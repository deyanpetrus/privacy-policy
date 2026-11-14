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
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
  if(req.method!=="POST")return response({ok:false,error:"Method not allowed"},405);
  try {
    await authorized(req);
    const items=await sourceRows();
    return response({ok:true,mode:"discovery_only",source_count:items.length,sources:items,
      warning:"Reachable URL is not proof of schedule/license/LIVE validity; never auto-promote.",
      generated_at:new Date().toISOString()});
  }catch(e){
    return response({ok:false,error:e instanceof Failure?e.message:"Source registry unavailable"},
      e instanceof Failure?e.code:503);
  }
});
