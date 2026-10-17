import JSZip from 'npm:jszip@3.10.1';

// LifeDashPro v37.29 — Transit Europe/Balkans coverage hardening
// Single-file Edge Function on purpose: Supabase remote bundling previously omitted ../_shared/security.ts.

export class HttpError extends Error {
  status:number; retryAfter?:number;
  constructor(status:number,message:string,retryAfter?:number){super(message);this.status=status;this.retryAfter=retryAfter;}
}
type AuthContext={userId:string;accessToken:string;apiKey:string;supabaseUrl:string};
function publishableKey(){const legacy=Deno.env.get('SUPABASE_ANON_KEY');if(legacy)return legacy;const raw=Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');if(raw){try{const p=JSON.parse(raw),v=p?.default||Object.values(p||{})[0];if(typeof v==='string'&&v)return v}catch{}}throw new HttpError(500,'Supabase publishable key is not configured')}
function bearer(req:Request){const h=req.headers.get('authorization')||'',m=h.match(/^Bearer\s+(.+)$/i);if(!m?.[1])throw new HttpError(401,'Authentication required');const t=m[1].trim();if(t.startsWith('sb_publishable_')||t.startsWith('sb_secret_'))throw new HttpError(401,'Authenticated user session required');return t}
async function requireAuthenticatedUser(req:Request):Promise<AuthContext>{if(req.method!=='POST')throw new HttpError(405,'Method not allowed');const supabaseUrl=Deno.env.get('SUPABASE_URL');if(!supabaseUrl)throw new HttpError(500,'SUPABASE_URL is not configured');const apiKey=publishableKey(),accessToken=bearer(req),r=await fetch(`${supabaseUrl}/auth/v1/user`,{headers:{apikey:apiKey,authorization:`Bearer ${accessToken}`,accept:'application/json'}});if(!r.ok)throw new HttpError(401,'Invalid or expired user session');const u=await r.json().catch(()=>null);if(!u?.id)throw new HttpError(401,'Authenticated user session required');return{userId:u.id,accessToken,apiKey,supabaseUrl}}
async function enforceUserRateLimit(a:AuthContext,bucket:string,limit:number,windowSeconds:number){const r=await fetch(`${a.supabaseUrl}/rest/v1/rpc/consume_user_rate_limit`,{method:'POST',headers:{apikey:a.apiKey,authorization:`Bearer ${a.accessToken}`,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({p_bucket:bucket,p_limit:limit,p_window_seconds:windowSeconds})});if(!r.ok)throw new HttpError(503,'Rate limit service unavailable');const p=await r.json().catch(()=>null),row=Array.isArray(p)?p[0]:p;if(!row||row.allowed!==true)throw new HttpError(429,'Too many requests',Math.max(1,Number(row?.retry_after_seconds)||windowSeconds))}
async function authenticateAndRateLimit(req:Request,bucket:string,limit:number,windowSeconds:number){const a=await requireAuthenticatedUser(req);await enforceUserRateLimit(a,bucket,limit,windowSeconds);return a}
function jsonError(e:unknown,headers:Record<string,string>){const x=e as any,status=Number(x?.status)||500,body:{ok:false;error:string;retryAfter?:number}={ok:false,error:String(x?.message||'Request failed')};if(x?.retryAfter)body.retryAfter=x.retryAfter;return new Response(JSON.stringify(body),{status,headers:{...headers,'content-type':'application/json',...(x?.retryAfter?{'retry-after':String(x.retryAfter)}:{})}})}

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
const DB_BASE='https://v6.db.transport.rest';
const DB_PROFILES=['dbnav','dbweb','db'] as const;
const CH_BASE='https://transport.opendata.ch/v1';
const TRANSITLAND_BASE='https://transit.land/api/v2/rest';
const TRANSITLAND_SOURCE='https://www.transit.land/';
const JSP_FEED={id:'mk-jsp',name:'JSP Skopje official GTFS',url:'https://www.modeshift.app/api/v1/9814b106-2afe-47c8-919b-bdec6a5e521e/transport/gtfs/gtfs.zip',tz:'Europe/Skopje',sourceUrl:'https://mobilitydatabase.org/feeds/gtfs/mdb-3045'};

const PROVIDERS={
 MK:{country:'MK',primary:'mk-jsp',quality:'scheduled',name:'JSP Skopje official GTFS',sourceUrl:JSP_FEED.sourceUrl,notes:'Official GTFS schedule adapter.'},
 DE:{country:'DE',primary:'transitland-v2',quality:'live',name:'Transitland v2 + Germany fallbacks',sourceUrl:TRANSITLAND_SOURCE,notes:'Transitland v2 primary; DB JSON is a short-timeout fallback only.'},
 CH:{country:'CH',primary:'transitland-v2',quality:'live',name:'Transitland v2 + Swiss fallback',sourceUrl:TRANSITLAND_SOURCE,notes:'Transitland v2 primary; Swiss stationboard is a short-timeout fallback only.'},
} as const;
function providerMeta(country:string){return country==='MK'?PROVIDERS.MK:(country==='DE'?PROVIDERS.DE:(country==='CH'?PROVIDERS.CH:{country,primary:'transitland-v2',quality:'live' as const,name:'Transitland v2',sourceUrl:TRANSITLAND_SOURCE,notes:'Europe-wide GTFS/GTFS-RT aggregator.'}))}


type Row=Record<string,string>;
type TransitQuality='live'|'scheduled'|'station-only';
type TransitSourceKind='official-api'|'official-gtfs'|'official-gtfs-rt'|'aggregator'|'community'|'osm';
type ProviderAttempt={providerId:string;provider:string;ok:boolean;durationMs:number;itemCount?:number;error?:string};
type Stop={id:string;name:string;lat:number;lon:number;distanceM?:number;lines?:string[];code?:string;platform?:string;mode?:string;providerId?:string;provider?:string;feedSource?:string;sourceKind?:TransitSourceKind;quality?:TransitQuality};
type Departure={id:string;stopId?:string;routeId?:string;tripId?:string;line:string;direction:string;mode?:string;realtimeTime?:string;scheduledTime?:string;localTime?:string;plannedLocalTime?:string;delayMinutes?:number|null;platform?:string|null;cancelled?:boolean;realtime?:boolean;status?:'on_time'|'delayed'|'cancelled'|'scheduled'|'unknown';providerId?:string;provider:string;feedSource?:string;sourceKind?:TransitSourceKind;quality?:TransitQuality};
type FeedCache={at:number;stops:{id:string;name:string;lat:number;lon:number;code?:string;platform?:string}[];routes:Map<string,Row>;trips:Map<string,Row>;timesByStop:Map<string,Row[]>;routesByStop:Map<string,string[]>;calendar:Map<string,Row>;exceptions:Map<string,Map<string,string>>};
const GTFS_CACHE=new Map<string,FeedCache>();
const JSON_CACHE=new Map<string,{at:number;value:any}>();

function csv(text:string):Row[]{const rows:string[][]=[];let row:string[]=[],cell='',q=false;for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c==='"'&&text[i+1]==='"'){cell+='"';i++}else if(c==='"')q=false;else cell+=c}else if(c==='"')q=true;else if(c===','){row.push(cell);cell=''}else if(c==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell=''}else cell+=c}if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row)}const h=rows.shift()||[];return rows.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(h.map((k,i)=>[k.trim(),String(r[i]??'').trim()]))) }
async function zipTxt(zip:JSZip,name:string){const f=zip.file(name);return f?await f.async('text'):''}
function distKm(a:number,b:number,c:number,d:number){const R=6371,p=Math.PI/180,x=(c-a)*p,y=(d-b)*p,q=Math.sin(x/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(y/2)**2;return R*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q))}
function timeSec(v:string){const p=String(v||'').split(':').map(Number);return p.length>=2&&p.every(Number.isFinite)?p[0]*3600+p[1]*60+(p[2]||0):NaN}
function hhmm(sec:number){const s=((sec%86400)+86400)%86400;return`${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}`}
function localParts(tz:string){const parts=new Intl.DateTimeFormat('en-GB',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date());const g=(k:string)=>parts.find(x=>x.type===k)?.value||'';return{date:`${g('year')}${g('month')}${g('day')}`,weekday:g('weekday').toLowerCase().slice(0,3),sec:Number(g('hour'))*3600+Number(g('minute'))*60+Number(g('second'))}}
function isoLocalTime(v:any){if(v==null)return undefined;const raw=String(v);const m=raw.match(/T(\d{2}):(\d{2})/);if(m)return`${m[1]}:${m[2]}`;const n=Number(v),d=Number.isFinite(n)?new Date(n<1e12?n*1000:n):new Date(raw);if(Number.isNaN(d.getTime()))return undefined;return`${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}` }
function activeService(serviceId:string,feed:FeedCache,date:string,weekday:string){const ex=feed.exceptions.get(serviceId)?.get(date);if(ex==='1')return true;if(ex==='2')return false;const c=feed.calendar.get(serviceId);if(!c)return true;if(c.start_date&&date<c.start_date)return false;if(c.end_date&&date>c.end_date)return false;const key=({mon:'monday',tue:'tuesday',wed:'wednesday',thu:'thursday',fri:'friday',sat:'saturday',sun:'sunday'} as any)[weekday];return key?c[key]==='1':true}
function uniq(xs:string[],limit=16){return[...new Set(xs.map(x=>String(x||'').trim()).filter(Boolean))].slice(0,limit)}
function dbLines(raw:any){return uniq((Array.isArray(raw)?raw:[]).map(x=>String(x?.name||x?.fahrtNr||x?.ref||'')))}
function dbMode(p:any){if(p?.bus)return'bus';if(p?.tram)return'tram';if(p?.subway)return'subway';if(p?.suburban)return'suburban';if(p?.ferry)return'ferry';return'train'}
function swissMode(category:any,name:any){const c=`${category||''} ${name||''}`.toLowerCase();if(/bus|b\d/.test(c))return'bus';if(/tram|t\d/.test(c))return'tram';if(/ship|bat|schiff/.test(c))return'ferry';if(/metro|m\d/.test(c))return'subway';if(/^s\s?\d| s\d/.test(c))return'suburban';return'train'}
async function fetchJsonCached(url:string,ttlMs:number,timeoutMs=4500,headers:Record<string,string>={}){const cacheKey=url.replace(/([?&](?:apikey|api_key|api_token|access_token)=)[^&]+/ig,'$1***');const hit=JSON_CACHE.get(cacheKey);if(hit&&Date.now()-hit.at<ttlMs)return hit.value;const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeoutMs);try{const r=await fetch(url,{headers:{accept:'application/json','user-agent':'LifeDashPro Transit Europe/37.29',...headers},signal:ctl.signal});if(!r.ok)throw new HttpError(r.status===429?429:502,`Transit upstream HTTP ${r.status}`,r.status===429?30:undefined);const v=await r.json();JSON_CACHE.set(cacheKey,{at:Date.now(),value:v});return v}finally{clearTimeout(timer)}}
function transitlandKey(){const key=String(Deno.env.get('TRANSITLAND_API_KEY')||'').trim();if(!key)throw new HttpError(503,'TRANSITLAND_API_KEY is not configured');return key}
async function transitlandJson(path:string,params:Record<string,string|number|boolean|undefined>,ttlMs:number,timeoutMs=4500){const u=new URL(`${TRANSITLAND_BASE}${path}`);for(const[k,v]of Object.entries(params)){if(v!==undefined&&v!==null)u.searchParams.set(k,String(v))}return fetchJsonCached(u.toString(),ttlMs,timeoutMs,{apikey:transitlandKey()})}
function tlRouteRows(x:any){const candidates=[x?.routes,x?.routes_serving_stop,x?.routesServingStop,x?.route_stops,x?.routeStops];for(const c of candidates){if(Array.isArray(c))return c.map((r:any)=>r?.route||r).filter(Boolean)}return[]}
function tlLine(r:any){return String(r?.route_short_name||r?.route_shortname||r?.short_name||r?.route_long_name||r?.route_id||'').trim()}
function tlMode(routeType:any){const n=Number(routeType);if(n===0||n===5||n===12)return'tram';if(n===1)return'subway';if(n===2||n===6||n===7)return'train';if(n===3||n===11)return'bus';if(n===4)return'ferry';if(n>=100&&n<200)return'train';if(n>=200&&n<300)return'bus';if(n>=400&&n<500)return'subway';if(n>=700&&n<800)return'bus';return'all'}
function tlCoords(x:any){const c=x?.geometry?.coordinates;if(Array.isArray(c)&&c.length>=2)return{lat:Number(c[1]),lon:Number(c[0])};return{lat:Number(x?.lat??x?.latitude),lon:Number(x?.lon??x?.longitude)}}
function tlTime(v:any){if(v==null)return undefined;const raw=String(v);if(/^\d{1,2}:\d{2}/.test(raw)){const[a,b]=raw.split(':');return`${String(Number(a)%24).padStart(2,'0')}:${String(b).padStart(2,'0')}`}return isoLocalTime(v)}
function tlEventTime(ev:any,fallback:any){return tlTime(ev?.estimated_time??ev?.estimatedTime??ev?.time??ev?.departure_time??ev?.departureTime??fallback)}
function tlDelayMinutes(ev:any){const d=Number(ev?.delay);return Number.isFinite(d)?Math.round(d/60):null}
async function nearbyTransitland(lat:number,lon:number,radiusM:number,limit:number):Promise<Stop[]>{const data=await transitlandJson('/stops',{lat,lon,radius:Math.min(10000,Math.max(200,radiusM)),limit:Math.min(40,Math.max(1,limit)),include_routes:true,license_commercial_use_allowed:'exclude_no'},45_000,4500);const rows=Array.isArray(data?.stops)?data.stops:[];const mapped=rows.map((x:any)=>{const c=tlCoords(x),routes=tlRouteRows(x),lines=uniq(routes.map(tlLine)),mode=routes.length?tlMode(routes[0]?.route_type):'all';return{id:String(x?.onestop_id||x?.id||x?.stop_id||''),name:String(x?.stop_name||x?.name||'Transit stop'),lat:c.lat,lon:c.lon,distanceM:Math.round(distKm(lat,lon,c.lat,c.lon)*1000),lines,code:x?.stop_code||undefined,platform:x?.platform_code||undefined,mode,providerId:'eu-transitland',provider:'Transitland v2',sourceKind:'aggregator',quality:'scheduled'}}).filter((x:any)=>x.id&&Number.isFinite(x.lat)&&Number.isFinite(x.lon)&&x.distanceM<=radiusM).sort((a:any,b:any)=>a.distanceM-b.distanceM);const out:Stop[]=[];for(const x of mapped){const k=x.name.toLowerCase().replace(/\s+/g,' ').trim();const i=out.findIndex(y=>k===y.name.toLowerCase().replace(/\s+/g,' ').trim()&&distKm(x.lat,x.lon,y.lat,y.lon)<0.12);if(i>=0){out[i]={...out[i],distanceM:Math.min(out[i].distanceM||999999,x.distanceM||999999),lines:uniq([...(out[i].lines||[]),...(x.lines||[])])}}else out.push(x)}return out.slice(0,limit)}
async function resolveTransitlandStop(lat:number,lon:number){
 const rows=await nearbyTransitland(lat,lon,1800,8);
 return rows.sort((a,b)=>(a.distanceM||999999)-(b.distanceM||999999))[0]||null;
}
async function departuresTransitland(stopId:string,duration:number):Promise<Departure[]>{const data=await transitlandJson(`/stops/${encodeURIComponent(stopId)}/departures`,{next:Math.min(10800,Math.max(1800,duration*60)),limit:40,include_alerts:false},20_000,4500);const stops=Array.isArray(data?.stops)?data.stops:[];const stop=stops[0]||data?.stop||null;const rows=Array.isArray(stop?.departures)?stop.departures:(Array.isArray(data?.departures)?data.departures:[]);return rows.map((x:any,i:number)=>{const trip=x?.trip||{},route=trip?.route||x?.route||{},ev=x?.departure||x?.arrival||{},planned=tlTime(x?.departure_time||x?.arrival_time),actual=tlEventTime(ev,planned),rel=String(x?.schedule_relationship||trip?.schedule_relationship||'STATIC').toUpperCase(),delay=tlDelayMinutes(ev),line=String(route?.route_short_name||route?.route_long_name||route?.route_id||trip?.trip_short_name||'—'),direction=String(x?.stop_headsign||trip?.trip_headsign||trip?.trip_short_name||route?.route_long_name||'—'),cancelled=['CANCELED','DELETED','SKIPPED'].includes(rel),realtime=rel!=='STATIC'||delay!=null||Boolean(ev?.time||ev?.estimated_time||ev?.estimatedTime);return{id:String(trip?.trip_id||trip?.id||`${stopId}-${i}-${planned||actual||''}`),line,direction,mode:tlMode(route?.route_type),localTime:actual||planned,plannedLocalTime:planned||actual,delayMinutes:delay,platform:x?.platform_code||x?.stop?.platform_code||null,cancelled,realtime,providerId:'eu-transitland',provider:'Transitland v2',sourceKind:'aggregator',quality:realtime?'live':'scheduled',status:cancelled?'cancelled':(!realtime?'scheduled':((delay||0)>0?'delayed':'on_time')),stopId,tripId:String(trip?.trip_id||trip?.id||'')||undefined,routeId:String(route?.route_id||route?.id||'')||undefined,realtimeTime:actual||planned,scheduledTime:planned||actual}}).filter((x:any)=>x.localTime||x.plannedLocalTime)}


