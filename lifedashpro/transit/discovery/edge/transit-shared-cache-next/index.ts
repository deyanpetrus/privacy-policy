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
const CACHE_VERSION="ldp-transit-unified-v4-quality-geo-20261115";
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
   const mode=str(b.mode,16).toLowerCase()||"all";
   if(!["all","bus","tram","train","rail","sbahn","subway","metro","ferry"].includes(mode))throw new Fault(400,"Invalid mode");
   return {action,country,lat,lon,radiusM,mode,limit:bounded(b.limit,30,1,40)};
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
   // Partial 1-7 stop extracts are NOT complete local coverage: retry APIs frequently.
   const n=Array.isArray(data.stops)?data.stops.length:0;
   if(own&&n<8)return {ttl:120,stale:0};
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

/** NEXT-only: the compact rural bus cache covers a bounded Bavarian region.
 *  Outside it, continue countrywide Transitland/DB API fallback without calling H3.
 *  A sample of 2 national rail stops MUST NOT suppress real local buses.
 */
function isGermanRuralArea(r:AnyObject):boolean{
 const lat=Number(r.lat),lon=Number(r.lon);
 return r.country==="DE"&&Number.isFinite(lat)&&Number.isFinite(lon)&&
   lat>=48.62&&lat<=49.15&&lon>=11.42&&lon<=12.08;
}
async function germanRuralBusStops(a:{origin:string,key:string,jwt:string},r:AnyObject):Promise<AnyObject[]>{
 if(!isGermanRuralArea(r))return [];
 try{
   const radius=bounded(r.radiusM,6000,500,12000);
   const res=await fetch(a.origin+"/functions/v1/transit-de-bus-h3",{
     method:"POST",
     headers:{apikey:a.key,authorization:"Bearer "+a.jwt,"content-type":"application/json"},
     body:JSON.stringify({action:"nearby",country:"DE",mode:"bus",
       lat:r.lat,lon:r.lon,radiusM:radius}),
     signal:AbortSignal.timeout(9000)
   });
   if(!res.ok)return [];
   const data=await res.json().catch(()=>null);
   if(data?.ok!==true||!Array.isArray(data.stops))return [];
   const normalized:AnyObject[]=[];
   for(const x of data.stops.slice(0,40)){
     const id=str(x?.stop_id||x?.id,180),name=str(x?.name,220),
       lat=Number(x?.lat),lon=Number(x?.lon),distanceM=Number(x?.distance_m??x?.distanceM);
     if(!id||!name||!Number.isFinite(lat)||!Number.isFinite(lon)
       ||!Number.isFinite(distanceM)||distanceM<0||distanceM>radius)continue;
     normalized.push({id,name,lat,lon,distanceM,
       lines:Array.isArray(x.lines)?x.lines.filter((v:unknown)=>typeof v==="string").slice(0,75):[],
       platform:str(x.platform,60)||undefined,
       mode:"bus",providerId:"de-bus-h3",feedSource:"de-bus-h3",
       provider:"GTFS.de rural bus subset",sourceKind:"official-gtfs",quality:"scheduled"});
   }
   return normalized;
 }catch(_ignored){return [];}
}
function mergedGermanStops(base:AnyObject,rural:AnyObject[],limit:number):AnyObject[]{
 const prev=Array.isArray(base.stops)?base.stops:[];
 const out:AnyObject[]=[];
 for(const candidate of [...rural,...prev]){
   const x=obj(candidate),name=str(x.name,220),lat=Number(x.lat),lon=Number(x.lon);
   if(!name||!Number.isFinite(lat)||!Number.isFinite(lon))continue;
   const near=out.findIndex(item=>{
     const dlat=Math.abs(Number(item.lat)-lat),dlon=Math.abs(Number(item.lon)-lon);
     return str(item.name,220).toLocaleLowerCase()===name.toLocaleLowerCase() &&
       dlat<0.00065&&dlon<0.0008;
   });
   if(near>=0){
     const current=out[near];
     current.lines=Array.from(new Set([...(Array.isArray(current.lines)?current.lines:[]),
       ...(Array.isArray(x.lines)?x.lines:[])]));
     // Preserve our dedicated GTFS stop id when known so its timetable endpoint remains routable.
     if(x.providerId==="de-bus-h3")out[near]={...current,...x,
       lines:current.lines};
   }else out.push({...x});
 }
 const dist=(x:AnyObject)=>Number.isFinite(Number(x.distanceM))?Number(x.distanceM):999999;
 out.sort((a,b)=>dist(a)-dist(b));
 return out.slice(0,limit);
}
function includeVerifiedGermanRuralStops(base:AnyObject,rural:AnyObject[],limit:number):AnyObject{
 if(!rural.length)return base;
 const original=Array.isArray(base.stops)?base.stops:[];
 const merged=mergedGermanStops(base,rural,limit);
 const mixed=original.length>0;
 return {...base,ok:true,country:"DE",stops:merged,providerId:mixed?"de-mixed":"de-bus-h3",
   provider:mixed?str(base.provider,110)+" + GTFS.de rural buses":"GTFS.de rural bus subset",
   quality:"scheduled",
   sourceUrl:"https://gtfs.de/en/feeds/de_nv/",
   coverageHint:"local-scheduled-buses-combined-with-countrywide-api-fallback"};
}


