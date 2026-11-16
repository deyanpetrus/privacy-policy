import GtfsRealtimeBindings from "npm:gtfs-realtime-bindings@1.1.1";
// LifeDashPro NEXT: Sofia / Zagreb GTFS-RT pilot, no changes to existing Sofia GPS or Fuel.
type Item=Record<string,unknown>;
const CORS={"access-control-allow-origin":"*","access-control-allow-headers":"authorization,apikey,content-type,x-client-info","access-control-allow-methods":"POST,OPTIONS"};
const out=(v:unknown,s=200)=>Response.json(v,{status:s,headers:{...CORS,"cache-control":"no-store"}});
class Fault extends Error{constructor(public status:number,message:string){super(message)}}
const base=()=>Deno.env.get("SUPABASE_URL")||"";
function getKey(kind:"public"|"secret"){const name=kind==="public"?"SUPABASE_ANON_KEY":"SUPABASE_SERVICE_ROLE_KEY";const legacy=Deno.env.get(name);if(legacy)return legacy;try{const obj=JSON.parse(Deno.env.get(kind==="public"?"SUPABASE_PUBLISHABLE_KEYS":"SUPABASE_SECRET_KEYS")||"{}");return String(obj.default||Object.values(obj)[0]||"")}catch{return ""}}
const iso=(v:unknown)=>typeof v==="string"&&Number.isFinite(Date.parse(v))?v:null;
const n=(v:unknown)=>v===undefined||v===null?null:Number.isFinite(Number(v))?Number(v):null;
const txt=(v:unknown,k=180)=>typeof v==="string"?v.slice(0,k):"";
function translated(m:any){const arr=m?.translation||[];return txt((arr.find((x:any)=>x.language==='bg'||x.language==='hr'||x.language==='en')||arr[0]||{}).text,600)}
async function auth(req:Request){const t=/^Bearer\s+([^\s]+)$/i.exec(req.headers.get("authorization")||"")?.[1]||"";const key=getKey("public");if(!t||t.startsWith("sb_")||!key||!base())throw new Fault(401,"User session required");const r=await fetch(base()+"/auth/v1/user",{headers:{apikey:key,authorization:"Bearer "+t},signal:AbortSignal.timeout(5000)});if(!r.ok||!(await r.json().catch(()=>null))?.id)throw new Fault(401,"Invalid session");return t}
async function guard(t:string){const k=getKey("public");const r=await fetch(base()+"/rest/v1/rpc/consume_user_rate_limit",{method:"POST",headers:{apikey:k,authorization:"Bearer "+t,"content-type":"application/json"},body:JSON.stringify({p_bucket:"transit-gtfsrt-balkan-pilot",p_limit:40,p_window_seconds:86400}),signal:AbortSignal.timeout(5000)});if(!r.ok)throw new Fault(503,"Quota unavailable");const z=await r.json().catch(()=>null);if((Array.isArray(z)?z[0]:z)?.allowed!==true)throw new Fault(429,"Pilot daily quota exceeded")}
async function cacheRead(key:string,secret:string){const r=await fetch(base()+"/rest/v1/next_transit_regional_cache_v1?select=payload,expires_at&cache_key=eq."+encodeURIComponent(key),{headers:{apikey:secret,authorization:"Bearer "+secret},signal:AbortSignal.timeout(3000)});if(!r.ok)return null;const a=await r.json().catch(()=>[]),x=a?.[0];return x&&Date.parse(x.expires_at)>Date.now()?x.payload:null}
async function cacheWrite(key:string,country:string,action:string,payload:unknown,secret:string){const now=Date.now();await fetch(base()+"/rest/v1/next_transit_regional_cache_v1?on_conflict=cache_key",{method:"POST",headers:{apikey:secret,authorization:"Bearer "+secret,"content-type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({cache_key:key,country,source_id:action,payload,fetched_at:new Date(now).toISOString(),expires_at:new Date(now+45000).toISOString()}),signal:AbortSignal.timeout(3000)})}
function normalizeTrip(pb:any,max=100){const updates=[];for(const entity of pb.entity||[]){const tr=entity.tripUpdate;if(!tr)continue;const t=tr.trip||{},stops=[];for(const su of (tr.stopTimeUpdate||[]).slice(0,50)){const arr=su.arrival||{},dep=su.departure||{};stops.push({stop_id:txt(su.stopId,80),stop_sequence:n(su.stopSequence),arrival_epoch:n(arr.time),departure_epoch:n(dep.time),arrival_delay_seconds:n(arr.delay),departure_delay_seconds:n(dep.delay),schedule_relationship:su.scheduleRelationship??null})}updates.push({trip_id:txt(t.tripId,100),route_id:txt(t.routeId,70),start_date:txt(t.startDate,20),schedule_relationship:t.scheduleRelationship??null,stop_updates:stops,reported_at_epoch:n(tr.timestamp),vehicle_id:txt(tr.vehicle?.id,70),source_entity_id:txt(entity.id,80)});if(updates.length>=max)break}return updates}
function normalizeVehicles(pb:any,max=130){const vehicles=[];for(const entity of pb.entity||[]){const v=entity.vehicle;if(!v?.position)continue;const lat=n(v.position.latitude),lon=n(v.position.longitude),time=n(v.timestamp);if(lat===null||lon===null||lat<45.6||lat>46.1||lon<15.5||lon>16.5)continue;vehicles.push({id:txt(v.vehicle?.id||entity.id,80),route_id:txt(v.trip?.routeId,80),trip_id:txt(v.trip?.tripId,100),lat,lon,timestamp_epoch:time,current_status:v.currentStatus??null,delay_minutes:null});if(vehicles.length>=max)break}return vehicles}
function normalizeAlerts(pb:any,max=75){const alerts=[];const now=Math.floor(Date.now()/1000);for(const e of pb.entity||[]){const a=e.alert;if(!a)continue;const periods=(a.activePeriod||[]).map((p:any)=>({start_epoch:n(p.start),end_epoch:n(p.end)}));if(periods.length&&!periods.some((p:any)=>(p.start_epoch===null||p.start_epoch<=now)&&(p.end_epoch===null||p.end_epoch>=now)))continue;alerts.push({id:txt(e.id,100),header:translated(a.headerText),description:translated(a.descriptionText),cause:a.cause??null,effect:a.effect??null,periods,affected:(a.informedEntity||[]).slice(0,20).map((x:any)=>({route_id:txt(x.routeId,70),stop_id:txt(x.stopId,70),trip_id:txt(x.trip?.tripId,80)})),url:translated(a.url)});if(alerts.length>=max)break}return alerts}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response("ok",{headers:CORS});
 try{
  if(req.method!=='POST')throw new Fault(405,"POST required");
  const token=await auth(req),q=await req.json().catch(()=>null);
  const country=txt(q?.country,2).toUpperCase(),city=txt(q?.city,20).toLowerCase(),action=txt(q?.action,25);
  if(country==='BG'&&city==='sofia'&&['trip-updates','alerts'].includes(action)){}
  else if(country==='HR'&&city==='zagreb'&&['trip-updates','vehicle-positions'].includes(action)){}
  else throw new Fault(400,"Supported: BG Sofia trip-updates/alerts; HR Zagreb trip-updates/vehicle-positions");
  const secret=getKey("secret");if(!secret||!base())throw new Fault(503,"Protected cache unavailable");
  const cacheKey="GTFSRT:"+country+":"+city+":"+action;
  const hit=await cacheRead(cacheKey,secret);if(hit)return out({...hit,cache:"HIT"});
  await guard(token);
  const url=country==='BG'?"https://gtfs.sofiatraffic.bg/api/v1/"+action:"https://zet.hr/gtfs-rt-protobuf";
  const response=await fetch(url,{headers:{Accept:"application/x-protobuf"},signal:AbortSignal.timeout(11000)});
  if(!response.ok)throw new Fault(503,"Official feed not available HTTP "+response.status);
  if(Number(response.headers.get("content-length")||0)>10000000)throw new Fault(503,"Provider feed too large");
  const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>10000000)throw new Fault(503,"Provider feed too large");
  let pb:any;try{pb=GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(bytes)}catch{throw new Fault(503,"Provider response not valid GTFS-RT protobuf")}
  const stamp=n(pb.header?.timestamp),now=Math.floor(Date.now()/1000),age=stamp===null?null:now-stamp;
  const recent=age!==null&&age>=-120&&age<=(country==='BG'?300:900);
  if(!recent)throw new Fault(503,"Provider feed timestamp absent or stale");
  let items:Item[];if(action==='alerts')items=normalizeAlerts(pb);else if(action==='vehicle-positions')items=normalizeVehicles(pb);else items=normalizeTrip(pb);
  const data={ok:true,pilot:true,country,city,action,source:country==='BG'?"Sofia Traffic official GTFS-RT":"ZET Zagreb GTFS-RT (TEST PURPOSE ONLY)",feed_timestamp_epoch:stamp,feed_age_seconds:age,quality:"CURRENT_GTFS_RT_FEED",count:items.length,items,requires_static_gtfs_join:action==='trip-updates',notice:"Trip delays are per trip/stop, NOT automatically a confirmed delay for every vehicle. Empty feed does not mean there are no disruptions.",attribution:country==='BG'?"© Sofia Municipality, CC BY 4.0":"© Zagrebački električni tramvaj d.o.o. — Open Licence Croatia"};
  await cacheWrite(cacheKey,country,city+"-"+action,data,secret).catch(()=>null);
  return out({...data,cache:"MISS"});
 }catch(e){return out({ok:false,error:e instanceof Fault?e.message:"GTFS-RT pilot unavailable"},e instanceof Fault?e.status:503)}
});export {};