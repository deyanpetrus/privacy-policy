// LifeDashPro NEXT only — optional Abfahrt departures provider.
// Fail closed until ABFAHRT_API_ENABLED=true and an approved ABFAHRT_API_KEY is supplied.
// This function is additive; no changes to Germany Road Live, existing Transit or Navigator.
type O=Record<string,unknown>;
const CORS={"access-control-allow-origin":"*","access-control-allow-headers":"authorization,apikey,content-type,x-client-info","access-control-allow-methods":"POST,OPTIONS"};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{...CORS,"cache-control":"no-store"}});
class Failure extends Error{constructor(public status:number,message:string){super(message)}}
const url=()=>Deno.env.get("SUPABASE_URL")||"";
function sbKey(kind:"public"|"secret"){
  const legacy=Deno.env.get(kind==="public"?"SUPABASE_ANON_KEY":"SUPABASE_SERVICE_ROLE_KEY");
  if(legacy)return legacy;
  try{const obj=JSON.parse(Deno.env.get(kind==="public"?"SUPABASE_PUBLISHABLE_KEYS":"SUPABASE_SECRET_KEYS")||"{}");return String(obj.default||Object.values(obj)[0]||"")}catch{return ""}
}
const tokenFrom=(req:Request)=>/^Bearer\s+([^\s]+)$/i.exec(req.headers.get("authorization")||"")?.[1]||"";
async function userSession(req:Request){
 const token=tokenFrom(req),key=sbKey("public");if(!token||token.startsWith("sb_")||!url()||!key)throw new Failure(401,"Signed-in user required");
 const r=await fetch(url()+"/auth/v1/user",{headers:{apikey:key,authorization:"Bearer "+token},signal:AbortSignal.timeout(5000)});
 if(!r.ok||!(await r.json().catch(()=>null))?.id)throw new Failure(401,"Invalid user session");
 return token;
}
async function clientThrottle(token:string){
 const key=sbKey("public");
 const r=await fetch(url()+"/rest/v1/rpc/consume_user_rate_limit",{
 method:"POST",headers:{apikey:key,authorization:"Bearer "+token,"content-type":"application/json"},
 body:JSON.stringify({p_bucket:"next-abfahrt-request-v1",p_limit:10,p_window_seconds:60}),signal:AbortSignal.timeout(5000)});
 if(!r.ok)throw new Failure(503,"Client rate limiter unavailable");
 const v=await r.json().catch(()=>null),row=Array.isArray(v)?v[0]:v;
 if(row?.allowed!==true)throw new Failure(429,"Too many requests; try later");
}
async function cacheRead(cacheKey:string,secret:string){
 try{const r=await fetch(url()+"/rest/v1/next_abfahrt_cache_v1?select=payload,expires_at&cache_key=eq."+encodeURIComponent(cacheKey),{
 headers:{apikey:secret,authorization:"Bearer "+secret},signal:AbortSignal.timeout(4000)});
 if(!r.ok)return null;const rows=await r.json().catch(()=>[]),item=rows?.[0];
 return item&&Date.parse(item.expires_at)>Date.now()?item.payload:null
 }catch{return null}
}
async function reserveRequest(secret:string){
 const r=await fetch(url()+"/rest/v1/rpc/reserve_next_abfahrt_free_v1",{method:"POST",
 headers:{apikey:secret,authorization:"Bearer "+secret,"content-type":"application/json"},body:"{}",signal:AbortSignal.timeout(5000)});
 if(!r.ok)throw new Failure(503,"Global request budget unavailable");
 const n=Number(await r.json().catch(()=>NaN));if(!Number.isFinite(n))throw new Failure(503,"Invalid budget response");
 if(n<0)throw new Failure(429,"Shared free-tier daily budget exhausted");
 return n
}
async function cacheWrite(cacheKey:string,payload:unknown,secret:string){
 const now=Date.now();const r=await fetch(url()+"/rest/v1/next_abfahrt_cache_v1?on_conflict=cache_key",{
 method:"POST",headers:{apikey:secret,authorization:"Bearer "+secret,"content-type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},
 body:JSON.stringify({cache_key:cacheKey,payload,fetched_at:new Date(now).toISOString(),expires_at:new Date(now+10*60000).toISOString()}),signal:AbortSignal.timeout(4000)});
 return r.ok;
}
const str=(v:unknown,n=120)=>typeof v==="string"?v.slice(0,n):"";
const num=(v:unknown)=>typeof v==="number"&&Number.isFinite(v)?v:null;
function normalize(data:O,asOf:number){
 const entries=Array.isArray(data.departures)?data.departures:[];
 const departures=[];for(const x of entries){
  if(!x||typeof x!=="object")continue;const d=x as O;
  const epoch=num(d.timestamp);if(epoch===null||epoch*1000<asOf-60000||epoch*1000>asOf+6*3600000)continue;
  departures.push({line:str(d.line,48),direction:str(d.direction,120),station:str(d.station,120),
   station_distance_m:num(d.stationDistance),scheduled_or_expected_at:new Date(epoch*1000).toISOString(),
   platform:str(d.platform,32)||null,delay_minutes:num(d.delay),cancelled:d.cancelled===true,
   mode:str(d.mode,22),occupancy:str(d.occupancy,12)||null,
   quality:data.realtime===true?"REALTIME_AVAILABLE_AT_REGION":"SCHEDULED_OR_UNKNOWN"});
  if(departures.length>=20)break
 }
 return {ok:true,provider:"Abfahrt!",region:str(data.region,120),city:str(data.city,100),
  provider_realtime_available:data.realtime===true,attribution:str(data.attribution,500),
  fetched_at:new Date(asOf).toISOString(),cache_ttl_seconds:600,
  departures,departure_count:departures.length,
  warning:"Realtime is a provider-level availability flag, not proof that every departure is predicted. Show source attribution verbatim."};
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
 try{
  if(req.method!=="POST")throw new Failure(405,"POST required");
  const token=await userSession(req);
  const body=await req.json().catch(()=>null);
  if(!body||typeof body!=="object")throw new Failure(400,"JSON request required");
  if(body.action==="status")return json({ok:true,provider:"Abfahrt!",configured:!!Deno.env.get("ABFAHRT_API_KEY"),
      enabled:Deno.env.get("ABFAHRT_API_ENABLED")==="true"&&!!Deno.env.get("ABFAHRT_API_KEY"),
      requires_approved_usage:true,quota_per_day:60});
  const lat=num(body.lat),lon=num(body.lon);
  if(lat===null||lon===null||lat<-90||lat>90||lon<-180||lon>180)throw new Failure(400,"Valid lat/lon required");
  if(body.action!=="departures")throw new Failure(400,"Action departures required");
  if(Deno.env.get("ABFAHRT_API_ENABLED")!=="true"||!Deno.env.get("ABFAHRT_API_KEY"))
    return json({ok:false,provider:"Abfahrt!",error:"API_KEY_OR_PERMISSION_NOT_CONFIGURED",enabled:false},503);
  const secret=sbKey("secret");if(!secret||!url())throw new Failure(503,"Private cache unavailable");
  await clientThrottle(token);
  const radius=typeof body.radius==="number"&&Number.isFinite(body.radius)?Math.max(250,Math.min(1500,Math.round(body.radius))):900;
  const mode=typeof body.mode==="string"&&/^(subway|suburban|tram|bus|ferry|regional|express)$/.test(body.mode)?body.mode:"";
  const snappedLat=Math.round(lat*1000)/1000,snappedLon=Math.round(lon*1000)/1000;
  const cacheKey=["ABFAHRT-V1",snappedLat.toFixed(3),snappedLon.toFixed(3),radius,mode||"all"].join(":");
  const hit=await cacheRead(cacheKey,secret);
  if(hit&&typeof hit==="object"){
    const obj=hit as O,departures=Array.isArray(obj.departures)?obj.departures:[];
    const fresh=departures.filter((d:any)=>Date.parse(d.scheduled_or_expected_at)>Date.now()-60000);
    return json({...obj,departures:fresh,departure_count:fresh.length,cache:"HIT"});
  }
  const remaining=await reserveRequest(secret);
  const apiUrl=new URL("https://api.abfahrt.now/departures");
  apiUrl.searchParams.set("lat",String(snappedLat));apiUrl.searchParams.set("lon",String(snappedLon));
  apiUrl.searchParams.set("radius",String(radius));apiUrl.searchParams.set("limit","20");
  if(mode)apiUrl.searchParams.set("mode",mode);
  const resp=await fetch(apiUrl,{headers:{"x-api-key":Deno.env.get("ABFAHRT_API_KEY")||"",accept:"application/json"},
   signal:AbortSignal.timeout(10000)});
  if(resp.status===429)throw new Failure(429,"Abfahrt upstream daily limit reached");
  if(resp.status===401||resp.status===403)throw new Failure(503,"Abfahrt API key rejected or access not granted");
  if(!resp.ok)throw new Failure(502,"Abfahrt provider temporarily unavailable");
  if(Number(resp.headers.get("content-length")||0)>500000)throw new Failure(502,"Abfahrt response too large");
  const raw=await resp.json().catch(()=>null);
  if(!raw||typeof raw!=="object"||!Array.isArray(raw.departures))throw new Failure(502,"Abfahrt invalid response");
  const value=normalize(raw,Date.now());
  await cacheWrite(cacheKey,value,secret).catch(()=>null);
  return json({...value,cache:"MISS",shared_budget_remaining:remaining})
 }catch(e){return json({ok:false,provider:"Abfahrt!",error:e instanceof Failure?e.message:"Regional departures unavailable"},
    e instanceof Failure?e.status:503)}
});
export {};