/* NEXT Unified Transit Engine v4: reuse existing auth, rate limiting, v3 GTFS/API paths.
 * No new public tables, exact addresses, user IDs, or service-role keys enter shared rows.
 */
const QUALITY_OK=55;
const GEO_GRID=1000; // ~110m latitude cells; country+radius+mode+limit remain in SHA256 key
function distanceMeters(a:number,b:number,c:number,d:number):number{
 const p=Math.PI/180,dl=(c-a)*p,da=(d-b)*p;
 const t=Math.sin(dl/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(da/2)**2;
 return 12742000*Math.asin(Math.sqrt(Math.min(1,Math.max(0,t))));
}
function selectedMode(x:AnyObject,mode:string):boolean{
 if(mode==="all")return true;
 const m=str(x.mode,40).toLowerCase();
 if(!m||m==="all"||m==="unknown")return false;
 if(mode==="bus")return m==="bus"||m==="coach";
 if(mode==="train"||mode==="rail")return ["rail","train","regional","long_distance","suburban","sbahn"].includes(m);
 if(mode==="sbahn")return ["sbahn","suburban"].includes(m);
 if(mode==="subway"||mode==="metro")return m==="subway"||m==="metro"||m==="u-bahn";
 return m===mode;
}
function reformStops(base:AnyObject,req:AnyObject):AnyObject{
 if(req.action!=="nearby")return base;
 const radius=Number(req.radiusM),limit=bounded(req.limit,30,1,40),mode=String(req.mode||"all");
 const lat=Number(req.lat),lon=Number(req.lon);
 if(!Array.isArray(base.stops)||!Number.isFinite(lat)||!Number.isFinite(lon))return base;
 const out:AnyObject[]=[];
 for(const raw of base.stops){
   const x=obj(raw),slat=Number(x.lat),slon=Number(x.lon);
   if(!Number.isFinite(slat)||!Number.isFinite(slon)||!selectedMode(x,mode))continue;
   const d=Math.round(distanceMeters(lat,lon,slat,slon));
   if(d>radius)continue;
   out.push({...x,distanceM:d});
 }
 out.sort((a,b)=>Number(a.distanceM)-Number(b.distanceM));
 return {...base,stops:out.slice(0,limit)};
}
function coverageScore(base:AnyObject,req:AnyObject):number{
 if(req.action==="departures"){
   const x=Array.isArray(base.departures)?base.departures:[];
   return x.length?Math.min(96,65+x.length*2):0;
 }
 if(req.action==="trip")return obj(base.route).id||obj(base.route).tripId?80:0;
 if(req.action!=="nearby")return 0;
 const x=Array.isArray(base.stops)?base.stops:[];
 const close=x.filter(z=>Number(obj(z).distanceM)<=3000);
 const near=x.filter(z=>Number(obj(z).distanceM)<=1500);
 if(!close.length)return 0;
 const withLines=near.filter(z=>Array.isArray(obj(z).lines)&&obj(z).lines.length>0).length;
 const sources=new Set(near.map(z=>str(obj(z).providerId,80)).filter(Boolean));
 const rail=String(req.mode||"all").match(/^(rail|train|sbahn|subway|metro)$/);
 const enough=rail?2:6;
 const result=10+Math.min(56,near.length*(rail?13:7))+Math.min(18,withLines*3)+Math.min(16,sources.size*7);
 return Math.min(100,Math.round(near.length<enough?Math.min(result,54):result));
}
function chooseCanonical(req:AnyObject):AnyObject{
 if(req.action!=="nearby"||req.country!=="DE")return req;
 // Query slightly beyond cell edge, so a nearby stop is not lost when moving ~100m.
 return {...req,lat:Math.round(Number(req.lat)*GEO_GRID)/GEO_GRID,
   lon:Math.round(Number(req.lon)*GEO_GRID)/GEO_GRID,
   radiusM:Math.min(15000,Number(req.radiusM)+200),limit:40};
}
function cacheKeyRequest(req:AnyObject):AnyObject{
 if(req.action!=="nearby"||req.country!=="DE")return {...req};
 // The actual user GPS is never stored in shared cache keys.
 return {...req,lat:Math.round(Number(req.lat)*GEO_GRID)/GEO_GRID,
   lon:Math.round(Number(req.lon)*GEO_GRID)/GEO_GRID};
}
function cachePolicy(kind:string,result:AnyObject,score:number){
 if(kind==="nearby"){
   if(score<QUALITY_OK)return {ttl:120,stale:0};
   const ids=(Array.isArray(result.stops)?result.stops:[]).map(s=>str(obj(s).providerId,50)).filter(Boolean);
   const exclusiveOwn=ids.length>0&&ids.every(id=>id==="de-national"||id==="de-bus-h3"||id.startsWith("de-gtfs"));
   return {ttl:exclusiveOwn?86400:3600,stale:exclusiveOwn?7200:0};
 }
 if(kind==="departures"){
   const live=Array.isArray(result.departures)&&result.departures.some(x=>obj(x).realtime===true||obj(x).quality==="live");
   return {ttl:live?15:45,stale:0};
 }
 return {ttl:1200,stale:0};
}
function berlinNowParts(){
 const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Berlin",
   year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",
   hourCycle:"h23"}).formatToParts(new Date());
 const x:Record<string,string>={};for(const p of parts)x[p.type]=p.value;
 return Date.UTC(Number(x.year),Number(x.month)-1,Number(x.day),Number(x.hour),Number(x.minute));
}
function h3ScheduledDepartures(boards:unknown,durationMinutes:number,stopId:string):AnyObject[]{
 const nowLocal=berlinNowParts();
 const list:AnyObject[]=[];
 for(const board of Array.isArray(boards)?boards:[]){
   const x=obj(board),day=str(x.service_date,10);
   if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Array.isArray(x.payload))continue;
   const base=Date.parse(day+"T00:00:00Z");
   if(!Number.isFinite(base))continue;
   for(const raw of x.payload){
     const item=obj(raw),secs=Number(item.departureSecs),tripId=str(item.tripId,130);
     if(!Number.isFinite(secs)||secs<0||secs>172799||!tripId)continue;
     const dtime=base+secs*1000,mins=(dtime-nowLocal)/60000;
     if(mins< -1||mins>durationMinutes)continue;
     const date=new Date(dtime).toISOString().slice(0,19);
     const time=date.slice(11,16),line=str(item.line,80)||"—";
     list.push({id:"de-bus-h3:"+tripId+":"+day+":"+secs,stopId,tripId,
       line,direction:str(item.direction,130)||"—",mode:"bus",
       scheduledTime:date,localTime:time,plannedLocalTime:time,realtime:false,
       cancelled:false,status:"scheduled",providerId:"de-bus-h3",
       feedSource:"de-bus-h3",provider:"GTFS.de rural buses",sourceKind:"official-gtfs",
       quality:"scheduled"});
   }
 }
 return list.sort((a,b)=>String(a.scheduledTime).localeCompare(String(b.scheduledTime))).slice(0,40);
}
async function existingH3Departures(a:{origin:string,key:string,jwt:string},body:AnyObject){
 const rawId=str(body.stopId,180).replace(/^de-bus-h3:/,"");
 if(!rawId||rawId.length>160)throw new Fault(400,"Invalid GTFS stop ID");
 const res=await fetch(a.origin+"/functions/v1/transit-de-bus-h3",{
   method:"POST",headers:{apikey:a.key,authorization:"Bearer "+a.jwt,"content-type":"application/json"},
   body:JSON.stringify({action:"departures",country:"DE",stopId:rawId}),signal:AbortSignal.timeout(10000)});
 if(!res.ok)return {ok:false,status:res.status,body:{ok:false,error:"GTFS rural timetable temporarily unavailable"}};
 const bodyResult=await res.json();
 if(bodyResult?.ok!==true||!Array.isArray(bodyResult.boards))
   return {ok:false,status:502,body:{ok:false,error:"Invalid GTFS timetable response"}};
 const departures=h3ScheduledDepartures(bodyResult.boards,bounded(body.duration,90,30,180),rawId);
 return {ok:true,status:200,body:{ok:true,country:"DE",providerId:"de-bus-h3",
   provider:"GTFS.de rural bus subset",quality:"scheduled",
   sourceUrl:"https://gtfs.de/en/feeds/de_nv/",departures,
   generatedAt:new Date().toISOString()}};
}

