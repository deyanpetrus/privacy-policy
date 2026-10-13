/* LifeDashPro Web v1.21 - Dashboard Notes + movable new cards.
 * Read-only; browser-local per-account UI preferences; no backend changes.
 */
(()=>{
'use strict';
const root=document.querySelector('#content'),app=document.querySelector('#appView');
if(!root||!app)return;
const bridge=()=>window.LifeDashDashboardBridge;
const i18n=()=>window.LifeDashWebI18n;
const tr=(key,fallback)=>i18n()?.tr?.(key)||fallback;
const E=(tag,cls,value)=>{
 const e=document.createElement(tag);if(cls)e.className=cls;
 if(value!==undefined)e.textContent=String(value);return e;
};
const $=(q,r=document)=>r.querySelector(q);
const KEYS=['today','notes','around','world','route','news','budget'];
const CLS={
 today:'.ldp119-today',notes:'.ldp121-notes',
 around:'.ldp119-around',world:'.ldp119-world',
 route:'.ldp119-route',news:'.ldp119-news',budget:'.ldp120-dashboard-budget'
};
let owner='', editing=false, current=null;
const storagePrefix='lifedash_web_card_layout_v121_';
const prefPrefix='lifedash_web_note_filter_v121_';
const read=(key,fallback)=>{
 try{const x=localStorage.getItem(key);return x==null?fallback:JSON.parse(x)}
 catch{return fallback}
};
const put=(key,obj)=>{try{localStorage.setItem(key,JSON.stringify(obj))}catch(_){}};
function orderFor(id){
 const x=read(storagePrefix+id,[]);
 if(!Array.isArray(x)||!x.every(k=>KEYS.includes(k))||new Set(x).size!==x.length)return KEYS.slice();
 return [...x,...KEYS.filter(k=>!x.includes(k))];
}
function domCards(host){return Object.fromEntries(KEYS.map(k=>[k,$(CLS[k],host)]))}
function reorder(host,order){
 const cards=domCards(host);let anchor=$('#ldp121LayoutControls',host);
 const existing=order.filter(k=>Boolean(cards[k]));
 if(!existing.length)return;
 // The finance budget may be injected later by v1.20; never clone/reconstruct cards.
 for(const key of existing){
  const card=cards[key];
  if(card?.previousElementSibling!==anchor)anchor.after(card);
  anchor=card;
 }
}
function updateMoveControls(host){
 const cards=domCards(host);
 const order=Array.from(host.children)
   .map(n=>KEYS.find(k=>n.matches?.(CLS[k]))).filter(Boolean);
 for(const [key,card] of Object.entries(cards)){
  if(!card)continue;
  const bar=card.querySelector(':scope > .ldp121-move');
  if(!bar)continue;
  bar.hidden=!editing;
  card.draggable=editing;
  const up=bar.querySelector('[data-dir="up"]');
  const down=bar.querySelector('[data-dir="down"]');
  if(up)up.disabled=order.indexOf(key)<=0;
  if(down)down.disabled=order.indexOf(key)===order.length-1;
 }
}
function move(host,key,direction){
 const present=Array.from(host.children)
  .map(n=>KEYS.find(k=>n.matches?.(CLS[k]))).filter(Boolean);
 const at=present.indexOf(key),dest=at+direction;
 if(at<0||dest<0||dest>=present.length)return;
 [present[at],present[dest]]=[present[dest],present[at]];
 const all=[...present,...KEYS.filter(k=>!present.includes(k))];
 put(storagePrefix+owner,all);reorder(host,all);updateMoveControls(host);
}
function keyDate(value){
 const match=String(value||'').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/);
 if(!match)return '';
 const y=+match[1],m=+match[2],d=+match[3];
 const date=new Date(y,m-1,d,12);
 return date.getFullYear()===y&&date.getMonth()+1===m&&date.getDate()===d?
  y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0'):'';
}
const dayOffset=days=>{
 const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+days);
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
};
function preparedRows(notes){
 return (Array.isArray(notes)?notes:[])
 .filter(n=>n&&n.status!=='archived')
 .map(n=>({
  row:n,id:String(n.id||''),
  title:String(n.title||n.description||'Untitled note').slice(0,130),
  due:keyDate(n.dueDate),
  changed:keyDate(n.updatedAt||n._sync?.updated_at||n.createdAt),
  created:keyDate(n.createdAt||n.updatedAt||n._sync?.updated_at),
  priority:String(n.priority||'').toLowerCase()
 }));
}
function visibleRows(records,settings){
 const today=dayOffset(0),end=dayOffset(10);
 let rows=records.filter(n=>{
  if(settings.filter==='today')return n.due===today;
  if(settings.filter==='next')return n.due>today&&n.due<=end;
  if(settings.filter==='overdue')return Boolean(n.due)&&n.due<today;
  if(settings.filter==='undated')return !n.due;
  return true;
 });
 const collator=new Intl.Collator(i18n()?.locale?.()||'en',{numeric:true,sensitivity:'base'});
 rows.sort((a,b)=>{
  if(settings.sort==='az')return collator.compare(a.title,b.title);
  if(settings.sort==='due')return (a.due||'9999').localeCompare(b.due||'9999')||
   (b.changed||'').localeCompare(a.changed||'');
  if(settings.sort==='oldest')return (a.created||'9999').localeCompare(b.created||'9999');
  return (b.changed||'').localeCompare(a.changed||'');
 });
 return {all:rows,shown:rows.slice(0,settings.limit==='all'?1000:Number(settings.limit)||3)};
}
function showDate(iso){
 const key=keyDate(iso);if(!key)return '';
 const [y,m,d]=key.split('-').map(Number);
 try{return new Intl.DateTimeFormat(i18n()?.locale?.()||'en',{day:'numeric',month:'short',year:'numeric'}).format(new Date(y,m-1,d,12))}
 catch{return key}
}
function navNotes(){document.querySelector('#nav [data-page="notes"]')?.click()}
function notesCard(host){
 if($(CLS.notes,host))return;
 const snapshot=bridge()?.snapshot();
 if(!snapshot)return;
 const records=preparedRows(snapshot.notes||[]);
 const card=E('section','ldp119-panel ldp121-notes');
 const heading=E('header','ldp119-head');
 const left=E('div','ldp119-heading');
 left.append(E('span','ldp119-icon','📝'),E('h2','',tr('notesWidget','Notes Pro')+' · '+records.length));
 heading.append(left);
 const allButton=E('button','ldp119-more',tr('openAll','All notes →'));
 allButton.type='button';allButton.addEventListener('click',navNotes);
 heading.append(allButton);card.append(heading);
 const filters=E('div','ldp121-filters');
 const stored=read(prefPrefix+owner,{});
 const prefs=stored&&typeof stored==='object'&&!Array.isArray(stored)?stored:{};
 const state={
  sort:['newest','oldest','due','az'].includes(prefs.sort)?prefs.sort:'newest',
  filter:['all','today','next','overdue','undated'].includes(prefs.filter)?prefs.filter:'all',
  limit:[3,5,10,'all'].includes(prefs.limit)?prefs.limit:3
 };
 const controls=[
  ['sort',[['newest','newest'],['oldest','oldest'],['due','dueSoon'],['az','alphabetical']]],
  ['filter',[['all','allNotes'],['today','dueToday'],['next','nextTenFilter'],['overdue','overdue'],['undated','noDate']]],
  ['limit',[[3,'3'],[5,'5'],[10,'10'],['all','allNotes']]]
 ];
 const values={};
 for(const [key,options]of controls){
  const label=E('label','ldp121-filter-label');
  label.append(E('span','',tr(key,key.toUpperCase())));
  const selector=E('select','ldp121-select');
  selector.setAttribute('aria-label',tr(key,key));
  for(const [val,labelKey]of options){
   const opt=E('option','',typeof labelKey==='string'&&/^\d+$/.test(labelKey)?labelKey:tr(labelKey,labelKey));
   opt.value=String(val);selector.append(opt);
  }
  selector.value=String(state[key]);
  selector.addEventListener('change',()=>{
   state[key]=key==='limit'&&selector.value!=='all'?Number(selector.value):selector.value;
   put(prefPrefix+owner,state);renderRows();
  });
  label.append(selector);filters.append(label);values[key]=selector;
 }
 card.append(filters);
 const list=E('div','ldp121-note-list');card.append(list);
 const foot=E('div','ldp121-list-foot');card.append(foot);
 function renderRows(){
  list.replaceChildren();
  const {all,shown}=visibleRows(records,state);
  if(!shown.length)list.append(E('p','ldp121-empty',tr('emptyNotes','No matching synced notes.')));
  for(const n of shown){
   const item=E('button','ldp121-note');
   item.type='button';
   const icon=E('span','ldp121-note-icon','✎');
   const body=E('span','ldp121-note-body');
   body.append(E('strong','',n.title));
   const detail=n.due?tr('dueSoon','Due')+' · '+showDate(n.due):
    (n.changed?showDate(n.changed):tr('noDate','No date'));
   body.append(E('small','',detail));
   item.append(icon,body,E('span','ldp121-note-arrow','›'));
   item.addEventListener('click',navNotes);
   list.append(item);
  }
  foot.textContent=shown.length+' / '+all.length+' '+tr('notes','Notes');
 }
 renderRows();
 host.append(card);
}
function setup(host){
 const controls=E('div','ldp121-layout-toolbar');
 controls.id='ldp121LayoutControls';
 const label=E('strong','',tr('layoutHint','My dashboard'));
 const customize=E('button','ldp121-layout-button',tr('editLayout','Rearrange cards'));
 customize.type='button';customize.setAttribute('aria-pressed','false');
 const reset=E('button','ldp121-layout-reset',tr('resetLayout','Reset order'));
 reset.type='button';reset.hidden=true;
 controls.append(label,customize,reset);host.prepend(controls);
 customize.addEventListener('click',()=>{
  editing=!editing;host.classList.toggle('ldp121-editing',editing);
  customize.textContent=editing?tr('finishLayout','Finish'):tr('editLayout','Rearrange cards');
  customize.setAttribute('aria-pressed',String(editing));
  reset.hidden=!editing;updateMoveControls(host);
 });
 reset.addEventListener('click',()=>{
  put(storagePrefix+owner,KEYS);reorder(host,KEYS);updateMoveControls(host);
 });
 let dragged='';
 host.addEventListener('dragstart',e=>{
  const card=e.target.closest('.ldp121-draggable');
  if(!editing||root.classList.contains('ldp123-desktop')||!card)return;
  dragged=card.dataset.layoutKey||'';
  if(!dragged)return;
  e.dataTransfer?.setData('text/plain',dragged);
  if(e.dataTransfer)e.dataTransfer.effectAllowed='move';
 });
 host.addEventListener('dragover',e=>{
  if(!root.classList.contains('ldp123-desktop')&&editing&&dragged&&e.target.closest('.ldp121-draggable'))e.preventDefault();
 });
 host.addEventListener('drop',e=>{
  if(!editing||root.classList.contains('ldp123-desktop')||!dragged)return;
  const dest=e.target.closest('.ldp121-draggable')?.dataset.layoutKey;
  if(dest&&dest!==dragged){
   e.preventDefault();
   const order=Array.from(host.children).map(n=>n.dataset.layoutKey).filter(Boolean);
   const from=order.indexOf(dragged),to=order.indexOf(dest);
   if(from>=0&&to>=0){
    order.splice(from,1);order.splice(to,0,dragged);
    put(storagePrefix+owner,order);reorder(host,order);updateMoveControls(host);
   }
  }
  dragged='';
 });
 host.addEventListener('dragend',()=>{dragged=''});
}
function sync(){
 if(app.classList.contains('hidden')||!bridge()?.ready()){
  if(owner){owner='';editing=false;current=null}
  return;
 }
 const host=$('#androidDashboardParityV119',root);
 if(!host||host.dataset.readyFor!==bridge().identity())return;
 // Desktop Mode owns card order, sizing and visibility. Keep Classic state intact.
 if(root.classList.contains('ldp123-desktop'))return;
 const id=bridge().identity();
 if(owner!==id){owner=id;editing=false;current=null}
 if(current!==host){current=host;editing=false;setup(host);notesCard(host)}
 const cards=domCards(host);
 for(const [key,card]of Object.entries(cards)){
  if(!card||card.dataset.layoutKey===key)continue;
  card.dataset.layoutKey=key;card.classList.add('ldp121-draggable');
  const bar=E('div','ldp121-move');
  for(const [dir,symbol]of [['up','↑'],['down','↓']]){
   const button=E('button','ldp121-move-button',symbol);
   button.type='button';button.dataset.dir=dir;
   button.setAttribute('aria-label',tr(dir==='up'?'earlier':'later',dir==='up'?'Move earlier':'Move later'));
   button.addEventListener('click',()=>move(host,key,dir==='up'?-1:1));
   bar.append(button);
  }
  card.prepend(bar);
 }
 const order=orderFor(owner);
 const present=Array.from(host.children).map(n=>n.dataset.layoutKey).filter(Boolean);
 const wanted=order.filter(k=>Boolean(cards[k]));
 if(JSON.stringify(present)!==JSON.stringify(wanted))reorder(host,order);
 updateMoveControls(host);
}
document.addEventListener('lifedash:mode-change',sync);
new MutationObserver(sync).observe(root,{childList:true,subtree:true});
new MutationObserver(sync).observe(app,{attributes:true,attributeFilter:['class']});
document.addEventListener('lifedash:locale-change',()=>{
 if(root.classList.contains('ldp123-desktop'))return;
 const host=current;
 if(!host||!host.isConnected)return;
 const toolbar=$('#ldp121LayoutControls',host);
 if(toolbar){
  toolbar.querySelector('strong').textContent=tr('layoutHint','My dashboard');
  toolbar.querySelector('.ldp121-layout-button').textContent=editing?
   tr('finishLayout','Finish'):tr('editLayout','Rearrange cards');
  toolbar.querySelector('.ldp121-layout-reset').textContent=tr('resetLayout','Reset order');
 }
 const notes=$(CLS.notes,host);
 if(notes){notes.remove();notesCard(host);reorder(host,orderFor(owner));updateMoveControls(host)}
});
sync();
})();