/* LifeDashPro Web v1.24 — real multiwindow Desktop Workspace.
 * Windows contain isolated same-origin LifeDashPro app views (one SPA per app).
 * Classic Web and mobile remain untouched when Desktop Mode is off.
 */
(()=>{
'use strict';
if(document.documentElement.classList.contains('ldp-os-embedded'))return;
const bridge=()=>window.LifeDashOSBridge;
const dash=()=>window.LifeDashDashboardBridge;
const $=(q,n=document)=>n?.querySelector(q)||null;
const all=(q,n=document)=>Array.from(n?.querySelectorAll(q)||[]);
const mk=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=String(txt);return n};
const APPS=[
 ['dashboard','⌂','Dashboard'],['today','◷','Today'],['calendar','▦','Calendar'],
 ['notes','✎','Notes Pro'],['tasks','✓','Tasks'],['documents','▣','Documents'],
 ['finance','€','Finance'],['explore','⌖','Around Me'],['vehicles','🚗','Vehicles'],
 ['journey','🗺','Journey'],['world','◉','World Live'],['news','▤','News & RSS'],
 ['radio','♫','World Radio'],['backup','⛨','Backup & Restore'],['profile','⚙','Settings']
];
const INFO=Object.fromEntries(APPS.map(([id,icon,name])=>[id,{icon,name}]));
const WIDGETS=['today','weather','calendar','finance','world','news'];
const DEFAULT_PIN=['notes','finance','calendar','radio','news','journey'];
const MAX_WINDOWS=8;
const PREF='ldp_web_os_v124_';
const COLOURS=['aurora','dawn','forest','charcoal'];
const LOCALE={
 en:{start:'Start',apps:'All applications',search:'Search apps…',windows:'Open windows',desktop:'Desktop',classic:'Classic',customize:'Customize',widgets:'Widgets',background:'Background',restore:'Restore workspace',empty:'No open windows',hint:'Open an application from Start or a desktop icon.',weather:'Check weather',waiting:'Upcoming',noEvents:'No upcoming dated items',save:'Saving workspace…',saved:'Workspace saved ✓',offline:'Saved on this device · cloud unavailable',max:'Up to 8 apps can stay open at once.',close:'Close',min:'Minimize',maximize:'Maximize',again:'Restore',show:'Show',hide:'Hide',pin:'Pin',unpin:'Unpin'},
 mk:{start:'Старт',apps:'Сите апликации',search:'Пребарај апликации…',windows:'Отворени прозорци',desktop:'Десктоп',classic:'Класичен',customize:'Прилагоди',widgets:'Виџети',background:'Позадина',restore:'Врати работен простор',empty:'Нема отворени прозорци',hint:'Отвори апликација од Старт или преку икона.',weather:'Провери време',waiting:'Претстојни',noEvents:'Нема претстојни записи со датум',save:'Се зачувува работниот простор…',saved:'Работниот простор е зачуван ✓',offline:'Зачувано на уредот · нема cloud',max:'Може да останат отворени до 8 апликации.',close:'Затвори',min:'Минимизирај',maximize:'Максимизирај',again:'Врати',show:'Прикажи',hide:'Сокриј',pin:'Закачи',unpin:'Откачи'},
 de:{start:'Start',apps:'Alle Apps',search:'Apps suchen…',windows:'Offene Fenster',desktop:'Desktop',classic:'Klassisch',customize:'Anpassen',widgets:'Widgets',background:'Hintergrund',restore:'Arbeitsbereich wiederherstellen',empty:'Keine offenen Fenster',hint:'App über Start oder Desktop-Symbol öffnen.',weather:'Wetter prüfen',waiting:'Demnächst',noEvents:'Keine bevorstehenden Termine',save:'Arbeitsbereich speichern…',saved:'Arbeitsbereich gespeichert ✓',offline:'Lokal gespeichert · Cloud nicht verfügbar',max:'Bis zu 8 Apps können gleichzeitig geöffnet sein.',close:'Schließen',min:'Minimieren',maximize:'Maximieren',again:'Wiederherstellen',show:'Anzeigen',hide:'Verbergen',pin:'Anheften',unpin:'Lösen'}
};
let owner='',data=null,ui=null,saving=0,saveRun=Promise.resolve(),z=50,focusId='',drag=null;
function lang(){return String(window.LifeDashWebI18n?.locale?.()||'en').toLowerCase().split('-')[0]}
function t(key){return (LOCALE[lang()]||LOCALE.en)[key]||LOCALE.en[key]||key}
function active(){return !!bridge()?.ready?.()&&!$('#appView')?.classList.contains('hidden')&&$('#appView')?.classList.contains('ldp123-desktop-shell')}
function base(){
 const width=Math.max(360,window.innerWidth),height=Math.max(340,window.innerHeight-84);
 const windowState={};
 for(const [i,id] of ['notes','finance'].entries()){
  windowState[id]={id,x:Math.min(width-350,85+i*125),y:Math.min(height-290,110+i*65),
   w:Math.min(730,width-35),h:Math.min(550,height-18),min:false,max:false};
 }
 return {version:1,wallpaper:'aurora',pinned:DEFAULT_PIN.slice(),
  widgetOrder:WIDGETS.slice(),hiddenWidgets:[],windows:windowState,updatedAt:0};
}
function clean(input){
 const baseState=base(),src=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
 const validList=(xs,allowed)=>Array.isArray(xs)?[...new Set(xs.filter(x=>allowed.includes(x)))]:[];
 const pinned=validList(src.pinned,Object.keys(INFO));
 const visible=validList(src.widgetOrder,WIDGETS);
 const result={version:1,wallpaper:COLOURS.includes(src.wallpaper)?src.wallpaper:'aurora',
 pinned:pinned.length?pinned:DEFAULT_PIN.slice(),widgetOrder:[...visible,...WIDGETS.filter(x=>!visible.includes(x))],
 hiddenWidgets:validList(src.hiddenWidgets,WIDGETS),windows:{},updatedAt:Math.max(0,Number(src.updatedAt)||0)};
 let list=0;
 for(const [id,w] of Object.entries(src.windows||{})){
  if(!INFO[id]||!w||typeof w!=='object'||list>=MAX_WINDOWS)continue;
  const finite=(n,f)=>Number.isFinite(Number(n))?Number(n):f;
  result.windows[id]={id,
   x:Math.round(Math.max(0,Math.min(4500,finite(w.x,90)))),
   y:Math.round(Math.max(0,Math.min(2600,finite(w.y,80)))),
   w:Math.round(Math.max(320,Math.min(1900,finite(w.w,690)))),
   h:Math.round(Math.max(280,Math.min(1400,finite(w.h,515)))),
   min:!!w.min,max:!!w.max};list++;
 }
 return result;
}
function storeKey(){return PREF+owner}
function readLocal(){try{return JSON.parse(localStorage.getItem(storeKey())||'null')}catch{return null}}
function writeLocal(){try{localStorage.setItem(storeKey(),JSON.stringify(data))}catch(_){}}
function persist(){
 if(!owner||!data)return;
 data.updatedAt=Date.now();writeLocal();showStatus(t('save'));
 if(saving)clearTimeout(saving);
 const id=owner,payload=JSON.parse(JSON.stringify(data));
 saving=setTimeout(()=>{
  saving=0;
  if(id!==owner||!bridge()?.ready?.())return;
  saveRun=saveRun.catch(()=>{}).then(async()=>{
   if(id!==owner||!bridge()?.ready?.())return;
   try{await bridge().save(payload);if(owner===id)showStatus(t('saved'))}
   catch(_){if(owner===id)showStatus(t('offline'))}
  });
 },850);
}
function showStatus(msg){const e=$('#ldp124Status',ui);if(e)e.textContent=msg}
function displayName(id){return INFO[id]?.name||id}
function shell(){
 if(ui)return ui;
 ui=mk('section','ldp124-os');ui.id='ldp124OS';
 ui.setAttribute('aria-label','LifeDashPro Desktop Workspace');
 const wallpaper=mk('div','ldp124-wallpaper');wallpaper.id='ldp124Wallpaper';
 const top=mk('header','ldp124-topstrip');
 const brand=mk('div','ldp124-brand');brand.append(mk('span','ldp124-brandmark','LD'),mk('strong','', 'LifeDashPro'),mk('span','ldp124-top-tag','DESKTOP OS'));
 const actions=mk('div','ldp124-top-actions');
 const customize=button('⚙ '+t('customize'),'ldp124-top-button',()=>toggleSettings());
 const classic=button('↩ '+t('classic'),'ldp124-top-button',switchClassic);
 actions.append(customize,classic);top.append(brand,actions);
 const canvas=mk('div','ldp124-canvas');canvas.id='ldp124Canvas';
 const icons=mk('nav','ldp124-icons');icons.id='ldp124Icons';icons.setAttribute('aria-label','Desktop applications');
 const widgets=mk('section','ldp124-widgets');widgets.id='ldp124Widgets';widgets.setAttribute('aria-label',t('widgets'));
 const winArea=mk('div','ldp124-windows');winArea.id='ldp124Windows';
 canvas.append(icons,widgets,winArea);
 const task=mk('nav','ldp124-taskbar');task.setAttribute('aria-label','Desktop taskbar');
 const start=button('◈','ldp124-start',()=>toggleStart());start.title=t('start');start.id='ldp124Start';
 const pinned=mk('div','ldp124-task-apps');pinned.id='ldp124TaskApps';
 const tray=mk('div','ldp124-task-tray');tray.id='ldp124Tray';
 const clock=mk('div','ldp124-task-clock');clock.id='ldp124Clock';
 const home=button('⌂','ldp124-task-home',()=>{hideStart();all('.ldp124-window',ui).forEach(el=>el.classList.remove('ldp124-focused'));focusId='';});
 home.title='Home';
 tray.append(clock,home);task.append(start,pinned,tray);
 const startMenu=mk('section','ldp124-start-menu');startMenu.id='ldp124StartMenu';startMenu.hidden=true;
 const settings=mk('aside','ldp124-settings');settings.id='ldp124Settings';settings.hidden=true;
 ui.append(wallpaper,top,canvas,task,startMenu,settings);
 document.body.append(ui);
 ui.addEventListener('pointerdown',event=>{
  if(event.target===wallpaper||event.target===canvas){hideStart();closeSettings()}
 });
 document.addEventListener('keydown',escapeMenus);
 updateClock();
 return ui;
}
function escapeMenus(event){
 if(event.key==='Escape'){hideStart();closeSettings();
  if(document.activeElement?.closest('.ldp124-window'))document.activeElement.blur()}
}
function button(text,cls,fn){
 const b=mk('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;
}
function updateClock(){
 const c=$('#ldp124Clock',ui);if(!c)return;
 const now=new Date();let date=now.toLocaleDateString(),time=now.toLocaleTimeString();
 try{date=new Intl.DateTimeFormat(lang(),{day:'2-digit',month:'short',year:'numeric'}).format(now);
 time=new Intl.DateTimeFormat(lang(),{hour:'2-digit',minute:'2-digit'}).format(now)}catch(_){}
 c.replaceChildren(mk('strong','',time),mk('small','',date));
}
function wallpaper(){if(ui)ui.dataset.wallpaper=data?.wallpaper||'aurora'}
function iconButton(id){
 const item=button('','ldp124-desktop-icon',()=>openApp(id));
 item.dataset.app=id;item.title=displayName(id);
 item.append(mk('span','ldp124-desktop-glyph',INFO[id].icon),mk('small','',displayName(id)));
 return item;
}
function drawIcons(){
 const host=$('#ldp124Icons',ui);if(!host)return;
 host.replaceChildren();
 const shortcuts=['dashboard','notes','finance','calendar','news','radio','world','explore','vehicles','journey','documents','profile'];
 for(const id of shortcuts)host.append(iconButton(id));
}
function drawTaskbar(){
 const dock=$('#ldp124TaskApps',ui);if(!dock)return;
 dock.replaceChildren();
 for(const id of data.pinned){
  const run=!!data.windows[id],w=data.windows[id];
  const b=button('','ldp124-task-app'+(run?' is-running':'')+(focusId===id?' is-active':''),
   ()=>{if(w?.min){restore(id)}else if(run){raise(id)}else openApp(id)});
  b.dataset.app=id;b.title=displayName(id);
  b.append(mk('span','',INFO[id].icon));
  if(run)b.append(mk('i','ldp124-running-dot'));
  dock.append(b);
 }
 // Include open apps not already pinned, so minimized windows remain accessible.
 for(const id of Object.keys(data.windows).filter(x=>!data.pinned.includes(x))){
  const b=button(INFO[id].icon,'ldp124-task-app is-running'+(focusId===id?' is-active':''),()=>restore(id));
  b.title=displayName(id);b.append(mk('i','ldp124-running-dot'));dock.append(b);
 }
}
function startContents(){
 const panel=$('#ldp124StartMenu',ui);if(!panel)return;
 panel.replaceChildren();
 const top=mk('div','ldp124-menu-head');
 top.append(mk('span','ldp124-brandmark','LD'),mk('div','',t('apps')));
 const close=button('×','ldp124-menu-close',hideStart);close.setAttribute('aria-label',t('close'));top.append(close);
 const search=mk('input','ldp124-menu-search');search.type='search';search.placeholder=t('search');
 search.setAttribute('aria-label',t('search'));
 const grid=mk('div','ldp124-menu-grid');
 const display=(query='')=>{
  grid.replaceChildren();const match=query.toLocaleLowerCase();
  for(const [id,icon,title] of APPS){
   if(!title.toLocaleLowerCase().includes(match)&&!id.includes(match))continue;
   const b=button('','ldp124-menu-app',()=>{hideStart();openApp(id)});
   b.append(mk('span','ldp124-menu-symbol',icon),mk('small','',title));
   grid.append(b);
  }
 };
 search.addEventListener('input',()=>display(search.value.trim()));display();
 const foot=mk('div','ldp124-menu-foot');
 foot.append(mk('span','',t('windows')+': '+Object.keys(data.windows).length),
  button('⚙ '+t('customize'),'ldp124-menu-settings',()=>{hideStart();toggleSettings()}));
 panel.append(top,search,grid,foot);
}
function toggleStart(){
 const panel=$('#ldp124StartMenu',ui);if(!panel)return;
 if(panel.hidden){closeSettings();startContents();panel.hidden=false;panel.querySelector('input')?.focus()}
 else panel.hidden=true;
}
function hideStart(){const p=$('#ldp124StartMenu',ui);if(p)p.hidden=true}
function toggleSettings(){
 const p=$('#ldp124Settings',ui);if(!p)return;
 if(p.hidden){hideStart();paintSettings();p.hidden=false}else p.hidden=true;
}
function closeSettings(){const p=$('#ldp124Settings',ui);if(p)p.hidden=true}
function paintSettings(){
 const p=$('#ldp124Settings',ui);if(!p)return;
 p.replaceChildren();
 const h=mk('div','ldp124-settings-heading');
 h.append(mk('h2','',t('customize')),button('×','ldp124-settings-x',closeSettings));
 p.append(h,mk('h3','',t('background')));
 const themes=mk('div','ldp124-themes');
 for(const code of COLOURS){
  const b=button('', 'ldp124-theme ldp124-theme-'+code+(data.wallpaper===code?' selected':''),
  ()=>{data.wallpaper=code;wallpaper();persist();paintSettings()});
  b.title=code;b.setAttribute('aria-label',code);themes.append(b);
 }
 p.append(themes,mk('h3','',t('widgets')));
 for(const key of data.widgetOrder){
  const row=mk('label','ldp124-check');
  const box=mk('input');box.type='checkbox';box.checked=!data.hiddenWidgets.includes(key);
  box.addEventListener('change',()=>{
   data.hiddenWidgets=box.checked?data.hiddenWidgets.filter(x=>x!==key):[...new Set([...data.hiddenWidgets,key])];
   persist();drawWidgets();
  });
  row.append(box,mk('span','',key==='today'?t('waiting'):displayName(key)));
  const move=mk('span','ldp124-widget-order');
  const up=button('↑','ldp124-widget-arrow',()=>shiftWidget(key,-1));
  const down=button('↓','ldp124-widget-arrow',()=>shiftWidget(key,1));
  up.disabled=data.widgetOrder.indexOf(key)===0;
  down.disabled=data.widgetOrder.indexOf(key)===data.widgetOrder.length-1;
  up.setAttribute('aria-label','Move '+key+' up');
  down.setAttribute('aria-label','Move '+key+' down');
  move.append(up,down);row.append(move);p.append(row);
 }
 p.append(mk('h3','',t('apps')));
 for(const [id,icon,title] of APPS){
  const row=mk('label','ldp124-check');
  const box=mk('input');box.type='checkbox';box.checked=data.pinned.includes(id);
  box.addEventListener('change',()=>{
   data.pinned=box.checked?[...new Set([...data.pinned,id])]:data.pinned.filter(x=>x!==id);
   persist();drawTaskbar();
  });
  row.append(box,mk('span','',icon+' '+title));p.append(row);
 }
 p.append(button(t('restore'),'ldp124-reset-workspace',()=>{
  if(!confirm(t('restore')+'?'))return;
  for(const id of Object.keys(data.windows))closeWindow(id,false);
  const next=base();data.wallpaper=next.wallpaper;data.widgetOrder=next.widgetOrder;
  data.hiddenWidgets=[];data.pinned=next.pinned;data.windows={};
  wallpaper();drawWidgets();drawTaskbar();persist();paintSettings();
 }));
 const status=mk('small','ldp124-status','');status.id='ldp124Status';p.append(status);
}
function shiftWidget(id,dir){
 const index=data.widgetOrder.indexOf(id),other=index+dir;
 if(index<0||other<0||other>=data.widgetOrder.length)return;
 [data.widgetOrder[index],data.widgetOrder[other]]=
  [data.widgetOrder[other],data.widgetOrder[index]];
 persist();drawWidgets();paintSettings();
}
function surface(){
 return {width:Math.max(335,window.innerWidth-22),height:Math.max(320,window.innerHeight-82)};
}
function clamp(w){
 const area=surface();
 const minWidth=Math.min(350,area.width);
 const size={w:Math.max(minWidth,Math.min(w.w||690,area.width)),h:Math.max(260,Math.min(w.h||520,area.height))};
 return {...w,...size,x:Math.max(0,Math.min(w.x||0,area.width-size.w)),
  y:Math.max(0,Math.min(w.y||0,area.height-size.h))};
}
function urlFor(id){
 const u=new URL('./index.html',location.href);
 u.searchParams.set('ldpWindow',id);
 u.hash=id;
 return u.href;
}
function openApp(id){
 if(!INFO[id]||!active())return;
 hideStart();closeSettings();
 if(data.windows[id]){restore(id);return}
 if(Object.keys(data.windows).length>=MAX_WINDOWS){showToast(t('max'));return}
 const {width,height}=surface();
 const count=Object.keys(data.windows).length;
 const initial=clamp({id,x:64+(count%5)*52,y:66+(count%5)*37,
  w:Math.min(790,width-35),h:Math.min(570,height-30),min:false,max:false});
 data.windows[id]=initial;
 mountWindow(id);raise(id);drawTaskbar();persist();
}
function showToast(msg){
 const e=$('#ldp124Toast',ui)||mk('div','ldp124-toast');
 e.id='ldp124Toast';e.textContent=msg;
 if(!e.isConnected)ui.append(e);
 e.hidden=false;
 clearTimeout(showToast.timer);
 showToast.timer=setTimeout(()=>{e.hidden=true},4200);
}
function makeWindow(id){
 const w=data.windows[id],node=mk('section','ldp124-window');
 node.dataset.app=id;node.setAttribute('aria-label',displayName(id)+' window');
 node.tabIndex=-1;
 const bar=mk('header','ldp124-window-bar');
 const label=mk('div','ldp124-window-label');
 label.append(mk('span','ldp124-window-icon',INFO[id].icon),mk('strong','',displayName(id)));
 const actions=mk('div','ldp124-window-actions');
 const mini=button('−','ldp124-window-mini',()=>minimize(id));
 mini.title=t('min');mini.setAttribute('aria-label',t('min'));
 const max=button('□','ldp124-window-max',()=>maximize(id));
 max.title=t('maximize');max.setAttribute('aria-label',t('maximize'));
 const close=button('×','ldp124-window-close',()=>closeWindow(id));
 close.title=t('close');close.setAttribute('aria-label',t('close'));
 actions.append(mini,max,close);bar.append(label,actions);
 bar.addEventListener('dblclick',e=>{if(!e.target.closest('button'))maximize(id)});
 bar.addEventListener('pointerdown',e=>startDrag(e,id,node,bar));
 const frame=mk('iframe','ldp124-frame');
 frame.title=displayName(id);
 frame.setAttribute('loading','eager');frame.setAttribute('referrerpolicy','same-origin');
 // Same-origin iframe deliberately preserves complete existing auth, event and
 // module isolation, including the Radio audio element when minimized.
 frame.src=urlFor(id);
 frame.addEventListener('load',()=>{
  node.classList.add('ldp124-loaded');
  // Same-origin child app clicks must raise their owning Desktop window.
  try{frame.contentDocument?.addEventListener('pointerdown',()=>raise(id),true)}catch(_){}
 });
 const grip=mk('div','ldp124-resize-grip');
 grip.setAttribute('role','separator');grip.setAttribute('aria-label','Resize '+displayName(id));
 grip.addEventListener('pointerdown',e=>startResize(e,id,node,grip));
 node.addEventListener('pointerdown',()=>raise(id));
 node.append(bar,frame,grip);return node;
}
function position(node,w){
 const b=clamp(w);
 if(w.max){
  node.classList.add('ldp124-maximized');
  node.style.left='0px';node.style.top='0px';
  node.style.width='100%';node.style.height='100%';
 }else{
  node.classList.remove('ldp124-maximized');
  node.style.left=b.x+'px';node.style.top=b.y+'px';
  node.style.width=b.w+'px';node.style.height=b.h+'px';
 }
 node.hidden=!!w.min;
 node.dataset.minimized=w.min?'true':'false';
}
function mountWindow(id){
 const w=data.windows[id];if(!w)return;
 const host=$('#ldp124Windows',ui);
 let node=host?.querySelector('[data-app="'+id+'"]');
 if(!node){node=makeWindow(id);host.append(node)}
 position(node,w);return node;
}
function raise(id){
 if(!data.windows[id])return;
 focusId=id;
 const node=$('#ldp124Windows [data-app="'+id+'"]',ui);
 if(node){
  z++;if(z>9000){z=51;all('.ldp124-window',ui).forEach(el=>el.style.zIndex='50')}
  node.style.zIndex=String(z);
  all('.ldp124-window',ui).forEach(el=>el.classList.toggle('ldp124-focused',el===node));
 }
 drawTaskbar();
}
function restore(id){
 const w=data.windows[id];if(!w)return;
 if(w.min){w.min=false;mountWindow(id);persist()}
 raise(id);
}
function minimize(id){
 const w=data.windows[id];if(!w)return;
 w.min=true;position(mountWindow(id),w);focusId='';drawTaskbar();persist();
}
function maximize(id){
 const w=data.windows[id];if(!w)return;
 w.max=!w.max;w.min=false;position(mountWindow(id),w);raise(id);persist();
}
function closeWindow(id,saveChange=true){
 const node=$('#ldp124Windows [data-app="'+id+'"]',ui);
 if(node)node.remove();
 delete data.windows[id];
 if(focusId===id)focusId='';
 drawTaskbar();if(saveChange)persist();
}
function startDrag(e,id,node,handle){
 if(e.button!==0||e.target.closest('button')||!data.windows[id]||data.windows[id].max)return;
 e.preventDefault();raise(id);
 const b=clamp(data.windows[id]);
 drag={kind:'move',id,startX:e.clientX,startY:e.clientY,base:b};
 node.classList.add('ldp124-interacting');
 handle.setPointerCapture(e.pointerId);
 const onMove=ev=>dragMotion(ev,node);
 const onEnd=ev=>{
  handle.removeEventListener('pointermove',onMove);handle.removeEventListener('pointerup',onEnd);
  handle.removeEventListener('pointercancel',onEnd);
  node.classList.remove('ldp124-interacting');drag=null;
  persist();
 };
 handle.addEventListener('pointermove',onMove);
 handle.addEventListener('pointerup',onEnd);handle.addEventListener('pointercancel',onEnd);
}
function startResize(e,id,node,handle){
 if(e.button!==0||!data.windows[id]||data.windows[id].max)return;
 e.preventDefault();e.stopPropagation();raise(id);
 drag={kind:'size',id,startX:e.clientX,startY:e.clientY,base:clamp(data.windows[id])};
 node.classList.add('ldp124-interacting');
 handle.setPointerCapture(e.pointerId);
 const onMove=ev=>dragMotion(ev,node);
 const onEnd=()=>{
  handle.removeEventListener('pointermove',onMove);handle.removeEventListener('pointerup',onEnd);
  handle.removeEventListener('pointercancel',onEnd);
  node.classList.remove('ldp124-interacting');drag=null;persist();
 };
 handle.addEventListener('pointermove',onMove);
 handle.addEventListener('pointerup',onEnd);handle.addEventListener('pointercancel',onEnd);
}
function dragMotion(ev,node){
 if(!drag||!data.windows[drag.id])return;
 const dx=ev.clientX-drag.startX,dy=ev.clientY-drag.startY;
 const b=drag.base,area=surface();
 let next;
 if(drag.kind==='move')next={...b,x:Math.max(0,Math.min(area.width-b.w,b.x+dx)),
  y:Math.max(0,Math.min(area.height-b.h,b.y+dy))};
 else next={...b,w:Math.max(Math.min(350,area.width-b.x),Math.min(area.width-b.x,b.w+dx)),
  h:Math.max(260,Math.min(area.height-b.y,b.h+dy))};
 Object.assign(data.windows[drag.id],next);position(node,data.windows[drag.id]);
}
function updateWindows(){
 const host=$('#ldp124Windows',ui);if(!host)return;
 for(const node of all('.ldp124-window',host)){
  const id=node.dataset.app;
  if(!data.windows[id])node.remove();
 }
 for(const id of Object.keys(data.windows))mountWindow(id);
}
function dateKey(v){
 const m=String(v||'').match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|T|\s)/);
 if(!m)return '';
 const y=+m[1],mo=+m[2],d=+m[3];
 const test=new Date(y,mo-1,d);
 if(test.getFullYear()!==y||test.getMonth()+1!==mo||test.getDate()!==d)return '';
 return y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0');
}
function nearEvents(){
 const d=dash()?.snapshot?.();if(!d)return [];
 const today=new Date(),start=new Date(today.getFullYear(),today.getMonth(),today.getDate());
 const end=new Date(start);end.setDate(end.getDate()+10);
 const localKey=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 const begin=localKey(start),limit=localKey(end);
 const candidates=[
  ...(d.notes||[]).filter(x=>x.status!=='archived').map(x=>[x.title,x.dueDate]),
  ...(d.family_tasks||[]).filter(x=>!x.done).map(x=>[x.title,x.dueDate]),
  ...(d.manual_reminders||[]).map(x=>[x.title||x.text,x.dueDate||x.date]),
  ...(d.documents||[]).map(x=>[x.name||x.title,x.expiresAt||x.expiryDate])
 ];
 return candidates.map(([title,date])=>({title:String(title||'').slice(0,75),date:dateKey(date)}))
 .filter(x=>x.title&&x.date>=begin&&x.date<=limit)
 .sort((a,b)=>a.date.localeCompare(b.date)).slice(0,3);
}
function widget(id){
 const box=mk('article','ldp124-widget');box.dataset.widget=id;
 const title={today:t('waiting'),weather:'Weather',calendar:'Calendar',finance:'Finance',
 world:'World Live',news:'News & RSS'}[id]||id;
 const btn=button('↗','ldp124-widget-open',()=>openApp(id==='weather'?'world':id==='today'?'today':id));
 btn.setAttribute('aria-label','Open '+title);
 const heading=mk('div','ldp124-widget-head');
 heading.append(mk('strong','',title),btn);
 box.append(heading);
 if(id==='today'||id==='calendar'){
  const events=nearEvents();if(!events.length)box.append(mk('p','ldp124-widget-muted',t('noEvents')));
  else for(const x of events){
   const row=button('','ldp124-widget-event',()=>openApp(id==='today'?'today':'calendar'));
   row.append(mk('strong','',x.title),mk('small','',x.date));box.append(row);
  }
 }else if(id==='finance'){
  const rows=dash()?.snapshot?.()?.finance_transactions||[];
  const math=window.LifeDashMonthlyMathV120;
  const figures=math?.calculate?.(rows,math.localDate(),'EUR');
  const amount=figures?.posted?.balance;
  box.append(mk('strong','ldp124-finance-number',
   Number.isFinite(amount)?new Intl.NumberFormat(lang(),{style:'currency',currency:'EUR'}).format(amount/100):'—'));
  box.append(mk('small','ldp124-widget-muted','Monthly balance · EUR'));
 }else if(id==='weather'){
  const line=mk('p','ldp124-widget-muted',dash()?.profile?.()?.city||'City in Profile');
  const value=mk('div','ldp124-weather-value','☁');
  const check=button(t('weather'),'ldp124-weather-button',async()=>{
   if(check.disabled)return;check.disabled=true;value.textContent='…';
   try{
    const city=dash()?.profile?.()?.city;
    if(!city)throw new Error('Set city in Profile');
    const search=await window.LifeDashExploreBridge?.cities?.(city);
    const first=search?.find(x=>Number.isFinite(Number(x.lat))&&Number.isFinite(Number(x.lon)));
    if(!first)throw new Error('City not found');
    const url=new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude',String(first.lat));url.searchParams.set('longitude',String(first.lon));
    url.searchParams.set('current','temperature_2m');url.searchParams.set('forecast_days','1');
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),9500);
    let res;try{res=await fetch(url.toString(),{signal:controller.signal})}finally{clearTimeout(timeout)}
    if(!res.ok)throw new Error('Weather service unavailable');
    const json=await res.json(),temp=Number(json?.current?.temperature_2m);
    if(!Number.isFinite(temp)||temp<-120||temp>70)throw new Error('Invalid data');
    if(box.isConnected)value.textContent=Math.round(temp)+'°C';
   }catch(e){if(box.isConnected)value.textContent=String(e.message||'Weather unavailable').slice(0,60)}
   finally{check.disabled=false}
  });
  box.append(value,line,check);
 }else if(id==='world'){
  box.append(mk('div','ldp124-widget-decor','🌐'),mk('p','ldp124-widget-muted','Fires · Earthquakes · Road Live'));
 }else if(id==='news'){
  box.append(mk('div','ldp124-widget-decor','📰'),mk('p','ldp124-widget-muted','RSS · DE · MK · RS · Balkans'));
 }
 return box;
}
function drawWidgets(){
 const parent=$('#ldp124Widgets',ui);if(!parent)return;
 parent.replaceChildren();
 for(const id of data.widgetOrder){
  if(data.hiddenWidgets.includes(id))continue;
  const node=widget(id);parent.append(node);
 }
}
function activate(){
 if(!active())return;
 const next=bridge().identity();
 if(!next)return;
 if(owner!==next){
  if(saving){clearTimeout(saving);saving=0}
  owner=next;
  const local=readLocal(),cloud=bridge().prefs?.();
  data=clean(cloud&&Number(cloud.updatedAt||0)>=Number(local?.updatedAt||0)?cloud:local);
  if(!cloud&&!local)data=base();
 }
 shell();ui.hidden=false;wallpaper();drawIcons();drawWidgets();
 updateWindows();drawTaskbar();updateClock();
 // Keep classic mode and existing dashboard alive underneath for safe rollback.
}
function deactivate(){
 if(ui&&!ui.hidden){
  ui.hidden=true;hideStart();closeSettings();
  // Leaving Desktop stops iframe work (including playing radio) without
  // deleting saved window positions, so re-entering restores the workspace.
  $('#ldp124Windows',ui)?.replaceChildren();
 }
}
function switchClassic(){
 const choice=$('#ldp123ModeSwitch [data-mode="classic"]');
 if(choice){choice.click();deactivate()}
}
function sync(){
 if(active())activate();
 else{deactivate();if(!bridge()?.ready?.()||$('#appView')?.classList.contains('hidden')){
  owner='';data=null;
  if(ui){for(const frame of all('iframe',ui))frame.remove();$('#ldp124Windows',ui)?.replaceChildren()}
 }}
}
let busy=false;
function schedule(){if(busy)return;busy=true;queueMicrotask(()=>{busy=false;sync()})}
new MutationObserver(schedule).observe($('#appView'),{attributes:true,attributeFilter:['class']});
document.addEventListener('lifedash:locale-change',schedule);
window.addEventListener('resize',()=>{if(!ui||ui.hidden||!data)return;
 for(const id of Object.keys(data.windows)){
  const w=data.windows[id];position($('#ldp124Windows [data-app="'+id+'"]',ui),w);
 }});
window.setInterval(()=>{if(ui&&!ui.hidden)updateClock()},30000);
schedule();
})();