async function invokeExisting(a:{origin:string,key:string,jwt:string},body:AnyObject){
 // NEXT-only German nearby query: the national subset can be sparse and MUST
 // NOT prevent Transitland / DB fallback. Preserve legacy as fail-safe.
 if(body.action==="departures"&&body.country==="DE"&&body.feedSource==="de-bus-h3"){
   return existingH3Departures(a,body);
 }
 const nextNear=body.action==="nearby"&&body.country==="DE";
 // Start local bus lookup in parallel; only within its verified Bavarian footprint.
 const ruralPromise=nextNear&&body.mode!=="train"&&body.mode!=="rail"&&body.mode!=="sbahn"&&body.mode!=="metro"&&body.mode!=="subway"&&isGermanRuralArea(body)
    ?germanRuralBusStops(a,body):Promise.resolve([] as AnyObject[]);
 const providers=nextNear
   ?["transit-schedule-next-expanded","transit-schedule"]
   :["transit-schedule"];
 for(let i=0;i<providers.length;i++){
   try{
     const res=await fetch(a.origin+"/functions/v1/"+providers[i],{
       method:"POST",
       headers:{apikey:a.key,authorization:"Bearer "+a.jwt,"content-type":"application/json"},
       body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
     const raw=await res.text();
     if(raw.length>1_400_000)throw new Fault(502,"Transit response exceeds safe limit");
     const parsed=JSON.parse(raw);
     const result={ok:res.ok,status:res.status,body:obj(parsed)};
     if(res.status<500||i===providers.length-1){
       if(nextNear){
         const rural=await ruralPromise;
         if(rural.length){
           return {ok:true,status:200,body:includeVerifiedGermanRuralStops(
             result.ok&&result.body.ok===true?result.body:{ok:true,country:"DE",stops:[]},
             rural,bounded(body.limit,30,1,40))};
         }
       }
       return result;
     }
   }catch(e){
     if(i===providers.length-1)throw e;
   }
 }
 throw new Fault(502,"No transit provider available");
}
Deno.serve(async (req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
 if(req.method!=="POST")return response({ok:false,error:"Method not allowed"},405);
 try{
   const auth=await authenticate(req);
   const normalizedRequest=normalized(await req.json().catch(()=>{throw new Fault(400,"Bad JSON")}));
   const action=String(normalizedRequest.action),usesCache=["nearby","departures","trip"].includes(action);
   const bucket=action;
   let key="",cached:AnyObject|null=null,cacheFresh=false,cachedStoredAt=0,stale:AnyObject|null=null;
   if(usesCache){
     const keyRequest=cacheKeyRequest(normalizedRequest);
     if(action==="departures")keyRequest.timeWindow=Math.floor(Date.now()/60000);
     key=await hashedKey(bucket,keyRequest);
     try{
       const rows=await cacheRpc("transit_shared_cache_read_v1",{p_bucket:bucket,p_key:key});
       const row=Array.isArray(rows)?rows[0]:null;
       if(row?.payload){
         cached=obj(row.payload);cacheFresh=row.is_fresh===true;
         cachedStoredAt=Date.parse(String(row.stored_at||""))||0;
         const shown=reformStops(cached,normalizedRequest);
         const score=coverageScore(shown,normalizedRequest);
         // Tiny partial results do not block countrywide API retries; short 30s coalescing.
         if(cacheFresh&&(action!=="nearby"||score>=QUALITY_OK||
             (score>0&&Date.now()-cachedStoredAt<30000))){
           if(action!=="nearby"||Array.isArray(shown.stops)&&shown.stops.length>0)
             return response({...shown,coverageScore:score,partial:score<QUALITY_OK,
               sharedCache:{hit:true,stale:false,expiresAt:row.expires_at,
                 source:"supabase-transit-shared"}});
         }
         if(action==="nearby"&&!cacheFresh&&score>0)stale=shown;
       }
     }catch(_ignored){/* DB cache failure cannot block the original API. */}
   }
   // Nationwide API fallback is authoritative for non-rural coverage.
   // H3 runs only within its verified Bavarian footprint and is merged by existing v3 logic.
   const canonical=chooseCanonical(normalizedRequest);
   const upstream=await invokeExisting(auth,canonical);
   if(upstream.ok&&upstream.body.ok===true){
     const shown=reformStops(upstream.body,normalizedRequest);
     const score=coverageScore(shown,normalizedRequest);
     if(usesCache){
       const safe=cacheablePayload(action,upstream.body);
       const policy=cachePolicy(action,shown,score);
       if(safe&&policy.ttl>0&&score>0){
         try{
           await cacheRpc("transit_shared_cache_store_quality_v2",{
             p_bucket:bucket,p_key:key,p_payload:{...safe,coverageScore:score},
             p_ttl_seconds:policy.ttl,
             p_provider:str(upstream.body.providerId,80)||"unknown",
             p_quality_score:score,p_stale_grace_seconds:policy.stale});
         }catch(_ignored){/* Quota/RPC failure does not mask valid provider results. */}
       }
       if(action==="nearby"&&cached){
         const previous=reformStops(cached,normalizedRequest);
         const oldScore=coverageScore(previous,normalizedRequest);
         if(oldScore>score&&Array.isArray(previous.stops)&&previous.stops.length){
           return response({...previous,coverageScore:oldScore,partial:oldScore<QUALITY_OK,
             sharedCache:{hit:true,stale:!cacheFresh,refreshAttempted:true,
               warning:"Previous transit coverage was better; using last verified nearby stops."}});
         }
       }
     }
     return response({...shown,coverageScore:score,partial:action==="nearby"&&score<QUALITY_OK,
       sharedCache:{hit:false,stale:false,source:"provider-api"}});
   }
   if((stale||cached)&&action==="nearby"){
     const old=reformStops(stale||cached||{},normalizedRequest),score=coverageScore(old,normalizedRequest);
     if(score>0&&Array.isArray(old.stops)&&old.stops.length)
       return response({...old,coverageScore:score,partial:true,
         sharedCache:{hit:true,stale:!cacheFresh,warning:"Provider unavailable; showing available previous stops only."}});
   }
   return response(upstream.body,upstream.status);
 }catch(e){
   return response({ok:false,error:e instanceof Fault?e.message:"Unified Transit temporarily unavailable"},
     e instanceof Fault?e.code:503);
 }
});