async function loadJspFeed():Promise<FeedCache>{const old=GTFS_CACHE.get(JSP_FEED.id);if(old&&Date.now()-old.at<10*60*1000)return old;const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),15000);let buf:ArrayBuffer;try{const r=await fetch(JSP_FEED.url,{headers:{accept:'application/zip','user-agent':'LifeDashPro Transit Europe/37.24'},signal:ctl.signal});if(!r.ok)throw new HttpError(502,`GTFS HTTP ${r.status}`);buf=await r.arrayBuffer()}finally{clearTimeout(timer)}const zip=await JSZip.loadAsync(buf);const[stopsR,routesR,tripsR,timesR,calR,exR]=await Promise.all([zipTxt(zip,'stops.txt'),zipTxt(zip,'routes.txt'),zipTxt(zip,'trips.txt'),zipTxt(zip,'stop_times.txt'),zipTxt(zip,'calendar.txt'),zipTxt(zip,'calendar_dates.txt')]);if(!stopsR||!tripsR||!timesR)throw new HttpError(502,'GTFS feed is incomplete');const stops=csv(stopsR).map(x=>({id:x.stop_id,name:x.stop_name||x.stop_id,lat:Number(x.stop_lat),lon:Number(x.stop_lon),code:x.stop_code||undefined,platform:x.platform_code||undefined})).filter(x=>x.id&&Number.isFinite(x.lat)&&Number.isFinite(x.lon));const routes=new Map(csv(routesR).map(x=>[x.route_id,x])),trips=new Map(csv(tripsR).map(x=>[x.trip_id,x])),timesByStop=new Map<string,Row[]>(),routesByStopSet=new Map<string,Set<string>>();for(const x of csv(timesR)){if(!x.stop_id||!x.trip_id)continue;const a=timesByStop.get(x.stop_id)||[];a.push(x);timesByStop.set(x.stop_id,a);const t=trips.get(x.trip_id),r=t?.route_id;if(r){const s=routesByStopSet.get(x.stop_id)||new Set<string>();s.add(r);routesByStopSet.set(x.stop_id,s)}}for(const a of timesByStop.values())a.sort((x,y)=>timeSec(x.departure_time||x.arrival_time)-timeSec(y.departure_time||y.arrival_time));const calendar=new Map(csv(calR).map(x=>[x.service_id,x])),exceptions=new Map<string,Map<string,string>>();for(const x of csv(exR)){if(!x.service_id||!x.date)continue;const m=exceptions.get(x.service_id)||new Map<string,string>();m.set(x.date,x.exception_type);exceptions.set(x.service_id,m)}const feed={at:Date.now(),stops,routes,trips,timesByStop,routesByStop:new Map([...routesByStopSet].map(([k,v])=>[k,[...v]])),calendar,exceptions};GTFS_CACHE.set(JSP_FEED.id,feed);return feed}
function jspRouteName(feed:FeedCache,id:string){const r=feed.routes.get(id);return String(r?.route_short_name||r?.route_long_name||id||'—')}
function jspStopLines(feed:FeedCache,id:string){return uniq((feed.routesByStop.get(id)||[]).map(r=>jspRouteName(feed,r)))}

