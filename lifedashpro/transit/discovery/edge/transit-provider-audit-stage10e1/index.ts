// LifeDashPro NEXT Transit Diagnostics v2 — read-only, signed-in, manual use.
// One endpoint for real GTFS / external API status, page-by-page with no 25/40 presentation truncation.
// Mobility Database is a *feed catalog*, never masquerades as a live nearby timetable.
class ErrorResponse extends Error {constructor(readonly status:number,message:string){super(message)}}
const CORS={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type,x-client-info','access-control-allow-methods':'POST, OPTIONS'};
const ROOT='https://gnqtngtuzbxohgwgvmpb.supabase.co/rest/v1/rpc/';
const SIZE_PER_PAGE=100; // A network/SQL page size; NOT a total-results limit. Next pages are explicit.
const PAGE_MAX_OFFSET=30000;
const CACHE = new Map<string,{expires:number,data:unknown}>();
const OVERPASS_UA='LifeDashPro-TransitDiagnostics/2.0 (+https://mkdigital.app/)';
let OVERPASS_NEXT_ALLOWED=0;
let OVERPASS_BLOCKED_UNTIL=0;
function out(body:unknown,status=200){return Response.json(body,{status,headers:{...CORS,'cache-control':'private, no-store'}})}
function publishable(){const x=Deno.env.get('SUPABASE_ANON_KEY');if(x)return x;try{const p=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}');if(typeof p.default==='string')return p.default;}catch{}throw new ErrorResponse(503,'Authentication service unavailable')}
function svc(){
 const k=(Deno.env.get('LDP_DEDICATED_TRANSIT_SERVICE_ROLE_KEY')||'').trim();
 if(!k)throw Error('Dedicated Transit service key not configured');
 return k;
}
async function requireUserAndLimit(req:Request) {
 const jwt=/^Bearer\s+([^\s]+)$/i.exec(req.headers.get('authorization')||'')?.[1]||'';
 if(!jwt||jwt.startsWith('sb_publishable_')||jwt.startsWith('sb_secret_'))throw new ErrorResponse(401,'Signed-in account required');
 const url=Deno.env.get('SUPABASE_URL')||'';
 if(!url)throw new ErrorResponse(503,'Authentication service unavailable');
 const headers={apikey:publishable(),authorization:'Bearer '+jwt,accept:'application/json'};
 const response=await fetch(url+'/auth/v1/user',{headers,signal:AbortSignal.timeout(4500)});
 if(!response.ok)throw new ErrorResponse(401,'Invalid or expired session');
 const user=await response.json().catch(()=>null);if(!user?.id)throw new ErrorResponse(401,'Signed-in account required');
 const limit=await fetch(url+'/rest/v1/rpc/consume_user_rate_limit',{
   method:'POST',headers:{...headers,'content-type':'application/json'},
   body:JSON.stringify({p_bucket:'transit-provider-audit-10e1',p_limit:3,p_window_seconds:60}),
   signal:AbortSignal.timeout(5000)});
 if(!limit.ok)throw new ErrorResponse(503,'Rate limit service unavailable');
 const res=await limit.json().catch(()=>null),row=Array.isArray(res)?res[0]:res;
 if(row?.allowed!==true)throw new ErrorResponse(429,'Diagnostics requests are limited; retry later');
 return {jwt,url,anon:publishable()};
}
type Stop={sourceId:string;name:string|null;lat:number;lon:number;distanceM:number|null;mode:string[];lines:string[];platform:string|null};
type SourcePage={stops:Stop[];totalAvailable?:number|null;nextCursor?:string|null;pageSize?:number;sourceNote?:string};
type Audit={providerId:string;provider:string;status:'ok'|'empty'|'error'|'not_connected';count:number;shown:number;unnamed:number;durationMs:number;note?:string;stops:Stop[];totalAvailable?:number|null;nextCursor?:string|null;hasMore:boolean;pageSize?:number;modeCounts:Record<string,number>;withLines:number;withName:number;within1500m:number;within3000m:number;departuresCapability:'scheduled'|'live_if_available'|'station_only'|'unknown';resultKind:'nearby_stops'|'feed_catalog'};
function haversine(a:number,b:number,c:number,d:number){
 const k=Math.PI/180,s1=Math.sin((c-a)*k/2)**2,s2=Math.sin((d-b)*k/2)**2;
 return Math.round(12742000*Math.asin(Math.sqrt(Math.min(1,s1+Math.cos(a*k)*Math.cos(c*k)*s2))));
}
function cleanName(n:unknown){const s=typeof n==='string'?n.trim():'';return s&&s!=='—'&&s.toLowerCase()!=='null'?s:null}
function cleanLines(raw:unknown):string[]{const values=Array.isArray(raw)?raw:[];return [...new Set(values.map(x=>String(x||'').trim()).filter(Boolean))].slice(0,30)}
function coerceStop(sourceId:string,name:unknown,lat:unknown,lon:unknown,originLat:number,originLon:number,mode:string[],lines:string[],platform:unknown):Stop|null{
 const a=Number(lat),b=Number(lon);
 if(!sourceId||!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a)>90||Math.abs(b)>180)return null;
 return {sourceId,name:cleanName(name),lat:a,lon:b,distanceM:haversine(originLat,originLon,a,b),
    mode:[...new Set(mode)],lines:cleanLines(lines),platform:cleanName(platform)};
}
function routeMode(t:unknown){const n=Number(t);if(!Number.isFinite(n))return'unknown';if(n===3||(n>=700&&n<800))return'bus';if(n===0||(n>=900&&n<1000))return'tram';if(n===1||(n>=400&&n<500))return'subway';if(n===109)return'suburban';if(n===2||(n>=100&&n<200))return'train';if(n===4)return'ferry';return'unknown'}
async function dedicatedRpc<T>(name:string,args:Record<string,unknown>):Promise<T>{
 const key=svc();
 const headers:Record<string,string>={apikey:key,'content-type':'application/json',accept:'application/json'};
 if(key.startsWith('eyJ'))headers.authorization='Bearer '+key;
 const r=await fetch(ROOT+name,{method:'POST',headers,body:JSON.stringify(args),signal:AbortSignal.timeout(6500)});
 if(!r.ok)throw Error('Dedicated Transit DB HTTP '+r.status);
 return r.json() as Promise<T>;
}
async function privateGtfs(source:string,lat:number,lon:number,radius:number,offset:number):Promise<SourcePage>{
 const rows=await dedicatedRpc<any[]>('transit_next_diagnostic_nearby_page',
   {p_source:source,p_lat:lat,p_lon:lon,p_radius_m:radius,p_limit:SIZE_PER_PAGE,p_offset:offset});
 if(!Array.isArray(rows))throw Error('Dedicated GTFS response invalid');
 const mapped=rows.map(s=>coerceStop(String(s.stop_id||''),s.name,s.lat,s.lon,lat,lon,
    s.mode==='unknown'?[]:[String(s.mode||'unknown')],s.lines||[],s.platform)).filter(Boolean) as Stop[];
 const total=rows.length?Number(rows[0].total_matches):offset;
 return {stops:mapped,totalAvailable:rows.length?total:null,nextCursor:rows.length&&offset+rows.length<total?String(offset+rows.length):null,
   pageSize:SIZE_PER_PAGE,sourceNote:source==='de-bus-h3'?'Validated local scheduled GTFS; not nationwide.':source==='de-rail'?'Regional rail compact cache; schedule only.':'Previously imported German GTFS subset, not full nationwide feed.'};
}
function getApiKey(){const x=(Deno.env.get('TRANSITLAND_API_KEY')||'').trim();if(!x)throw Error('Transitland token not configured');return x}
async function transitland(lat:number,lon:number,radius:number,cursor:string|null):Promise<SourcePage>{
 const u=new URL('https://transit.land/api/v2/rest/stops');
 u.searchParams.set('lat',String(lat));u.searchParams.set('lon',String(lon));
 u.searchParams.set('radius',String(Math.min(radius,10000)));
 u.searchParams.set('limit',String(SIZE_PER_PAGE));
 u.searchParams.set('include_routes','true');
 u.searchParams.set('license_commercial_use_allowed','exclude_no');
 if(cursor)u.searchParams.set('after',cursor);
 const res=await fetch(u.toString(),{headers:{accept:'application/json',apikey:getApiKey()},signal:AbortSignal.timeout(7000)});
 if(!res.ok)throw Error('Transitland HTTP '+res.status);
 const data=await res.json();
 if(!Array.isArray(data?.stops))throw Error('Transitland response invalid');
 const rows:Stop[]=[];
 for(const s of data.stops){
   const routes=s.routes||s.routes_serving_stop||s.routesServingStop||[];
   const rr=Array.isArray(routes)?routes.map((x:any)=>x?.route||x):[];
   const coords=s.geometry?.coordinates||null;
   const lines=cleanLines(rr.map((r:any)=>r.route_short_name||r.route_long_name||r.route_id));
   const modes=[...new Set(rr.map((r:any)=>routeMode(r.route_type)).filter((m:string)=>m!=='unknown'))] as string[];
   const stop=coerceStop(String(s.onestop_id||s.id||s.stop_id||''),s.stop_name||s.name,
      coords?.[1]??s.lat??s.latitude,coords?.[0]??s.lon??s.longitude,lat,lon,modes,lines,s.platform_code);
   if(stop&&stop.distanceM!==null&&stop.distanceM<=radius)rows.push(stop);
 }
 // Transitland REST v2 gives an opaque 'after' cursor in response.meta.
 let after=data?.meta?.after;
 if(after==null&&typeof data?.meta?.next==='string'){
   try{const link=new URL(data.meta.next,'https://transit.land');if(link.hostname==='transit.land')after=link.searchParams.get('after');}catch{}
 }
 const next=after!=null&&/^\d{1,12}$/.test(String(after))?String(after):null;
 return {stops:rows,totalAvailable:null,nextCursor:next,pageSize:SIZE_PER_PAGE,
   sourceNote:next?'Provider reported more pages; request next cursor to continue.':'No pagination cursor returned by provider.'};
}
async function db(lat:number,lon:number,radius:number):Promise<SourcePage>{
 const u=new URL('https://v6.db.transport.rest/locations/nearby');
 Object.entries({latitude:lat,longitude:lon,results:100,distance:radius,stops:'true',poi:'false',linesOfStops:'true',profile:'dbnav',pretty:'false'}).forEach(([k,v])=>u.searchParams.set(k,String(v)));
 const res=await fetch(u.toString(),{headers:{accept:'application/json'},signal:AbortSignal.timeout(7000)});
 if(!res.ok)throw Error('DB transport REST HTTP '+res.status);
 const payload=await res.json();
 const items=Array.isArray(payload)?payload:Array.isArray(payload?.stops)?payload.stops:null;
 if(!items)throw Error('DB transport REST response invalid');
 const rows:Stop[]=[];
 for(const s of items){
   const modes=Object.entries(s.products||{}).filter(([,active])=>active===true)
     .map(([m])=>m==='suburban'?'suburban':m==='regional'?'train':m==='national'?'train':m==='bus'?'bus':m==='tram'?'tram':m==='subway'?'subway':m==='ferry'?'ferry':'unknown').filter(x=>x!=='unknown');
   const lines=cleanLines((Array.isArray(s.lines)?s.lines:[]).map((x:any)=>x?.name||x?.ref||x?.fahrtNr));
   const stop=coerceStop(String(s.id||''),s.name,s.location?.latitude,s.location?.longitude,lat,lon,modes,lines,s.platform);
   if(stop&&stop.distanceM!==null&&stop.distanceM<=radius)rows.push(stop);
 }
 return {stops:rows,pageSize:100,sourceNote:'DB public transport.rest availability not guaranteed. Request attempted once; no repeated retries.'};
}
function overpassUrl(){
 // Admin-managed optional endpoint; no random host switching to evade policy refusals.
 const configured=(Deno.env.get('LDP_OVERPASS_INTERPRETER_URL')||'').trim();
 if(!configured)return 'https://overpass-api.de/api/interpreter';
 let u:URL;try{u=new URL(configured)}catch{throw Error('Configured Overpass URL invalid')}
 if(u.protocol!=='https:'||u.username||u.password||u.hash||u.search||
    !['overpass-api.de','api.overpass.ch'].includes(u.hostname)||
    !(u.pathname==='/api/interpreter'||/^\/v1\/[a-zA-Z0-9_-]{10,}\/interpreter$/.test(u.pathname)))
    throw Error('Configured Overpass endpoint is not approved');
 return u.toString();
}
async function osm(lat:number,lon:number,radius:number):Promise<SourcePage>{
 const now=Date.now();
 if(now<OVERPASS_BLOCKED_UNTIL)throw Error('Overpass policy cooldown in effect; refusing repeat after HTTP 406');
 if(now<OVERPASS_NEXT_ALLOWED)throw Error('Overpass diagnostic cooldown; try again later');
 OVERPASS_NEXT_ALLOWED=now+60000;
 const r=Math.min(radius,3000);
 const q='[out:json][timeout:8];(node["highway"="bus_stop"](around:'+r+','+lat+','+lon+');node["railway"~"station|halt|tram_stop|subway_entrance"](around:'+r+','+lat+','+lon+');node["public_transport"~"platform|station"](around:'+r+','+lat+','+lon+');way["public_transport"="platform"](around:'+r+','+lat+','+lon+'););out center;';
 const response=await fetch(overpassUrl(),{method:'POST',
   headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8',accept:'application/json',
     'user-agent':OVERPASS_UA,'referer':'https://mkdigital.app/'},
   body:new URLSearchParams({data:q}).toString(),signal:AbortSignal.timeout(12000)});
 if(response.status===406||response.status===429){
   OVERPASS_BLOCKED_UNTIL=Date.now()+30*60000;
   throw Error('Overpass HTTP '+response.status+' — provider refused or rate limited; no automatic retry');
 }
 if(!response.ok)throw Error('Overpass HTTP '+response.status);
 const raw=await response.text();
 if(raw.length>1_500_000)throw Error('Overpass result too large for safe diagnostics; reduce radius (not silently truncated)');
 const payload=JSON.parse(raw);
 if(!Array.isArray(payload?.elements))throw Error('Overpass response invalid');
 const out:Stop[]=[];
 for(const el of payload.elements){
   const tags=el.tags||{},modes=[];
   if(tags.highway==='bus_stop'||tags.bus==='yes'||tags.amenity==='bus_station')modes.push('bus');
   if(tags.railway==='tram_stop'||tags.tram==='yes')modes.push('tram');
   if(tags.railway==='subway_entrance'||tags.subway==='yes')modes.push('subway');
   if(tags.railway==='station'||tags.railway==='halt'||tags.train==='yes')modes.push('train');
   const stop=coerceStop(String(el.type||'node')+'/'+String(el.id||''),
      tags.name||tags['name:de'],el.lat??el.center?.lat,el.lon??el.center?.lon,
      lat,lon,modes,cleanLines(String(tags.route_ref||tags.ref||'').split(/[;,]/)),tags.platform_ref||tags.local_ref);
   if(stop&&stop.distanceM!==null&&stop.distanceM<=r)out.push(stop);
 }
 return {stops:out,sourceNote:'OpenStreetMap locations only; no guaranteed departures or live service.'};
}
function classify(stops:Stop[]){
 const types:Record<string,number>={bus:0,train:0,suburban:0,tram:0,subway:0,ferry:0,unknown:0};
 for(const x of stops){
   if(!x.mode?.length){types.unknown++;continue;}
   let valid=false;
   for(const mode of new Set(x.mode)){if(types[mode]===undefined)types.unknown++;else types[mode]++;valid=true}
   if(!valid)types.unknown++;
 }
 return types;
}
function capacity(id:string):Audit['departuresCapability']{
 if(id==='osm')return'station_only';
 if(id==='eu-transitland')return'live_if_available';
 if(id==='de-bus-h3'||id==='de-rail'||id==='de-gtfs-cache')return'scheduled';
 return'unknown';
}
async function audit(id:string,label:string,fn:()=>Promise<SourcePage>):Promise<Audit>{
 const at=Date.now();
 try{
   const result=await fn(),stops=result.stops;
   const total=result.totalAvailable;
   const next=result.nextCursor||null;
   return {providerId:id,provider:label,status:stops.length?'ok':'empty',
      count:stops.length,shown:stops.length,unnamed:stops.filter(x=>!x.name).length,
      durationMs:Date.now()-at,stops,totalAvailable:total,nextCursor:next,
      hasMore:Boolean(next),pageSize:result.pageSize,modeCounts:classify(stops),
      withLines:stops.filter(x=>x.lines.length>0).length,
      withName:stops.filter(x=>!!x.name).length,
      within1500m:stops.filter(x=>(x.distanceM??Infinity)<=1500).length,
      within3000m:stops.filter(x=>(x.distanceM??Infinity)<=3000).length,
      departuresCapability:capacity(id),resultKind:'nearby_stops',note:result.sourceNote};
 }catch(e){
   return {providerId:id,provider:label,status:'error',count:0,shown:0,unnamed:0,
     durationMs:Date.now()-at,note:String((e as any)?.message||'Source unavailable').slice(0,170),
     stops:[],hasMore:false,modeCounts:classify([]),withLines:0,withName:0,
     within1500m:0,within3000m:0,departuresCapability:capacity(id),resultKind:'nearby_stops'};
 }
}
async function metadata(){
 const [catalog,cache]=await Promise.allSettled([
  dedicatedRpc<any[]>('transit_mobility_api_country_summary',{}),
  dedicatedRpc<any[]>('transit_shared_cache_stats_v1',{})]);
 const german=catalog.status==='fulfilled'&&Array.isArray(catalog.value)?catalog.value.filter(x=>x.country_code==='DE'):[];
 const cached=cache.status==='fulfilled'&&Array.isArray(cache.value)?cache.value:[];
 return {
  mobilityDatabase:{status:catalog.status==='fulfilled'?'catalog_available':'error',
    description:'Mobility Database lists discoverable GTFS/GTFS-RT/GBFS FEEDS, not nearby stops or live departure API results.',
    country:'DE',feedCounts:Object.fromEntries(german.map(x=>[x.feed_kind,Number(x.latest_count)||0])),
    totalFeedListings:german.reduce((sum,x)=>sum+Number(x.latest_count||0),0),
    lastCheckedAt:german[0]?.last_checked_at||null,
    directlyServingNearby:false,sourceUrl:'https://mobilitydatabase.org/'},
  sharedCache:{status:cache.status==='fulfilled'?'available':'error',
    description:'Dedicated private shared cache counters, NOT the number of unique stops.',
    buckets:cached.map(x=>({bucket:String(x.bucket),records:Number(x.items||0),newest:x.newest||null})),
    directlyServingNearby:true}
 };
}
function candidate(sourceId:string,lat:number,lon:number,radius:number,offset:number,cursor:string|null):Promise<SourcePage>{
 if(sourceId==='de-gtfs-cache')return privateGtfs('de-national',lat,lon,radius,offset);
 if(sourceId==='de-bus-h3')return privateGtfs('de-bus-h3',lat,lon,radius,offset);
 if(sourceId==='de-rail')return privateGtfs('de-rail',lat,lon,radius,offset);
 if(sourceId==='eu-transitland')return transitland(lat,lon,radius,cursor);
 if(sourceId==='de-db-rest')return db(lat,lon,radius);
 if(sourceId==='osm')return osm(lat,lon,radius);
 throw new ErrorResponse(400,'Unknown provider');
}
function unconnected(name:string,id:string):Audit{
 return {providerId:id,provider:name,status:'not_connected',count:0,shown:0,
   unnamed:0,durationMs:0,stops:[],hasMore:false,modeCounts:classify([]),withLines:0,
   withName:0,within1500m:0,within3000m:0,departuresCapability:'unknown',
   resultKind:'nearby_stops',note:'Not connected to this diagnostic; no API request made.'};
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
 if(req.method!=='POST')return out({ok:false,error:'Method not allowed'},405);
 try{
   const auth=await requireUserAndLimit(req);
   const body=await req.json().catch(()=>null);
   const action=String(body?.action||'');
   if(body?.country!=='DE'||!['provider-audit','provider-audit-page','provider-audit-departures'].includes(action))
     throw new ErrorResponse(400,'Germany diagnostic actions only');
   if(action==='provider-audit-departures'){
     const stopId=String(body?.stopId||'').trim(),feedSource=String(body?.feedSource||'').trim();
     if(!stopId||stopId.length>160||!['de-bus-h3','de-rail','de-national','de-rvv','de-mvv','eu-transitland','de-db-rest'].includes(feedSource))
       throw new ErrorResponse(400,'Use verified stop ID and feedSource to audit departures');
     const res=await fetch(auth.url+'/functions/v1/transit-shared-cache-next',{
       method:'POST',headers:{apikey:auth.anon,authorization:'Bearer '+auth.jwt,'content-type':'application/json'},
       body:JSON.stringify({action:'departures',country:'DE',stopId,feedSource,duration:90}),
       signal:AbortSignal.timeout(17000)});
     const data=await res.json().catch(()=>null),dep=Array.isArray(data?.departures)?data.departures:[];
     return out({ok:res.ok&&data?.ok===true,action,country:'DE',stopId,feedSource,
        returned:dep.length,live:dep.filter((d:any)=>d.realtime===true).length,
        scheduled:dep.filter((d:any)=>d.realtime!==true).length,
        status:!res.ok?'error':dep.length?'found':'no_departures_in_window',
        reason:!res.ok?'Provider unavailable or invalid stop ID':dep.length?'Real departures for selected stop.':'No departures returned in the next 90 minutes; NOT proof that the stop has no timetable.',
        departures:dep,generatedAt:new Date().toISOString()});
   }
   const lat=Number(body?.lat),lon=Number(body?.lon);
   if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<47||lat>55.3||lon<5||lon>16)
     throw new ErrorResponse(400,'Germany location coordinates required');
   const radius=Math.min(6000,Math.max(500,Math.round(Number(body?.radiusM)||3500)));
   const source=String(body?.providerId||'');
   const offset=Math.min(PAGE_MAX_OFFSET,Math.max(0,Math.floor(Number(body?.offset)||0)));
   const cursor=body?.cursor==null?null:String(body.cursor);
   if(cursor&&!/^\d{1,12}$/.test(cursor))throw new ErrorResponse(400,'Invalid provider pagination cursor');
   if(action==='provider-audit-page'){
      const name={ 'de-gtfs-cache':'LifeDashPro dedicated GTFS',
         'de-bus-h3':'GTFS.de rural bus H3','de-rail':'Germany regional train GTFS',
         'eu-transitland':'Transitland v2','de-db-rest':'DB transport REST / dbnav',
         'osm':'OpenStreetMap / Overpass'}[source]||'';
      if(!name)throw new ErrorResponse(400,'Unknown provider');
      if(!['de-gtfs-cache','de-bus-h3','de-rail','eu-transitland'].includes(source)
         &&(cursor||offset>0))throw new ErrorResponse(400,'This provider has no pagination endpoint');
      const result=await audit(source,name,()=>candidate(source,lat,lon,radius,offset,cursor));
      return out({ok:true,action,country:'DE',diagnosticOnly:true,provider:result,
        sourcePaginationOnly:true,generatedAt:new Date().toISOString()});
   }
   const key=[lat.toFixed(4),lon.toFixed(4),radius,'v2'].join('|'),cached=CACHE.get(key);
   if(cached&&cached.expires>Date.now())return out(cached.data);
   const [results,extra]=await Promise.all([
      Promise.all([
        audit('de-gtfs-cache','LifeDashPro dedicated GTFS',()=>privateGtfs('de-national',lat,lon,radius,0)),
        audit('eu-transitland','Transitland v2',()=>transitland(lat,lon,radius,null)),
        audit('de-bus-h3','GTFS.de rural bus H3',()=>privateGtfs('de-bus-h3',lat,lon,radius,0)),
        audit('de-rail','Germany regional rail GTFS',()=>privateGtfs('de-rail',lat,lon,radius,0)),
        audit('de-db-rest','DB transport REST / dbnav',()=>db(lat,lon,radius)),
        audit('osm','OpenStreetMap / Overpass',()=>osm(lat,lon,radius))
      ]),
      metadata().catch(()=>({mobilityDatabase:{status:'error'},sharedCache:{status:'error'}}))
   ]);
   // Keep original providers[] contract for NEXT Android, with additive fields.
   const providers=[...results,unconnected('MVV regional direct feed','mvv-direct'),
     unconnected('MVG direct feed','mvg-direct')];
   const complete={ok:true,action:'provider-audit',country:'DE',
     generatedAt:new Date().toISOString(),radiusM:radius,diagnosticOnly:true,
     pagination:{pageSize:SIZE_PER_PAGE,totalLimit:'none; explicit next page per provider',allReturnedOnThisPage:true},
     truncatedPerProviderAt:null,providers,...extra,
     notices:['A feed catalog is not a nearby provider.','Rural H3 contains only an imported region.',
       'OSM stops do not include scheduled departures.','Extra API pages consume further provider quota.']};
   if(CACHE.size>60)CACHE.clear();
   CACHE.set(key,{data:complete,expires:Date.now()+90_000});
   return out(complete);
 }catch(e){
   const code=e instanceof ErrorResponse?e.status:503;
   return out({ok:false,error:e instanceof ErrorResponse?e.message:'Provider audit temporarily unavailable'},code);
 }
});
