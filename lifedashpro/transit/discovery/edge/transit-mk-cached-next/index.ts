// LifeDashPro NEXT - Macedonian cached route catalog v1. NOT a live transit API.
// Service role is server-side only. No new GTFS imports, no invented schedules/GPS.
const CORS={
 "access-control-allow-origin":"*",
 "access-control-allow-headers":"authorization,apikey,content-type,x-client-info",
 "access-control-allow-methods":"POST,OPTIONS"
};
function respond(payload:unknown,status=200){
 return Response.json(payload,{status,headers:{...CORS,"cache-control":"private, no-store"}});
}
class Fault extends Error{constructor(readonly status:number,message:string){super(message)}}
function anonKey(){
 const key=Deno.env.get("SUPABASE_ANON_KEY");if(key)return key;
 try{const x=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}");
 return typeof x.default==="string"?x.default:"";}catch{return""}
}
async function authenticate(req:Request){
 const jwt=/^Bearer\s+([^\s]+)$/i.exec(req.headers.get("authorization")||"")?.[1]||"";
 const host=Deno.env.get("SUPABASE_URL")||"",anon=anonKey();
 if(!jwt||jwt.startsWith("sb_")||!host||!anon)throw new Fault(401,"Signed-in account required");
 const headers={apikey:anon,authorization:"Bearer "+jwt,accept:"application/json"};
 const r=await fetch(host+"/auth/v1/user",{headers,signal:AbortSignal.timeout(4500)});
 if(!r.ok||(await r.json().catch(()=>null))?.id==null)throw new Fault(401,"Invalid user session");
 const limit=await fetch(host+"/rest/v1/rpc/consume_user_rate_limit",{
  method:"POST",headers:{...headers,"content-type":"application/json"},
  body:JSON.stringify({p_bucket:"next-mk-static-catalog-20261115",p_limit:12,p_window_seconds:60}),
  signal:AbortSignal.timeout(5000)});
 if(!limit.ok)throw new Fault(503,"Rate limiting temporarily unavailable");
 const x=await limit.json().catch(()=>null),row=Array.isArray(x)?x[0]:x;
 if(row?.allowed!==true)throw new Fault(429,"Too many catalog requests");
}
async function dedicatedRpc(name:string,args:Record<string,unknown>){
 const secret=(Deno.env.get("LDP_DEDICATED_TRANSIT_SERVICE_ROLE_KEY")||"").trim();
 if(!secret)throw new Fault(503,"Dedicated transit not configured");
 const h:Record<string,string>={apikey:secret,"content-type":"application/json",accept:"application/json"};
 if(secret.startsWith("eyJ"))h.authorization="Bearer "+secret;
 const res=await fetch("https://gnqtngtuzbxohgwgvmpb.supabase.co/rest/v1/rpc/"+name,{
  method:"POST",headers:h,body:JSON.stringify(args),signal:AbortSignal.timeout(7500)});
 if(!res.ok)throw new Fault(503,"Transit catalog unavailable");
 const data=await res.json().catch(()=>null);
 if(!Array.isArray(data))throw new Fault(503,"Transit catalog response invalid");
 return data;
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
 if(req.method!=="POST")return respond({ok:false,error:"Method not allowed"},405);
 try{
  await authenticate(req);
  const body=await req.json().catch(()=>null);
  const action=String(body?.action||"");
  if(body?.country!=="MK"||!["routes","rail","overview","search","rail-departures"].includes(action))
   throw new Fault(400,"Unsupported country/action");
  const aliases:Record<string,string>={stip:"Штип",shtip:"Штип",shtipmk:"Штип",
    strumica:"Струмица",skopje:"Скопје",bitola:"Битола",
    gevgelija:"Гевгелија",sofia:"Софија",kumanovo:"Куманово",
    veles:"Велес",ohrid:"Охрид",struga:"Струга",tetovo:"Тетово"};
  const normalized=(x:unknown)=>{const v=String(x||"").trim();
    return aliases[v.toLowerCase().replace(/[^a-z0-9]/g,"")]||v};
  const city=body?.city==null||body?.city===""?null:normalized(body.city);
  if(city!==null&&!["Штип","Струмица"].includes(city))throw new Fault(400,"Unknown city");
  const limit=Math.min(100,Math.max(1,Math.floor(Number(body?.limit)||100)));
  const offset=Math.min(10000,Math.max(0,Math.floor(Number(body?.offset)||0)));
  if(action==="rail-departures"){
    const stopId=String(body?.stopId||"").trim();
    const date=String(body?.serviceDate||"");
    if(!/^[A-Za-z0-9_:-]{1,60}$/.test(stopId)||!/^(2026)-(11|12)-[0-3][0-9]$/.test(date)||
      date>"2026-12-12"||date<"2026-11-15")
      throw new Fault(400,"Only verified 2026-11-15 through 2026-12-12 MK rail reference dates are supported");
    const dep=await dedicatedRpc("transit_next_mk_rail_stop_departures",
      {p_stop_id:stopId,p_date:date,p_limit:100});
    const rows=dep.filter(x=>String(x.verified_until||"")>=date).map(x=>({
      ...x,mode:"train",quality:"SCHEDULED · CACHED · NOT LIVE",live:false,
      canUseForJourney:false,sourceCaveat:"Community GTFS reference; latest MŽI timetable (2026-11-09) must be reconciled before automatic Journey use."}));
    return respond({ok:true,action,country:"MK",stopId,serviceDate:date,
      source:"MK Rail community GTFS (service-verified reference window)",
      quality:"SCHEDULED · CACHED · NOT LIVE",
      note:"Not realtime. Cancellations or last-minute changes cannot be confirmed.",
      rows,returned:rows.length,generatedAt:new Date().toISOString()});
  }
  if(action==="search"){
    const origin=normalized(body?.origin);
    const destination=normalized(body?.destination);
    if(origin.length>80||destination.length>80)throw new Fault(400,"Search text too long");
    const klass=String(body?.serviceClass||"");
    if(!["","local_bus","intercity_bus"].includes(klass))throw new Fault(400,"Invalid service class");
    const [refs,rail,catalog]=await Promise.all([
      dedicatedRpc("transit_mk_published_departure_reference_search",
       {p_origin:origin||null,p_destination:destination||null,p_city:city,p_service_class:klass||null,
        p_limit:limit,p_offset:offset}),
      (!klass||body?.includeRail===true)?dedicatedRpc("transit_mk_rail_route_catalog",{}):Promise.resolve([]),
      dedicatedRpc("transit_mk_static_route_catalog",{p_city:city,p_limit:100,p_offset:0})
    ]);
    const total=refs.length?Number(refs[0].total_matches||0):null;
    return respond({ok:true,action,country:"MK",city,
      dataQuality:"CACHED SOURCE REFERENCE · NOT LIVE",
      currentVerifiedBusDepartures:[],
      publishedConditionalLocal:refs.filter(x=>x.source_status==="published_conditional"),
      publishedUnverifiedIntercity:refs.filter(x=>x.source_status==="published_undated"),
      routeCatalog:catalog,railRoutes:rail,returned:refs.length,totalMatches:total,
      nextOffset:total!==null&&offset+refs.length<total?offset+refs.length:null,
      note:"Bus times are published references, not date-verified journeys; never present as guaranteed upcoming service.",
      generatedAt:new Date().toISOString()});
  }
  if(action==="routes"){
   const routes=await dedicatedRpc("transit_mk_static_route_catalog",
     {p_city:city,p_limit:limit,p_offset:offset});
   const total=routes.length?Number(routes[0]?.total_matches||0):null;
   return respond({ok:true,country:"MK",action,city,
    quality:"CACHED ROUTE LIST · NOT LIVE",timetableStatus:"not_imported",
    note:"Route names only. No current departures or stop coordinates verified; do not use in trip planning yet.",
    rows:routes,returned:routes.length,totalMatches:total,
    nextOffset:total!==null&&offset+routes.length<total?offset+routes.length:null,
    generatedAt:new Date().toISOString()});
  }
  const rail=await dedicatedRpc("transit_mk_rail_route_catalog",{});
  if(action==="rail"){
    return respond({ok:true,country:"MK",action,quality:"CACHED RAIL ROUTE · NOT LIVE",
      note:"Schedules are separate. Do not assert live status or future service beyond verified date.",
      rows:rail,returned:rail.length,generatedAt:new Date().toISOString()});
  }
  const routes=await dedicatedRpc("transit_mk_static_route_catalog",
   {p_city:city,p_limit:100,p_offset:0});
  return respond({ok:true,country:"MK",action,city,
   busRouteEntries:routes.length,railRouteEntries:rail.length,
   cityRouteStatus:{Stip:"route_only",Strumica:"historic_unverified"},
   railVerifiedThrough:rail[0]?.source_reviewed_until||null,
   liveFeedsIntegratedByThisEndpoint:false,
   containsCurrentBusDepartures:false,
   note:"Discovery catalog only. Legacy Skopje/MK rail Android endpoints are separate and unchanged.",
   generatedAt:new Date().toISOString()});
 }catch(e){
  return respond({ok:false,error:e instanceof Fault?e.message:"MK cached catalog temporarily unavailable"},
    e instanceof Fault?e.status:503);
 }
});
