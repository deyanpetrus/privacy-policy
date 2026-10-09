/* LifeDashPro Web v1.9 · Personal Organizer & Calendar (staging).
   Read-only views of canonical Android-backed notes, family_tasks, manual_reminders,
   documents and family_members. No new records, alarm scheduling or database writes. */
(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n};
const DATA_TYPES={
 tasks:{label:'Tasks',symbol:'✓',page:'tasks'},
 notes:{label:'Notes',symbol:'✎',page:'notes'},
 reminders:{label:'Reminders',symbol:'◷',page:'today'},
 documents:{label:'Documents',symbol:'▣',page:'documents'},
 birthdays:{label:'Birthdays',symbol:'♢',page:'today'}
};
const KEYS=Object.keys(DATA_TYPES);
const page=$('#content'),app=$('#appView');
if(!page||!app)return;
let cursor=new Date(),selected='',mode='month',events=[],userId='';
let include=new Set(KEYS);
const today=()=>new Date();
const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const dateAt=(y,m,d)=>new Date(y,m,d,12,0,0,0);
function parseDate(raw){
 if(raw===undefined||raw===null||raw==='')return null;
 if(raw instanceof Date)return Number.isFinite(raw.getTime())?raw:null;
 const s=String(raw).trim();
 const isoPattern=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
 let date;
 if(isoPattern)date=dateAt(+isoPattern[1],+isoPattern[2]-1,+isoPattern[3]);
 else {
   const other=s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
   if(other)date=dateAt(+other[3],+other[2]-1,+other[1]);
   else return null;
 }
 if(date.getFullYear()!==+(isoPattern?isoPattern[1]:s.match(/\d{4}$/)?.[0])||
    (isoPattern&&(date.getMonth()+1!==+isoPattern[2]||date.getDate()!==+isoPattern[3])))
    return null;
 return date;
}
const validTime=s=>/^\d{1,2}:\d{2}/.test(String(s||''))?String(s).slice(0,5):'';
function eventDate(raw){const date=parseDate(raw);return date?iso(date):''}
function startWeek(d){const a=dateAt(d.getFullYear(),d.getMonth(),d.getDate());a.setDate(a.getDate()-(a.getDay()+6)%7);return a}
function dateLabel(d,options={weekday:'short',month:'short',day:'numeric'}){return new Intl.DateTimeFormat(undefined,options).format(d)}
const bridge=()=>window.LifeDashCalendarBridge;
function snapshotEvents(){
 const data=bridge()?.snapshot();
 if(!data)return [];
 const result=[],used=new Set();
 function add(kind,record,date,title,time='',desc='',state='',id=''){
   if(!date||!DATA_TYPES[kind])return;
   const key=kind+'|'+(id||record?.id||title)+'|'+date;
   if(used.has(key))return;
   used.add(key);
   result.push({kind,id:String(id||record?.id||''),date,
     time:validTime(time),title:String(title||DATA_TYPES[kind].label).slice(0,160),
     description:String(desc||'').slice(0,330),status:state||''});
 }
 for(const n of data.notes||[]){
   if(n.status==='archived')continue;
   add('notes',n,eventDate(n.dueDate),n.title||'Note',n.dueTime,n.description,n.status,n.id);
 }
 for(const t of data.family_tasks||[]){
   add('tasks',t,eventDate(t.dueDate||t.scheduledFor),t.title||'Task',
     t.reminderTime||'',[t.assignedTo,t.priority].filter(Boolean).join(' · '),
     t.done?'completed':'',t.id);
 }
 for(const r of data.manual_reminders||[]){
   add('reminders',r,eventDate(r.dueDate||r.date||r.scheduledFor),
     r.title||r.text||'Reminder',r.time||r.reminderTime,
     r.type||'',r.done?'completed':'',r.id);
 }
 for(const d of data.documents||[]){
   add('documents',d,eventDate(d.expiresAt),d.name||d.title||'Document',
     '',d.category||d.type||'',
     eventDate(d.expiresAt)<iso(today())?'expired':'expires',d.id);
 }
 // Birthdays recur on the same calendar day; do not mutate or duplicate originals.
 const year=today().getFullYear();
 for(const member of data.family_members||[]){
   const dob=parseDate(member.birthday);
   if(!dob)continue;
   for(let y=year-1;y<=year+3;y++){
     const b=dateAt(y,dob.getMonth(),dob.getDate());
     if(b.getMonth()!==dob.getMonth())continue; // Feb 29: no guessed substitute.
     add('birthdays',member,iso(b),member.name||'Birthday','',
       member.relation||'Family member','birthday',member.id);
   }
 }
 return result.sort((a,b)=>(a.date+' '+a.time).localeCompare(b.date+' '+b.time));
}
function filtered(){return events.filter(e=>include.has(e.kind))}
function forDate(day){return filtered().filter(e=>e.date===day)}
function openSource(e){
 const link=$('#nav [data-page="'+DATA_TYPES[e.kind].page+'"]');
 if(link)link.click();
}
function toolbarButton(text,action,cls='secondary'){
 const b=node('button',cls,text);b.type='button';b.addEventListener('click',action);return b;
}
function chip(kind){
 const d=DATA_TYPES[kind];
 const label=node('label','calendar-chip calendar-chip-'+kind);
 const cb=node('input');cb.type='checkbox';cb.checked=include.has(kind);
 cb.setAttribute('aria-label','Show '+d.label);
 cb.addEventListener('change',()=>{
   if(cb.checked)include.add(kind);else include.delete(kind);
   draw();});
 label.append(cb,node('span','',d.symbol+' '+d.label));
 return label;
}
function drawRow(e,compact=false){
 const btn=node('button','calendar-event calendar-event-'+e.kind);
 btn.type='button';
 const mark=node('span','calendar-event-mark',DATA_TYPES[e.kind].symbol);
 const body=node('span','calendar-event-body');
 body.append(node('strong','',e.title));
 if(!compact){
   body.append(node('small','',[DATA_TYPES[e.kind].label,e.time,e.description].filter(Boolean).join(' · ')));
 }else if(e.time)body.append(node('small','',e.time));
 const pill=node('span','calendar-event-state',e.status==='completed'?'Done':e.status==='expired'?'Expired':'›');
 btn.append(mark,body,pill);
 btn.setAttribute('aria-label',DATA_TYPES[e.kind].label+' '+e.title+' · '+e.date+' · open source');
 btn.addEventListener('click',()=>openSource(e));
 return btn;
}
function dayCell(d,displayMonth=true){
 const key=iso(d),current=iso(today());
 const day=node('button','calendar-day'+(key===current?' is-today':'')+
    (key===selected?' is-selected':'')+
    (displayMonth&&d.getMonth()!==cursor.getMonth()?' is-outside':''));day.type='button';
 day.append(node('span','calendar-day-num',String(d.getDate())));
 const entries=forDate(key);
 if(entries.length){
   const badges=node('span','calendar-day-badges');
   const types=[...new Set(entries.map(e=>e.kind))];
   for(const kind of types.slice(0,4)){const dot=node('i','calendar-dot calendar-dot-'+kind);dot.title=DATA_TYPES[kind].label;badges.append(dot)}
   day.append(badges,node('span','calendar-day-count',entries.length+' events'));
 }
 day.setAttribute('aria-label',dateLabel(d,{weekday:'long',month:'long',day:'numeric',year:'numeric'})+' · '+entries.length+' events');
 day.addEventListener('click',()=>{selected=key;draw()});
 return day;
}
function dateTitle(){
 if(mode==='month')return dateLabel(cursor,{month:'long',year:'numeric'});
 if(mode==='week'){
   const start=startWeek(cursor),end=dateAt(start.getFullYear(),start.getMonth(),start.getDate()+6);
   return dateLabel(start,{month:'short',day:'numeric'})+' – '+dateLabel(end,{month:'short',day:'numeric',year:'numeric'});
 }
 return dateLabel(cursor,{month:'long',year:'numeric'})+' · Upcoming';
}
function calendarBody(root){
 const surface=node('div','calendar-grid-panel');
 if(mode==='agenda'){
   const start=iso(today()),end=iso(dateAt(today().getFullYear(),today().getMonth(),today().getDate()+45));
   const selection=filtered().filter(e=>e.date>=start&&e.date<=end);
   const groups=[...new Set(selection.map(e=>e.date))];
   if(!groups.length)surface.append(node('div','calendar-empty','No upcoming events in the next 45 days with the selected filters.'));
   for(const day of groups){
     const grp=node('section','calendar-agenda-group');
     grp.append(node('h4','',dateLabel(parseDate(day),{weekday:'long',month:'long',day:'numeric'})));
     for(const e of selection.filter(v=>v.date===day))grp.append(drawRow(e));
     surface.append(grp);
   }
   return surface;
 }
 const headers=node('div','calendar-weekday-head');
 for(const label of ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])headers.append(node('span','',label));
 surface.append(headers);
 const grid=node('div','calendar-days');
 const first=mode==='week'?startWeek(cursor):startWeek(dateAt(cursor.getFullYear(),cursor.getMonth(),1));
 const length=mode==='week'?7:42;
 for(let i=0;i<length;i++)grid.append(dayCell(dateAt(first.getFullYear(),first.getMonth(),first.getDate()+i),mode==='month'));
 surface.append(grid);
 return surface;
}
function details(){
 const side=node('aside','calendar-details');
 const date=parseDate(selected)||today();
 side.append(node('h3','',dateLabel(date,{weekday:'long',month:'long',day:'numeric'})));
 const entries=forDate(iso(date));
 side.append(node('p','calendar-muted',entries.length+' scheduled item'+(entries.length===1?'':'s')));
 if(!entries.length)side.append(node('div','calendar-empty','No events for this day. Select another date or enable more filters.'));
 for(const e of entries)side.append(drawRow(e));
 side.append(node('p','calendar-readonly','Events come from your synced Android records. Editing and native reminder alarms remain in their existing modules.'));
 return side;
}
function shift(n){
 if(mode==='week')cursor=dateAt(cursor.getFullYear(),cursor.getMonth(),cursor.getDate()+7*n);
 else cursor=dateAt(cursor.getFullYear(),cursor.getMonth()+n,1);
 selected=iso(cursor);draw();
}
function draw(){
 const host=$('#personalCalendar');
 if(!host)return;
 host.replaceChildren();
 const head=node('div','calendar-head');
 const intro=node('div');
 intro.append(node('span','eyebrow','PERSONAL ORGANIZER'),node('h2','','Your calendar'),
   node('p','calendar-muted','Tasks, Notes, Reminders, document expiry and family birthdays · synced with Android'));
 const controls=node('div','calendar-top-controls');
 controls.append(toolbarButton('Today',()=>{cursor=today();selected=iso(cursor);draw()}));
 controls.append(toolbarButton('‹',()=>shift(-1),'secondary calendar-arrow'));
 controls.append(node('strong','calendar-date-title',dateTitle()));
 controls.append(toolbarButton('›',()=>shift(1),'secondary calendar-arrow'));
 head.append(intro,controls);host.append(head);
 const bar=node('div','calendar-filter-bar');
 const tabs=node('div','calendar-view-tabs');
 for(const [name,title] of [['month','Month'],['week','Week'],['agenda','Agenda']]){
   const btn=toolbarButton(title,()=>{mode=name;draw()},'calendar-tab'+(mode===name?' active':''));
   btn.setAttribute('aria-pressed',String(mode===name));tabs.append(btn);
 }
 const filters=node('div','calendar-filters');
 KEYS.forEach(k=>filters.append(chip(k)));
 bar.append(tabs,filters);host.append(bar);
 const layout=node('div','calendar-layout');
 layout.append(calendarBody(host),details());
 host.append(layout);
 const footer=node('p','calendar-data-note',
   'Read-only calendar: no duplicate records, no database changes, no browser notification promises. Expired documents are labeled; missing dates are not invented.');
 host.append(footer);
}
function dashboardWidget(){
 const dashboard=page.classList.contains('dashboard-view')?$('.dash-grid',page):null;
 if(!dashboard||$('#calendarDashboard',dashboard))return;
 const widget=node('section','card calendar-widget span-12');
 widget.id='calendarDashboard';widget.setAttribute('aria-label','Personal calendar upcoming events');
 const title=node('div','card-head');
 const wrap=node('div');wrap.append(node('p','eyebrow','PERSONAL ORGANIZER'),node('h3','','Coming up'));
 title.append(wrap,toolbarButton('Open calendar →',()=>$('#nav [data-page="calendar"]')?.click(),'text-btn'));
 widget.append(title);
 const upcoming=events.filter(e=>e.date>=iso(today())&&e.date<=iso(dateAt(today().getFullYear(),today().getMonth(),today().getDate()+14))).slice(0,4);
 if(!upcoming.length)widget.append(node('div','calendar-empty','No dated events in the next 14 days.'));
 for(const e of upcoming){
   const row=drawRow(e,true);
   const d=node('span','calendar-upcoming-date',dateLabel(parseDate(e.date),{month:'short',day:'numeric'}));
   row.insertBefore(d,row.firstChild);widget.append(row);
 }
 dashboard.append(widget);
}
function sync(){
 if(!bridge()?.ready()||app.classList.contains('hidden')){
   if(userId){userId='';events=[]}
   return;
 }
 const id=bridge().identity();
 if(id!==userId){userId=id;cursor=today();selected=iso(cursor)}
 events=snapshotEvents();
 const host=$('#personalCalendar',page);
 if(host){
   if(!selected)selected=iso(today());
   // Only redraw on content mount/sync; avoid an observer loop.
   if(host.dataset.ready!=='1'){host.dataset.ready='1';draw()}
 }
 dashboardWidget();
}
new MutationObserver(sync).observe(page,{childList:true});
new MutationObserver(sync).observe(app,{attributes:true,attributeFilter:['class']});
window.addEventListener('focus',sync);
sync();
})();
