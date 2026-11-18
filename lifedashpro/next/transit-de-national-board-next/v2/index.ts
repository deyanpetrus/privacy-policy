// NEXT-only German national GTFS stationboard. Does not alter Germany Road LIVE or legacy transit.
// Reads validated Nov 2026 'de-national' feed from the DEDICATED transit project.
type Row=Record<string,unknown>;
const CORS={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type,x-client-info','access-control-allow-methods':'POST,OPTIONS'};
const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:{...CORS,'cache-control':'no-store'}});
class Fault extends Error{constructor(public status:number,message:string){super(message)}}
const root=()=>Deno.env.get('SUPABASE_URL')||'';
function sbKey(type:'public'|'secret'){
 const old=Deno.env.get(type==='public'?'SUPABASE_ANON_KEY':'SUPABASE_SERVICE_ROLE_KEY');if(old)return old;
 try{const obj=JSON.parse(Deno.env.get(type==='public'?'SUPABASE_PUBLISHABLE_KEYS':'SUPABASE_SECRET_KEYS')||'{}');
 return String(obj.default||Object.values(obj)[0]||'')}catch{return ''}
}
const str=(v:unknown,max=100)=>typeof v==='string'?v.trim().slice(0,max):'';
function headers(key:string){const h:Record<string,string>={apikey:key,accept:'application/json','content-type':'application/json'};if(key.startsWith('eyJ'))h.authorization='Bearer '+key;return h}
async function authenticate(req:Request){
 const bearer=(req.headers.get('authorization')||'').match(/^Bearer\s+([^\s]+)$/i)?.[1]||'';
 const anon=sbKey('public');if(!bearer||bearer.startsWith('sb_')||!root()||!anon)throw new Fault(401,'User login required');
 const r=await fetch(root()+'/auth/v1/user',{headers:{apikey:anon,authorization:'Bearer '+bearer},signal:AbortSignal.timeout(4500)});
 if(!r.ok||!(await r.json().catch(()=>null))?.id)throw new Fault(401,'User session expired');
 return bearer;
}
async function userRate(token:string){
 const pub=sbKey('public'),r=await fetch(root()+'/rest/v1/rpc/consume_user_rate_limit',{method:'POST',
 headers:{apikey:pub,authorization:'Bearer '+token,'content-type':'application/json'},
 body:JSON.stringify({p_bucket:'next-de-national-stationboard-v1',p_limit:35,p_window_seconds:86400}),signal:AbortSignal.timeout(5500)});
 if(!r.ok)throw new Fault(503,'Rate limiter unavailable');
 const v=await r.json().catch(()=>null),item=Array.isArray(v)?v[0]:v;
 if(item?.allowed!==true)throw new Fault(429,'Stationboard daily limit reached');
}
const dedicated='https://gnqtngtuzbxohgwgvmpb.supabase.co/rest/v1/rpc/';
async function rpc(name:string,data:Row):Promise<any[]>{
 const key=Deno.env.get('LDP_DEDICATED_TRANSIT_SERVICE_ROLE_KEY')||'';
 if(!key)throw new Fault(503,'Dedicated transit key not configured');
 const r=await fetch(dedicated+name,{method:'POST',headers:headers(key),body:JSON.stringify(data),signal:AbortSignal.timeout(9500)});
 if(!r.ok)throw new Fault(503,'Dedicated timetable unavailable ('+name+' HTTP '+r.status+')');
 const v=await r.json().catch(()=>null);
 if(!Array.isArray(v))throw new Fault(503,'Invalid timetable reply');
 return v;
}
async function cacheRead(cacheKey:string,secret:string){
 try{const r=await fetch(root()+'/rest/v1/next_transit_regional_cache_v1?select=payload,expires_at&cache_key=eq.'+encodeURIComponent(cacheKey),
 {headers:{apikey:secret,authorization:'Bearer '+secret},signal:AbortSignal.timeout(3000)});
 if(!r.ok)return null;const a=await r.json().catch(()=>[]),hit=a?.[0];
 return hit&&Date.parse(hit.expires_at)>Date.now()?hit.payload:null;
 }catch{return null}
}
async function cacheWrite(cacheKey:string,value:unknown,secret:string,ttlMs:number){
 const t=Date.now();await fetch(root()+'/rest/v1/next_transit_regional_cache_v1?on_conflict=cache_key',{method:'POST',
 headers:{apikey:secret,authorization:'Bearer '+secret,'content-type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},
 body:JSON.stringify({cache_key:cacheKey,country:'DE',source_id:'de-national-gtfs-current',payload:value,
 fetched_at:new Date(t).toISOString(),expires_at:new Date(t+ttlMs).toISOString()}),signal:AbortSignal.timeout(3000)});
}
function cityClock(){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
 const part=(k:string)=>parts.find(x=>x.type===k)?.value||'00';
 return {day:part('year')+'-'+part('month')+'-'+part('day'),seconds:Number(part('hour'))*3600+Number(part('minute'))*60+Number(part('second'))};
}
function distanceKm(a:number,b:number,c:number,d:number){
 const r=Math.PI/180,dl=(c-a)*r,dn=(d-b)*r;
 const h=Math.sin(dl/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(dn/2)**2;
 return 6371*2*Math.asin(Math.min(1,Math.sqrt(h)));
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
 try{
  if(req.method!=='POST')throw new Fault(405,'POST required');
  const token=await authenticate(req);
  const input=await req.json().catch(()=>null);
  if(!input||typeof input!=='object')throw new Fault(400,'JSON request required');
  if(input.action==='status')return reply({ok:true,provider:'GTFS.de official national subset',country:'DE',pilot:true});
  if(input.country!=='DE'||input.action!=='nearby')throw new Fault(400,'Country DE, action nearby required');
  const city=str(input.city,70);
  const lat=typeof input.lat==='number'&&Number.isFinite(input.lat)?input.lat:null;
  const lon=typeof input.lon==='number'&&Number.isFinite(input.lon)?input.lon:null;
  const inDE=lat!==null&&lon!==null&&lat>=47&&lat<=55.4&&lon>=5.5&&lon<=15.6;
  if(!inDE&&!/^[\p{L}\p{M} .,'\-]{3,70}$/u.test(city))throw new Fault(400,'German city or valid GPS required');
  const key=sbKey('secret');if(!root()||!key)throw new Fault(503,'Shared cache unavailable');
  const cacheKey='DE_NATIONAL_V1:'+city.toLocaleLowerCase('de-DE')+':'+(inDE?lat!.toFixed(2)+':'+lon!.toFixed(2):'CITY');
  const hit=await cacheRead(cacheKey,key);if(hit)return reply({...hit,cache:'HIT'});
  await userRate(token);
  const clock=cityClock();
  const feed=await rpc('transit_next_de_feed_status_v1',{});
  const meta=feed[0];
  if(!meta||meta.active!==true||clock.day<meta.valid_from||clock.day>meta.valid_until)
    throw new Fault(503,'Current German GTFS feed unavailable or expired');
  const cityCandidates=/^[\p{L}\p{M} .,'\-]{3,70}$/u.test(city)
     ?await rpc('transit_next_de_city_active_v1',{p_city:city,p_service_date:clock.day,p_now_seconds:clock.seconds,p_limit:24}):[];
  let gpsCandidates:any[]=[];
  if(inDE)gpsCandidates=await rpc('transit_gtfs_nearby',{p_lat:lat!,p_lon:lon!,p_radius_m:8000,p_limit:60});
  let coordinateMode='GPS_NEARBY';
  const cityArea=cityCandidates.find(x=>Number.isFinite(Number(x.stop_lat))&&Number.isFinite(Number(x.stop_lon)));
  const mismatch=inDE&&cityArea&&distanceKm(lat!,lon!,Number(cityArea.stop_lat),Number(cityArea.stop_lon))>25;
  if(mismatch)coordinateMode='SELECTED_CITY_OVERRIDES_STALE_COORDINATES';
  if(!inDE||mismatch)coordinateMode=mismatch?coordinateMode:'SELECTED_CITY';
  const candidates=(mismatch||!inDE)?cityCandidates:[...gpsCandidates.slice(0,12),...cityCandidates.slice(0,14)];
  const stops:any[]=[],ids=new Set<string>();
  for(const x of candidates){
   const id=String(x.stop_id||'');
   if(!/^\d{1,15}$/.test(id)||ids.has(id))continue;
   if(mismatch&&city&&cityCandidates.length&&!cityCandidates.some((y:any)=>String(y.stop_id)===id))continue;
   ids.add(id);stops.push(x);if(stops.length>=26)break;
  }
  const maxChecks=Math.min(stops.length,26);let selected:any=null;let departures:any[]=[];
  const now=Date.now();
  // Do not rely on the first stop: GTFS uses platform-specific stop IDs.
  for(let i=0;i<maxChecks;i+=4){
   const batch=stops.slice(i,i+4);
   const results=await Promise.allSettled(batch.map(s=>rpc('transit_gtfs_departures',{
     p_feed_source:'de-national',p_stop_id:String(s.stop_id),p_service_date:clock.day,
     p_now_seconds:clock.seconds,p_window_minutes:180,p_limit:20})));
   for(let j=0;j<batch.length;j++){
    const rr=results[j];if(rr.status!=='fulfilled'||!rr.value.length)continue;
    const planned=rr.value.map((d:any)=>{
     const display=Number(d.display_seconds);
     if(!Number.isFinite(display))return null;
     const delta=display-clock.seconds;
     if(delta< -80||delta>10800)return null;
     const stamp=new Date(now+delta*1000).toISOString();
     return {line:str(d.line,60)||'—',destination:str(d.direction,140)||'—',
       scheduled_at:stamp,expected_at:stamp,delay_minutes:null,
       platform:str(d.platform_code,30)||null,planned_platform:str(d.platform_code,30)||null,
       realtime:false,status:'SCHEDULED',source:'GTFS.de · scheduled',stop_name:str(batch[j].stop_name,150)};
    }).filter(Boolean);
    if(planned.length){selected=batch[j];departures=planned;break}
   }
   if(selected)break;
  }
  departures.sort((a:any,b:any)=>Date.parse(a.scheduled_at)-Date.parse(b.scheduled_at));
  const out={ok:true,country:'DE',provider:'GTFS.de',source:'GTFS.de national subset (SCHEDULED)',
   selected_stop_name:selected?str(selected.stop_name,140):null,
   departure_count:departures.length,departures:departures.slice(0,20),
   checked_stops:maxChecks,stop_candidate_count:stops.length,
   coordinate_mode:coordinateMode,
   feed_imported_at:meta.imported_at,feed_valid_until:meta.valid_until,
   updated_at:new Date(now).toISOString(),quality:'SCHEDULED',
   warning:'GTFS scheduled timetable only, not realtime or confirmed track/delay. Regional feed coverage may be incomplete.'};
  await cacheWrite(cacheKey,out,key,departures.length?120000:60000).catch(()=>null);
  return reply({...out,cache:'MISS'});
 }catch(e){return reply({ok:false,error:e instanceof Fault?e.message:'National timetable request failed'},e instanceof Fault?e.status:503)}
});export {};
