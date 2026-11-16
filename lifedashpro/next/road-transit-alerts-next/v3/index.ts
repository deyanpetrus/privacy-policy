// LifeDashPro NEXT ONLY. Official links, no unlicensed scraping or fictitious LIVE incidents.
type S={id:string;country:string;mode:'road'|'rail'|'camera';name:string;url:string;status:'OFFICIAL_LINK_ONLY';rights:'API_AND_REUSE_UNVERIFIED'};
const SOURCES:S[]=[
{id:'rs-putevi',country:'RS',mode:'road',name:'Putevi Srbije — stanje na državnim putevima',url:'https://www.putevi-srbije.rs/index.php/sr/stanje-na-drzavnim-putevima',status:'OFFICIAL_LINK_ONLY',rights:'API_AND_REUSE_UNVERIFIED'},
{id:'rs-amss',country:'RS',mode:'road',name:'AMSS — stanje na putu',url:'https://www.amss.org.rs/na-putu/stanje-na-putu/strana/mapa',status:'OFFICIAL_LINK_ONLY',rights:'API_AND_REUSE_UNVERIFIED'},
{id:'bg-bdz',country:'BG',mode:'rail',name:'BDZ — Актуална информация',url:'https://www.bdz.bg/bg/c/live-updates',status:'OFFICIAL_LINK_ONLY',rights:'API_AND_REUSE_UNVERIFIED'},
{id:'hr-hak',country:'HR',mode:'camera',name:'HAK — Croatia road cameras',url:'https://map.hak.hr/',status:'OFFICIAL_LINK_ONLY',rights:'API_AND_REUSE_UNVERIFIED'}];

