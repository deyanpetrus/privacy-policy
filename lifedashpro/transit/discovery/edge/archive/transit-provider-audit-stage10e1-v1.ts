// LifeDashPro NEXT Stage10E1: isolated user-triggered provider audit.
// No replacement of transit-schedule, no database writes, no client secrets.
class ErrorResponse extends Error{constructor(readonly status:number,message:string){super(message)}}
const CORS={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type,x-client-info','access-control-allow-methods':'POST, OPTIONS'};
const DEDICATED_RPC='https://gnqtngtuzbxohgwgvmpb.supabase.co/rest/v1/rpc/transit_gtfs_nearby';
const MAX=25;
const IN_MEMORY=new Map<string,{expires:number,data:unknown}>();
function json(body:unknown,status=200){return Response.json(body,{status,headers:{...CORS,'cache-control':'private, no-store'}})}
function publishable(){const x=Deno.env.get('SUPABASE_ANON_KEY');if(x)return x;try{const p=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}');if(typeof p.default==='string')return p.default;}catch{}throw new ErrorResponse(503,'Authentication service unavailable')}
async function requireUserAndLimit(req:Request){
 const jwt=/^Bearer\s+([^\s]+)$/i.exec(req.headers.get('authorization')||'')?.[1]||'';
 if(!jwt||jwt.startsWith('sb_publishable_')||jwt.startsWith('sb_secret_'))throw new ErrorResponse(401,'Signed-in account required');
 const url=Deno.env.get('SUPABASE_URL')||'';if(!url)throw new ErrorResponse(503,'Authentication service unavailable');
 const headers={apikey:publishable(),authorization:'Bearer '+jwt,accept:'application/json'};
 const response=await fetch(url+'/auth/v1/user',{headers,signal:AbortSignal.timeout(4500)});
 if(!response.ok)throw new ErrorResponse(401,'Invalid or expired session');
 const user=await response.json().catch(()=>null);if(!user?.id)throw new ErrorResponse(401,'Signed-in account required');
 const limit=await fetch(url+'/rest/v1/rpc/consume_user_rate_limit',{
  method:'POST',headers:{...headers,'content-type':'application/json'},
  body:JSON.stringify({p_bucket:'transit-provider-audit-10e1',p_limit:2,p_window_seconds:60}),
  signal:AbortSignal.timeout(5000)
 });
 if(!limit.ok)throw new ErrorResponse(503,'Rate limit service unavailable');
 const res=await limit.json().catch(()=>null),row=Array.isArray(res)?res[0]:res;
 if(row?.allowed!==true)throw new ErrorResponse(429,'Please retry later');
}
type Stop={sourceId:string;name:string|null;lat:number;lon:number;distanceM:number|null;mode:string[];lines:string[];platform:string|null};
type Audit={providerId:string;provider:string;status:'ok'|'empty'|'error'|'not_connected';count:number;shown:number;unnamed:number;durationMs:number;note?:string;stops:Stop[]};
function haversine(a:number,b:number,c:number,d:number){const k=Math.PI/180,s1=Math.sin((c-a)*k/2)**2,s2=Math.sin((d-b)*k/2)**2;return Math.round(12742000*Math.asin(Math.sqrt(Math.min(1,s1+Math.cos(a*k)*Math.cos(c*k)*s2))))}
function cleanName(n:unknown){const s=typeof n==='string'?n.trim():'';return s&&s!=='—'&&s.toLowerCase()!=='null'?s:null}
function cleanLines(raw:unknown):string[]{const values=Array.isArray(raw)?raw:[];return [...new Set(values.map(x=>String(x||'').trim()).filter(Boolean))].slice(0,12)}
function coerceStop(sourceId:string,name:unknown,lat:unknown,lon:unknown,originLat:number,originLon:number,mode:string[],lines:string[],platform:unknown):Stop|null{
 const a=Number(lat),b=Number(lon);if(!sourceId||!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a)>90||Math.abs(b)>180)return null;
 return {sourceId,name:cleanName(name),lat:a,lon:b,distanceM:haversine(originLat,originLon,a,b),mode,lines,platform:cleanName(platform)};
}
function routeMode(t:unknown){const n=Number(t);if(!Number.isFinite(n))return'unknown';if(n===3||(n>=700&&n<800))return'bus';if(n===0||(n>=900&&n<1000))return'tram';if(n===1||(n>=400&&n<500))return'subway';if(n===109)return'suburban';if(n===2||(n>=100&&n<200))return'train';if(n===4)return'ferry';return'unknown'}
async function gtfs(lat:number,lon:number,radius:number):Promise<Stop[]>{
 const key=(Deno.env.get('LDP_DEDICATED_TRANSIT_SERVICE_ROLE_KEY')||'').trim();if(!key)throw new Error('GTFS server key not configured');
 const h:Record<string,string>={apikey:key,'content-type':'application/json',accept:'application/json'};
 if(key.startsWith('eyJ'))h.authorization='Bearer '+key;
 const res=await fetch(DEDICATED_RPC,{method:'POST',headers:h,body:JSON.stringify({p_lat:lat,p_lon:lon,p_radius_m:radius,p_limit:40}),signal:AbortSignal.timeout(6500)});
 if(!res.ok)throw new Error('GTFS backend HTTP '+res.status);
 const data=await res.json();if(!Array.isArray(data))throw new Error('GTFS response invalid');
 return data.map((s:any)=>coerceStop(String(s?.scoped_id||s?.stop_id||''),s?.stop_name,s?.stop_lat,s?.stop_lon,lat,lon,[],[],s?.platform_code)).filter(Boolean).slice(0,MAX) as Stop[];
}
async function transitland(lat:number,lon:number,radius:number):Promise<Stop[]>{
 const token=(Deno.env.get('TRANSITLAND_API_KEY')||'').trim();if(!token)throw new Error('Transitland server key not configured');
 const u=new URL('https://transit.land/api/v2/rest/stops');
 u.searchParams.set('lat',String(lat));u.searchParams.set('lon',String(lon));u.searchParams.set('radius',String(Math.min(radius,6000)));u.searchParams.set('limit','40');u.searchParams.set('include_routes','true');u.searchParams.set('license_commercial_use_allowed','exclude_no');
 const res=await fetch(u.toString(),{headers:{accept:'application/json',apikey:token},signal:AbortSignal.timeout(6500)});
 if(!res.ok)throw new Error('Transitland HTTP '+res.status);
 const data=await res.json();if(!Array.isArray(data?.stops))throw new Error('Transitland response invalid');
 const rows:Stop[]=[];for(const s of data.stops){
  const routes=s.routes||s.routes_serving_stop||s.routesServingStop||[];
  const rr=Array.isArray(routes)?routes.map((x:any)=>x?.route||x):[];
  const coords=s.geometry?.coordinates||null;
  const lineNames=cleanLines(rr.map((r:any)=>r.route_short_name||r.route_long_name||r.route_id));
  const modes=[...new Set(rr.map((r:any)=>routeMode(r.route_type)).filter((m:string)=>m!=='unknown'))] as string[];
  const stop=coerceStop(String(s.onestop_id||s.id||s.stop_id||''),s.stop_name||s.name,coords?.[1]??s.lat??s.latitude,coords?.[0]??s.lon??s.longitude,lat,lon,modes,lineNames,s.platform_code);
  if(stop&&stop.distanceM!==null&&stop.distanceM<=radius)rows.push(stop);
 }return rows.slice(0,MAX);
}
async function db(lat:number,lon:number,radius:number):Promise<Stop[]>{
 const u=new URL('https://v6.db.transport.rest/locations/nearby');
 Object.entries({latitude:lat,longitude:lon,results:40,distance:radius,stops:'true',poi:'false',linesOfStops:'true',profile:'dbnav',pretty:'false'}).forEach(([k,v])=>u.searchParams.set(k,String(v)));
 const res=await fetch(u.toString(),{headers:{accept:'application/json'},signal:AbortSignal.timeout(6500)});
 if(!res.ok)throw new Error('DB REST HTTP '+res.status);const payload=await res.json();
 const rows=Array.isArray(payload)?payload:Array.isArray(payload?.stops)?payload.stops:null;
 if(!rows)throw new Error('DB REST response invalid');
 const out:Stop[]=[];for(const s of rows){
  const modes=Object.entries(s.products||{}).filter(([,active])=>active===true).map(([m])=>m==='suburban'?'suburban':m==='regional'?'train':m==='national'?'train':m==='regionalExpress'?'train':m==='nationalExpress'?'train':m==='bus'?'bus':m==='tram'?'tram':m==='subway'?'subway':m==='ferry'?'ferry':'unknown').filter((x)=>x!=='unknown');
  const lines=cleanLines((Array.isArray(s.lines)?s.lines:[]).map((x:any)=>x?.name||x?.ref||x?.fahrtNr));
  const stop=coerceStop(String(s.id||''),s.name,s.location?.latitude,s.location?.longitude,lat,lon,[...new Set(modes)],lines,s.platform);
  if(stop&&stop.distanceM!==null&&stop.distanceM<=radius)out.push(stop);
 }return out.slice(0,MAX);
}
async function osm(lat:number,lon:number,radius:number):Promise<Stop[]>{
 // Constrained manual diagnostic: 3 km and up to 50 raw nodes/ways, no recurring scan.
 const r=Math.min(radius,3000);
 const q='[out:json][timeout:8];(node["highway"="bus_stop"](around:'+r+','+lat+','+lon+');node["railway"~"station|halt|tram_stop|subway_entrance"](around:'+r+','+lat+','+lon+');node["public_transport"~"platform|station"](around:'+r+','+lat+','+lon+');way["public_transport"="platform"](around:'+r+','+lat+','+lon+'););out tags center 50;';
 const res=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8',accept:'application/json'},body:'data='+encodeURIComponent(q),signal:AbortSignal.timeout(8500)});
 if(!res.ok)throw new Error('Overpass HTTP '+res.status);const payload=await res.json();
 if(!Array.isArray(payload?.elements))throw new Error('Overpass response invalid');
 const out:Stop[]=[];for(const el of payload.elements){
  const tags=el.tags||{};const modes=[];
  if(tags.highway==='bus_stop'||tags.bus==='yes'||tags.amenity==='bus_station')modes.push('bus');
  if(tags.railway==='tram_stop'||tags.tram==='yes')modes.push('tram');
  if(tags.railway==='subway_entrance'||tags.subway==='yes')modes.push('subway');
  if(tags.railway==='station'||tags.railway==='halt'||tags.train==='yes')modes.push('train');
  const stop=coerceStop(String(el.type||'node')+'/'+String(el.id||''),tags.name||tags['name:de'],el.lat??el.center?.lat,el.lon??el.center?.lon,lat,lon,modes,cleanLines(String(tags.route_ref||tags.ref||'').split(/[;,]/)),tags.platform_ref||tags.local_ref);
  if(stop&&stop.distanceM!==null&&stop.distanceM<=r)out.push(stop);
 }return out.slice(0,MAX);
}
async function audit(id:string,label:string,fn:()=>Promise<Stop[]>):Promise<Audit>{
 const at=Date.now();try{const stops=await fn();return{providerId:id,provider:label,status:stops.length?'ok':'empty',count:stops.length,shown:stops.length,unnamed:stops.filter(x=>!x.name).length,durationMs:Date.now()-at,stops}}catch(e){return{providerId:id,provider:label,status:'error',count:0,shown:0,unnamed:0,durationMs:Date.now()-at,note:String((e as any)?.message||'Provider unavailable').slice(0,100),stops:[]}}}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
 if(req.method!=='POST')return json({ok:false,error:'Method not allowed'},405);
 try{
  await requireUserAndLimit(req);
  const body=await req.json().catch(()=>null);
  if(body?.action!=='provider-audit'||body?.country!=='DE')throw new ErrorResponse(400,'Germany test audit only');
  const lat=Number(body.lat),lon=Number(body.lon);if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||!lat||!lon)throw new ErrorResponse(400,'Invalid coordinates');
  const radius=Math.min(6000,Math.max(500,Math.round(Number(body.radiusM)||3500)));
  const key=[lat.toFixed(4),lon.toFixed(4),radius].join('|'),cached=IN_MEMORY.get(key);
  if(cached&&cached.expires>Date.now())return json(cached.data);
  const checked=await Promise.all([
   audit('de-gtfs-cache','LifeDashPro dedicated GTFS',()=>gtfs(lat,lon,radius)),
   audit('eu-transitland','Transitland v2',()=>transitland(lat,lon,radius)),
   audit('de-db-rest','DB transport REST / dbnav',()=>db(lat,lon,radius)),
   audit('osm','OpenStreetMap / Overpass',()=>osm(lat,lon,radius))
  ]);
  const notConnected:Audit[]=['MVV regional direct feed','MVG direct feed'].map((label,i)=>({providerId:i===0?'mvv-direct':'mvg-direct',provider:label,status:'not_connected',count:0,shown:0,unnamed:0,durationMs:0,note:'Not connected to this diagnostic endpoint; no API request was made.',stops:[]}));
  const result={ok:true,action:'provider-audit',country:'DE',generatedAt:new Date().toISOString(),radiusM:radius,diagnosticOnly:true,truncatedPerProviderAt:MAX,providers:[...checked,...notConnected]};
  if(IN_MEMORY.size>80)IN_MEMORY.clear();IN_MEMORY.set(key,{data:result,expires:Date.now()+90_000});
  return json(result);
 }catch(e){const code=e instanceof ErrorResponse?e.status:503;return json({ok:false,error:e instanceof ErrorResponse?e.message:'Provider audit temporarily unavailable'},code)}
});