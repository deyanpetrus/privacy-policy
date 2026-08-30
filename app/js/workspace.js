(()=>{
'use strict';
const params=new URLSearchParams(location.search);
if(params.get('workspace')!=='desktop')return;
const APPS=[
 ['dashboard','⌂','Dashboard'],['today','◷','Today'],['notes','✎','Notes Pro'],['finance','€','Finance'],['invoices','▤','Invoices'],['documents','▣','Documents'],['family','♧','Family'],['vehicles','◈','Vehicles'],['route','⌖','Route Planner'],['explore','◎','Explore & Live'],['air','✈','Air Traffic'],['radio','◉','Balkan Vibes'],['profile','⚙','Settings']
];
const SHORTCUTS=['notes','finance','documents','family','vehicles','route','explore','air','radio'];
const PINNED=['dashboard','today','notes','finance','explore','route','radio'];
const app=id=>APPS.find(x=>x[0]===id);
const routeNow=()=>location.hash.replace('#','')||'dashboard';
const openRoute=id=>{if(typeof window.setRoute==='function')window.setRoute(id);else location.hash=id;syncActive()};
function syncActive(){const r=routeNow();document.querySelectorAll('[data-workspace-route]').forEach(b=>b.classList.toggle('active',b.dataset.workspaceRoute===r))}
function makeShortcuts(){const host=document.createElement('div');host.className='desktop-shortcuts';host.setAttribute('aria-label','Workspace shortcuts');SHORTCUTS.forEach(id=>{const a=app(id),b=document.createElement('button');b.className='desktop-shortcut';b.dataset.workspaceRoute=id;b.innerHTML=`<span class="desk-icon">${a[1]}</span><b>${a[2]}</b>`;b.onclick=()=>openRoute(id);host.appendChild(b)});document.body.appendChild(host)}
function makeTaskbar(){const bar=document.createElement('div');bar.className='desktop-taskbar';bar.innerHTML='<button class="task-start" id="workspaceStart" title="LifeDash launcher">◈</button>';
 PINNED.forEach(id=>{const a=app(id),b=document.createElement('button');b.className='task-app';b.dataset.workspaceRoute=id;b.title=a[2];b.textContent=a[1];b.onclick=()=>openRoute(id);bar.appendChild(b)});
 const spacer=document.createElement('div');spacer.className='task-spacer';bar.appendChild(spacer);
 const sys=document.createElement('button');sys.className='task-system';sys.type='button';sys.onclick=()=>openRoute('today');sys.innerHTML='<b id="workspaceClock">--:--</b><span id="workspaceDate">LifeDashPro</span>';bar.appendChild(sys);document.body.appendChild(bar);
 document.getElementById('workspaceStart').onclick=()=>document.getElementById('workspaceLauncher').classList.toggle('hidden')}
function makeLauncher(){const box=document.createElement('section');box.id='workspaceLauncher';box.className='workspace-launcher hidden';box.innerHTML=`<div class="launcher-head"><div><b>LifeDashPro</b><div class="card-sub">Apps & workspace</div></div><button class="icon-btn" id="workspaceLauncherClose">×</button></div><div class="launcher-grid">${APPS.map(a=>`<button class="launcher-item" data-workspace-route="${a[0]}"><i>${a[1]}</i><span>${a[2]}</span></button>`).join('')}</div>`;document.body.appendChild(box);box.querySelectorAll('[data-workspace-route]').forEach(b=>b.onclick=()=>{box.classList.add('hidden');openRoute(b.dataset.workspaceRoute)});box.querySelector('#workspaceLauncherClose').onclick=()=>box.classList.add('hidden')}
function makeBadge(){const x=document.createElement('div');x.className='workspace-badge';x.textContent='MONSI AI · Desktop Workspace Lab';document.body.appendChild(x)}
function tick(){const n=new Date(),c=document.getElementById('workspaceClock'),d=document.getElementById('workspaceDate');if(c)c.textContent=n.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});if(d)d.textContent=n.toLocaleDateString([],{weekday:'short',day:'2-digit',month:'short'})}
function boot(){document.body.classList.add('workspace-desktop');makeShortcuts();makeTaskbar();makeLauncher();makeBadge();tick();setInterval(tick,30000);syncActive();window.addEventListener('hashchange',syncActive);document.addEventListener('click',e=>{const launcher=document.getElementById('workspaceLauncher');if(!launcher||launcher.classList.contains('hidden'))return;if(e.target.closest('#workspaceLauncher')||e.target.closest('#workspaceStart'))return;launcher.classList.add('hidden')});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