async function nearbyMK(lat:number,lon:number,radiusM:number,limit:number):Promise<Stop[]>{const feed=await loadJspFeed();return feed.stops.map(s=>({...s,distanceM:Math.round(distKm(lat,lon,s.lat,s.lon)*1000),lines:jspStopLines(feed,s.id),mode:'bus',providerId:'mk-jsp',provider:JSP_FEED.name,sourceKind:'official-gtfs' as TransitSourceKind,quality:'scheduled' as TransitQuality} as Stop)).filter(s=>s.distanceM<=radiusM).sort((a,b)=>a.distanceM-b.distanceM).slice(0,limit)}
async function departuresMK(stopId:string|undefined,lat:number|undefined,lon:number|undefined,duration:number){const feed=await loadJspFeed();let id=String(stopId||'');if(!id&&Number.isFinite(lat)&&Number.isFinite(lon))id=feed.stops.map(s=>({id:s.id,d:distKm(lat!,lon!,s.lat,s.lon)})).sort((a,b)=>a.d-b.d)[0]?.id||'';const stop=feed.stops.find(s=>s.id===id);if(!stop)throw new HttpError(404,'GTFS stop not found');const now=localParts(JSP_FEED.tz),raw=feed.timesByStop.get(id)||[],departures:Departure[]=[];for(const st of raw){const sec=timeSec(st.departure_time||st.arrival_time);if(!Number.isFinite(sec)||sec<now.sec-60||sec>now.sec+duration*60)continue;const trip=feed.trips.get(st.trip_id);if(!trip||!activeService(trip.service_id,feed,now.date,now.weekday))continue;departures.push({id:`${st.trip_id}-${st.stop_sequence}-${st.departure_time}`,line:jspRouteName(feed,trip.route_id),direction:trip.trip_headsign||trip.trip_short_name||'—',mode:'bus',localTime:hhmm(sec),plannedLocalTime:hhmm(sec),delayMinutes:null,platform:stop.platform||st.platform_code||null,cancelled:false,realtime:false,status:'scheduled',quality:'scheduled',providerId:'mk-jsp',provider:JSP_FEED.name,sourceKind:'official-gtfs',stopId:id,tripId:st.trip_id,routeId:trip.route_id,scheduledTime:hhmm(sec)});if(departures.length>=30)break}return{stop:{...stop,lines:jspStopLines(feed,id)},departures}}

async function nearbyDE(lat:number,lon:number,radiusM:number,limit:number):Promise<Stop[]>{const attempts=DB_PROFILES.map(async profile=>{const u=new URL(`${DB_BASE}/locations/nearby`);u.searchParams.set('latitude',String(lat));u.searchParams.set('longitude',String(lon));u.searchParams.set('results',String(Math.max(limit,30)));u.searchParams.set('distance',String(radiusM));u.searchParams.set('stops','true');u.searchParams.set('poi','false');u.searchParams.set('linesOfStops','true');u.searchParams.set('profile',profile);u.searchParams.set('pretty','false');const rows=await fetchJsonCached(u.toString(),30_000,2200);const out=(Array.isArray(rows)?rows:[]).filter((x:any)=>x?.location&&x?.id).map((x:any)=>({id:String(x.id),name:String(x.name||'Stop'),lat:Number(x.location.latitude),lon:Number(x.location.longitude),distanceM:Math.round(distKm(lat,lon,Number(x.location.latitude),Number(x.location.longitude))*1000),lines:dbLines(x.lines),mode:dbMode(x.products),providerId:'de-db-rest',provider:'Germany DB fallback',sourceKind:'community' as TransitSourceKind,quality:'scheduled' as TransitQuality} as Stop)).filter((x:any)=>Number.isFinite(x.lat)&&Number.isFinite(x.lon)&&x.distanceM<=radiusM).sort((a:any,b:any)=>a.distanceM-b.distanceM).slice(0,limit);if(!out.length)throw new Error('empty');return out});try{return await Promise.any(attempts)}catch{return[]}}
async function departuresDE(stopId:string,duration:number){const attempts=DB_PROFILES.map(async profile=>{const u=new URL(`${DB_BASE}/stops/${encodeURIComponent(stopId)}/departures`);u.searchParams.set('duration',String(duration));u.searchParams.set('results','40');u.searchParams.set('remarks','true');u.searchParams.set('includeRelatedStations','true');u.searchParams.set('profile',profile);u.searchParams.set('pretty','false');const rows=await fetchJsonCached(u.toString(),18_000,2200);const departures:Departure[]=(Array.isArray(rows)?rows:[]).map((x:any,i:number)=>{const planned=x.plannedWhen||x.when,actual=x.when||planned,delay=typeof x.delay==='number'?Math.round(x.delay/60):null;return{id:String(x.tripId||`${stopId}-${i}-${planned}`),line:String(x.line?.name||x.line?.fahrtNr||'—'),direction:String(x.direction||'—'),mode:dbMode(x.line?.product?{[x.line.product]:true}:x.line?.products),localTime:isoLocalTime(actual),plannedLocalTime:isoLocalTime(planned),delayMinutes:delay,platform:x.platform||x.plannedPlatform||null,cancelled:!!x.cancelled,realtime:!!x.when&&(x.when!==x.plannedWhen||delay!=null),status:!!x.cancelled?'cancelled':(!(!!x.when&&(x.when!==x.plannedWhen||delay!=null))?'scheduled':((delay||0)>0?'delayed':'on_time')),quality:(!!x.when&&(x.when!==x.plannedWhen||delay!=null))?'live':'scheduled',providerId:'de-db-rest',provider:'Germany DB fallback',sourceKind:'community',stopId,tripId:x.tripId||undefined,realtimeTime:actual,scheduledTime:planned}});if(!departures.length)throw new Error('empty');return departures});try{return await Promise.any(attempts)}catch{return[]}}


