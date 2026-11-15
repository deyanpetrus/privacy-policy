// LifeDashPro NEXT isolated scheduled GTFS proxy. Never exposes service-role credentials.
// transit-de-regional-bus (Bremen and Pfaffenhofen v1)
const CORS={"access-control-allow-origin":"*","access-control-allow-headers":"authorization,apikey,content-type,x-client-info","access-control-allow-methods":"POST,OPTIONS"};
const OUT=(data,status=200)=>Response.json(data,{status,headers:{...CORS,"cache-control":"private, no-store"}});
class Fault extends Error{constructor(status,message){super(message);this.status=status}}
const ROOT="https://gnqtngtuzbxohgwgvmpb.supabase.co/rest/v1/rpc/";
const LABEL="GTFS.de national regional pilot (scheduled, CC BY 4.0)",MODES=["bus"];
function key(){const k=Deno.env.get("SUPABASE_ANON_KEY");if(k)return k;try{const z=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}");return String(z.default||"")}catch{return""}}
async function authenticated(req){
const jwt=/^Bearer\s+([^\s]+)$/i.exec(req.headers.get("authorization")||"")?.[1]||"";
const host=Deno.env.get("SUPABASE_URL")||"",anon=key();
if(!jwt||!host||!anon||jwt.startsWith("sb_"))throw new Fault(401,"Signed-in account required");
const headers={apikey:anon,authorization:"Bearer "+jwt,accept:"application/json"};
const user=await fetch(host+"/auth/v1/user",{headers,signal:AbortSignal.timeout(4500)});
if(!user.ok||(await user.json().catch(()=>null))?.id==null)throw new Fault(401,"Invalid user session");
const check=await fetch(host+"/rest/v1/rpc/consume_user_rate_limit",{
method:"POST",headers:{...headers,"content-type":"application/json"},
body:JSON.stringify({p_bucket:"next-de-regional-bus-20261115",p_limit:12,p_window_seconds:60}),signal:AbortSignal.timeout(4500)});
if(!check.ok)throw new Fault(503,"Rate limiting unavailable");
const data=await check.json().catch(()=>null),row=Array.isArray(data)?data[0]:data;
if(row?.allowed!==true)throw new Fault(429,"Too many timetable requests");
}
async function rpc(action,input){
const secret=Deno.env.get("LDP_DEDICATED_TRANSIT_SERVICE_ROLE_KEY")||"";
if(!secret)throw new Fault(503,"Dedicated timetable not configured");
const headers={apikey:secret,"content-type":"application/json",accept:"application/json"};
if(secret.startsWith("eyJ"))headers.authorization="Bearer "+secret;
const r=await fetch(ROOT+"transit_next_de_regional_bus_"+action,{
method:"POST",headers,body:JSON.stringify(input),signal:AbortSignal.timeout(7000)});
if(!r.ok)throw new Fault(503,"Dedicated GTFS database currently unavailable");
const value=await r.json().catch(()=>null);
if(!Array.isArray(value))throw new Fault(503,"Invalid dedicated GTFS response");
return value;
}
Deno.serve(async req=>{
if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
if(req.method!=="POST")return OUT({ok:false,error:"Method not allowed"},405);
try{
await authenticated(req);
const d=await req.json().catch(()=>null);
if(d?.country!=="DE"||!["nearby","departures"].includes(String(d?.action||"")))throw new Fault(400,"Unsupported action");
if(d.action==="nearby"){
const lat=Number(d.lat),lon=Number(d.lon),mode=String(d.mode||"bus");
if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<47||lat>55.3||lon<5||lon>16||!MODES.includes(mode))throw new Fault(400,"Invalid location or transport mode");
const radiusM=Math.min(12000,Math.max(500,Math.round(Number(d.radiusM)||6000)));
const rows=await rpc("nearby",{p_lat:lat,p_lon:lon,p_radius_m:radiusM,p_limit:100});
return OUT({ok:true,source:LABEL,quality:"scheduled",stops:rows,generatedAt:new Date().toISOString()});
}
const stopId=String(d.stopId||"");
if(!stopId||stopId.length>160||/[\u0000-\u001f]/.test(stopId))throw new Fault(400,"Invalid stop ID");
const date=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const boards=await rpc("departures",{p_stop_id:stopId,p_date:date});
return OUT({ok:true,source:LABEL,quality:"scheduled",date,boards:boards.slice(0,2),generatedAt:new Date().toISOString()});
}catch(e){return OUT({ok:false,error:e instanceof Fault?e.message:"Transit service temporarily unavailable"},e instanceof Fault?e.status:503)}
});