/* LifeDashPro Web v1.11 — Vehicle Manager (read-only Android sync).
   No DB writes, mileage updates, file access or Android alarm changes. */
(()=>{
'use strict';
const $=(q,r=document)=>r.querySelector(q);
const E=(tag,cls,t)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(t!==undefined)n.textContent=String(t);return n;};
const content=$('#content'),app=$('#appView');if(!content||!app)return;
const bridge=()=>window.LifeDashMobilityBridge;
let uid='',vehicles=[],documents=[],selected='',section='overview';
const txt=(v,max=150)=>String(v??'').trim().slice(0,max);
const num=v=>(v!==null&&v!==''&&v!==undefined&&Number.isFinite(Number(v)))?Number(v):null;
function datestr(v){
 const m=txt(v,45).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
 if(!m)return '';
 const dt=new Date(+m[1],+m[2]-1,+m[3],12);
 if(dt.getFullYear()!==+m[1]||dt.getMonth()+1!==+m[2]||dt.getDate()!==+m[3])return '';
 return [m[1],String(+m[2]).padStart(2,'0'),String(+m[3]).padStart(2,'0')].join('-');
}
function formatDate(v){
 const d=datestr(v);if(!d)return 'Not recorded';
 const [y,m,day]=d.split('-').map(Number);
 return new Intl.DateTimeFormat(undefined,{day:'numeric',month:'short',year:'numeric'}).format(new Date(y,m-1,day,12));
}
function daysTill(v){
 const d=datestr(v);if(!d)return null;
 const [y,m,day]=d.split('-').map(Number);
 const now=new Date();
 return Math.round((Date.UTC(y,m-1,day)-Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()))/86400000);
}
function deadline(v){
 const days=daysTill(v);
 return days===null?{kind:'none',text:'Not set',days:null}:
 days<0?{kind:'expired',text:'Expired '+Math.abs(days)+' days ago',days}:
 days===0?{kind:'soon',text:'Expires today',days}:
 days<=30?{kind:'soon',text:'Due in '+days+' days',days}:
 {kind:'valid',text:formatDate(v),days};
}
function money(amount,currency){
 const n=num(amount),unit=/^[A-Z]{3}$/.test(String(currency||'EUR').toUpperCase())?String(currency||'EUR').toUpperCase():'EUR';
 if(n===null)return '—';
 try{return new Intl.NumberFormat(undefined,{style:'currency',currency:unit,maximumFractionDigits:2}).format(n)}
 catch(_){return n.toFixed(2)+' '+unit}
}
function km(n){const v=num(n);return v===null?'—':new Intl.NumberFormat(undefined,{maximumFractionDigits:0}).format(v)+' km'}
const display=v=>[txt(v.name),txt(v.brand),txt(v.model)].filter(Boolean).join(' ')||'Vehicle';
function detailsPair(parent,key,value){
 const n=E('div','mob111-pair');
 n.append(E('span','',key),E('strong','',value||'—'));parent.append(n);
}
function sectionHeading(title,note){
 const h=E('div','mob111-section-head');
 h.append(E('h3','',title),E('p','mob111-muted',note));return h;
}
function action(label,callback,cls='secondary'){
 const btn=E('button',cls,label);btn.type='button';btn.addEventListener('click',callback);return btn;
}
function statusBadge(value){
 const st=deadline(value);
 return E('span','mob111-pill mob111-pill-'+st.kind,st.text);
}
function docMatches(vehicle,doc){
 if(String(doc.linkedType||'').trim().toLowerCase()!=='vehicle')return false;
 const linked=txt(doc.linkedLabel||'',170).toLocaleLowerCase();
 const ids=[vehicle.id,vehicle.licensePlate,vehicle.name,[vehicle.brand,vehicle.model].filter(Boolean).join(' ')]
   .map(v=>txt(v,170).toLocaleLowerCase()).filter(Boolean);
 return linked!==''&&ids.includes(linked);
}
function renderDeadlines(vehicle,parent){
 const data=[
 ['Insurance',vehicle.insuranceExpires],
 ['Registration',vehicle.registrationExpires],
 ['Technical inspection',vehicle.technicalExpires]
 ];
 const grid=E('div','mob111-expiry-grid');
 for(const [name,raw] of data){
   const card=E('article','mob111-expiry-card');
   card.append(E('small','',name),E('strong','',formatDate(raw)),statusBadge(raw));grid.append(card);
 }
 parent.append(grid);
 const serviceKm=num(vehicle.nextServiceKm),odo=num(vehicle.currentKm);
 if(serviceKm!==null){
   const box=E('div','mob111-service-due');
   box.append(E('strong','','Next service · '+km(serviceKm)));
   if(odo!==null){
     const remain=serviceKm-odo;
     box.append(E('span','',remain<=0?'Service mileage reached / exceeded by '+km(Math.abs(remain)):
       km(remain)+' remaining based on recorded odometer'));
   }else box.append(E('span','','Current mileage not recorded'));
   parent.append(box);
 }
 const reminders=vehicle.reminders;
 if(reminders&&typeof reminders==='object'&&!Array.isArray(reminders)){
   const notes=E('div','mob111-reminder-states');
   for(const [key,label]of [['insurance','Insurance'],['registration','Registration'],['technical','Technical']]){
     const r=reminders[key];
     if(!r||typeof r!=='object')continue;
     const state=r.enabled===true?'Enabled on Android':r.enabled===false?'Disabled on Android':'Configured on Android';
     const terms=[label,state,r.daysBefore!=null?String(r.daysBefore)+' days before':'',txt(r.time||'',20)].filter(Boolean);
     notes.append(E('span','mob111-reminder-label',terms.join(' · ')));
   }
   if(notes.childElementCount)parent.append(notes);
 }
}
function renderServices(vehicle,parent){
 const list=Array.isArray(vehicle.services)?vehicle.services.slice(0,100):[];
 parent.append(sectionHeading('Service history','Historical records synchronized from Android; editing remains Android-first.'));
 if(!list.length){parent.append(E('p','mob111-empty','No service entries saved for this vehicle.'));return}
 list.sort((a,b)=>datestr(b.date).localeCompare(datestr(a.date)));
 const grid=E('div','mob111-history');
 for(const row of list){
   const item=E('article','mob111-history-row');
   const head=E('div','mob111-history-top');
   head.append(E('strong','',txt(row.type||'Service')),E('span','',formatDate(row.date)));
   item.append(head);
   const parts=[row.km!=null?km(row.km):'',row.cost!=null?money(row.cost,row.currency||'EUR'):''].filter(Boolean);
   if(parts.length)item.append(E('small','mob111-muted',parts.join(' · ')));
   if(txt(row.notes))item.append(E('p','',txt(row.notes,900)));
   grid.append(item);
 }
 parent.append(grid);
}
function renderFuel(vehicle,parent){
 const list=Array.isArray(vehicle.fuelHistory)?vehicle.fuelHistory.slice(0,100):[];
 parent.append(sectionHeading('Fuel history','Recorded fills, fuel volume, price and odometer. No guessed consumption.'));
 if(!list.length){parent.append(E('p','mob111-empty','No fuel entries recorded.'));return}
 const totals=new Map();let liters=0;
 for(const item of list){
   const l=num(item.liters);if(l!==null&&l>=0)liters+=l;
   const v=num(item.total),currency=txt(item.currency||'EUR').toUpperCase();
   if(v!==null)totals.set(currency,(totals.get(currency)||0)+v);
 }
 const summary=E('div','mob111-fuel-summary');
 summary.append(E('span','',new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(liters)+' L recorded'));
 for(const [currency,amount]of totals)summary.append(E('span','',money(amount,currency)+' recorded'));
 parent.append(summary);
 list.sort((a,b)=>datestr(b.date).localeCompare(datestr(a.date)));
 const grid=E('div','mob111-history');
 for(const f of list){
   const item=E('article','mob111-history-row');
   const head=E('div','mob111-history-top');
   head.append(E('strong','',txt(f.station||f.fuelType||'Fuel fill')),E('span','',formatDate(f.date)));
   item.append(head);
   const fields=[num(f.liters)!==null?f.liters+' L':'',
     num(f.total)!==null?money(f.total,f.currency||'EUR'):'',
     num(f.km)!==null?km(f.km):'',
     f.fullTank===true?'Full tank':''].filter(Boolean);
   item.append(E('small','mob111-muted',fields.join(' · ')));
   grid.append(item);
 }
 parent.append(grid);
}
function renderDocs(vehicle,parent){
 const docs=documents.filter(doc=>docMatches(vehicle,doc));
 parent.append(sectionHeading('Linked documents','Only documents explicitly linked to this vehicle by Android label.'));
 if(!docs.length)parent.append(E('p','mob111-empty','No documents explicitly linked to this vehicle.'));
 else for(const doc of docs){
   const item=E('div','mob111-history-row');
   item.append(E('strong','',txt(doc.name||'Document')),E('small','mob111-muted',
     txt(doc.category||'Document')+' · expiry '+formatDate(doc.expiresAt)));
   parent.append(item);
 }
 parent.append(action('Open Documents Pro →',()=>$('#nav [data-page="documents"]')?.click()));
}
function renderOverview(vehicle,parent){
 parent.append(sectionHeading('Vehicle details','Your saved Android record, with no automatic changes.'));
 const grid=E('div','mob111-details-grid');
 for(const [k,v]of [
  ['Brand',txt(vehicle.brand)],['Model',txt(vehicle.model)],['Year',txt(vehicle.year)],
  ['License plate',txt(vehicle.licensePlate)],['Color',txt(vehicle.color)],
  ['Fuel type',txt(vehicle.fuelType)],['Odometer',km(vehicle.currentKm)],
  ['Last service',formatDate(vehicle.lastService)]
 ])detailsPair(grid,k,v);
 parent.append(grid);
 if(txt(vehicle.notes))parent.append(E('p','mob111-note',txt(vehicle.notes,1500)));
 parent.append(sectionHeading('Deadlines & service','Dates and reminders are shown as stored in Android.'));
 renderDeadlines(vehicle,parent);
}
function draw(){
 const host=$('#vehicleManagerV111',content);
 if(!host)return;
 host.dataset.mob111Ready='1';host.replaceChildren();
 const top=E('div','mob111-intro');
 const title=E('div');title.append(E('p','eyebrow','VEHICLE MANAGER'),E('h2','','My garage'),
   E('p','mob111-muted','Vehicles, maintenance, refueling and expiry dates from your Android account.'));
 top.append(title,action('View journeys →',()=>$('#nav [data-page="journey"]')?.click()));
 host.append(top);
 const counters=E('div','mob111-kpis');
 const alerts=vehicles.flatMap(v=>[v.insuranceExpires,v.registrationExpires,v.technicalExpires]
   .map(deadline).filter(x=>x.kind==='expired'||x.kind==='soon'));
 for(const [label,value] of [['Saved vehicles',vehicles.length],
   ['Urgent / expired dates',alerts.length],
   ['Service records',vehicles.reduce((a,v)=>a+(Array.isArray(v.services)?v.services.length:0),0)],
   ['Fuel entries',vehicles.reduce((a,v)=>a+(Array.isArray(v.fuelHistory)?v.fuelHistory.length:0),0)]]){
   const k=E('div','mob111-kpi');k.append(E('strong','',value),E('span','',label));counters.append(k);
 }
 host.append(counters);
 if(!vehicles.length){host.append(E('p','mob111-empty','No synced vehicles on this account. Add a vehicle in Android to see it here.'));return}
 if(!vehicles.some(x=>String(x.id)===selected))selected=String(vehicles[0].id);
 const layout=E('div','mob111-layout');
 const side=E('aside','mob111-chooser');
 side.append(E('strong','','Saved vehicles'));
 for(const v of vehicles){
   const item=action(display(v),()=>{selected=String(v.id);section='overview';draw()},'mob111-choice');
   item.classList.toggle('active',String(v.id)===selected);
   item.setAttribute('aria-pressed',String(v.id)===selected);
   const second=E('small','',txt(v.licensePlate)||txt(v.fuelType)||'Vehicle');
   item.append(second);side.append(item);
 }
 const vehicle=vehicles.find(v=>String(v.id)===selected)||vehicles[0];
 const panel=E('section','mob111-panel');
 const info=E('div','mob111-panel-title');
 info.append(E('h3','',display(vehicle)),E('span','mob111-plate',txt(vehicle.licensePlate)||'No plate'));
 panel.append(info);
 const tabs=E('div','mob111-tabs');
 for(const [key,label]of [['overview','Overview'],['services','Services'],['fuel','Fuel'],['documents','Documents']]){
   const tab=action(label,()=>{section=key;draw()},'mob111-tab');
   tab.classList.toggle('active',section===key);tab.setAttribute('aria-pressed',String(section===key));tabs.append(tab);
 }
 panel.append(tabs);
 if(section==='services')renderServices(vehicle,panel);
 else if(section==='fuel')renderFuel(vehicle,panel);
 else if(section==='documents')renderDocs(vehicle,panel);
 else renderOverview(vehicle,panel);
 layout.append(side,panel);host.append(layout);
 host.append(E('p','mob111-footnote',
   'Read-only view of Android vehicle records. Expiry dates are reminders for planning, not authoritative coverage or legal validity checks. Android maintains service entries and native alarms.'));
}
function sync(){
 if(!bridge()?.ready()||app.classList.contains('hidden')){
   if(uid){uid='';vehicles=[];documents=[];selected='';section='overview'}
   return;
 }
 const id=bridge().identity();
 if(id!==uid){uid=id;selected='';section='overview'}
 const data=bridge().snapshot();if(!data)return;
 vehicles=Array.isArray(data.vehicles)?data.vehicles:[];
 documents=Array.isArray(data.documents)?data.documents:[];
 const host=$('#vehicleManagerV111',content);
 if(host&&!host.dataset.mob111Ready)draw();
}
new MutationObserver(sync).observe(content,{childList:true});
new MutationObserver(sync).observe(app,{attributes:true,attributeFilter:['class']});
sync();
})();