type TripRouteStop={id:string;name:string;lat:number;lon:number;arrivalTime?:string;departureTime?:string;platform?:string};
type TripRoute={id:string;tripId:string;line:string;direction:string;mode?:string;origin?:string;destination?:string;startTime?:string;endTime?:string;points:{lat:number;lon:number}[];stops:TripRouteStop[];providerId?:string;provider:string;geometryKind?:'shape'|'stops';approximate?:boolean};
function stopLocation(x:any){const s=x?.stop||x?.station||x?.location||x,c=s?.location||s;const lat=Number(c?.latitude??c?.lat),lon=Number(c?.longitude??c?.lon);return{id:String(s?.id||s?.station?.id||''),name:String(s?.name||s?.station?.name||'Stop'),lat,lon,arrivalTime:isoLocalTime(x?.arrival||x?.plannedArrival),departureTime:isoLocalTime(x?.departure||x?.plannedDeparture),platform:x?.platform||x?.plannedPlatform||undefined} as TripRouteStop}
function collectLineCoordinates(raw:any):{lat:number;lon:number}[]{const out:{lat:number;lon:number}[]=[];const push=(coords:any)=>{if(!Array.isArray(coords))return;if(coords.length>=2&&typeof coords[0]==='number'&&typeof coords[1]==='number'){const lon=Number(coords[0]),lat=Number(coords[1]);if(Number.isFinite(lat)&&Number.isFinite(lon))out.push({lat,lon});return}for(const x of coords)push(x)};const walk=(x:any)=>{if(!x)return;if(Array.isArray(x)){for(const y of x)walk(y);return}if(x?.type==='FeatureCollection')return walk(x.features);if(x?.type==='Feature')return walk(x.geometry);if(x?.type==='LineString'||x?.type==='MultiLineString')return push(x.coordinates);if(x?.geometry)return walk(x.geometry);if(x?.coordinates)return push(x.coordinates)};walk(raw);const clean:{lat:number;lon:number}[]=[];for(const x of out){const prev=clean[clean.length-1];if(!prev||Math.abs(prev.lat-x.lat)>1e-6||Math.abs(prev.lon-x.lon)>1e-6)clean.push(x)}return clean}
function tripRouteFromDb(data:any,tripId:string,lineName?:string):TripRoute|null{const trip=data?.trip||data;if(!trip)return null;const stopovers=(Array.isArray(trip?.stopovers)?trip.stopovers:[]).map(stopLocation).filter((x:TripRouteStop)=>Number.isFinite(x.lat)&&Number.isFinite(x.lon));let points=collectLineCoordinates(trip?.polyline);const hasShape=points.length>=2;if(!hasShape)points=stopovers.map((x:TripRouteStop)=>({lat:x.lat,lon:x.lon}));if(points.length<2)return null;const line=String(trip?.line?.name||trip?.line?.fahrtNr||lineName||'—'),direction=String(trip?.direction||trip?.headsign||stopovers[stopovers.length-1]?.name||'—');return{id:`de-trip-${tripId}`,tripId,line,direction,mode:dbMode(trip?.line?.product?{[trip.line.product]:true}:trip?.line?.products),origin:stopovers[0]?.name,destination:stopovers[stopovers.length-1]?.name,startTime:stopovers[0]?.departureTime||stopovers[0]?.arrivalTime,endTime:stopovers[stopovers.length-1]?.arrivalTime||stopovers[stopovers.length-1]?.departureTime,points,stops:stopovers,providerId:'de-db-rest',provider:'Germany DB trip map',geometryKind:hasShape?'shape':'stops',approximate:!hasShape}}
async function tripDE(tripId:string,lineName?:string){const attempts=DB_PROFILES.map(async profile=>{const u=new URL(`${DB_BASE}/trips/${encodeURIComponent(tripId)}`);u.searchParams.set('stopovers','true');u.searchParams.set('polyline','true');u.searchParams.set('remarks','false');u.searchParams.set('profile',profile);u.searchParams.set('pretty','false');const data=await fetchJsonCached(u.toString(),15_000,3200);const route=tripRouteFromDb(data,tripId,lineName);if(!route)throw new Error('trip geometry unavailable');return route});try{return await Promise.any(attempts)}catch{return null}}

async function tripTransitland(routeId:string,tripId:string,lineName?:string){if(!routeId||!tripId)return null;try{const data=await transitlandJson(`/routes/${encodeURIComponent(routeId)}/trips/${encodeURIComponent(tripId)}`,{include_geometry:true},15_000,3500);const trip=Array.isArray(data?.trips)?data.trips[0]:(data?.trip||data);if(!trip)return null;const stopTimes=Array.isArray(trip?.stop_times)?trip.stop_times:[];const stops:TripRouteStop[]=stopTimes.map((x:any)=>{const st=x?.stop||{},c=tlCoords(st);return{id:String(st?.onestop_id||st?.id||st?.stop_id||''),name:String(st?.stop_name||st?.name||'Stop'),lat:c.lat,lon:c.lon,arrivalTime:tlTime(x?.arrival_time),departureTime:tlTime(x?.departure_time),platform:st?.platform_code||undefined}}).filter((x:TripRouteStop)=>Number.isFinite(x.lat)&&Number.isFinite(x.lon));let points=collectLineCoordinates(trip?.geometry||trip?.shape);const hasShape=points.length>=2;if(!hasShape)points=stops.map(x=>({lat:x.lat,lon:x.lon}));if(points.length<2)return null;const route=trip?.route||{};return{id:`tl-trip-${tripId}`,tripId,line:String(route?.route_short_name||route?.route_long_name||lineName||routeId),direction:String(trip?.trip_headsign||stops[stops.length-1]?.name||'—'),mode:tlMode(route?.route_type),origin:stops[0]?.name,destination:stops[stops.length-1]?.name,startTime:stops[0]?.departureTime||stops[0]?.arrivalTime,endTime:stops[stops.length-1]?.arrivalTime||stops[stops.length-1]?.departureTime,points,stops,providerId:'eu-transitland',provider:'Transitland v2 trip map',geometryKind:hasShape?'shape':'stops',approximate:!hasShape} as TripRoute}catch{return null}}


