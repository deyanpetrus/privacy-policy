/* LifeDashPro Web v1.8.2 · Air Traffic and Road Live (read-only)
   Air: authenticated pre-existing ADSB Edge; road: German Autobahn public API.
   No DB mutation, GPS permission or automatic polling. One bounded request batch per city. */
(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const el=(tag,cls,value)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=value;return e};
const CITY={
 regensburg:[49.0134,12.1016,'DE',['A3','A93']],
 munich:[48.1374,11.5755,'DE',['A8','A9']],
 nuremberg:[49.4521,11.0767,'DE',['A3','A9']],
 berlin:[52.5200,13.405,'DE',['A10','A100']],
 hamburg:[53.5511,9.9937,'DE',['A1','A7']],
 frankfurt:[50.1109,8.6821,'DE',['A3','A5']],
 vienna:[48.2082,16.3738,'AT',[]],
 skopje:[41.9981,21.4254,'MK',[]],
 ohrid:[41.1231,20.8016,'MK',[]],
 belgrade:[44.7866,20.4489,'RS',[]],
 sofia:[42.6977,23.3219,'BG',[]],
 zagreb:[45.815,15.9819,'HR',[]],
 ljubljana:[46.0569,14.5058,'SI',[]],
 thessaloniki:[40.6401,22.9444,'GR',[]],
 paris:[48.8566,2.3522,'FR',[]],
 london:[51.5072,-.1276,'GB',[]]
};
const page=$('#content'),app=$('#appView');
if(!page||!app)return;
const state={city:'',identity:'',generation:0,cache:new Map(),pending:new Map(),attempt:new Map()};
const AIR_TTL=2*60*1000,ROAD_TTL=15*60*1000,MIN_RETRY=60000;
let visibleMapKind=null,mapInstance=null,mapSignature='',mapLoading='',mapLibraryPromise=null;
const stamp=t=>t&&Number.isFinite(Number(t))?
 new Intl.DateTimeFormat(undefined,{month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(Number(t))):'Not checked';
function signedIn(){return !app.classList.contains('hidden')&&Boolean(window.LifeDashWorldBridge?.authenticated())}
function getCity(){
 const choice=$('#worldLiveCity')?.value;
 let saved='';try{saved=localStorage.getItem('lifedash_web_live_city_v18')||''}catch(_){}
 return CITY[choice]?choice:CITY[saved]?saved:'regensburg';
}
function distance(lat1,lon1,lat2,lon2){
 const r=Math.PI/180,a=Math.sin((lat2-lat1)*r/2)**2+
 Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin((lon2-lon1)*r/2)**2;
 return 12742*Math.asin(Math.min(1,Math.sqrt(a)));
}
function fmt(x){return x===null||x===undefined||!Number.isFinite(Number(x))?'—':String(Math.round(Number(x)))}
async function getAir(city){
 const [lat,lon]=CITY[city];
 let timeout;
 let data;
 try{
   data=await Promise.race([
     window.LifeDashWorldBridge.air({lat,lon,radiusKm:100}),
     new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Air Traffic request timed out')),22000)})
   ]);
 }finally{clearTimeout(timeout)}
 if(!data||!Array.isArray(data.aircraft))throw new Error('Invalid aircraft response');
 const rows=data.aircraft.filter(x=>x&&Number.isFinite(Number(x.latitude))&&Number.isFinite(Number(x.longitude)))
   .map(x=>({
     id:String(x.icao24||'').slice(0,16),callsign:String(x.callsign||'Unknown').slice(0,40),
     altitude:x.geoAltitude??x.baroAltitude??null,speed:x.velocity==null?null:Number(x.velocity)*3.6,
     track:x.trueTrack??null,dist:x.distanceKm??null,
     status:String(x.status||'unknown').slice(0,30),lat:Number(x.latitude),lon:Number(x.longitude),
     operator:String(x.operator||'').slice(0,80),registration:String(x.registration||'').slice(0,25)
   }))
   .filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon))
   .slice(0,150);
 return {rows,provider:String(data.providerLabel||'ADS-B').slice(0,80),queriedAt:Number(data.queriedAt)||Date.now()};
}
async function getRoad(city){
 const [lat,lon,code,roads]=CITY[city];
 if(code!=='DE'||!roads.length)return {unsupported:true,rows:[],roads:[]};
 const kinds=[['warning','Traffic warning'],['closure','Road closure'],['roadworks','Roadworks']];
 const batch=roads.flatMap(road=>kinds.map(([service,label])=>({road,service,label})));
 const all=await Promise.all(batch.map(async req=>{
   const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),10000);
   try{
     const url='https://verkehr.autobahn.de/o/autobahn/'+encodeURIComponent(req.road)+
       '/services/'+encodeURIComponent(req.service);
     const response=await fetch(url,{signal:abort.signal,headers:{Accept:'application/json'}});
     if(!response.ok)throw new Error('Autobahn API HTTP '+response.status);
     const data=await response.json();
     const values=data?.[req.service];
     if(!Array.isArray(values))throw new Error('Unexpected Autobahn '+req.service+' response');
     return {success:true,req,rows:values};
   }catch(error){return {success:false,req,error:String(error.message||'Source unavailable').slice(0,130)}}
   finally{clearTimeout(timer)}
 }));
 const failed=all.filter(x=>!x.success);
 const successful=all.filter(x=>x.success);
 if(!successful.length)throw new Error('Autobahn data unavailable; check network or provider CORS');
 const seen=new Set(),rows=[];
 for(const item of successful){
   for(const x of item.rows){
     const y=Number(x?.coordinate?.lat),z=Number(x?.coordinate?.long);
     if(!Number.isFinite(y)||!Number.isFinite(z)||Math.abs(y)>90||Math.abs(z)>180)continue;
     const km=distance(lat,lon,y,z);
     if(km>130)continue;
     const id=String(x?.identifier||x?.title||'')+'|'+item.req.service+'|'+item.req.road;
     if(seen.has(id))continue;seen.add(id);
     const description=Array.isArray(x?.description)?x.description.filter(Boolean).join(' · '):String(x?.description||'');
     rows.push({id,kind:item.req.label,road:item.req.road,
       title:String(x?.title||x?.subtitle||item.req.label).slice(0,140),
       description:description.slice(0,230),dist:Math.round(km),lat:y,lon:z});
   }
 }
 rows.sort((a,b)=>a.dist-b.dist);
 return {unsupported:false,rows:rows.slice(0,60),roads,covered:successful.length,totalQueries:all.length,failed:failed.length,partial:failed.length>0};
}
const providers={air:getAir,road:getRoad};
function cacheKey(kind,city){return kind+'|'+city}
function switchCity(id){
 const name=CITY[id]?id:getCity();
 if(name===state.city)return;
 state.city=name;state.generation++;removeMobilityMap();
 updateAll();refresh();
}
function ensureIdentity(){
 const user=signedIn()?String(window.LifeDashWorldBridge?.identity()||''):'';
 if(state.identity===user)return;
 removeMobilityMap();visibleMapKind=null;
 state.identity=user;state.generation++;state.cache.clear();state.pending.clear();state.attempt.clear();
 state.city=user?getCity():'';
}
function load(kind,force=false){
 if(!signedIn()||!state.city)return;
 const city=state.city,k=cacheKey(kind,city),record=state.cache.get(k);
 const ttl=kind==='air'?AIR_TTL:ROAD_TTL;
 if(!force&&record?.when&&!record.error&&Date.now()-record.when<ttl)return;
 if(state.pending.has(k))return;
 const last=state.attempt.get(k)||0;
 if(last&&Date.now()-last<MIN_RETRY)return;
 state.attempt.set(k,Date.now());
 const epoch=state.generation,identity=state.identity;
 const task=(async()=>{
   try{
     const data=await providers[kind](city);
     if(epoch!==state.generation||identity!==state.identity||!signedIn())return;
     state.cache.set(k,{data,when:Date.now(),error:''});
   }catch(e){
     if(epoch!==state.generation||identity!==state.identity||!signedIn())return;
     state.cache.set(k,{data:record?.data||null,when:record?.when||null,
       error:String(e?.message||'Source unavailable').slice(0,140)});
   }finally{
     if(state.pending.get(k)===task)state.pending.delete(k);
     if(epoch===state.generation&&identity===state.identity)updateAll();
   }
 })();
 state.pending.set(k,task);updateAll();
}
function refresh(force=false){
 for(const kind of ['air','road'])load(kind,force);
}

