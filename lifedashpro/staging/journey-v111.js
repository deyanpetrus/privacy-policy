/* LifeDashPro Web v1.11 — Saved Journey Manager.
   Canonical Android trip plans, read-only; geographic stop map is not navigation. */
(()=>{
'use strict';
const $=(q,r=document)=>r.querySelector(q);
const E=(tag,cls,value)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(value!==undefined)x.textContent=String(value);return x};
const content=$('#content'),app=$('#appView');if(!content||!app)return;
const bridge=()=>window.LifeDashMobilityBridge;
const arr=x=>Array.isArray(x)?x:[];
const str=(x,n=160)=>String(x??'').trim().slice(0,n);
const num=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
let account='',plans=[],selected='',tab='stops',map=null,mapKey='',loadingKey='',libPromise=null;
function date(raw){
 const m=str(raw,40).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(!m)return '';
 const d=new Date(+m[1],+m[2]-1,+m[3],12);
 return d.getFullYear()===+m[1]&&d.getMonth()+1===+m[2]&&d.getDate()===+m[3]?
 m[1]+'-'+String(+m[2]).padStart(2,'0')+'-'+String(+m[3]).padStart(2,'0'):'';
}
function friendly(v){
 const iso=date(v);if(!iso)return 'Not set';
 const [y,m,d]=iso.split('-').map(Number);
 return new Intl.DateTimeFormat(undefined,{day:'numeric',month:'short',year:'numeric'}).format(new Date(y,m-1,d,12));
}
function stopName(s){return str(s?.place?.displayName||s?.place?.name||s?.place?.city||s?.place?.address||'Stop')}
function coords(stop){
 const p=stop?.place||{},lat=num(p.latitude??p.lat),lon=num(p.longitude??p.lon);
 return lat===null||lon===null||Math.abs(lat)>90||Math.abs(lon)>180||(lat===0&&lon===0)?null:{lat,lon};
}
function action(text,callback,cls='secondary'){
 const n=E('button',cls,text);n.type='button';n.addEventListener('click',callback);return n;
}
function heading(title,help){
 const node=E('div','mob111-section-head');
 node.append(E('h3','',title),E('p','mob111-muted',help));return node;
}
function clearMap(){
 if(map)try{map.remove()}catch(_){}
 map=null;mapKey='';loadingKey='';
}
function leaflet(){
 if(window.L?.map&&window.L?.tileLayer)return Promise.resolve(window.L);
 if(libPromise)return libPromise;
 libPromise=new Promise((resolve,reject)=>{
   if(!document.querySelector('link[data-world-leaflet]')){
     const css=document.createElement('link');css.rel='stylesheet';css.dataset.worldLeaflet='true';
     css.href='https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';document.head.append(css);
   }
   let script=document.querySelector('script[data-world-leaflet]');
   const timer=setTimeout(()=>reject(new Error('Map timed out')),14000);
   const done=()=>{clearTimeout(timer);window.L?.map?resolve(window.L):reject(new Error('Map library unavailable'))};
   const fail=()=>{clearTimeout(timer);reject(new Error('Map library could not load'))};
   if(!script){
     script=document.createElement('script');script.dataset.worldLeaflet='true';script.async=true;
     script.src='https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
     script.onload=done;script.onerror=fail;document.head.append(script);
   }else{script.addEventListener('load',done,{once:true});script.addEventListener('error',fail,{once:true})}
 }).catch(e=>{libPromise=null;throw e});
 return libPromise;
}
function stopList(plan){return arr(plan.stops).slice(0,120)}
function loadMap(plan){
 const host=$('#journeyMapV111'),message=$('#journeyMapMessageV111');
 if(!host||!message)return;
 const points=stopList(plan).map((stop,i)=>({stop,i,point:coords(stop)})).filter(x=>x.point);
 if(!points.length){message.textContent='No verified stop coordinates available. The itinerary remains visible below.';return}
 const key=account+'|'+str(plan.id)+'|'+points.length;
 if(map&&mapKey===key)return;
 if(loadingKey===key)return;
 clearMap();loadingKey=key;message.textContent='Loading '+points.length+' stop markers…';
 void (async()=>{
   try{
     const L=await leaflet();
     if(loadingKey!==key||!host.isConnected||String(selected)!==String(plan.id)||!bridge()?.ready())return;
     const first=points[0].point;
     const m=L.map(host,{scrollWheelZoom:false,zoomControl:true,preferCanvas:true}).setView([first.lat,first.lon],8);
     map=m;mapKey=key;
     L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
       {maxZoom:18,attribution:'© OpenStreetMap contributors'}).addTo(m);
     const line=[];
     for(const {stop,i,point}of points){
       const marker=L.circleMarker([point.lat,point.lon],
         {radius:8,color:'#fff',weight:2,fillColor:'#437fdf',fillOpacity:.97}).addTo(m);
       const popup=document.createElement('div');
       popup.append(E('strong','',(i+1)+'. '+stopName(stop)),
         E('p','',[friendly(stop.date),str(stop.transportMode)].filter(Boolean).join(' · ')));
       marker.bindPopup(popup);line.push([point.lat,point.lon]);
     }
     if(line.length>1){
       L.polyline(line,{color:'#77a4ff',weight:3,opacity:.7,dashArray:'5 8'}).addTo(m);
       m.fitBounds(line,{padding:[22,22],maxZoom:11});
     }else m.setView(line[0],11);
     message.textContent=line.length+' verified stops. Dashed lines show stop order, NOT a calculated driving route.';
     requestAnimationFrame(()=>{if(map===m)m.invalidateSize()});
   }catch(e){
     if(loadingKey===key){clearMap();message.textContent='Map unavailable: '+str(e?.message||'Loading error')+'. The itinerary below is still available.'}
   }finally{if(loadingKey===key)loadingKey=''}
 })();
}
function openStop(point){
 const lat=String(point.lat),lon=String(point.lon);
 const href='https://www.openstreetmap.org/?mlat='+encodeURIComponent(lat)+
 '&mlon='+encodeURIComponent(lon)+'#map=13/'+encodeURIComponent(lat)+'/'+encodeURIComponent(lon);
 window.open(href,'_blank','noopener,noreferrer');
}
function stopsPanel(plan,panel){
 panel.append(heading('Stops & schedule','Your saved itinerary in Android order, including dates and modes.'));
 const saved=stopList(plan);
 if(!saved.length){panel.append(E('p','mob111-empty','No stops are saved for this trip.'));return}
 const list=E('div','mob111-journey-stops');
 saved.forEach((stop,i)=>{
   const item=E('article','mob111-stop'),info=E('div','mob111-stop-info');
   info.append(E('strong','',stopName(stop)));
   const d=[friendly(stop.date),str(stop.arrivalTime)?'Arrive '+str(stop.arrivalTime):'',
    str(stop.departureTime)?'Depart '+str(stop.departureTime):'',str(stop.transportMode),
    num(stop.nights)>0?String(stop.nights)+' nights':''].filter(Boolean);
   info.append(E('small','mob111-muted',d.join(' · ')));
   const loc=stop.place||{},address=str(loc.address||[loc.city,loc.country].filter(Boolean).join(', '),220);
   if(address)info.append(E('small','mob111-muted',address));
   if(str(stop.note))info.append(E('p','',str(stop.note,850)));
   const numbers=[['reminders',arr(stop.reminders).length],['documents',arr(stop.documents).length],
     ['attachments',arr(stop.attachments).length]].filter(x=>x[1]>0).map(x=>x[1]+' '+x[0]);
   if(numbers.length)info.append(E('small','mob111-muted',numbers.join(' · ')));
   item.append(E('span','mob111-stop-number',i+1),info);
   const geo=coords(stop);if(geo)item.append(action('Map ↗',()=>openStop(geo),'secondary mob111-map-link'));
   list.append(item);
 });
 panel.append(list);
}
function transportPanel(plan,panel){
 panel.append(heading('Saved transport','Saved mode choices and provider status; no new route calculation.'));
 const entries=arr(plan.segments).slice(0,70);
 if(!entries.length){panel.append(E('p','mob111-empty','No transport segments saved.'));return}
 const list=E('div','mob111-history');
 for(const s of entries){
   const row=E('article','mob111-history-row');
   row.append(E('strong','',str(s.preferredMode||s.provider||'Transport segment')));
   const details=[str(s.departureRequested)?'Departure '+str(s.departureRequested):'',
     arr(s.options).length+' stored options',s.upstreamMissing===true?'Provider information missing':''].filter(Boolean);
   row.append(E('small','mob111-muted',details.join(' · ')));
   if(str(s.error))row.append(E('p','mob111-muted','Last saved source error: '+str(s.error,200)));
   list.append(row);
 }
 panel.append(list);
}
function labelOf(value){
 if(value===null||value===undefined)return '';
 if(typeof value==='string'||typeof value==='number')return str(value,220);
 if(typeof value!=='object')return '';
 return str(value.title||value.label||value.name||value.text||value.description||value.item||'',220);
}
function organizerPanel(plan,panel){
 const ws=plan.travelWorkspace&&typeof plan.travelWorkspace==='object'?plan.travelWorkspace:{};
 panel.append(heading('Travel organizer','Packing, reservations, activities and memories from the Android trip workspace.'));
 for(const [key,name]of [['packing','Packing checklist'],['reservations','Reservations'],['activities','Activities'],['memories','Memories']]){
   const source=arr(ws[key]).slice(0,80);
   const group=E('section','mob111-workspace-group');
   group.append(E('h4','',name+' · '+source.length));
   if(!source.length)group.append(E('p','mob111-muted','No entries'));
   else{
     let shown=0;const list=E('div','mob111-workspace-list');
     for(const value of source){
       const name=labelOf(value);if(!name)continue;shown++;
       const done=typeof value==='object'&&value!==null&&
         (value.checked===true||value.done===true||value.completed===true);
       const row=E('div','mob111-workspace-item');
       row.append(E('span','mob111-workspace-mark',done?'✓':'•'),E('span','',name));
       list.append(row);
     }
     if(!shown)list.append(E('p','mob111-muted','Saved entries have no displayable titles.'));
     group.append(list);
   }
   panel.append(group);
 }
 if(str(ws.notes))panel.append(E('p','mob111-note',str(ws.notes,2400)));
}
function exportTrip(plan){
 const lines=['LifeDashPro itinerary · '+str(plan.title||'Trip'),
   'Start: '+friendly(plan.startDate),'Stops: '+stopList(plan).length,'',
   'Saved stop order (not turn-by-turn navigation)',''];
 stopList(plan).forEach((s,i)=>{lines.push((i+1)+'. '+stopName(s)+' · '+friendly(s.date));
   if(str(s.note))lines.push('   '+str(s.note,400))});
 const blob=new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='lifedash-journey-'+(date(plan.startDate)||'saved')+'.txt';
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function draw(){
 const host=$('#journeyManagerV111',content);if(!host)return;
 host.dataset.mob111Ready='1';host.replaceChildren();
 const top=E('div','mob111-intro'),labels=E('div');
 labels.append(E('p','eyebrow','JOURNEY MANAGER'),E('h2','','Saved journeys'),
   E('p','mob111-muted','Itineraries and travel workspace synced from Android.'));
 top.append(labels,action('View vehicles →',()=>$('#nav [data-page="vehicles"]')?.click()));
 host.append(top);
 const counters=E('div','mob111-kpis');
 const stats=[['Saved trips',plans.length],
   ['Saved stops',plans.reduce((n,p)=>n+stopList(p).length,0)],
   ['Trips with transport',plans.filter(p=>arr(p.segments).length>0).length],
   ['Trips with packing',plans.filter(p=>arr(p.travelWorkspace?.packing).length>0).length]];
 for(const [name,value]of stats){const k=E('div','mob111-kpi');
   k.append(E('strong','',value),E('span','',name));counters.append(k)}
 host.append(counters);
 if(!plans.length){host.append(E('p','mob111-empty','No saved journeys yet. Create one in Android to see it here.'));return}
 if(!plans.some(p=>String(p.id)===selected))selected=String(plans[0].id);
 const layout=E('div','mob111-layout'),chooser=E('aside','mob111-chooser');
 chooser.append(E('strong','','My journeys'));
 for(const p of plans.slice().sort((a,b)=>date(b.startDate).localeCompare(date(a.startDate)))){
   const button=action(str(p.title||'Saved journey'),()=>{clearMap();selected=String(p.id);tab='stops';draw()},'mob111-choice');
   button.classList.toggle('active',String(p.id)===selected);
   button.setAttribute('aria-pressed',String(p.id)===selected);
   button.append(E('small','',friendly(p.startDate)+' · '+stopList(p).length+' stops'));
   chooser.append(button);
 }
 const plan=plans.find(p=>String(p.id)===selected)||plans[0];
 const panel=E('section','mob111-panel'),head=E('div','mob111-panel-title');
 head.append(E('h3','',str(plan.title||'Saved journey')),E('span','mob111-plate',friendly(plan.startDate)));
 panel.append(head);
 const facts=E('div','mob111-facts');
 for(const value of [str(plan.startTime)?'Start '+str(plan.startTime):'',
   stopList(plan).length+' stops',str(plan.timeMode)||'Saved schedule'])
   if(value)facts.append(E('span','',value));
 panel.append(facts);
 panel.append(action('Export itinerary (.txt)',()=>exportTrip(plan)));
 const tabs=E('div','mob111-tabs');
 for(const [key,label]of [['stops','Stops & map'],['transport','Transport'],['organizer','Trip organizer']]){
   const b=action(label,()=>{if(tab!==key){clearMap();tab=key;draw()}},'mob111-tab');
   b.classList.toggle('active',tab===key);b.setAttribute('aria-pressed',String(tab===key));
   tabs.append(b);
 }
 panel.append(tabs);
 if(tab==='transport')transportPanel(plan,panel);
 else if(tab==='organizer')organizerPanel(plan,panel);
 else{
   const container=E('section','mob111-map-section');
   container.append(E('strong','','Itinerary map · saved coordinates'),
     E('p','mob111-muted','Dashed connections are straight-line stop order, NOT a routed road.'));
   const status=E('p','mob111-map-message','Loading map…');
   status.id='journeyMapMessageV111';status.setAttribute('role','status');container.append(status);
   const canvas=E('div','mob111-map');canvas.id='journeyMapV111';
   canvas.setAttribute('aria-label','Map of saved stops');container.append(canvas);panel.append(container);
   stopsPanel(plan,panel);
 }
 layout.append(chooser,panel);host.append(layout);
 host.append(E('p','mob111-footnote',
   'Read-only journey overview: no Android navigation, background location, route calculation or SAR changes. The Android app remains the editing and native alarms source.'));
 if(tab==='stops')loadMap(plan);
}
function sync(){
 if(!bridge()?.ready()||app.classList.contains('hidden')){
   if(account){account='';plans=[];selected='';tab='stops';clearMap()}
   return;
 }
 const next=String(bridge().identity()||'');
 if(next!==account){account=next;selected='';tab='stops';clearMap()}
 const data=bridge().snapshot();if(!data)return;
 plans=arr(data.journey_plans_beta);
 const host=$('#journeyManagerV111',content);
 if(!host){if(map||loadingKey)clearMap();return}
 if(!host.dataset.mob111Ready)draw();
}
new MutationObserver(sync).observe(content,{childList:true});
new MutationObserver(sync).observe(app,{attributes:true,attributeFilter:['class']});
sync();
})();