type EdgeJourneyResult={journeys:any[];fromStop?:Stop;toStop?:Stop;originStops:Stop[];destinationStops:Stop[];providerId:string;provider:string;attempts:ProviderAttempt[]};
async function journeyRowsDE(fromId:string,toId:string,departure:string,limit:number,profile:string){
 const u=new URL(`${DB_BASE}/journeys`);u.searchParams.set('from',fromId);u.searchParams.set('to',toId);u.searchParams.set('departure',departure);u.searchParams.set('results',String(Math.max(4,Math.min(8,limit))));u.searchParams.set('stopovers','true');u.searchParams.set('remarks','true');u.searchParams.set('transfers','8');u.searchParams.set('nationalExpress','true');u.searchParams.set('national','true');u.searchParams.set('regionalExpress','true');u.searchParams.set('regional','true');u.searchParams.set('suburban','true');u.searchParams.set('bus','true');u.searchParams.set('ferry','true');u.searchParams.set('subway','true');u.searchParams.set('tram','true');u.searchParams.set('taxi','false');u.searchParams.set('routingMode','HYBRID');u.searchParams.set('notOnlyFastRoutes','true');u.searchParams.set('polylines','true');u.searchParams.set('transferTime','2');u.searchParams.set('profile',profile);u.searchParams.set('pretty','false');
 const rows=await fetchJsonCached(u.toString(),8_000,3200);return Array.isArray(rows)?rows:[];
}
async function managedJourneyDE(fromLat:number,fromLon:number,toLat:number,toLon:number,departure:string,limit:number,radiusM:number):Promise<EdgeJourneyResult>{
 const attempts:ProviderAttempt[]=[];
 let [originStops,destinationStops]=await Promise.all([nearbyDE(fromLat,fromLon,radiusM,5),nearbyDE(toLat,toLon,radiusM,5)]);
 if(!originStops.length||!destinationStops.length){const wide=Math.min(12000,Math.max(radiusM,9000));[originStops,destinationStops]=await Promise.all([originStops.length?Promise.resolve(originStops):nearbyDE(fromLat,fromLon,wide,6),destinationStops.length?Promise.resolve(destinationStops):nearbyDE(toLat,toLon,wide,6)])}
 const pairs:{a:Stop;b:Stop;score:number}[]=[];for(const a of originStops.slice(0,5))for(const b of destinationStops.slice(0,5)){if(a.id===b.id)continue;pairs.push({a,b,score:Number(a.distanceM||0)+Number(b.distanceM||0)})}pairs.sort((x,y)=>x.score-y.score);
 if(!pairs.length)return{journeys:[],originStops,destinationStops,providerId:'de-db-edge',provider:'LifeDash Transit Edge / DB',attempts};
 const shortlist=pairs.slice(0,4);
 for(const profile of DB_PROFILES){
  const batch=await Promise.all(shortlist.map(async pair=>{const started=Date.now();try{const rows=await journeyRowsDE(pair.a.id,pair.b.id,departure,limit,profile);const attempt:ProviderAttempt={providerId:'de-db-edge',provider:`DB ${profile}`,ok:rows.length>0,durationMs:Date.now()-started,itemCount:rows.length};return{pair,rows,attempt}}catch(e){const attempt:ProviderAttempt={providerId:'de-db-edge',provider:`DB ${profile}`,ok:false,durationMs:Date.now()-started,error:String((e as any)?.message||'failed')};return{pair,rows:[] as any[],attempt}}}));
  attempts.push(...batch.map(x=>x.attempt));const good=batch.filter(x=>x.rows.length).sort((a,b)=>a.pair.score-b.pair.score)[0];if(good)return{journeys:good.rows,fromStop:good.pair.a,toStop:good.pair.b,originStops,destinationStops,providerId:'de-db-edge',provider:'LifeDash Transit Edge / DB',attempts};
 }
 return{journeys:[],originStops,destinationStops,providerId:'de-db-edge',provider:'LifeDash Transit Edge / DB',attempts};
}


async function nearbyCH(lat:number,lon:number,radiusM:number,limit:number):Promise<Stop[]>{const u=new URL(`${CH_BASE}/locations`);u.searchParams.set('x',String(lat));u.searchParams.set('y',String(lon));const data=await fetchJsonCached(u.toString(),45_000,2500);const stations=Array.isArray(data?.stations)?data.stations:[];return stations.map((x:any)=>{const la=Number(x?.coordinate?.x),lo=Number(x?.coordinate?.y);return{id:String(x.id||x.name),name:String(x.name||'Station'),lat:la,lon:lo,distanceM:Math.round(distKm(lat,lon,la,lo)*1000),lines:[] as string[],mode:'all',providerId:'ch-json',provider:'Swiss public transport API',sourceKind:'community',quality:'scheduled'}}).filter((x:any)=>Number.isFinite(x.lat)&&Number.isFinite(x.lon)&&x.distanceM<=radiusM).sort((a:any,b:any)=>a.distanceM-b.distanceM).slice(0,limit)}
async function departuresCH(stopId:string,_duration:number){const u=new URL(`${CH_BASE}/stationboard`);u.searchParams.set('id',stopId);u.searchParams.set('limit','30');u.searchParams.set('type','departure');const data=await fetchJsonCached(u.toString(),20_000,2500),rows=Array.isArray(data?.stationboard)?data.stationboard:[];return rows.map((x:any,i:number)=>{const st=x?.stop||{},journey=x||{},planned=st.departure||st.prognosis?.departure,actual=st.prognosis?.departure||st.departure,delay=typeof st.delay==='number'?st.delay:null,line=String(journey.number||journey.name||journey.category||'—'),direction=String(journey.to||'—'),platform=st.prognosis?.platform||st.platform||null,realtime=!!st.prognosis?.departure||delay!=null;return{id:String(journey.id||`${stopId}-${i}-${planned||''}`),line,direction,mode:swissMode(journey.category,journey.name),localTime:isoLocalTime(actual),plannedLocalTime:isoLocalTime(planned),delayMinutes:delay,platform,cancelled:false,realtime,status:realtime?((delay||0)>0?'delayed':'on_time'):'scheduled',quality:realtime?'live':'scheduled',providerId:'ch-json',provider:'Swiss public transport API',sourceKind:'community',stopId,realtimeTime:isoLocalTime(actual),scheduledTime:isoLocalTime(planned)}}) as Departure[]}