function removeMobilityMap(){
 if(mapInstance){try{mapInstance.remove()}catch(_){}}
 mapInstance=null;mapSignature='';mapLoading='';
}
function toggleMobilityMap(kind){
 if(visibleMapKind===kind){visibleMapKind=null;removeMobilityMap()}
 else{visibleMapKind=kind;removeMobilityMap()}
 const panel=$('#worldMobilityMapPanel');
 if(panel)panel.hidden=!visibleMapKind;
 renderMobilityMap();
 if(visibleMapKind)panel?.scrollIntoView({block:'nearest',behavior:'auto'});
}
function requestLeaflet(){
 if(window.L?.map&&window.L?.tileLayer)return Promise.resolve(window.L);
 if(mapLibraryPromise)return mapLibraryPromise;
 mapLibraryPromise=new Promise((resolve,reject)=>{
   let script=document.querySelector('script[data-world-leaflet]');
   let timeout;
   const done=()=>{clearTimeout(timeout);window.L?.map?resolve(window.L):reject(new Error('Map library failed to load'))};
   const fail=()=>{clearTimeout(timeout);reject(new Error('Map library unavailable'))};
   timeout=setTimeout(()=>reject(new Error('Map library timeout')),12000);
   if(!document.querySelector('link[data-world-leaflet]')){
     const css=document.createElement('link');css.rel='stylesheet';css.dataset.worldLeaflet='true';
     css.href='https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
     document.head.append(css);
   }
   if(!script){
     script=document.createElement('script');script.dataset.worldLeaflet='true';script.async=true;
     script.src='https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
     script.onload=done;script.onerror=fail;document.head.append(script);
   }else if(window.L?.map)done();
   else{script.addEventListener('load',done,{once:true});script.addEventListener('error',fail,{once:true})}
 }).catch(e=>{mapLibraryPromise=null;throw e});
 return mapLibraryPromise;
}
async function renderMobilityMap(){
 const panel=$('#worldMobilityMapPanel'),holder=$('#worldMobilityMapCanvas'),status=$('#worldMobilityMapStatus');
 if(!panel||!holder||!status||!visibleMapKind||!state.city||!signedIn())return;
 panel.hidden=false;
 const kind=visibleMapKind,city=state.city,record=state.cache.get(cacheKey(kind,city));
 const unsupported=kind==='road'&&CITY[city][2]!=='DE';
 const coords=(record?.data?.rows||[]).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon)&&
   Math.abs(x.lat)<=90&&Math.abs(x.lon)<=180);
 const signature=kind+'|'+city+'|'+String(record?.when||0)+'|'+String(record?.error||'')+'|'+coords.length;
 if(mapSignature===signature&&mapInstance)return;
 if(mapLoading===signature)return;
 removeMobilityMap();
 mapLoading=signature;
 status.textContent='Loading '+(kind==='air'?'aircraft':'road events')+' map…';
 try{
   const L=await requestLeaflet();
   const latest=state.cache.get(cacheKey(kind,city));
   const latestSignature=kind+'|'+city+'|'+String(latest?.when||0)+'|'+String(latest?.error||'')+'|'+
     (latest?.data?.rows||[]).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon)&&Math.abs(x.lat)<=90&&Math.abs(x.lon)<=180).length;
   if(!holder.isConnected||visibleMapKind!==kind||state.city!==city||mapLoading!==signature||
      latestSignature!==signature||!signedIn())return;
   const center=CITY[city];
   const map=L.map(holder,{scrollWheelZoom:false,zoomControl:true,preferCanvas:true})
     .setView([center[0],center[1]],8);
   mapInstance=map;mapSignature=signature;
   L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:18,attribution:'© OpenStreetMap contributors'
   }).addTo(map);
   const points=[];
   for(const x of coords){
     const marker=L.circleMarker([x.lat,x.lon],{radius:kind==='air'?6:5,
       weight:1.3,color:'#fff',fillColor:kind==='air'?'#347eec':'#f08734',
       fillOpacity:.9}).addTo(map);
     const popup=document.createElement('div');
     const title=document.createElement('strong');
     title.textContent=kind==='air'?x.callsign||'Aircraft':x.road+' · '+x.kind;
     const detail=document.createElement('p');
     detail.textContent=kind==='air'?'Altitude '+fmt(x.altitude)+' m · Speed '+
       fmt(x.speed)+' km/h · '+x.status:
       x.title+' · '+fmt(x.dist)+' km from city center';
     popup.append(title,detail);marker.bindPopup(popup);
     points.push([x.lat,x.lon]);
   }
   if(points.length===1)map.setView(points[0],10);
   else if(points.length>1)map.fitBounds(points,{maxZoom:11,padding:[20,20]});
   status.textContent=unsupported?'Road Live currently covers Germany only. No road markers for this city.':
      record?.error?(points.length?'Last known positions; source refresh failed: ':'Source unavailable: ')+record.error:
      points.length?points.length+' verified '+(kind==='air'?'aircraft':'road event')+
        ' markers · select a point to view details.':
      record?.data?'No records returned by this source for the selected area.':
        'Waiting for verified records. No markers drawn.';
   requestAnimationFrame(()=>{if(mapInstance===map)map.invalidateSize()});
 }catch(e){
   if(mapLoading===signature){removeMobilityMap();status.textContent=
     'Map unavailable: '+String(e?.message||'load failed')+' · the event list remains available.'}
 }finally{if(mapLoading===signature)mapLoading=''}
}
function makeCard(kind,short=false){
 const card=el('article','card world-mobility-card');
 card.dataset.mobility=kind;
 card.append(el('p','eyebrow',kind==='air'?'AIR TRAFFIC LIVE':'ROAD LIVE · GERMANY'));
 const total=el('strong','world-mobility-number','—');total.dataset.mobilityTotal='';
 const sub=el('p','world-mobility-description','Checking source…');sub.dataset.mobilityDescription='';
 const list=el('div','world-mobility-list');list.dataset.mobilityList='';
 const last=el('small','world-live-checked','Not checked');last.dataset.mobilityChecked='';
 last.setAttribute('role','status');
 card.append(total,sub,list,last);
 if(!short){
   const mapButton=el('button','secondary world-mobility-map-button','View map & markers ↗');
   mapButton.type='button';mapButton.addEventListener('click',()=>toggleMobilityMap(kind));
   card.append(mapButton);
 }
 if(short){
   const open=el('button','text-btn world-live-open','Open World Live →');
   open.type='button';open.addEventListener('click',()=>$('#nav [data-page="world"]')?.click());
   card.append(open);
 }
 return card;
}
function mount(){
 const full=$('#worldLivePage',page);
 if(full&&!$('#worldMobilitySection',full)){
   const sec=el('section','world-mobility-section');sec.id='worldMobilitySection';
   const top=el('div','world-mobility-heading');
   top.append(el('h3','','Air Traffic & Road Live'));
   const refreshBtn=el('button','secondary world-mobility-refresh','↻ Refresh mobility');
   refreshBtn.type='button';refreshBtn.addEventListener('click',()=>refresh(true));
   refreshBtn.id='worldMobilityRefresh';top.append(refreshBtn);sec.append(top);
   const grid=el('div','world-mobility-grid');
   grid.append(makeCard('air'),makeCard('road'));sec.append(grid);
   const maps=el('section','world-mobility-map-panel');maps.id='worldMobilityMapPanel';
   maps.hidden=true;maps.setAttribute('aria-label','World Live mobility map');
   maps.append(el('strong','world-mobility-map-title','Live movement & road marker map'));
   const message=el('p','world-mobility-map-status','Select Air Traffic or Road Live to show a map.');
   message.id='worldMobilityMapStatus';message.setAttribute('role','status');
   const canvas=el('div','world-mobility-map-canvas');canvas.id='worldMobilityMapCanvas';
   canvas.setAttribute('aria-label','Live aircraft and road event locations');
   maps.append(message,canvas);sec.append(maps);
   sec.append(el('small','world-mobility-footnote',
     'Air Traffic: ADS-B compatible snapshot via LifeDashPro Edge, within 100 km; not for flight safety. Road Live: Autobahn API for selected German motorways, incidents within 130 km. Other countries not supported yet.'));
   const anchor=$('.world-forecast-section',full);
   if(anchor)full.insertBefore(sec,anchor);
   else full.append(sec);
 }
 const dash=$('#worldLiveDashboard',page);
 if(dash&&!$('#worldMobilityDashboard',dash)){
   const row=el('section','world-mobility-dashboard');
   row.id='worldMobilityDashboard';
   row.append(el('strong','world-mobility-dashboard-title','Air Traffic & Road Live'));
   const grid=el('div','world-mobility-grid');
   grid.append(makeCard('air',true),makeCard('road',true));
   row.append(grid);dash.append(row);
 }
}
function updateCard(card,kind,brief){
 const city=state.city,k=cacheKey(kind,city),value=state.cache.get(k);
 const busy=state.pending.has(k),data=value?.data;
 const signature=JSON.stringify([city,kind,brief,busy,value?.when||0,value?.error||'',Boolean(data)]);
 if(card.dataset.mobilitySignature===signature)return;
 card.dataset.mobilitySignature=signature;
 const total=$('[data-mobility-total]',card),subtitle=$('[data-mobility-description]',card),
   list=$('[data-mobility-list]',card),checked=$('[data-mobility-checked]',card);
 if(!total||!subtitle||!list||!checked)return;
 list.replaceChildren();
 const unsupported=kind==='road'&&CITY[city]?.[2]!=='DE';
 total.textContent=unsupported?'Germany only':!data?'—':kind==='air'?String(data.rows.length)+' aircraft':
   String(data.rows.length)+' incidents';
 subtitle.textContent=unsupported?'Road Live currently covers German motorways only.':
   !data?'No verified response yet':
   kind==='air'?'Aircraft nearby · '+data.provider:
   data.roads.join(', ')+' · within 130 km'+(data.partial?' · partial coverage':'');
 checked.textContent=unsupported?'Outside supported road area':
   busy?'Updating source…':
   value?.error?(data?'Last successful '+stamp(value.when)+' · refresh failed':'Unavailable · '+value.error):
   value?.when?'Checked '+stamp(value.when):'Not checked';
 if(!data||unsupported){
   if(!brief)list.append(el('p','world-mobility-empty',unsupported?
     'Select Regensburg, Munich, Berlin, Hamburg, Frankfurt or Nuremberg to view Autobahn data.':
     value?.error?'Provider request failed; no result claimed.':'Loading verified source data…'));
   return;
 }
 const rows=data.rows.slice(0,brief?2:kind==='air'?12:15);
 if(!rows.length){
   list.append(el('p','world-mobility-empty',kind==='air'?
     'No aircraft returned within 100 km for this snapshot.':
     data.partial?'No nearby records in responding road services; other services unavailable.':
       'No nearby road incidents reported for the selected motorways.'));
 }
 for(const row of rows){
   const item=el('div','world-mobility-item');
   if(kind==='air'){
     item.append(el('strong','',row.callsign||row.id||'Aircraft'),
       el('small','',fmt(row.dist)+' km · '+fmt(row.altitude)+' m · '+fmt(row.speed)+' km/h · '+row.status));
   }else{
     item.append(el('strong','',row.road+' · '+row.kind+' · '+row.title),
       el('small','',row.dist+' km'+(brief?'':' · '+row.description)));
   }
   list.append(item);
 }
}
function updateAll(){
 if(!state.city)return;
 document.querySelectorAll('#worldMobilitySection [data-mobility],#worldMobilityDashboard [data-mobility]')
   .forEach(card=>updateCard(card,card.dataset.mobility,Boolean(card.closest('#worldMobilityDashboard'))));
 const b=$('#worldMobilityRefresh');
 if(b)b.disabled=['air','road'].some(kind=>state.pending.has(cacheKey(kind,state.city)));
 if(visibleMapKind)void renderMobilityMap();
}
function onContent(){
 ensureIdentity();
 if(!signedIn())return;
 if(!state.city)state.city=getCity();
 const old=state.city,cur=getCity();
 if(CITY[cur]&&cur!==old){state.city=cur;state.generation++}
 const host=$('#worldLivePage',page),dash=$('#worldLiveDashboard',page);
 if(!host){removeMobilityMap();visibleMapKind=null}
 if(!host&&!dash)return;
 mount();updateAll();refresh();
}
document.addEventListener('lifedash:world-city-change',e=>{if(signedIn())switchCity(e.detail?.id)});
document.addEventListener('change',e=>{if(e.target?.id==='worldLiveCity'&&signedIn())switchCity(e.target.value)});
new MutationObserver(onContent).observe(page,{childList:true});
new MutationObserver(()=>{
 if(!signedIn()){state.generation++;state.identity='';state.city='';state.cache.clear();state.pending.clear();state.attempt.clear()}
 else onContent();
}).observe(app,{attributes:true,attributeFilter:['class']});
onContent();
})();
