/* LifeDashPro Web v1.19: Android dashboard visual parity.
 * Read-only from existing synced snapshot. No new data provider, no GPS on load,
 * no mutation of Finance/Notes/World/Explore/News or Android Navigator.
 */
(()=>{
'use strict';
const content=document.querySelector('#content'),app=document.querySelector('#appView');
if(!content||!app)return;
const B=()=>window.LifeDashDashboardBridge;
const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=String(txt);return n;};
const $=(q,r=document)=>r.querySelector(q);
const localDay=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const isoToday=()=>localDay(new Date());
function dateKey(value){
 if(value==null||value==='')return '';
 const s=String(value).trim();
 let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/);
 if(!m){m=s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);if(!m)return '';
   const day=Number(m[1]),month=Number(m[2]),year=Number(m[3]);
   const d=new Date(year,month-1,day,12);
   return d.getFullYear()===year&&d.getMonth()+1===month&&d.getDate()===day?localDay(d):'';
 }
 const year=Number(m[1]),month=Number(m[2]),day=Number(m[3]);
 const d=new Date(year,month-1,day,12);
 return d.getFullYear()===year&&d.getMonth()+1===month&&d.getDate()===day?localDay(d):'';
}
function validTime(value){
 const s=String(value||'');
 const m=s.match(/^(\d{1,2}):(\d{2})/);
 return m&&Number(m[1])<24&&Number(m[2])<60?String(m[1]).padStart(2,'0')+':'+m[2]:'';
}
function amount(value,currency){
 const num=Number(value);
 if(!Number.isFinite(num))return '';
 try{return new Intl.NumberFormat(undefined,{style:'currency',currency:currency||'EUR'}).format(num)}
 catch{return String(num.toFixed(2))+' '+(currency||'EUR')}
}
function isDone(x){
 return x.done===true||x.done==='true'||x.completed===true||String(x.status||'').toLowerCase()==='completed';
}
function futureDate(offset){
 const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+offset);return localDay(d);
}
function collect(snapshot){
 const out=[],seen=new Set();
 function push(kind,obj,rawDate,title,subtitle,time='',waiting=false,badge=''){
  const date=dateKey(rawDate);
  if(!date)return;
  const id=String(obj?.id||obj?.itemId||title);
  const key=kind+'|'+id+'|'+date;
  if(seen.has(key))return;seen.add(key);
  out.push({kind,id,date,title:String(title||kind).slice(0,130),
   subtitle:String(subtitle||'').slice(0,120),time:validTime(time),
   waiting:Boolean(waiting),badge:String(badge||'').slice(0,40)});
 }
 for(const n of snapshot.notes||[]){
  if(['archived','completed'].includes(String(n.status||'').toLowerCase()))continue;
  push('notes',n,n.dueDate,n.title||'Note','Note',n.dueTime||n.reminderTime);
 }
 for(const t of snapshot.family_tasks||[]){
  if(isDone(t))continue;
  push('tasks',t,t.dueDate||t.scheduledFor,t.title||'Task','Task',t.reminderTime||t.dueTime);
 }
 for(const r of snapshot.manual_reminders||[]){
  if(isDone(r))continue;
  push('reminders',r,r.dueDate||r.date||r.scheduledFor,r.title||r.text||'Reminder','Reminder',r.time||r.reminderTime);
 }
 for(const f of snapshot.finance_transactions||[]){
  const paid=f.isPaid===true||f.isPaid==='true'||f.paid===true;
  const title=f.description||f.title||f.merchant||f.category||'Transaction';
  const currency=f.currency||f.baseCurrencyAtEntry||'EUR';
  const positive=String(f.type||'').toLowerCase()==='income';
  const money=amount(f.amount,currency);
  const label=(paid?'Paid':'Unpaid')+(money?' · '+(positive?'+':'−')+money:'');
  // Paid activity is dated by transaction; unpaid is dated by due date when available.
  const when=paid?(f.date||f.paidAt||f.dueDate):(f.dueDate||f.date);
  push('finance',f,when,title,label,f.time||f.paymentTime,false,
    money?(positive?'+':'−')+money:'');
  const last=out[out.length-1];
  if(last&&last.kind==='finance'&&last.id===String(f.id||f.itemId||title)){
    last.paid=paid;
  }
 }
 for(const d of snapshot.documents||[]){
  push('documents',d,d.expiresAt||d.expiryDate||d.expirationDate,
    d.name||d.title||'Document','Document expiry');
 }
 out.sort((a,b)=>(a.date+' '+a.time+' '+a.kind).localeCompare(b.date+' '+b.time+' '+b.kind));
 return out;
}
function statusGroups(events){
 const now=isoToday(),end=futureDate(10);
 const today=events.filter(e=>e.date===now);
 const next=events.filter(e=>e.date>now&&e.date<=end);
 const waiting=events.filter(e=>(e.date<now||e.date===now) &&
   (e.kind==='finance'?e.paid===false:
    ['tasks','reminders','notes','documents'].includes(e.kind) && e.date<now));
 return {today,next,waiting};
}
function mk(){
 return /^mk(?:-|$)/i.test(B()?.profile()?.language||'');
}
function t(mac,eng){return mk()?mac:eng}
function nav(page){
 const button=$('#nav button[data-page="'+page+'"]')||$('.mobile-nav button[data-page="'+page+'"]');
 if(button){button.click();return true}return false;
}
function afterNavigate(page,fn){
 if(!nav(page))return;
 // Explore is mounted via synchronous DOM observer after the route changes.
 const apply=()=>{const host=$('#exploreAroundPage');if(!host?.dataset.ready)return false;fn(host);return true};
 if(apply())return;
 const mo=new MutationObserver(()=>{if(apply())mo.disconnect()});
 mo.observe(content,{childList:true});
 setTimeout(()=>mo.disconnect(),1800);
}
function explore(category='',city=''){
 afterNavigate('explore',host=>{
  if(category)host.querySelector('[data-explore-category="'+category+'"]')?.click();
  if(city){
   const query=host.querySelector('#exploreCityQuery');
   if(query){query.value=city;host.querySelector('#exploreFindCity')?.click()}
  }
 });
}
function world(kind){
 if(!nav('world'))return;
 if(!kind)return;
 const target={
  fires:'.world-live-card[data-type="fires"]',quakes:'.world-live-card[data-type="quakes"]',
  air:'#worldMobilitySection [data-mobility="air"]',road:'#worldMobilitySection [data-mobility="road"]'
 }[kind];
 if(!target)return;
 setTimeout(()=>$(target)?.scrollIntoView({block:'nearest',behavior:'smooth'}),120);
}
function button(text,cls,handler){
 const b=el('button',cls,text);b.type='button';b.addEventListener('click',handler);return b;
}
function icon(tone,glyph){
 const e=el('span','ldp119-icon ldp119-icon-'+tone,glyph);e.setAttribute('aria-hidden','true');return e;
}
const PAGE={finance:'finance',notes:'notes',tasks:'tasks',reminders:'today',documents:'documents'};
const SYMBOL={finance:'💳',notes:'📝',tasks:'✓',reminders:'◷',documents:'▣'};
function recordNode(record){
 const row=button('','ldp119-record',()=>nav(PAGE[record.kind]||'today'));
 const sym=icon(record.kind,SYMBOL[record.kind]||'◷');
 const main=el('span','ldp119-record-main');
 main.append(el('strong','',record.title));
 const line=[record.date,record.time,record.subtitle].filter(Boolean).join(' · ');
 main.append(el('small','',line));
 row.append(sym,main);
 if(record.badge)row.append(el('b','ldp119-record-money',record.badge));
 row.setAttribute('aria-label',record.title+' · '+line+(record.badge?' · '+record.badge:''));
 return row;
}
function todayCard(host,snapshot){
 const events=collect(snapshot),groups=statusGroups(events);
 const section=el('section','ldp119-panel ldp119-today');
 const h=el('header','ldp119-head');
 const heading=el('div','ldp119-heading');heading.append(icon('today','◷'),el('h2','',t('Денес · Следни · Чекаат','Today · Next · Waiting')));
 h.append(heading,button(t('Сите →','All →'),'ldp119-more',()=>nav('today')));section.append(h);
 const tabs=el('div','ldp119-tabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Choose timeline period');
 const rows=el('div','ldp119-rows');
 const menu=[
  ['today',t('Денес','Today'),groups.today.length],
  ['next',t('Следни 10 дена','Next 10 days'),groups.next.length],
  ['waiting',t('Чекаат','Waiting'),groups.waiting.length]
 ];
 let selected='today',expanded=false;
 const refresh=()=>{
  tabs.querySelectorAll('button').forEach(b=>{
    const active=b.dataset.group===selected;
    b.classList.toggle('is-selected',active);b.setAttribute('aria-pressed',String(active));
  });
  rows.replaceChildren();
  const items=groups[selected]||[];
  const visible=expanded?items:items.slice(0,3);
  if(!visible.length)rows.append(el('p','ldp119-empty',t('Нема записи во избраниот период.','No records in this period.')));
  visible.forEach(x=>rows.append(recordNode(x)));
  more.textContent=expanded?t('Помалку ↑','Show less ↑'):t('Прикажи повеќе','Show more');
  more.hidden=items.length<=3;
 };
 for(const [key,label,count] of menu){
  const tab=button(label+' '+count,'ldp119-chip ldp119-chip-'+key,()=>{
   selected=key;expanded=false;refresh()
  });
  tab.dataset.group=key;tabs.append(tab);
 }
 const more=button('','ldp119-expand',()=>{expanded=!expanded;refresh()});
 section.append(tabs,rows,more);
 const disclaimer=el('p','ldp119-disclaimer',
  t('Прикажани се само записи со валиден датум од синхронизираните податоци. Податоците може да се разликуваат од Android додека не се синхронизираат.',
    'Shows dated records from synced cloud data; Android may differ until its local changes are synced.'));
 section.append(disclaimer);host.append(section);refresh();
}
function aroundCard(host,profile){
 const section=el('section','ldp119-panel ldp119-around');
 const h=el('header','ldp119-head'),left=el('div','ldp119-heading');
 left.append(icon('around','📍'),el('h2','',t('Истражи и во живо','Explore & Around Me')));
 h.append(left,button('→','ldp119-chevron',()=>nav('explore')));section.append(h);
 section.append(el('p','ldp119-subtitle',(profile.city||t('Избрана локација','Selected location'))+' · '+t('без автоматско GPS следење','GPS is only requested on click')));
 const tiles=el('div','ldp119-shortcuts');
 for(const [key,symbol,label] of [
  ['fuel','⛽',t('Гориво','Fuel')],['parking','🅿',t('Паркинг','Parking')],
  ['restaurant','☕',t('Храна','Food & Coffee')],['hotel','🛏',t('Хотели','Hotels')],
  ['charging','⚡',t('EV полначи','EV charging')],['pharmacy','✚',t('Аптеки','Pharmacies')]
 ]){
  const item=button('','ldp119-shortcut',()=>explore(key));
  item.append(el('span','ldp119-shortcut-icon',symbol),el('span','',label));tiles.append(item);
 }
 section.append(tiles);
 const find=el('form','ldp119-find');const input=el('input','ldp119-search');
 input.type='search';input.placeholder=t('Пребарај град или место…','Search for a city…');
 input.maxLength=100;input.setAttribute('aria-label',t('Пребарај град','Search city'));
 const submit=button(t('Пребарај','Search'),'ldp119-search-button',()=>{});
 submit.type='submit';
 find.append(input,submit);
 find.addEventListener('submit',e=>{e.preventDefault();const term=input.value.trim();if(term)explore('',term);else nav('explore')});
 section.append(find);
 section.append(el('small','ldp119-footnote',t('Отвора постојно пребарување и мапа во Explore; не врши пребарување во позадина.','Opens existing Explore search and map; no background place lookup.')));
 host.append(section);
}
function worldCard(host){
 const section=el('section','ldp119-panel ldp119-world');
 const h=el('header','ldp119-head'),left=el('div','ldp119-heading');
 left.append(icon('world','🌐'),el('h2','',t('Светски информации','World Intelligence')));
 h.append(left,button('→','ldp119-chevron',()=>nav('world')));section.append(h);
 section.append(el('p','ldp119-subtitle',t('Настани во живо · Животна средина · Воздушен и патен сообраќај','Live events · Environment · Air and road traffic')));
 const list=el('div','ldp119-shortcuts');
 for(const [kind,symbol,label] of [
  ['fires','🔥',t('Пожари','Fires')],['quakes','🌍','Earthquakes'],
  ['air','✈️',t('Авионски сообраќај','Air Traffic')],
  ['road','🛣',t('Патишта','Road Live')]
 ]){
  const item=button('','ldp119-shortcut',()=>world(kind));
  item.append(el('span','ldp119-shortcut-icon',symbol),el('span','',label));
  list.append(item);
 }
 section.append(list);
 section.append(el('small','ldp119-footnote',t('Сите извори се вчитуваат кога ќе ја отвориш соодветната секција. Граници и море засега остануваат само во Android.','Sources load when you open the section. Borders and maritime views remain Android-only for now.')));
 host.append(section);
}
function routeCard(host){
 const section=el('section','ldp119-panel ldp119-route');
 const h=el('div','ldp119-route-main');
 h.append(icon('route','🗺️'));
 const box=el('div');
 box.append(el('h2','',t('Отвори рута','Open route')));
 box.append(el('p','',t('Прегледај ги зачуваните патувања и станици','View saved trips and itinerary stops')));
 h.append(box,button('→','ldp119-chevron',()=>nav('journey')));
 section.append(h);
 const actions=el('div','ldp119-route-links');
 actions.append(
  button('⛽ '+t('Гориво','Fuel'),'ldp119-textbtn',()=>explore('fuel')),
  button('🛏 '+t('Хотели','Hotels'),'ldp119-textbtn',()=>explore('hotel')),
  button('🅿 '+t('Паркинг','Parking'),'ldp119-textbtn',()=>explore('parking')),
  button('↗ '+t('Патувања','Saved trips'),'ldp119-textbtn',()=>nav('journey'))
 );
 section.append(actions);
 section.append(el('small','ldp119-footnote',t('Веб-верзијата засега прикажува зачувани патувања; активната навигација и Search Along Route остануваат во Android.','Web currently shows saved itineraries; active navigation and Search Along Route remain Android-only.')));
 host.append(section);
}
function draw(host){
 const bridge=B();if(!bridge?.ready())return;
 const snapshot=bridge.snapshot();if(!snapshot)return;
 const user=bridge.identity();if(!user)return;
 host.dataset.readyFor=user;host.replaceChildren();
 const profile=bridge.profile();
 todayCard(host,snapshot);aroundCard(host,profile);worldCard(host);routeCard(host);
}
function sync(){
 if(app.classList.contains('hidden')||!B()?.ready())return;
 const host=content.querySelector('#androidDashboardParityV119');
 if(!host)return;
 const id=B().identity();
 if(host.dataset.readyFor===id)return;
 draw(host);
}
new MutationObserver(sync).observe(content,{childList:true});
new MutationObserver(sync).observe(app,{attributes:true,attributeFilter:['class']});
sync();
})();