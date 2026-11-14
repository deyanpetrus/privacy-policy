// LifeDashPro NEXT Transit Hub paged nearby. Additive: does not modify existing endpoints.
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization,apikey,content-type,x-client-info",
  "access-control-allow-methods": "POST,OPTIONS"
};
const OUT = (v: unknown, status=200) => Response.json(v,{
  status, headers:{...CORS,"cache-control":"private, no-store"}
});
class Fault extends Error { status:number; constructor(status:number,message:string){super(message);this.status=status;} }
const ROOT = "https://gnqtngtuzbxohgwgvmpb.supabase.co/rest/v1/rpc/transit_hub_nearby_page";
function publicKey():string {
  const old=Deno.env.get("SUPABASE_ANON_KEY");
  if(old)return old;
  try {
    const v=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}");
    return String(v.default||"");
  } catch{return "";}
}
async function authorize(req:Request){
  const jwt=/^Bearer\s+([^\s]+)$/i.exec(req.headers.get("authorization")||"")?.[1]||"";
  const origin=Deno.env.get("SUPABASE_URL")||"", key=publicKey();
  if(!origin||!key||!jwt||jwt.startsWith("sb_"))throw new Fault(401,"Signed-in account required");
  const headers={apikey:key,authorization:"Bearer "+jwt,accept:"application/json"};
  const u=await fetch(origin+"/auth/v1/user",{headers,signal:AbortSignal.timeout(4500)});
  if(!u.ok||!(await u.json().catch(()=>null))?.id)throw new Fault(401,"Invalid user session");
  const l=await fetch(origin+"/rest/v1/rpc/consume_user_rate_limit",{
    method:"POST",headers:{...headers,"content-type":"application/json"},
    body:JSON.stringify({p_bucket:"transit-hub-paged-20261114",p_limit:15,p_window_seconds:60}),
    signal:AbortSignal.timeout(4500)
  });
  if(!l.ok)throw new Fault(503,"Rate limiting unavailable");
  const result=await l.json().catch(()=>null), row=Array.isArray(result)?result[0]:result;
  if(row?.allowed!==true)throw new Fault(429,"Too many requests");
}
function boundedInt(v:unknown,def:number,lo:number,hi:number){
  const n=Number(v);
  return Number.isFinite(n)?Math.max(lo,Math.min(hi,Math.trunc(n))):def;
}
async function getRows(p:object) {
  const secret=Deno.env.get("LDP_DEDICATED_TRANSIT_SERVICE_ROLE_KEY")||"";
  if(!secret)throw new Fault(503,"Transit backend not configured");
  const headers:Record<string,string>={apikey:secret,"content-type":"application/json",accept:"application/json"};
  if(secret.startsWith("eyJ"))headers.authorization="Bearer "+secret;
  const res=await fetch(ROOT,{method:"POST",headers,body:JSON.stringify(p),signal:AbortSignal.timeout(8000)});
  if(!res.ok)throw new Fault(503,"Transit backend unavailable");
  const rows=await res.json().catch(()=>null);
  if(!Array.isArray(rows))throw new Fault(503,"Invalid timetable response");
  return rows;
}

