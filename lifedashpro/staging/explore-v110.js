/* LifeDashPro Web v1.10 — Explore & Around Me.
   Existing authenticated nearby-places Edge (Geoapify/OSM), no browser keys,
   no background GPS, no automatic polling, no database writes. */
(()=>{
'use strict';
const $=(q,r=document)=>r.querySelector(q);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n};
const content=$('#content'),app=$('#appView');
if(!content||!app)return;
const bridge=()=>window.LifeDashExploreBridge;
const PRESETS=[
 ['regensburg','Regensburg, Germany',49.0134,12.1016],
 ['munich','Munich, Germany',48.1374,11.5755],
 ['nuremberg','Nuremberg, Germany',49.4521,11.0767],
 ['berlin','Berlin, Germany',52.52,13.405],
 ['hamburg','Hamburg, Germany',53.5511,9.9937],
 ['frankfurt','Frankfurt, Germany',50.1109,8.6821],
 ['vienna','Vienna, Austria',48.2082,16.3738],
 ['skopje','Skopje, North Macedonia',41.9981,21.4254],
 ['ohrid','Ohrid, North Macedonia',41.1231,20.8016],
 ['belgrade','Belgrade, Serbia',44.7866,20.4489],
 ['sofia','Sofia, Bulgaria',42.6977,23.3219],
 ['zagreb','Zagreb, Croatia',45.815,15.9819],
 ['ljubljana','Ljubljana, Slovenia',46.0569,14.5058],
 ['thessaloniki','Thessaloniki, Greece',40.6401,22.9444],
 ['paris','Paris, France',48.8566,2.3522],
 ['london','London, UK',51.5072,-.1276]
];
const CATEGORIES=[
 ['fuel','⛽','Fuel'],['parking','🅿','Parking'],['restaurant','☕','Food & Coffee'],
 ['hotel','🛏','Hotels'],['charging','⚡','EV charging'],['market','🛒','Markets'],
 ['pharmacy','✚','Pharmacies'],['hospital','✚','Hospitals'],
 ['atm','€','ATMs'],['tourism','⌖','Attractions'],['police','◈','Police'],
 ['cafes','☕','Cafés']
];
const CACHE_MS=10*60*1000,RETRY_MS=60*1000;
let identity='',origin=null,category='fuel',radius=5,results=[],source='',checkedAt=0,error='';
let map=null,markers=[],leafletPromise=null,epoch=0,waiting=false,cache=new Map(),attempts=new Map();
const ready=()=>Boolean(bridge()?.ready())&&!app.classList.contains('hidden');
const cityKey='lifedash_web_explore_city_v110';
const fmtTime=t=>t?new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short'}).format(new Date(t)):'Not checked';
const distance=(a,b,c,d)=>{const r=Math.PI/180,lat=(c-a)*r,lon=(d-b)*r;const v=Math.sin(lat/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(lon/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(v)))};
function preset(){
 let saved='';try{saved=localStorage.getItem(cityKey)||''}catch(_){}
 const fromProfile=String(bridge()?.profileCity()||'').trim().toLowerCase();
 return PRESETS.find(x=>x[0]===saved)||PRESETS.find(x=>fromProfile&&x[1].toLowerCase().startsWith(fromProfile))||PRESETS[0];
}
function normalizePlace(x){
 const lat=Number(x?.lat),lon=Number(x?.lon);
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return null;
 const km=Number(x.distanceKm);
 return {id:String(x.id||lat+':'+lon),name:String(x.name||'Place').slice(0,140),lat,lon,
    distanceKm:Number.isFinite(km)&&km>=0?km:Math.round(distance(origin.lat,origin.lon,lat,lon)*10)/10,
    address:String(x.address||'').slice(0,220),phone:String(x.phone||'').slice(0,65),
    website:String(x.website||'').slice(0,240)};
}
function setOrigin(next){
 if(!next||!Number.isFinite(next.lat)||!Number.isFinite(next.lon))return;
 origin={lat:next.lat,lon:next.lon,label:next.label||'Selected location',presetId:next.presetId||''};
 epoch++;waiting=false;results=[];source='';error='';checkedAt=0;
 const label=$('#exploreCenterLabel');if(label)label.textContent=origin.label;
 const picker=$('#exploreCitySelect');
 if(picker)picker.value=origin.presetId||'custom';
 updateMap();updateList();
 search();
}
function loadPreset(id){
 const c=PRESETS.find(x=>x[0]===id);
 if(!c)return;
 try{localStorage.setItem(cityKey,c[0])}catch(_){}
 setOrigin({lat:c[2],lon:c[3],label:c[1],presetId:c[0]});
}
function cacheKey(){
 return [identity,origin.lat.toFixed(3),origin.lon.toFixed(3),category,radius].join('|');
}
async function search(force=false){
 if(!ready()||!origin||waiting)return;
 const k=cacheKey(),saved=cache.get(k);
 if(!force&&saved&&Date.now()-saved.when<CACHE_MS){apply(saved);return}
 if(Date.now()-(attempts.get(k)||0)<RETRY_MS){
   if(saved){apply(saved);return}
   error='Please wait a minute before repeating the same search.';updateList();return;
 }
 attempts.set(k,Date.now());
 waiting=true;const g=epoch,user=identity;updateList();
 try{
   const response=await bridge().nearby({action:'search',lat:origin.lat,lon:origin.lon,
     radiusKm:radius,category,limit:20,sort:'distance',lang:'en'});
   if(g!==epoch||user!==identity||!ready())return;
   const normalized=response.places.map(normalizePlace).filter(Boolean);
   const unique=[],ids=new Set();
   for(const place of normalized){
     const key=place.name+'|'+place.lat.toFixed(5)+'|'+place.lon.toFixed(5);
     if(!ids.has(key)){ids.add(key);unique.push(place)}
   }
   const record={places:unique.slice(0,20),provider:String(response.provider||'OpenStreetMap').slice(0,60),when:Date.now()};
   cache.set(k,record);apply(record);
 }catch(e){
   if(g!==epoch||user!==identity||!ready())return;
   if(saved){apply(saved);error='Could not refresh: '+String(e.message||'Source unavailable').slice(0,120)}
   else{results=[];checkedAt=0;error=String(e.message||'Source unavailable').slice(0,160)}
 }finally{
   if(g===epoch&&user===identity){waiting=false;updateList();updateMap()}
 }
}
function apply(row){results=row.places;source=row.provider;checkedAt=row.when;error='';updateList();updateMap()}
function clearMap(){
 if(map){try{map.remove()}catch(_){}}
 map=null;markers=[];
}
function leaflet(){
 if(window.L?.map)return Promise.resolve(window.L);
 if(leafletPromise)return leafletPromise;
 leafletPromise=new Promise((resolve,reject)=>{
   if(!document.querySelector('link[data-world-leaflet]')){
     const css=document.createElement('link');css.rel='stylesheet';css.dataset.worldLeaflet='true';
     css.href='https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';document.head.append(css);
   }
   let script=document.querySelector('script[data-world-leaflet]');
   const timeout=setTimeout(()=>reject(new Error('Map library timed out')),14000);
   const success=()=>{clearTimeout(timeout);window.L?.map?resolve(window.L):reject(new Error('Map library unavailable'))};
   const fail=()=>{clearTimeout(timeout);reject(new Error('Map library could not load'))};
   if(!script){
     script=document.createElement('script');script.async=true;script.dataset.worldLeaflet='true';
     script.src='https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
     script.onload=success;script.onerror=fail;document.head.append(script);
   }else{script.addEventListener('load',success,{once:true});script.addEventListener('error',fail,{once:true})}
 }).catch(e=>{leafletPromise=null;throw e});
 return leafletPromise;
}
function updateMap(){
 const mount=$('#exploreMap'),status=$('#exploreMapStatus');
 if(!mount||!origin)return;
 if(!map){status.textContent='Loading interactive map…';void initMap();return}
 for(const marker of markers){try{marker.remove()}catch(_){}}
 markers=[];
 map.setView([origin.lat,origin.lon],Math.min(13,map.getZoom()||12));
 const center=window.L.circleMarker([origin.lat,origin.lon],{radius:8,color:'#fff',weight:2,fillColor:'#377de9',fillOpacity:1}).addTo(map);
 center.bindTooltip('Search center: '+origin.label);markers.push(center);
 for(const x of results){
   const marker=window.L.circleMarker([x.lat,x.lon],{radius:6,color:'#fff',weight:1.4,
     fillColor:'#e79a4b',fillOpacity:.95}).addTo(map);
   const popup=document.createElement('div');
   const name=document.createElement('strong');name.textContent=x.name;
   const address=document.createElement('p');address.textContent=x.address||'Address not provided';
   popup.append(name,address);marker.bindPopup(popup);markers.push(marker);
 }
 const bounds=results.map(x=>[x.lat,x.lon]);
 if(bounds.length)map.fitBounds([[origin.lat,origin.lon],...bounds],{padding:[26,26],maxZoom:13});
 status.textContent=results.length?results.length+' verified places · select a pin for details':
   'Map centered on '+origin.label+'. No place markers returned yet.';
 requestAnimationFrame(()=>{if(map)map.invalidateSize()});
}
async function initMap(){
 const holder=$('#exploreMap'),status=$('#exploreMapStatus'),g=epoch;
 if(!holder||!origin||map||holder.dataset.loading==='1')return;
 holder.dataset.loading='1';
 try{
   const L=await leaflet();
   if(!holder.isConnected||!ready())return;
   map=L.map(holder,{zoomControl:true,scrollWheelZoom:false,preferCanvas:true})
     .setView([origin.lat,origin.lon],12);
   L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors'}).addTo(map);
   updateMap();
 }catch(e){if(status)status.textContent='Map unavailable: '+String(e.message||'Failed to load').slice(0,110)+
      ' · place results remain available.'}
 finally{holder.dataset.loading=''}
}
function openMarker(index){
 if(!map||!results[index])return;
 const marker=markers[index+1];
 if(!marker)return;
 map.setView([results[index].lat,results[index].lon],Math.max(14,map.getZoom()),{animate:true});
 marker.openPopup();
}
function safeSite(url){
 try{const u=new URL(url);return u.protocol==='https:'?u.href:null}catch(_){return null}
}
function updateList(){
 const list=$('#exploreResults'),count=$('#exploreCount'),meta=$('#exploreMeta'),button=$('#exploreRefresh');
 if(!list)return;
 const name=CATEGORIES.find(x=>x[0]===category)?.[2]||'Places';
 if(count)count.textContent=results.length+' '+name.toLowerCase()+' nearby';
 if(button){button.disabled=waiting;button.textContent=waiting?'Searching…':'↻ Refresh'}
 if(meta)meta.textContent=waiting?'Searching provider…':error?'Unavailable · '+error:
   checkedAt?'Source: '+source+' · Checked '+fmtTime(checkedAt):'Choose a category to search nearby';
 list.replaceChildren();
 if(error&&!results.length)list.append(el('p','explore-empty','Could not load nearby places. Try Refresh or another category.'));
 else if(!results.length)list.append(el('p','explore-empty',waiting?
   'Searching within '+radius+' km…':'No places returned for this category within '+radius+' km.'));
 results.forEach((x,i)=>{
   const card=el('article','explore-place-card');
   const btn=el('button','explore-place-select');btn.type='button';
   btn.setAttribute('aria-label','View '+x.name+' on map');
   const top=el('div','explore-place-top');
   top.append(el('strong','',x.name),el('span','explore-distance',x.distanceKm.toFixed(1)+' km'));
   btn.append(top,el('small','',x.address||'Address not provided'));btn.addEventListener('click',()=>openMarker(i));
   card.append(btn);
   const actions=el('div','explore-place-actions');
   const osm=el('a','','Map ↗');
   osm.href='https://www.openstreetmap.org/?mlat='+encodeURIComponent(x.lat)+
     '&mlon='+encodeURIComponent(x.lon)+'#map=17/'+encodeURIComponent(x.lat)+'/'+encodeURIComponent(x.lon);
   osm.target='_blank';osm.rel='noopener noreferrer';actions.append(osm);
   if(x.phone&&/^\+?[\d()\s.-]{5,25}$/.test(x.phone)){
     const call=el('a','','Call');call.href='tel:'+x.phone.replace(/[^\d+]/g,'');actions.append(call);
   }
   const site=safeSite(x.website);
   if(site){const a=el('a','','Website ↗');a.href=site;a.target='_blank';a.rel='noopener noreferrer';actions.append(a)}
   card.append(actions);list.append(card);
 });
}
async function searchCity(){
 const input=$('#exploreCityQuery'),button=$('#exploreFindCity'),resultsNode=$('#exploreCities');
 const query=String(input?.value||'').trim();
 if(query.length<2){resultsNode.textContent='Enter at least 2 letters.';return}
 button.disabled=true;resultsNode.replaceChildren(el('span','','Searching cities…'));
 try{
   const resp=await bridge().cities(query);
   resultsNode.replaceChildren();
   if(!resp.length)resultsNode.append(el('span','','No matching cities.'));
   resp.slice(0,6).forEach(x=>{
     const lat=Number(x.lat),lon=Number(x.lon);
     if(!Number.isFinite(lat)||!Number.isFinite(lon))return;
     const b=el('button','explore-city-option',String(x.label||x.city||'City'));
     b.type='button';b.addEventListener('click',()=>{setOrigin({lat,lon,label:b.textContent});resultsNode.replaceChildren()});
     resultsNode.append(b);
   });
 }catch(e){resultsNode.replaceChildren(el('span','',String(e.message||'City search unavailable').slice(0,150)))}
 finally{button.disabled=false}
}
function useGps(){
 const status=$('#exploreGpsStatus'),button=$('#exploreUseGps');
 if(!navigator.geolocation){status.textContent='Browser GPS is unavailable.';return}
 status.textContent='Requesting your browser location permission…';button.disabled=true;
 navigator.geolocation.getCurrentPosition(
   position=>{
     button.disabled=false;
     const lat=position.coords.latitude,lon=position.coords.longitude;
     if(!Number.isFinite(lat)||!Number.isFinite(lon))return;
     status.textContent='Approximate current location selected (not stored).';
     setOrigin({lat,lon,label:'My current location'});
   },
   e=>{button.disabled=false;status.textContent='Location unavailable or permission denied ('+e.code+'). Choose a city instead.'},
   {enableHighAccuracy:false,timeout:12000,maximumAge:60000}
 );
}
function render(){
 const host=$('#exploreAroundPage');
 if(!host||host.dataset.ready)return;
 host.dataset.ready='1';host.replaceChildren();
 const header=el('div','explore-header');
 const intro=el('div');intro.append(el('p','eyebrow','EXPLORE · AROUND ME'),el('h2','','Explore nearby'),
   el('p','explore-subtitle','Discover real places with an interactive map · Geoapify and OpenStreetMap data.'));
 header.append(intro);host.append(header);
 const controls=el('section','explore-controls');
 const cityWrap=el('label','explore-field');cityWrap.append(el('span','','Location'));
 const cities=el('select','explore-select');cities.id='exploreCitySelect';
 for(const x of PRESETS){const opt=el('option','',x[1]);opt.value=x[0];cities.append(opt)}
 const custom=el('option','','Custom location / GPS');custom.value='custom';cities.append(custom);
 cities.value=origin.presetId||'custom';
 cities.addEventListener('change',()=>{if(cities.value!=='custom')loadPreset(cities.value)});
 cityWrap.append(cities);
 const radiusWrap=el('label','explore-field');radiusWrap.append(el('span','','Radius'));
 const radios=el('select','explore-select');radios.id='exploreRadius';
 for(const km of [2,5,10,20]){const o=el('option','',km+' km');o.value=String(km);radios.append(o)}
 radios.value=String(radius);
 radios.addEventListener('change',()=>{radius=Number(radios.value);epoch++;waiting=false;results=[];error='';updateMap();updateList();search()});
 radiusWrap.append(radios);
 const gps=el('button','secondary explore-gps','⌖ Use my location');gps.type='button';gps.id='exploreUseGps';gps.addEventListener('click',useGps);
 const refresh=el('button','secondary explore-refresh','↻ Refresh');refresh.type='button';refresh.id='exploreRefresh';refresh.addEventListener('click',()=>search(true));
 controls.append(cityWrap,radiusWrap,gps,refresh);host.append(controls);
 const gpsStatus=el('p','explore-status','');gpsStatus.id='exploreGpsStatus';host.append(gpsStatus);
 const citySearch=el('div','explore-city-search');
 const query=el('input','explore-search');query.id='exploreCityQuery';query.placeholder='Find another city…';query.maxLength=120;query.setAttribute('aria-label','Find another city');
 const find=el('button','secondary','Find city');find.id='exploreFindCity';find.type='button';find.addEventListener('click',searchCity);
 query.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchCity()}});
 citySearch.append(query,find);
 const citiesOut=el('div','explore-cities');citiesOut.id='exploreCities';
 citySearch.append(citiesOut);host.append(citySearch);
 const tabs=el('div','explore-categories');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Nearby place category');
 for(const [key,icon,label]of CATEGORIES){
   const b=el('button','explore-category'+(key===category?' selected':''),icon+' '+label);
   b.type='button';b.dataset.exploreCategory=key;b.setAttribute('aria-pressed',String(key===category));
   b.addEventListener('click',()=>{
     if(category===key)return;
     category=key;epoch++;waiting=false;results=[];error='';
     host.querySelectorAll('[data-explore-category]').forEach(btn=>{
       const active=btn.dataset.exploreCategory===key;
       btn.classList.toggle('selected',active);btn.setAttribute('aria-pressed',String(active));
     });updateMap();updateList();search();
   });tabs.append(b);
 }
 host.append(tabs);
 const body=el('div','explore-layout');
 const mapPanel=el('section','explore-map-panel');
 const headline=el('div','explore-map-head');
 headline.append(el('strong','', 'Nearby map'),el('span','',origin.label));
 headline.querySelector('span').id='exploreCenterLabel';
 mapPanel.append(headline);
 const mapStatus=el('p','explore-map-status','Loading interactive map…');mapStatus.id='exploreMapStatus';mapPanel.append(mapStatus);
 const canvas=el('div','explore-map');canvas.id='exploreMap';canvas.setAttribute('aria-label','Map showing nearby places');mapPanel.append(canvas);
 const listPanel=el('section','explore-results-panel');
 const cap=el('div','explore-results-head');const count=el('strong','','Nearby places');count.id='exploreCount';cap.append(count);
 listPanel.append(cap);
 const meta=el('p','explore-results-meta','');meta.id='exploreMeta';meta.setAttribute('role','status');listPanel.append(meta);
 const list=el('div','explore-results');list.id='exploreResults';listPanel.append(list);
 body.append(mapPanel,listPanel);host.append(body);
 host.append(el('p','explore-disclaimer','Places and contact details depend on provider coverage and may be incomplete. Search happens only when you choose a location, category or Refresh. GPS is requested only on your click; the web does not track you in the background. Not the Android Navigator or route-POI scanner.'));
 updateList();void initMap();search();
}
function observe(){
 const page=$('#exploreAroundPage',content);
 if(!ready()){
   if(identity){identity='';cache.clear();attempts.clear();epoch++;waiting=false;results=[];clearMap()}
   return;
 }
 const user=String(bridge().identity()||'');
 if(user!==identity){identity=user;cache.clear();attempts.clear();epoch++;waiting=false;results=[];clearMap();origin=null}
 if(!page){if(map)clearMap();return}
 if(!origin){const c=preset();origin={lat:c[2],lon:c[3],label:c[1],presetId:c[0]}}
 render();
}
new MutationObserver(observe).observe(content,{childList:true});
new MutationObserver(observe).observe(app,{attributes:true,attributeFilter:['class']});
observe();
})();
