// NEXT ONLY. Official Vienna OGD live departures; no changes to protected German road/navigation.
type Obj=Record<string,unknown>;
const CORS={"access-control-allow-origin":"*","access-control-allow-headers":"authorization,apikey,content-type,x-client-info","access-control-allow-methods":"POST,OPTIONS"};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{...CORS,"cache-control":"no-store"}});
class Err extends Error {constructor(public status:number,message:string){super(message)}}
const sbURL=()=>Deno.env.get("SUPABASE_URL")||"";
function key(kind:"pub"|"srv"){
 const legacy=Deno.env.get(kind==="pub"?"SUPABASE_ANON_KEY":"SUPABASE_SERVICE_ROLE_KEY");
 if(legacy)return legacy;
 try{const list=JSON.parse(Deno.env.get(kind==="pub"?"SUPABASE_PUBLISHABLE_KEYS":"SUPABASE_SECRET_KEYS")||"{}");return String(list.default||Object.values(list)[0]||"")}catch{return ""}
}
const txt=(v:unknown,cap=120)=>typeof v==="string"?v.slice(0,cap):"";
function dt(v:unknown){if(typeof v!=="string")return null;let s=v.replace(/([+-][0-9]{2})([0-9]{2})$/,"$1:$2");const t=Date.parse(s);return Number.isFinite(t)?new Date(t).toISOString():null}
async function auth(req:Request){
 const token=/^Bearer\s+([^\s]+)$/i.exec(req.headers.get("authorization")||"")?.[1]||"",pub=key("pub"),base=sbURL();
 if(!token||token.startsWith("sb_")||!pub||!base)throw new Err(401,"Signed in user required");
 const r=await fetch(base+"/auth/v1/user",{headers:{apikey:pub,authorization:"Bearer "+token},signal:AbortSignal.timeout(5500)});
 if(!r.ok||!(await r.json().catch(()=>null))?.id)throw new Err(401,"Invalid user session");
 return token;
}
async function rateLimit(token:string){
 const pub=key("pub");const r=await fetch(sbURL()+"/rest/v1/rpc/consume_user_rate_limit",{
 method:"POST",headers:{apikey:pub,authorization:"Bearer "+token,"content-type":"application/json"},
 body:JSON.stringify({p_bucket:"next-wiener-live-pilot-daily",p_limit:45,p_window_seconds:86400}),signal:AbortSignal.timeout(5000)});
 if(!r.ok)throw new Err(503,"Rate limit not available");
 const o=await r.json().catch(()=>null),v=Array.isArray(o)?o[0]:o;
 if(v?.allowed!==true)throw new Err(429,"Pilot daily quota reached");
}
async function getCache(cacheKey:string,secret:string){
 try{const r=await fetch(sbURL()+"/rest/v1/next_transit_regional_cache_v1?select=payload,expires_at&cache_key=eq."+encodeURIComponent(cacheKey),{
 headers:{apikey:secret,authorization:"Bearer "+secret},signal:AbortSignal.timeout(3500)});
 if(!r.ok)return null;const o=await r.json().catch(()=>[]),v=o?.[0];
 return v&&Date.parse(v.expires_at)>Date.now()?v.payload:null;
 }catch{return null}
}
async function putCache(cacheKey:string,payload:unknown,secret:string){
 const now=Date.now();
 await fetch(sbURL()+"/rest/v1/next_transit_regional_cache_v1?on_conflict=cache_key",{
 method:"POST",headers:{apikey:secret,authorization:"Bearer "+secret,"content-type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},
 body:JSON.stringify({cache_key:cacheKey,country:"AT",source_id:"wienerlinien-ogd",payload,fetched_at:new Date(now).toISOString(),expires_at:new Date(now+120000).toISOString()}),
 signal:AbortSignal.timeout(4000)
 });
}
function asDepartures(body:Obj,stopId:string){
 const rows:Obj[]=[],ms=Date.now();
 const monitors=(body?.data as any)?.monitors;
 if(!Array.isArray(monitors))throw new Err(502,"Wiener Linien response missing monitors");
 let stopName="";
 for(const mon of monitors){
  stopName=stopName||txt(mon?.locationStop?.properties?.title,130);
  for(const line of mon?.lines||[]){
   const lineName=txt(line?.name,35),dest=txt(line?.towards,120),platform=txt(line?.platform,40)||null;
   for(const dep of line?.departures?.departure||[]){
    const planned=dt(dep?.departureTime?.timePlanned),real=dt(dep?.departureTime?.timeReal);
    const plannedMs=planned?Date.parse(planned):NaN,realMs=real?Date.parse(real):NaN;
    if(!planned||plannedMs<ms-60000||plannedMs>ms+6*3600000)continue;
    const predicted=real||planned;
    const validPrediction=Boolean(real&&line?.realtimeSupported===true);
    const delay=Number.isFinite(realMs)?Math.round((realMs-plannedMs)/60000):null;
    rows.push({line:lineName,destination:dest,scheduled_at:planned,expected_at:predicted,
      delay_minutes:validPrediction?delay:null,platform,planned_platform:platform,stop_name:stopName,
      realtime:validPrediction,status:validPrediction?"LIVE":"SCHEDULED",cancelled:false,
      source:"Wiener Linien OGD"});
   }
  }
 }
 rows.sort((a:any,b:any)=>Date.parse(a.expected_at)-Date.parse(b.expected_at));
 return {stop_name:stopName,departures:rows.slice(0,20)};
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
 try{
  if(req.method!=="POST")throw new Err(405,"POST required");
  const token=await auth(req);
  const body=await req.json().catch(()=>null);
  if(!body||typeof body!=="object")throw new Err(400,"JSON object required");
  const action=txt(body.action,25)||"departures";
  if(action==="status")return reply({ok:true,pilot:true,country:"AT",provider:"Wiener Linien OGD",
    coverage:"Vienna city only",requires_key:false,kind:"DEPARTURE_BOARD",needs_stop_rbl:true});
  if(action!=="departures"||body.country!=="AT")throw new Err(400,"Country AT and departures action required");
  const stopId=txt(body.stop_id,12);
  if(!/^[1-9]\d{0,7}$/.test(stopId))throw new Err(400,"Numeric Wiener Linien RBL stop_id required");
  const secret=key("srv");if(!secret||!sbURL())throw new Err(503,"Private cache unavailable");
  const cacheKey="AT:WL-OGD:STOP:"+stopId;
  const cached=await getCache(cacheKey,secret);
  if(cached&&typeof cached==="object")return reply({...cached,cache:"HIT"});
  await rateLimit(token);
  const upstreamURL="https://www.wienerlinien.at/ogd_realtime/monitor?stopId="+encodeURIComponent(stopId);
  const u=await fetch(upstreamURL,{headers:{accept:"application/json","user-agent":"LifeDashProNEXT-WienerPilot/1.0 (https://mkdigital.app/)"},signal:AbortSignal.timeout(9000)});
  if(!u.ok)throw new Err(502,"Official Vienna provider not available (HTTP "+u.status+")");
  if(Number(u.headers.get("content-length")||0)>550000)throw new Err(502,"Upstream response too large");
  const data=await u.json().catch(()=>null);
  if(!data||typeof data!=="object")throw new Err(502,"Invalid Vienna data");
  const x=asDepartures(data,stopId);
  const result={ok:true,pilot:true,country:"AT",region:"Vienna",source:"Wiener Linien OGD",
    source_url:"https://www.wienerlinien.at/ogd_realtime/",attribution:"Wiener Linien · Stadt Wien Open Government Data",
    station:stopId,stop_name:x.stop_name,departure_count:x.departures.length,departures:x.departures,
    updated_at:new Date().toISOString(),cache_ttl_seconds:120,
    warning:"Vienna only, exact Wiener Linien stop RBL ID. TimeReal is a provider prediction. Do not claim this covers all Austrian cities."};
  await putCache(cacheKey,result,secret).catch(()=>null);
  return reply({...result,cache:"MISS"});
 }catch(e){return reply({ok:false,error:e instanceof Err?e.message:"Vienna provider request failed"},e instanceof Err?e.status:503)}
});export {};