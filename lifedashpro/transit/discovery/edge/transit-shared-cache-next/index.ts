// LifeDashPro NEXT only. Shared server-side read-through cache for Transit; no legacy function changes.
// Frontend calls this with same POST actions as transit-schedule. Service-only cache is in dedicated Transit DB.
// Cache is NEVER client writable; no direct external URLs; no user identity, search text, or precise GPS is stored.
type AnyObject=Record<string,unknown>;
const CORS={
 "access-control-allow-origin":"*",
 "access-control-allow-headers":"authorization,apikey,content-type,x-client-info",
 "access-control-allow-methods":"POST,OPTIONS"
};
const DEDICATED_RPC="https://gnqtngtuzbxohgwgvmpb.supabase.co/rest/v1/rpc/";
const CACHE_VERSION="ldp-transit-shared-v1";
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{...CORS,"cache-control":"private, no-store"}});
class Fault extends Error{code:number;constructor(code:number,msg:string){super(msg);this.code=code}}
function publicKey():string {
 const legacy=Deno.env.get("SUPABASE_ANON_KEY");if(legacy)return legacy;
 try{const v=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}");return String(v.default||"");}
 catch{return "";}
}
function obj(v:unknown):AnyObject {return v&&typeof v==="object"&&!Array.isArray(v)?v as AnyObject:{}}
function str(v:unknown,max=180){return typeof v==="string"?v.trim().slice(0,max):""}
function pos(v:unknown,min:number,max:number,name:string){
 const n=Number(v);
 if(v===undefined||v===null||v===""||!Number.isFinite(n)||n<min||n>max)throw new Fault(400,"Invalid "+name);
 return n;
}
function bounded(v:unknown,def:number,min:number,max:number){
 const n=Number(v);return !Number.isFinite(n)||v===null||v===undefined?def:Math.max(min,Math.min(max,Math.trunc(n)));
}
function round(v:number,d=4){return Number(v.toFixed(d))}
function latLon(b:AnyObject,latField:string,lonField:string){
 return {lat:round(pos(b[latField],-90,90,latField)),lon:round(pos(b[lonField],-180,180,lonField))};
}
function normalized(raw:unknown){
 const b=obj(raw), action=str(b.action,32)||"nearby",country=str(b.country,2).toUpperCase();
 if(!["nearby","departures","trip","journey","providers","cache-status","motis-diagnostic"].includes(action))
   throw new Fault(400,"Unsupported action");
 if(!/^[A-Z]{2}$/.test(country)&&!["providers","cache-status"].includes(action))
   throw new Fault(400,"Country code required");
 if(action==="nearby"){
   const {lat,lon}=latLon(b,"lat","lon");
   const radiusM=Math.round(bounded(b.radiusM,5000,300,15000)/100)*100;
   return {action,country,lat,lon,radiusM,limit:bounded(b.limit,30,1,40)};
 }
 if(action==="departures"){
   const {lat,lon}=Number.isFinite(Number(b.lat))&&Number.isFinite(Number(b.lon))
     ?latLon(b,"lat","lon"):{lat:undefined,lon:undefined};
   const stopId=str(b.stopId,180),feedSource=str(b.feedSource,80);
   if(!stopId&&(lat===undefined||lon===undefined))throw new Fault(400,"Stop id or coordinates required");
   return {action,country,stopId,lat,lon,feedSource,
     duration:bounded(b.duration,90,30,180)};
 }
 if(action==="trip"){
   const tripId=str(b.tripId,200);if(!tripId)throw new Fault(400,"Trip id required");
   return {action,country,tripId,routeId:str(b.routeId,180),lineName:str(b.lineName,140),
       providerId:str(b.providerId,90),feedSource:str(b.feedSource,90)};
 }
 if(action==="journey"||action==="motis-diagnostic"){
   const origin=latLon(b,"fromLat","fromLon");
   const dest=latLon(b,"toLat","toLon");
   const departureDate=b.departure?new Date(String(b.departure)):new Date();
   if(!Number.isFinite(departureDate.getTime()))throw new Fault(400,"Invalid departure");
   // Do not store or log personal itinerary or raw address strings. Actual journeys are never cached.
   return {action,country,fromLat:origin.lat,fromLon:origin.lon,
       toLat:dest.lat,toLon:dest.lon,departure:departureDate.toISOString(),
       radiusM:bounded(b.radiusM,6500,1000,12000),limit:bounded(b.limit,5,2,8)};
 }
 return {action,country};
}
async function authenticate(req:Request){
 const jwt=/^Bearer\s+([^\s]+)$/i.exec(req.headers.get("authorization")||"")?.[1]||"";
 if(!jwt||jwt.startsWith("sb_"))throw new Fault(401,"Sign in required");
 const origin=Deno.env.get("SUPABASE_URL")||"",key=publicKey();
 if(!origin||!key)throw new Fault(503,"Auth not configured");
 const headers={apikey:key,authorization:"Bearer "+jwt,accept:"application/json"};
 const user=await fetch(origin+"/auth/v1/user",{headers,signal:AbortSignal.timeout(5500)});
 const record=user.ok?await user.json().catch(()=>null):null;
 if(!record?.id)throw new Fault(401,"Session invalid");
 const limiter=await fetch(origin+"/rest/v1/rpc/consume_user_rate_limit",{
   method:"POST",headers:{...headers,"content-type":"application/json"},
   body:JSON.stringify({p_bucket:"transit-shared-cache-next",p_limit:40,p_window_seconds:60}),
   signal:AbortSignal.timeout(5500)});
 const v=limiter.ok?await limiter.json().catch(()=>null):null;
 const p=Array.isArray(v)?v[0]:v;
 if(!limiter.ok)throw new Fault(503,"Rate limiter unavailable");
 if(p?.allowed!==true)throw new Fault(429,"Too many requests");
 return {origin,key,jwt};
}
async function hashedKey(bucket:string,request:AnyObject){
 const stable=JSON.stringify({v:CACHE_VERSION,bucket,request});
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(stable));
 return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,"0")).join("");
}
async function cacheRpc(fn:string,body:AnyObject){
 const secret=Deno.env.get("LDP_DEDICATED_TRANSIT_SERVICE_ROLE_KEY")||"";
 if(!secret)throw new Error("CACHE_SERVICE_NOT_CONFIGURED");
 const headers:Record<string,string>={apikey:secret,accept:"application/json","content-type":"application/json"};
 if(secret.startsWith("eyJ"))headers.authorization="Bearer "+secret;
 const res=await fetch(DEDICATED_RPC+fn,{
   method:"POST",headers,body:JSON.stringify(body),signal:AbortSignal.timeout(4500)});
 if(!res.ok)throw new Error("CACHE_RPC_"+res.status);
 return res.json();
}
function allowedField(row:unknown,fields:string[]){
 const x=obj(row),out:AnyObject={};
 for(const name of fields){
   const v=x[name];
   if(typeof v==="string")out[name]=v.slice(0,260);
   else if(typeof v==="number"&&Number.isFinite(v))out[name]=v;
   else if(typeof v==="boolean"||v===null)out[name]=v;
   else if(Array.isArray(v)&&v.length<=60&&v.every(z=>typeof z==="string"))
     out[name]=v.map(z=>String(z).slice(0,120));
 }
 return out;
}
const STOP_FIELDS=["id","name","lat","lon","distanceM","lines","code","platform","mode",
  "providerId","provider","feedSource","sourceKind","quality","stopId","type"];