// STAGING ONLY: LifeDashPro v14 clone, with dedicated-server RPC transport.
// The active transit-schedule v14 is never modified by this preview.
// The service key must be stored ONLY in OLD project's Edge Function Secrets.
// It grants access ONLY to GTFS public-transit RPCs in the new project.
const DEDICATED_GTFS_URL='https://gnqtngtuzbxohgwgvmpb.supabase.co';
const DEDICATED_RPC_ALLOWLIST=new Set([
 'transit_gtfs_nearby','transit_gtfs_departures',
 'transit_gtfs_trip_route','transit_gtfs_cache_status'
]);
async function transitRpc<T>(_a:AuthContext,name:string,body:Record<string,unknown>):Promise<T>{
 if(!DEDICATED_RPC_ALLOWLIST.has(name))throw new HttpError(400,'Unknown dedicated GTFS RPC');
 const key=(Deno.env.get('LDP_DEDICATED_TRANSIT_SERVICE_ROLE_KEY')||'').trim();
 if(!key)throw new HttpError(503,'Dedicated GTFS preview is not configured');
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),8000);
 try {
   const response=await fetch(DEDICATED_GTFS_URL+'/rest/v1/rpc/'+name,{
     method:'POST',signal:controller.signal,
     // Opaque sb_secret_ keys are NOT JWTs: put them only in apikey.
     // Legacy service_role JWTs can additionally use Authorization: Bearer.
     headers:{apikey:key,...(key.startsWith('eyJ')?{authorization:'Bearer '+key}:{}),
       'content-type':'application/json','accept':'application/json'},
     body:JSON.stringify(body)
   });
   if(!response.ok)throw new HttpError(503,'Dedicated GTFS preview RPC unavailable');
   return await response.json() as T;
 }catch(e){
   if(e instanceof HttpError)throw e;
   throw new HttpError(503,'Dedicated GTFS preview connection unavailable');
 }finally{clearTimeout(timeout)}
}
// Failover to same OLD LifeDashPro project's own authenticated GTFS stop
// index. Stop discovery is safe across feed vintages; trip IDs and departure
// schedules are NOT interchangeable and are never fetched from legacy here.
async function legacyGtfsNearby(a:AuthContext,lat:number,lon:number,radiusM:number,limit:number):Promise<any[]>{
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),3000);
 try{
  const r=await fetch(a.supabaseUrl+'/rest/v1/rpc/transit_gtfs_nearby',{
   method:'POST',signal:ctl.signal,
   headers:{apikey:a.apiKey,authorization:'Bearer '+a.accessToken,
            'content-type':'application/json',accept:'application/json'},
   body:JSON.stringify({p_lat:lat,p_lon:lon,p_radius_m:radiusM,p_limit:limit})});
  if(!r.ok)throw new HttpError(503,'Legacy locations unavailable');
  const rows=await r.json();
  if(!Array.isArray(rows))throw new HttpError(503,'Legacy locations invalid');
  return rows;
 }catch(_e){throw new HttpError(503,'Legacy locations unavailable')}
 finally{clearTimeout(timer)}
}
function cacheClock(){const p=localParts('Europe/Berlin'),d=p.date;return{date:d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8),seconds:p.sec}}
async function gtfsNearby(a:AuthContext,lat:number,lon:number,radiusM:number,limit:number):Promise<Stop[]>{
 let rows:any[],usedLegacy=false;
 try{rows=await transitRpc<any[]>(a,'transit_gtfs_nearby',{p_lat:lat,p_lon:lon,p_radius_m:radiusM,p_limit:limit})}
 catch(_error){rows=await legacyGtfsNearby(a,lat,lon,radiusM,limit);usedLegacy=true}
 return (Array.isArray(rows)?rows:[]).map(x=>({
 id:String(x.scoped_id||x.feed_source+':'+x.stop_id),name:String(x.stop_name||'Stop'),
 lat:Number(x.stop_lat),lon:Number(x.stop_lon),distanceM:Number(x.distance_m||0),lines:[],
 code:x.stop_code||undefined,platform:x.platform_code||undefined,
 providerId:String(x.feed_source||'de-national'),provider:usedLegacy?'LifeDashPro legacy GTFS locations':String(x.feed_source||'Germany GTFS'),
 feedSource:String(x.feed_source||'de-national'),sourceKind:'official-gtfs' as const,quality:'scheduled' as const
 })).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon));
}
async function gtfsDepartures(a:AuthContext,feed:string,stopId:string,duration:number):Promise<Departure[]>{
 const c=cacheClock(),raw=stopId.includes(':')?stopId.slice(stopId.indexOf(':')+1):stopId;
 const rows=await transitRpc<any[]>(a,'transit_gtfs_departures',{
 p_feed_source:feed,p_stop_id:raw,p_service_date:c.date,p_now_seconds:c.seconds,p_window_minutes:duration,p_limit:50});
 return (Array.isArray(rows)?rows:[]).map((x,i)=>{
 const secs=Number(x.display_seconds??x.departure_secs??0),
 tm=String(Math.floor((secs%86400)/3600)).padStart(2,'0')+':'+String(Math.floor((secs%3600)/60)).padStart(2,'0');
 return{id:feed+':'+(x.trip_id||i)+':'+(x.departure_time||''),stopId:String(x.stop_id||raw),
 tripId:String(x.trip_id||''),routeId:String(x.route_id||''),line:String(x.line||x.route_id||'—'),
 direction:String(x.direction||'—'),scheduledTime:String(x.departure_time||''),localTime:tm,plannedLocalTime:tm,
 platform:x.platform_code||undefined,cancelled:false,realtime:false,status:'scheduled' as const,
 providerId:feed,provider:feed,feedSource:feed,sourceKind:'official-gtfs' as const,quality:'scheduled' as const};
 });
}
async function gtfsTrip(a:AuthContext,feed:string,id:string,line:string){
 const x=await transitRpc<any>(a,'transit_gtfs_trip_route',{p_feed_source:feed,p_trip_id:id});
 if(!x)return null;
 return{id:feed+':'+id,tripId:String(x.tripId||id),line:line||String(x.routeId||'—'),
 direction:String(x.direction||'—'),points:Array.isArray(x.points)?x.points:[],
 stops:Array.isArray(x.stops)?x.stops:[],providerId:feed,provider:feed,feedSource:feed,
 geometryKind:x.geometryKind==='shape'?'shape':'stops',approximate:x.approximate!==false};
}
async function gtfsStatus(a:AuthContext){
 const rows=await transitRpc<any[]>(a,'transit_gtfs_cache_status',{});
 return (Array.isArray(rows)?rows:[]).map(x=>({
 feedSource:x.feed_source,name:x.name,region:x.region,priority:x.priority,active:x.active,
 importedAt:x.imported_at,stops:Number(x.stops||0),routes:Number(x.routes||0),
 trips:Number(x.trips||0),stopTimes:Number(x.stop_times||0),shapePoints:Number(x.shape_points||0)}));
}
function sourceKindForProvider(providerId:string):TransitSourceKind{
 if(providerId==='mk-jsp')return'official-gtfs';
 if(providerId==='eu-transitland')return'aggregator';
 if(providerId==='de-db-rest'||providerId==='ch-json')return'community';
 return'aggregator';
}
function normalizeStopProvider(rows:Stop[],providerId:string,provider:string,quality:TransitQuality):Stop[]{return rows.map(x=>({...x,providerId:x.providerId||providerId,provider:x.provider||provider,sourceKind:x.sourceKind||sourceKindForProvider(providerId),quality:x.quality||quality}))}
function normalizeDepartureProvider(rows:Departure[],providerId:string,provider:string):Departure[]{return rows.map(x=>{const realtime=!!x.realtime,delay=x.delayMinutes??null,cancelled=!!x.cancelled;return{...x,providerId:x.providerId||providerId,provider:x.provider||provider,sourceKind:x.sourceKind||sourceKindForProvider(providerId),quality:x.quality||(realtime?'live':'scheduled'),status:x.status||(cancelled?'cancelled':(!realtime?'scheduled':((delay||0)>0?'delayed':'on_time')))}})}
async function providerAttempt<T>(providerId:string,provider:string,fn:()=>Promise<T>,count:(x:T)=>number){const started=Date.now();try{const value=await fn(),itemCount=count(value);return{value,attempt:{providerId,provider,ok:itemCount>0,durationMs:Date.now()-started,itemCount} as ProviderAttempt}}catch(e){return{value:undefined,attempt:{providerId,provider,ok:false,durationMs:Date.now()-started,error:String((e as any)?.message||'failed')} as ProviderAttempt}}}

async function managedNearby(auth:AuthContext,country:string,lat:number,lon:number,radiusM:number,limit:number){
 const attempts:ProviderAttempt[]=[];
 if(country==='DE'){
 const cached=await providerAttempt('de-gtfs-cache','Germany GTFS',()=>gtfsNearby(auth,lat,lon,radiusM,limit),x=>x.length);
 if(cached.value?.length&&cached.value[0].provider==='LifeDashPro legacy GTFS locations'){
  cached.attempt.providerId='de-gtfs-legacy';cached.attempt.provider='Original LifeDashPro GTFS stop fallback';
 }
 attempts.push(cached.attempt);
 if(cached.value?.length)return{stops:cached.value,providerId:cached.value[0].providerId,
 provider:cached.value[0].provider,quality:'scheduled' as TransitQuality,
 sourceUrl:'https://gtfs.de/en/feeds/de_nv/',attempts};
 }
 if(country==='MK'){
  const a=await providerAttempt('mk-jsp',JSP_FEED.name,()=>nearbyMK(lat,lon,radiusM,limit),x=>x.length);
  attempts.push(a.attempt);
  if(a.value?.length)return{stops:normalizeStopProvider(a.value,'mk-jsp',JSP_FEED.name,'scheduled'),providerId:'mk-jsp',provider:JSP_FEED.name,quality:'scheduled' as TransitQuality,sourceUrl:JSP_FEED.sourceUrl,attempts};
 }
 const tl=await providerAttempt('eu-transitland','Transitland v2',()=>nearbyTransitland(lat,lon,radiusM,limit),x=>x.length);
 attempts.push(tl.attempt);
 // A handful of national/intercity entries must not suppress local German buses.
 // Consult DB only where Transitland coverage is thin, preserving request budgets.
 if(country==='DE'){
  let dbStops:Stop[]=[];
  if((tl.value?.length||0)<Math.min(limit,10)){
   const db=await providerAttempt('de-db-rest','Germany DB fallback',()=>nearbyDE(lat,lon,radiusM,limit),x=>x.length);
   attempts.push(db.attempt);
   dbStops=normalizeStopProvider(db.value||[],'de-db-rest','Germany DB fallback','scheduled');
  }
  const tlStops=normalizeStopProvider(tl.value||[],'eu-transitland','Transitland v2','scheduled');
  if(dbStops.length||tlStops.length){
   const merged:Stop[]=[];
   for(const x of [...dbStops,...tlStops].sort((a,b)=>(a.distanceM||999999)-(b.distanceM||999999))){
    const match=merged.find(y=>y.name.trim().toLowerCase()===x.name.trim().toLowerCase() &&
      distKm(y.lat,y.lon,x.lat,x.lon)<0.09);
    if(match){
     match.lines=uniq([...(match.lines||[]),...(x.lines||[])]);
     if(x.providerId==='de-db-rest'&&match.providerId!=='de-db-rest')
      Object.assign(match,{id:x.id,providerId:x.providerId,provider:x.provider,sourceKind:x.sourceKind});
    }else merged.push({...x});
   }
   merged.sort((a,b)=>(a.distanceM||999999)-(b.distanceM||999999));
   return {stops:merged.slice(0,limit),providerId:dbStops.length&&tlStops.length?'de-mixed':(dbStops.length?'de-db-rest':'eu-transitland'),
    provider:dbStops.length&&tlStops.length?'Germany DB + Transitland v2':(dbStops.length?'Germany DB fallback':'Transitland v2'),
    quality:'scheduled' as TransitQuality,sourceUrl:dbStops.length?'https://v6.db.transport.rest/api.html':TRANSITLAND_SOURCE,attempts};
  }
 }
 if(tl.value?.length)return{stops:normalizeStopProvider(tl.value,'eu-transitland','Transitland v2','scheduled'),providerId:'eu-transitland',provider:'Transitland v2',quality:'scheduled' as TransitQuality,sourceUrl:TRANSITLAND_SOURCE,attempts};
 if(country==='CH'){
  const ch=await providerAttempt('ch-json','Swiss public transport API',()=>nearbyCH(lat,lon,radiusM,limit),x=>x.length);attempts.push(ch.attempt);
  if(ch.value?.length)return{stops:normalizeStopProvider(ch.value,'ch-json','Swiss public transport API','scheduled'),providerId:'ch-json',provider:'Swiss public transport API',quality:'scheduled' as TransitQuality,sourceUrl:'https://transport.opendata.ch/docs.html',attempts};
 }
 const meta=providerMeta(country);
 return{stops:[] as Stop[],providerId:String(meta.primary),provider:meta.name,quality:'station-only' as TransitQuality,sourceUrl:meta.sourceUrl,attempts};
}
async function fetchMotisChannel(params:{fromLat:number;fromLon:number;toLat:number;toLon:number;departure:string;language:string;transitOnly:boolean}):Promise<MotisChannel>{
 const started=Date.now(),u=new URL(TRANSITOUS_PLAN);u.searchParams.set('fromPlace',`${params.fromLat},${params.fromLon}`);u.searchParams.set('toPlace',`${params.toLat},${params.toLon}`);u.searchParams.set('time',params.departure);u.searchParams.set('timetableView','true');u.searchParams.set('numItineraries','4');u.searchParams.set('maxItineraries','4');u.searchParams.set('timeout','12');u.searchParams.set('detailedLegs','false');u.searchParams.set('detailedTransfers','false');u.searchParams.set('language',params.language||'en');u.searchParams.set('realtimeMode','REALTIME');u.searchParams.set('maxPreTransitTime','1800');u.searchParams.set('maxPostTransitTime','1800');u.searchParams.set('useRoutedTransfers','true');
 if(params.transitOnly){u.searchParams.set('transitModes','TRANSIT');u.searchParams.set('directModes','');u.searchParams.set('preTransitModes','WALK');u.searchParams.set('postTransitModes','WALK')}else{u.searchParams.set('transitModes','');u.searchParams.set('directModes','WALK');u.searchParams.set('maxDirectTime','3600')}
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),16000);try{const r=await fetch(u.toString(),{headers:{accept:'application/json','user-agent':'LifeDashPro/37.64 (+https://mkdigital.app/lifedashpro/)'},signal:ctl.signal});const httpStatus=r.status;if(!r.ok){const body=await r.text().catch(()=>'');return{ok:false,httpStatus,latencyMs:Date.now()-started,count:0,error:`HTTP ${httpStatus}${body?`: ${body.slice(0,180)}`:''}`,itineraries:[]}}const data=await r.json();const rows=motisRows(data);return{ok:true,httpStatus,latencyMs:Date.now()-started,count:rows.length,responseKeys:Object.keys(data||{}).slice(0,16),itineraries:rows.slice(0,6)}}catch(e){return{ok:false,latencyMs:Date.now()-started,count:0,error:String((e as any)?.name==='AbortError'?'timeout':((e as any)?.message||'request failed')),itineraries:[]}}finally{clearTimeout(timer)}}
async function motisDiagnostic(fromLat:number,fromLon:number,toLat:number,toLon:number,departure:string,language:string){const [transit,direct]=await Promise.all([fetchMotisChannel({fromLat,fromLon,toLat,toLon,departure,language,transitOnly:true}),fetchMotisChannel({fromLat,fromLon,toLat,toLon,departure,language,transitOnly:false})]);return{provider:'Transitous MOTIS v6 prototype',providerId:'transitous-motis-v6',prototypeOnly:true as const,from:{lat:fromLat,lon:fromLon},to:{lat:toLat,lon:toLon},departure,transit,direct}}

