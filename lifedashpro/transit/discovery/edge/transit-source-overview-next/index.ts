// LifeDashPro NEXT only: read-only authenticated source catalog. Independent of all existing transit functions.
const CORS={
  "access-control-allow-origin":"*",
  "access-control-allow-headers":"authorization,apikey,content-type,x-client-info",
  "access-control-allow-methods":"POST,OPTIONS"
};
const response=(x:unknown,status=200)=>Response.json(x,{status,headers:{...CORS,"cache-control":"private, no-store"}});
class Failure extends Error { code:number; constructor(code:number,message:string){super(message);this.code=code;} }
function publicKey():string {
  const old=Deno.env.get("SUPABASE_ANON_KEY");
  if(old)return old;
  try { const v=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}");return String(v.default||""); }
  catch{return "";}
}
async function authorized(req:Request) {
  const jwt=/^Bearer\s+([^\s]+)$/i.exec(req.headers.get("authorization")||"")?.[1]||"";
  const origin=Deno.env.get("SUPABASE_URL")||"",key=publicKey();
  if(!origin||!key||!jwt||jwt.startsWith("sb_"))throw new Failure(401,"Signed-in LifeDashPro account required");
  const headers={apikey:key,authorization:"Bearer "+jwt,accept:"application/json"};
  const auth=await fetch(origin+"/auth/v1/user",{headers,signal:AbortSignal.timeout(5500)});
  const user=auth.ok?await auth.json().catch(()=>null):null;
  if(!user?.id)throw new Failure(401,"Session invalid");
  const limit=await fetch(origin+"/rest/v1/rpc/consume_user_rate_limit",{
    method:"POST",headers:{...headers,"content-type":"application/json"},
    body:JSON.stringify({p_bucket:"transit-source-discovery-overview-20261114",p_limit:10,p_window_seconds:60}),
    signal:AbortSignal.timeout(5500)
  });
  if(!limit.ok)throw new Failure(503,"Rate limiting unavailable");
  const raw=await limit.json().catch(()=>null),row=Array.isArray(raw)?raw[0]:raw;
  if(row?.allowed!==true)throw new Failure(429,"Too many requests");
}
async function sourceRows(){
  const service=Deno.env.get("LDP_DEDICATED_TRANSIT_SERVICE_ROLE_KEY")||"";
  if(!service)throw new Failure(503,"Source registry not configured");
  const headers:Record<string,string>={apikey:service,accept:"application/json","content-type":"application/json"};
  if(service.startsWith("eyJ"))headers.authorization="Bearer "+service;
  const feed=await fetch("https://gnqtngtuzbxohgwgvmpb.supabase.co/rest/v1/rpc/transit_discovery_overview",{
    method:"POST",headers,body:"{}",signal:AbortSignal.timeout(8000)
  });
  const data=feed.ok?await feed.json().catch(()=>null):null;
  if(!Array.isArray(data)||data.length>200)throw new Failure(503,"Transit source overview unavailable");
  return data;
}

async function mobilityRpc(fn:string,payload:object):Promise<any[]>{
  const service=Deno.env.get("LDP_DEDICATED_TRANSIT_SERVICE_ROLE_KEY")||"";
  if(!service)throw new Failure(503,"Source index not configured");
  const headers:Record<string,string>={apikey:service,accept:"application/json","content-type":"application/json"};
  if(service.startsWith("eyJ"))headers.authorization="Bearer "+service;
  const res=await fetch("https://gnqtngtuzbxohgwgvmpb.supabase.co/rest/v1/rpc/"+fn,{
    method:"POST",headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)
  });
  const rows=res.ok?await res.json().catch(()=>null):null;
  if(!Array.isArray(rows))throw new Failure(503,"Mobility source index unavailable");
  return rows;
}
function capped(value:unknown,def:number,max:number){
  const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(max,Math.trunc(n))):def;
}
async function mobilityRows(d:any){
  const country=(d?.country===undefined||d?.country===null||d?.country==="")?null:String(d.country).toUpperCase();
  if(country!==null&&!/^[A-Z]{2}$/.test(country))throw new Failure(400,"Invalid country");
  const kind=(d?.kind===undefined||d?.kind===null||d?.kind==="")?null:String(d.kind);
  if(kind!==null&&!["gtfs","gtfs_rt","gbfs"].includes(kind))throw new Failure(400,"Invalid kind");
  const limit=Math.max(1,capped(d?.pageSize,100,100)),offset=capped(d?.offset,0,50000);
  const sources=await mobilityRpc("transit_mobility_api_overview",{
    p_country:country,p_kind:kind,p_limit:limit,p_offset:offset
  });
  return {ok:true,mode:"discovery_only",kind:"mobility_database_api",country,
    sources,pageSize:limit,offset,nextOffset:sources.length===limit?offset+limit:null,
    generated_at:new Date().toISOString(),
    warning:"Source metadata only. No ZIPs or realtime data stored; no active travel schedules certified."};
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
  if(req.method!=="POST")return response({ok:false,error:"Method not allowed"},405);
  try {
    await authorized(req);
    const request=await req.json().catch(()=>({}));
    if(request?.action==="mobility")return response(await mobilityRows(request));
    if(request?.action==="summary"){
      const countries=await mobilityRpc("transit_mobility_api_country_summary",{});
      return response({ok:true,mode:"discovery_only",countries,generated_at:new Date().toISOString()});
    }
    const items=await sourceRows();
    return response({ok:true,mode:"discovery_only",source_count:items.length,sources:items,
      warning:"Reachable URL is not proof of schedule/license/LIVE validity; never auto-promote.",
      generated_at:new Date().toISOString()});
  }catch(e){
    return response({ok:false,error:e instanceof Failure?e.message:"Source registry unavailable"},
      e instanceof Failure?e.code:503);
  }
});