const DEP_FIELDS=["id","stopId","routeId","tripId","line","direction","mode","realtimeTime",
 "scheduledTime","localTime","plannedLocalTime","delayMinutes","realtime","cancelled",
 "providerId","provider","sourceKind","quality","status","platform","headsign"];
const TRIP_FIELDS=["id","tripId","line","direction","mode","origin","destination",
 "startTime","endTime","provider","providerId","geometryKind","approximate"];
function cacheablePayload(kind:string,result:AnyObject){
 if(result.ok!==true)return null;
 const base:AnyObject={ok:true,country:str(result.country,2),providerId:str(result.providerId,100),
   provider:str(result.provider,180),quality:str(result.quality,40),
   sourceUrl:str(result.sourceUrl,250),generatedAt:new Date().toISOString()};
 if(kind==="nearby"){
   const stops=Array.isArray(result.stops)?result.stops:[];
   if(!stops.length)return null;
   base.stops=stops.slice(0,40).map(x=>allowedField(x,STOP_FIELDS));
 }else if(kind==="departures"){
   const departures=Array.isArray(result.departures)?result.departures:[];
   if(!departures.length)return null;
   base.departures=departures.slice(0,55).map(x=>allowedField(x,DEP_FIELDS));
   if(result.stop)base.stop=allowedField(result.stop,STOP_FIELDS);
 }else if(kind==="trip"){
   const route=obj(result.route);if(!route.id&&!route.tripId)return null;
   const safe=allowedField(route,TRIP_FIELDS);
   if(Array.isArray(route.points))safe.points=route.points.slice(0,1500).map(x=>allowedField(x,["lat","lon"]));
   if(Array.isArray(route.stops))safe.stops=route.stops.slice(0,120).map(x=>
     allowedField(x,["id","name","lat","lon","arrivalTime","departureTime","platform"]));
   base.route=safe;
 }else return null;
 const bytes=new TextEncoder().encode(JSON.stringify(base)).length;
 return bytes<=65536?base:null;
}
function ttlSeconds(action:string,data:AnyObject){
 if(action==="nearby"){
   // Only our owned de-national GTFS subset gets a full 24 hours; external source rights/freshness vary.
   const own=data.providerId==="de-national"||String(data.providerId||"").startsWith("de-gtfs");
   return {ttl:own?86400:3600,stale:own?7200:0};
 }
 if(action==="trip")return {ttl:data.providerId==="de-national"?21600:1200,stale:0};
 if(action==="departures"){
   const dep=Array.isArray(data.departures)?data.departures:[];
   const live=dep.some(x=>obj(x).realtime===true||obj(x).quality==="live");
   return {ttl:live?15:45,stale:0};
 }
 return {ttl:0,stale:0};
}
async function invokeExisting(a:{origin:string,key:string,jwt:string},body:AnyObject){
 const res=await fetch(a.origin+"/functions/v1/transit-schedule",{
   method:"POST",
   headers:{apikey:a.key,authorization:"Bearer "+a.jwt,"content-type":"application/json"},
   body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 const raw=await res.text();
 if(raw.length>1_400_000)throw new Fault(502,"Transit response exceeds safe limit");
 const parsed=JSON.parse(raw);
 return {ok:res.ok,status:res.status,body:obj(parsed)};
}
Deno.serve(async (req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
 if(req.method!=="POST")return response({ok:false,error:"Method not allowed"},405);
 try{
   const auth=await authenticate(req);
   const normalizedRequest=normalized(await req.json().catch(()=>{throw new Fault(400,"Bad JSON")}));
   const action=String(normalizedRequest.action);
   const usesCache=["nearby","departures","trip"].includes(action);
   const bucket=action;
   let key="";
   let stale:AnyObject|null=null;
   if(usesCache){
     const keyRequest:AnyObject={...normalizedRequest};
     // Departure boards depend on the current moment; avoid reusing old timetables later in the hour.
     if(action==="departures")keyRequest.timeWindow=Math.floor(Date.now()/60000);
     key=await hashedKey(bucket,keyRequest);
     try{
       const results=await cacheRpc("transit_shared_cache_read_v1",{p_bucket:bucket,p_key:key});
       const row=Array.isArray(results)?results[0]:null;
       if(row?.payload&&row.is_fresh===true){
         return response({...obj(row.payload),sharedCache:{hit:true,stale:false,
            expiresAt:row.expires_at,source:"supabase-transit-shared"}});
       }
       if(action==="nearby"&&row?.payload&&row.is_fresh===false)stale=obj(row.payload);
     }catch(_ignored){/* Supabase cache outage MUST NOT block API fallback. */}
   }
   // Existing server is authoritative for provider selection, fallback, and journey planning.
   const upstream=await invokeExisting(auth,normalizedRequest);
   if(upstream.ok&&upstream.body.ok===true){
     if(usesCache){
       const safe=cacheablePayload(action,upstream.body);
       const policy=ttlSeconds(action,upstream.body);
       if(safe&&policy.ttl>0){
         try{
           await cacheRpc("transit_shared_cache_store_v1",{
             p_bucket:bucket,p_key:key,p_payload:safe,p_ttl_seconds:policy.ttl,
             p_provider:str(upstream.body.providerId,80)||"unknown",
             p_stale_grace_seconds:policy.stale});
         }catch(_ignored){/* Preserve provider result when cache quota/DB unavailable. */}
       }
       // Do not turn an empty response into long-lived negative cache.
       if(action==="nearby"&&stale&&(!Array.isArray(upstream.body.stops)||upstream.body.stops.length===0)){
         return response({...stale,sharedCache:{hit:true,stale:true,
           warning:"Showing cached stop information only; live source returned no stops."}});
       }
     }
     return response({...upstream.body,sharedCache:{hit:false,stale:false,source:"provider-api"}});
   }
   if(stale&&upstream.status>=500)return response({...stale,sharedCache:{hit:true,stale:true,
      warning:"Live provider unavailable; showing potentially outdated stops."}});
   return response(upstream.body,upstream.status);
 }catch(e){
   return response({ok:false,error:e instanceof Fault?e.message:"Transit shared cache temporarily unavailable"},
     e instanceof Fault?e.code:503);
 }
});