async function managedDepartures(auth:AuthContext,country:string,stopId:string,lat:number,lon:number,duration:number,feedSource?:string){
 const attempts:ProviderAttempt[]=[],meta=providerMeta(country);let stop:Stop|undefined;
 if(country==='DE'){
 let feed=String(feedSource||'');
 if(!feed&&stopId.includes(':'))feed=stopId.split(':')[0];
 if(/^de-(rvv|mvv|national)$/.test(feed)){
 const gtfs=await providerAttempt(feed,'Germany GTFS',()=>gtfsDepartures(auth,feed,stopId,duration),x=>x.length);
 attempts.push(gtfs.attempt);
 if(gtfs.value?.length)return{departures:gtfs.value,stop,providerId:feed,provider:feed,
 quality:'scheduled' as TransitQuality,sourceUrl:'https://gtfs.de/en/feeds/de_nv/',attempts};
 }
 }
 if(country==='MK'){
  const jsp=await providerAttempt('mk-jsp',JSP_FEED.name,async()=>{const r=await departuresMK(stopId,lat,lon,duration);stop=normalizeStopProvider([r.stop as Stop],'mk-jsp',JSP_FEED.name,'scheduled')[0];return normalizeDepartureProvider(r.departures,'mk-jsp',JSP_FEED.name)},x=>x.length);
  attempts.push(jsp.attempt);
  if(jsp.value?.length)return{departures:jsp.value,stop,providerId:'mk-jsp',provider:JSP_FEED.name,quality:jsp.value.some(x=>x.realtime)?'live' as TransitQuality:'scheduled' as TransitQuality,sourceUrl:JSP_FEED.sourceUrl,attempts};
 }
 let id=String(stopId||'');
 const isDbId=country==='DE'&&/^\d{5,}$/.test(id);
 // A dedicated GTFS stop ID is not a Transitland Onestop ID. After an
 // outage use nearby GPS resolution, never direct cross-provider stop IDs.
 const isScopedGtfsId=country==='DE'&&/^de-(?:rvv|mvv|national):/.test(id);
 // DB stop identifiers and Transitland Onestop IDs are not interchangeable.
 if(isDbId){
  const db=await providerAttempt('de-db-rest','Germany DB fallback',()=>departuresDE(id,duration),x=>x.length);
  attempts.push(db.attempt);
  if(db.value?.length){
   const rows=normalizeDepartureProvider(db.value,'de-db-rest','Germany DB fallback');
   return{departures:rows,stop,providerId:'de-db-rest',provider:'Germany DB fallback',quality:rows.some(x=>x.realtime)?'live' as TransitQuality:'scheduled' as TransitQuality,sourceUrl:'https://v6.db.transport.rest/api.html',attempts};
  }
 }
 if(id&&!isDbId&&!isScopedGtfsId){
  const tl=await providerAttempt('eu-transitland','Transitland v2',()=>departuresTransitland(id,duration),x=>x.length);
  attempts.push(tl.attempt);
  if(tl.value?.length){
   const rows=normalizeDepartureProvider(tl.value,'eu-transitland','Transitland v2');
   return{departures:rows,stop,providerId:'eu-transitland',provider:'Transitland v2',quality:rows.some(x=>x.realtime)?'live' as TransitQuality:'scheduled' as TransitQuality,sourceUrl:TRANSITLAND_SOURCE,attempts};
  }
 }
 if(Number.isFinite(lat)&&Number.isFinite(lon)&&!isDbId){
  const resolve=await providerAttempt('eu-transitland','Transitland v2',()=>resolveTransitlandStop(lat,lon),x=>x?1:0);
  attempts.push(resolve.attempt);
  if(resolve.value){
   id=resolve.value.id;stop=normalizeStopProvider([resolve.value],'eu-transitland','Transitland v2','scheduled')[0];
   const tl=await providerAttempt('eu-transitland','Transitland v2',()=>departuresTransitland(id,duration),x=>x.length);
   attempts.push(tl.attempt);
   if(tl.value?.length){
    const rows=normalizeDepartureProvider(tl.value,'eu-transitland','Transitland v2');
    return{departures:rows,stop,providerId:'eu-transitland',provider:'Transitland v2',quality:rows.some(x=>x.realtime)?'live' as TransitQuality:'scheduled' as TransitQuality,sourceUrl:TRANSITLAND_SOURCE,attempts};
   }
  }
 }
 if(country==='DE'&&!isDbId&&Number.isFinite(lat)&&Number.isFinite(lon)){
  // Resolve a DB-native nearby ID rather than sending a Transitland ID to DB.
  const resolve=await providerAttempt('de-db-rest','Germany DB fallback',()=>nearbyDE(lat,lon,600,6),x=>x.length);
  attempts.push(resolve.attempt);
  const best=resolve.value?.[0];
  if(best&&Number(best.distanceM)<=350){
   stop=normalizeStopProvider([best],'de-db-rest','Germany DB fallback','scheduled')[0];
   const db=await providerAttempt('de-db-rest','Germany DB fallback',()=>departuresDE(best.id,duration),x=>x.length);
   attempts.push(db.attempt);
   if(db.value?.length){
    const rows=normalizeDepartureProvider(db.value,'de-db-rest','Germany DB fallback');
    return{departures:rows,stop,providerId:'de-db-rest',provider:'Germany DB fallback',quality:rows.some(x=>x.realtime)?'live' as TransitQuality:'scheduled' as TransitQuality,sourceUrl:'https://v6.db.transport.rest/api.html',attempts};
   }
  }
 }
 if(country==='CH'&&id){
  const ch=await providerAttempt('ch-json','Swiss public transport API',()=>departuresCH(id,duration),x=>x.length);attempts.push(ch.attempt);
  if(ch.value?.length){
   const rows=normalizeDepartureProvider(ch.value,'ch-json','Swiss public transport API');
   return{departures:rows,stop,providerId:'ch-json',provider:'Swiss public transport API',quality:rows.some(x=>x.realtime)?'live' as TransitQuality:'scheduled' as TransitQuality,sourceUrl:'https://transport.opendata.ch/docs.html',attempts};
  }
 }
 return{departures:[] as Departure[],stop,providerId:String(meta.primary),provider:meta.name,quality:'scheduled' as TransitQuality,sourceUrl:meta.sourceUrl,attempts};
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 try{
  const auth=await authenticateAndRateLimit(req,'transit-schedule',30,60);
  const b=await req.json().catch(()=>{throw new HttpError(400,'Invalid JSON body')});
  const country=String(b?.country||'').toUpperCase();
  const action=String(b?.action||'nearby');
  if(action==='providers')return Response.json({ok:true,generatedAt:new Date().toISOString(),provider:'LifeDash Transit Provider Manager',providerId:'lifedash-transit-manager',providers:[PROVIDERS.MK,PROVIDERS.DE,PROVIDERS.CH,{country:'EU',primary:'transitland-v2',quality:'scheduled',name:'Transitland v2',sourceUrl:TRANSITLAND_SOURCE}]},{headers:{...cors,'Cache-Control':'private, max-age=3600'}});
  if(action==='fallback-diagnostic'){
    const lat=Number(b.lat),lon=Number(b.lon);
    if(country!=='DE'||!Number.isFinite(lat)||!Number.isFinite(lon))throw new HttpError(400,'Germany coordinates required');
    const rows=await legacyGtfsNearby(auth,lat,lon,1200,5);
    return Response.json({ok:true,country:'DE',fallbackTestOnly:true,
      providerId:'de-gtfs-legacy',itemCount:rows.length,
      generatedAt:new Date().toISOString()},{headers:{...cors,'Cache-Control':'no-store'}});
   }
  if(action==='cache-status'){const feeds=await gtfsStatus(auth);return Response.json({ok:true,generatedAt:new Date().toISOString(),providerId:'de-gtfs-cache',provider:'Germany GTFS cache',feeds},{headers:{...cors,'Cache-Control':'no-store'}})}
  if(action==='motis-diagnostic'){
   const fromLat=Number(b.fromLat),fromLon=Number(b.fromLon),toLat=Number(b.toLat),toLon=Number(b.toLon),departure=String(b.departure||new Date().toISOString()),language=String(b.language||'en').slice(0,8);
   if(![fromLat,fromLon,toLat,toLon].every(Number.isFinite))throw new HttpError(400,'Invalid MOTIS diagnostic coordinates');
   const r=await motisDiagnostic(fromLat,fromLon,toLat,toLon,departure,language);return Response.json({ok:true,generatedAt:new Date().toISOString(),...r},{headers:{...cors,'Cache-Control':'no-store'}});
  }
  if(!/^[A-Z]{2}$/.test(country))throw new HttpError(400,'Country code required');
  if(action==='nearby'){
   const lat=Number(b.lat),lon=Number(b.lon),radiusM=Math.min(15000,Math.max(300,Number(b.radiusM)||5000)),limit=Math.min(40,Math.max(1,Number(b.limit)||30));
   if(!Number.isFinite(lat)||!Number.isFinite(lon))throw new HttpError(400,'Invalid coordinates');
   const r=await managedNearby(auth,country,lat,lon,radiusM,limit);
   return Response.json({ok:true,country,generatedAt:new Date().toISOString(),...r},{headers:{...cors,'Cache-Control':'private, max-age=45'}});
  }
  if(action==='trip'){
   const tripId=String(b?.tripId||'').trim(),lineName=String(b?.lineName||'').trim(),routeId=String(b?.routeId||'').trim(),providerId=String(b?.providerId||'').trim();if(!tripId)throw new HttpError(400,'Trip id required');
   const attempts:ProviderAttempt[]=[];
   const feed=String(b.feedSource||'')||(/^de-(rvv|mvv|national)$/.test(providerId)?providerId:'');
   if(country==='DE'&&/^de-(rvv|mvv|national)$/.test(feed)){
   const result=await providerAttempt(feed,'Germany GTFS',()=>gtfsTrip(auth,feed,tripId,lineName),x=>x?1:0);
   attempts.push(result.attempt);
   if(result.value)return Response.json({ok:true,country,route:result.value,providerId:feed,provider:feed,attempts});
   // A dedicated trip_id is only meaningful in that GTFS feed: do not ask
   // unrelated DB/Transitland providers for a coincidentally matching ID.
   return Response.json({ok:true,country,generatedAt:new Date().toISOString(),
      providerId:feed,provider:feed,route:null,attempts},
      {headers:{...cors,'Cache-Control':'no-store'}});
   }
   if(providerId==='eu-transitland'&&routeId){const started=Date.now();const route=await tripTransitland(routeId,tripId,lineName);attempts.push({providerId:'eu-transitland',provider:'Transitland v2 trip map',ok:!!route,durationMs:Date.now()-started,itemCount:route?1:0,...(!route?{error:'Trip geometry unavailable'}:{})});if(route)return Response.json({ok:true,country,generatedAt:new Date().toISOString(),provider:'Transitland v2 trip map',providerId:'eu-transitland',route,attempts},{headers:{...cors,'Cache-Control':'private, max-age=30'}})}
   if(country==='DE'){const started=Date.now();const route=await tripDE(tripId,lineName);attempts.push({providerId:'de-db-rest',provider:'Germany DB trip map',ok:!!route,durationMs:Date.now()-started,itemCount:route?1:0,...(!route?{error:'Trip geometry unavailable'}:{})});return Response.json({ok:true,country,generatedAt:new Date().toISOString(),provider:'Germany DB trip map',providerId:'de-db-rest',route,attempts},{headers:{...cors,'Cache-Control':'private, max-age=30'}})}
   return Response.json({ok:true,country,generatedAt:new Date().toISOString(),provider:'LifeDash Transit Edge',providerId:'lifedash-transit-edge',route:null,attempts},{headers:{...cors,'Cache-Control':'private, max-age=30'}});
  }
  if(action==='journey'){
   const fromLat=Number(b.fromLat),fromLon=Number(b.fromLon),toLat=Number(b.toLat),toLon=Number(b.toLon),limit=Math.min(8,Math.max(2,Number(b.limit)||5)),radiusM=Math.min(12000,Math.max(1000,Number(b.radiusM)||6500));
   const departure=String(b.departure||new Date().toISOString());if(![fromLat,fromLon,toLat,toLon].every(Number.isFinite))throw new HttpError(400,'Invalid journey coordinates');
   if(country!=='DE')return Response.json({ok:true,country,generatedAt:new Date().toISOString(),provider:'LifeDash Transit Edge',providerId:'lifedash-transit-edge',journeys:[],originStops:[],destinationStops:[],attempts:[]},{headers:{...cors,'Cache-Control':'private, max-age=10'}});
   const r=await managedJourneyDE(fromLat,fromLon,toLat,toLon,departure,limit,radiusM);return Response.json({ok:true,country,generatedAt:new Date().toISOString(),...r},{headers:{...cors,'Cache-Control':'private, max-age=10'}});
  }
  if(action==='departures'){
   const duration=Math.min(180,Math.max(30,Number(b.duration)||90)),lat=Number(b.lat),lon=Number(b.lon);
   const r=await managedDepartures(auth,country,String(b.stopId||''),lat,lon,duration,String(b.feedSource||''));
   return Response.json({ok:true,country,generatedAt:new Date().toISOString(),...r},{headers:{...cors,'Cache-Control':'private, max-age=20'}});
  }
  throw new HttpError(400,'Unsupported action');
 }catch(e){return jsonError(e,cors)}
});