// Additional country catalog entries are official LANDING PAGES only, not live feeds.
SOURCES.push(
{id:'mk-amsm',country:'MK',mode:'road',name:'AMSM — Road conditions',url:'https://amsm.mk/',status:'OFFICIAL_LINK_ONLY',rights:'API_AND_REUSE_UNVERIFIED'},
{id:'si-promet',country:'SI',mode:'road',name:'promet.si — traffic information',url:'https://www.promet.si/sl',status:'OFFICIAL_LINK_ONLY',rights:'API_AND_REUSE_UNVERIFIED'},
{id:'si-sz',country:'SI',mode:'rail',name:'Slovenske zeleznice — passenger transport',url:'https://potniski.sz.si/',status:'OFFICIAL_LINK_ONLY',rights:'API_AND_REUSE_UNVERIFIED'},
{id:'hr-hak-road',country:'HR',mode:'road',name:'HAK — road bulletin',url:'https://www.hak.hr/info/stanje-na-cestama/',status:'OFFICIAL_LINK_ONLY',rights:'API_AND_REUSE_UNVERIFIED'},
{id:'hr-hzpp',country:'HR',mode:'rail',name:'HZPP — rail status',url:'https://www.hzpp.hr/',status:'OFFICIAL_LINK_ONLY',rights:'API_AND_REUSE_UNVERIFIED'},
{id:'at-asfinag',country:'AT',mode:'road',name:'ASFINAG — road traffic',url:'https://www.asfinag.at/',status:'OFFICIAL_LINK_ONLY',rights:'API_AND_REUSE_UNVERIFIED'},
{id:'at-oebb',country:'AT',mode:'rail',name:'OEBB — train service',url:'https://www.oebb.at/',status:'OFFICIAL_LINK_ONLY',rights:'API_AND_REUSE_UNVERIFIED'},
{id:'ch-ski',country:'CH',mode:'rail',name:'Swiss Transport API — departures',url:'https://transport.opendata.ch/docs.html',status:'OFFICIAL_LINK_ONLY',rights:'API_AND_REUSE_UNVERIFIED'},
{id:'de-db',country:'DE',mode:'rail',name:'Deutsche Bahn — current services',url:'https://www.bahn.de/',status:'OFFICIAL_LINK_ONLY',rights:'API_AND_REUSE_UNVERIFIED'},
{id:'de-autobahn',country:'DE',mode:'road',name:'Autobahn GmbH — existing LifeDashPro Road Live',url:'https://verkehr.autobahn.de/',status:'OFFICIAL_LINK_ONLY',rights:'API_AND_REUSE_UNVERIFIED'},
{id:'nl-ns',country:'NL',mode:'rail',name:'NS — railway travel information',url:'https://www.ns.nl/',status:'OFFICIAL_LINK_ONLY',rights:'API_AND_REUSE_UNVERIFIED'},
{id:'fr-sncf',country:'FR',mode:'rail',name:'SNCF — train travel information',url:'https://www.sncf-connect.com/',status:'OFFICIAL_LINK_ONLY',rights:'API_AND_REUSE_UNVERIFIED'},
{id:'it-rfi',country:'IT',mode:'rail',name:'RFI — Italian rail infrastructure',url:'https://www.rfi.it/',status:'OFFICIAL_LINK_ONLY',rights:'API_AND_REUSE_UNVERIFIED'},
{id:'se-trafik',country:'SE',mode:'rail',name:'Trafikverket — rail information',url:'https://www.trafikverket.se/',status:'OFFICIAL_LINK_ONLY',rights:'API_AND_REUSE_UNVERIFIED'},
{id:'no-banenor',country:'NO',mode:'rail',name:'Bane NOR — railway information',url:'https://www.banenor.no/',status:'OFFICIAL_LINK_ONLY',rights:'API_AND_REUSE_UNVERIFIED'},
{id:'gr-ht',country:'GR',mode:'rail',name:'Hellenic Train — train updates',url:'https://www.hellenictrain.gr/',status:'OFFICIAL_LINK_ONLY',rights:'API_AND_REUSE_UNVERIFIED'}
);
const HEAD={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type,x-client-info','access-control-allow-methods':'POST,OPTIONS'};
const out=(v:unknown,s=200)=>Response.json(v,{status:s,headers:{...HEAD,'cache-control':'no-store'}});
class Fault extends Error{constructor(public code:number,message:string){super(message)}}
const apiKey=()=>{let v=Deno.env.get('SUPABASE_ANON_KEY');if(v)return v;try{const j=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}');return String(j.default||Object.values(j)[0]||'')}catch{return ''}};
async function verify(req:Request){const m=(req.headers.get('authorization')||'').match(/^Bearer\s+(.+)$/i);const token=m?.[1]||'';if(!token||token.startsWith('sb_publishable_')||token.startsWith('sb_secret_'))throw new Fault(401,'Authenticated session required');const base=Deno.env.get('SUPABASE_URL')||'',key=apiKey();if(!base||!key)throw new Fault(503,'Auth configuration unavailable');
 const who=await fetch(base+'/auth/v1/user',{headers:{apikey:key,authorization:'Bearer '+token,accept:'application/json'}});if(!who.ok)throw new Fault(401,'Invalid session');const u=await who.json().catch(()=>null);if(!u?.id)throw new Fault(401,'Authenticated session required');
 const limit=await fetch(base+'/rest/v1/rpc/consume_user_rate_limit',{method:'POST',headers:{apikey:key,authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({p_bucket:'next-road-rail-alerts-read',p_limit:20,p_window_seconds:60})});if(!limit.ok)throw new Fault(503,'Rate limit service unavailable');const raw=await limit.json().catch(()=>null);const row=Array.isArray(raw)?raw[0]:raw;if(!row||row.allowed!==true)throw new Fault(429,'Too many requests');}

function secretKey(){const legacy=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(legacy)return legacy;try{const o=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');return String(o.default||Object.values(o)[0]||'')}catch{return ''}}
function distanceKm(a:number,b:number,c:number,d:number){const r=Math.PI/180,da=(c-a)*r,db=(d-b)*r;const h=Math.sin(da/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(db/2)**2;return Math.round(6371*2*Math.asin(Math.min(1,Math.sqrt(h)))*10)/10}
async function approvedNotices(country:string,mode:string,lat:number|null,lon:number|null,offset:number){
 const base=Deno.env.get('SUPABASE_URL')||'',key=secretKey();if(!base||!key)return {rows:[],sourceRead:'UNAVAILABLE'};
 const now=Date.now(),latest=new Date(now).toISOString();
 const url=base+'/rest/v1/next_transport_notice_v1?select=notice_id,country,mode,source_id,source_title,title,summary,source_url,status,published_at,verified_at,expires_at,lat,lon&country=eq.'+encodeURIComponent(country)+'&review_state=eq.approved&expires_at=gt.'+encodeURIComponent(latest)+'&published_at=lte.'+encodeURIComponent(latest)+'&order=published_at.desc&limit=100&offset='+offset;
 try{
 const r=await fetch(url,{headers:{apikey:key,authorization:'Bearer '+key},signal:AbortSignal.timeout(5000)});
 if(!r.ok)return {rows:[],sourceRead:'UNAVAILABLE'};
 const raw=await r.json().catch(()=>[]);if(!Array.isArray(raw))return {rows:[],sourceRead:'INVALID'};
 const out=[];
 for(const x of raw){if(mode!=='all'&&x.mode!==mode)continue;
 const published=Date.parse(x.published_at),verified=Date.parse(x.verified_at),expire=Date.parse(x.expires_at);
 if(!Number.isFinite(published)||!Number.isFinite(verified)||!Number.isFinite(expire)||published>now||expire<=now)continue;
 const ageMs=now-verified,ttlMs=x.status==='VERIFIED_LIVE'?15*60000:48*3600000;
 if(ageMs<0||ageMs>ttlMs)continue;
 const hasCoords=typeof x.lat==='number'&&typeof x.lon==='number';
 const distance=hasCoords&&lat!==null&&lon!==null?distanceKm(lat,lon,x.lat,x.lon):null;
 out.push({...x,distance_km:distance,location_quality:distance===null?'NATIONAL_NO_DISTANCE':'GPS_APPROXIMATE',freshness:'VERIFIED'});
 }
 return {rows:out,sourceRead:'OK',nextOffset:raw.length===100?offset+100:null};
 }catch{return {rows:[],sourceRead:'UNAVAILABLE'}}
}
Deno.serve(async(req:Request)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:HEAD});try{if(req.method!=='POST')throw new Fault(405,'POST required');await verify(req);const body=await req.json().catch(()=>{throw new Fault(400,'Invalid JSON')});const country=String(body?.country||'').toUpperCase();if(!/^[A-Z]{2}$/.test(country))throw new Fault(400,'Country ISO2 required');const mode=String(body?.mode||'all');if(!['all','road','rail','camera'].includes(mode))throw new Fault(400,'Invalid mode');const sources=SOURCES.filter(s=>s.country===country&&(mode==='all'||s.mode===mode));
const lat=typeof body?.lat==='number'&&body.lat>=-90&&body.lat<=90?body.lat:null;const lon=typeof body?.lon==='number'&&body.lon>=-180&&body.lon<=180?body.lon:null;const offset=(Number.isInteger(body?.offset)&&body.offset>=0&&body.offset<=10000)?body.offset:0;const checked=await approvedNotices(country,mode,lat,lon,offset);const alerts=checked.rows;return out({ok:true,feature:'NEXT_ROAD_RAIL_ALERTS_V3',country,mode,coverage:{status:alerts.length?'VERIFIED_NOTICES':'OFFICIAL_LINKS_ONLY',verifiedLiveFeed:alerts.some((a:any)=>a.status==='VERIFIED_LIVE'),sourceAvailability:sources.length?'PUBLIC_OFFICIAL_LINKS':'NO_APPROVED_PROVIDER',approvedNoticeRead:checked.sourceRead,message:alerts.length?'Reviewed notices with expiry and freshness checks':'No approved current notices for this country; this does NOT mean the roads or rail are clear'},verifiedAlertCount:alerts.length,alerts,top_2:alerts.slice(0,2),next_offset:checked.nextOffset??null,offset,sources,checkedAt:new Date().toISOString(),notes:['No radius filtering: all notices belong to the selected ISO country, with paginated reads.','Official sites linked but automated reuse is not enabled.']});
}catch(e){return out({ok:false,error:e instanceof Fault?e.message:'Request failed'},e instanceof Fault?e.code:500)}});export {};