const RPC_BASE="https://gnqtngtuzbxohgwgvmpb.supabase.co/rest/v1/rpc/";
async function getProtectedBoard(fn:string,payload:object):Promise<any[]>{
  const secret=Deno.env.get("LDP_DEDICATED_TRANSIT_SERVICE_ROLE_KEY")||"";
  if(!secret)throw new Fault(503,"Transit backend not configured");
  const headers:Record<string,string>={apikey:secret,"content-type":"application/json",accept:"application/json"};
  if(secret.startsWith("eyJ"))headers.authorization="Bearer "+secret;
  const res=await fetch(RPC_BASE+fn,{method:"POST",headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)});
  if(!res.ok)throw new Fault(503,"Transit schedule temporarily unavailable");
  const rows=await res.json().catch(()=>null);
  if(!Array.isArray(rows))throw new Fault(503,"Invalid schedule response");
  return rows;
}
function localServiceClock(tz:string){
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(new Date());
  const v=(t:string)=>parts.find(x=>x.type===t)?.value||"00";
  return {date:v("year")+"-"+v("month")+"-"+v("day"),seconds:Number(v("hour"))*3600+Number(v("minute"))*60+Number(v("second"))};
}
function dayDiff(a:string,b:string){return Math.round((Date.parse(a+"T00:00:00Z")-Date.parse(b+"T00:00:00Z"))/86400000)}
function minutesOf(secs:number){const t=((secs%86400)+86400)%86400;return String(Math.floor(t/3600)).padStart(2,"0")+":"+String(Math.floor(t%3600/60)).padStart(2,"0")}
async function getScheduledDepartures(d:any){
  const source=String(d.source||"");
  if(!["bg-sofia","de-rail","mk-rail"].includes(source))throw new Fault(400,"Invalid timetable source");
  const stopId=String(d.stopId||"");
  if(!stopId||stopId.length>160||!(/^[\p{L}\p{N}_.:\-]+$/u.test(stopId)))throw new Fault(400,"Invalid stop");
  const offset=boundedInt(d.offset,0,0,10000),limit=boundedInt(d.pageSize,100,1,100);
  const tz=source==="bg-sofia"?"Europe/Sofia":source==="de-rail"?"Europe/Berlin":"Europe/Skopje";
  const clock=localServiceClock(tz),today=clock.date;
  const providerId=source==="bg-sofia"?"sofia-official":source==="de-rail"?"de-rail-h2b":"mk-rail-next";
  const ranked:{delta:number;value:any}[]=[];
  if(source==="mk-rail"){
    const tomorrow=new Date(Date.parse(today+"T00:00:00Z")+86400000).toISOString().slice(0,10);
    const boards=await Promise.all([today,tomorrow].map(date=>getProtectedBoard("transit_next_mk_rail_stop_departures",{p_stop_id:stopId,p_date:date,p_limit:100})));
    const now=Date.now();
    for(const x of boards.flat()){
      const ms=Date.parse(String(x.depart_at||"")),delta=Math.round((ms-now)/1000);
      if(!Number.isFinite(delta)||delta< -120||delta>10800)continue;
      const time=new Intl.DateTimeFormat("en-GB",{timeZone:tz,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(ms));
      ranked.push({delta,value:{id:"mk:"+stopId+":"+String(x.trip_id||"").slice(0,100)+":"+ms,
        line:String(x.train_number||x.line||"—").slice(0,80),direction:String(x.direction||"—").slice(0,140),mode:"train",
        localTime:time,plannedLocalTime:time,realtime:false,cancelled:false,
        quality:"scheduled",status:"scheduled",providerId,provider:"MŽ community railway timetable (not LIVE)"}});
    }
  }else{
    const name=source==="bg-sofia"?"transit_next_sofia_departures":"transit_next_rail_departures";
    const boards=await getProtectedBoard(name,{p_stop_id:stopId,p_date:today});
    for(const board of boards){
      const bd=String(board.service_date||"");
      if(!/^\d{4}-\d{2}-\d{2}$/.test(bd))continue;
      const diff=dayDiff(today,bd);
      if(Math.abs(diff)>2)continue;
      for(const item of Array.isArray(board.payload)?board.payload:[]){
        const sec=Number(item?.departureSecs);
        if(!Number.isFinite(sec)||sec<0||sec>172800)continue;
        const delta=sec-(diff*86400+clock.seconds);
        if(delta< -120||delta>10800)continue;
        const t=minutesOf(sec);
        ranked.push({delta,value:{id:source+":"+stopId+":"+String(item.tripId||"").slice(0,100)+":"+bd+":"+sec,
          line:String(item.line||"—").slice(0,80),direction:String(item.direction||"—").slice(0,140),
          mode:String(item.mode||(source==="de-rail"?"train":"bus")).slice(0,20),
          localTime:t,plannedLocalTime:t,realtime:false,cancelled:false,
          quality:"scheduled",status:"scheduled",providerId,
          provider:source==="bg-sofia"?"Sofia Traffic official GTFS":"GTFS.de official rail GTFS"}});
      }
    }
  }
  ranked.sort((a,b)=>a.delta-b.delta||a.value.id.localeCompare(b.value.id));
  return {ok:true,source,quality:"scheduled",departures:ranked.slice(offset,offset+limit).map(x=>x.value),
    offset,pageSize:limit,nextOffset:ranked.length>offset+limit?offset+limit:null,generatedAt:new Date().toISOString()};
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
  if(req.method!=="POST")return OUT({ok:false,error:"Method not allowed"},405);
  try {
    await authorize(req);
    const d=await req.json().catch(()=>null);
    if(d?.action==="departures")return OUT(await getScheduledDepartures(d));
    if(d?.action!=="nearby")throw new Fault(400,"Unsupported action");
    const lat=Number(d.lat),lon=Number(d.lon);
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat < -90||lat > 90||lon < -180||lon > 180)
      throw new Fault(400,"Invalid coordinates");
    const source=String(d.source??"all");
    if(!["all","mk-rail","bg-sofia","de-rail"].includes(source))throw new Fault(400,"Unsupported transit source");
    const limit=boundedInt(d.pageSize,100,1,100);
    const offset=boundedInt(d.offset,0,0,50000);
    const radius=boundedInt(d.radiusM,10000,500,25000);
    const rows=await getRows({p_lat:lat,p_lon:lon,p_radius_m:radius,p_limit:limit,p_offset:offset,p_source:source});
    return OUT({ok:true,source,quality:"scheduled",stops:rows,pageSize:limit,offset,
      nextOffset:rows.length===limit?offset+limit:null,generatedAt:new Date().toISOString()});
  } catch(e) {
    return OUT({ok:false,error:e instanceof Fault?e.message:"Transit temporarily unavailable"},
      e instanceof Fault?e.status:503);
  }
});
