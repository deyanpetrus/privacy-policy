(()=>{
'use strict';
const params=new URLSearchParams(location.search);
if(params.get('workspace')!=='desktop')return;

const THEMES=[
  ['neon-blue','Neon Blue'],
  ['neon-violet','Neon Violet'],
  ['aurora','Aurora'],
  ['midnight-glass','Midnight Glass'],
  ['light-glass','Light Glass']
];
const APPS=[
  ['dashboard','Dashboard','dashboard'],['today','Today','calendar'],['notes','Notes Pro','note'],['finance','Finance','finance'],
  ['documents','Documents','document'],['family','Family','family'],['vehicles','Vehicles','car'],['route','Route','route'],
  ['explore','Explore','compass'],['air','Air Traffic','air'],['radio','Radio','radio'],['profile','Profile','profile']
];
const LEFT_SHORTCUTS=['notes','finance','documents','family','vehicles'];
const RIGHT_SHORTCUTS=['explore','radio','air','route'];
const ROUTE_TITLES={dashboard:'Dashboard',today:'Today & Next 5 Days',notes:'Notes Pro',finance:'Finance',invoices:'Invoices',documents:'Documents',family:'Family',vehicles:'Vehicles & VIN',route:'Route Planner',explore:'Explore & Live',air:'Air Traffic',radio:'Balkan Vibes Radio',profile:'Profile & Settings'};
const W={root:null,window:null,home:null,dock:null,launcher:null,minimized:false,maximized:false,lastRoute:'dashboard',weather:null,hazard:null,geo:null,ready:false};

function svg(name){
 const common='viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
 const p={
  dashboard:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M8 14h3M13 14h3M8 17h3"/>',
  note:'<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 12h6M9 16h6"/>',
  finance:'<circle cx="12" cy="12" r="9"/><path d="M15.5 8.8c-.7-1-1.8-1.5-3.3-1.5-1.8 0-3.2.9-3.2 2.3 0 3.7 6.8 1.5 6.8 5 0 1.4-1.4 2.4-3.5 2.4-1.6 0-3-.6-3.8-1.7M12 5.5v13"/>',
  document:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/>',
  family:'<circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.4"/><path d="M3.5 20c.4-3.8 2.4-5.8 5.5-5.8s5.1 2 5.5 5.8M14 15.2c3.6-.7 6 1 6.5 4.8"/>',
  car:'<path d="M4 15l1.7-5h12.6l1.7 5v4H4z"/><path d="M7 10l1.4-3h7.2l1.4 3"/><circle cx="7" cy="17" r="1.2"/><circle cx="17" cy="17" r="1.2"/>',
  route:'<circle cx="6" cy="18" r="2.3"/><circle cx="18" cy="6" r="2.3"/><path d="M7.7 16.3c2-2.5 2.2-5.1 5.3-5.8 2.5-.6 3.2-1.5 3.4-2.7"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2.2 4.8-4.8 2.2 2.2-4.8z"/>',
  air:'<path d="M22 2L11 13"/><path d="M15 3l4-1-1 4M3 11l8 2-2 8 3-3 3 3 1-7 5-2"/>',
  radio:'<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M7 7l10-4M7 12h5"/><circle cx="16" cy="14" r="2.5"/><path d="M7 16h3"/>',
  profile:'<circle cx="12" cy="8" r="4"/><path d="M4.5 21c.7-4.5 3.2-6.7 7.5-6.7s6.8 2.2 7.5 6.7"/>',
  bell:'<path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 00-1.7-1L14.5 3h-5l-.4 3.1a8 8 0 00-1.7 1L5 6.1 3 9.5 5 11a7 7 0 000 2l-2 1.5 2 3.4 2.4-1a8 8 0 001.7 1l.4 3.1h5l.4-3.1a8 8 0 001.7-1l2.4 1 2-3.4-2-1.5a7 7 0 00.1-1z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  theme:'<path d="M12 3a9 9 0 109 9c0-.5 0-1-.1-1.4A6.5 6.5 0 0113.4 3H12z"/>'
 };
 return `<svg ${common}>${p[name]||p.dashboard}</svg>`;
}
function appInfo(id){const a=APPS.find(x=>x[0]===id);return a||['dashboard','Dashboard','dashboard']}
function localDay(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function routeNow(){return (location.hash||'#dashboard').slice(1)||'dashboard'}
function col(k){try{return typeof collection==='function'?collection(k):[]}catch{return[]}}
function money(n,c='EUR'){try{return typeof fmtMoney==='function'?fmtMoney(n,c):new Intl.NumberFormat(undefined,{style:'currency',currency:c}).format(Number(n)||0)}catch{return`${Number(n||0).toFixed(2)} ${c}`}}
function prefs(){const a=col('app_preferences');return a.find(x=>x.id==='main')||a[0]||{id:'main'}}
function themeNow(){const saved=localStorage.getItem('lifedash_desktop_theme');return THEMES.some(x=>x[0]===saved)?saved:'neon-blue'}
function setDesktopTheme(t,save=true){if(!THEMES.some(x=>x[0]===t))t='neon-blue';document.body.dataset.desktopTheme=t;localStorage.setItem('lifedash_desktop_theme',t);document.querySelectorAll('[data-desktop-theme]').forEach(b=>b.classList.toggle('active',b.dataset.desktopTheme===t));if(save&&W.ready&&typeof D!=='undefined'&&D?.upsert){const p={...prefs(),id:'main',desktopTheme:t,updatedAt:new Date().toISOString()};D.upsert('app_preferences',p).then(()=>{if(typeof reload==='function')return reload('app_preferences')}).catch(()=>{})}}
function cycleTheme(){const t=themeNow(),i=THEMES.findIndex(x=>x[0]===t);setDesktopTheme(THEMES[(i+1)%THEMES.length][0])}

function shortcutStatus(id){
 try{
  if(id==='notes')return `${col('notes').filter(x=>x.status!=='archived').length} active`;
  if(id==='finance'){const tx=col('finance_transactions'),m=localDay().slice(0,7),sum=tx.filter(x=>String(x.date||'').startsWith(m)).reduce((s,x)=>s+(x.type==='income'?1:-1)*Number(x.baseAmountAtEntry??x.amount??0),0);return money(sum,state?.profile?.currency||'EUR')}
  if(id==='documents')return `${col('documents').length} files`;
  if(id==='family')return `${col('family_tasks').filter(x=>!x.done).length} open tasks`;
  if(id==='vehicles')return `${col('vehicles').length} vehicles`;
  if(id==='radio'){const a=document.getElementById('audio');return a&&!a.paused?'Now playing':'Balkan Vibes'};
  if(id==='air')return 'Live radar';
  if(id==='route')return 'Plan smarter';
  if(id==='explore')return 'Maps · safety · road';
 }catch{}
 return 'Open app';
}
function makeShortcut(id,side){const a=appInfo(id);return `<button class="desktop-shortcut-card shortcut-${id}" data-workspace-route="${id}" data-side="${side}"><span class="shortcut-icon">${svg(a[2])}</span><span class="shortcut-copy"><b>${a[1]}</b><small data-shortcut-status="${id}">${shortcutStatus(id)}</small></span><span class="shortcut-arrow">›</span></button>`}
function makeDock(){return `<nav class="desktop-dock" id="desktopDock" aria-label="LifeDashPro apps"><div class="dock-glow"></div>${APPS.map(a=>`<button class="dock-app" data-workspace-route="${a[0]}" aria-label="${a[1]}" title="${a[1]}"><span class="dock-icon dock-${a[0]}">${svg(a[2])}</span><small>${a[1]}</small><i></i></button>`).join('')}</nav>`}
function makeThemes(){return `<section class="desktop-theme-panel"><span>Workspace theme</span><div>${THEMES.map(t=>`<button data-desktop-theme="${t[0]}">${t[1]}</button>`).join('')}</div></section>`}
function makeTopbar(){return `<header class="desktop-topbar"><div class="desktop-brand"><img src="../assets/lifedash-icon.webp" alt=""><div><b>LifeDashPro <em>Desktop</em></b><small>MONSI AI · Web workspace</small></div><span class="web-badge">WEB</span></div><div class="desktop-live"><b id="desktopClock">--:--:--</b><span><i></i> LIVE</span></div><div class="desktop-top-actions"><button id="desktopQuick" title="Quick add">${svg('plus')}</button><button id="desktopTheme" title="Change workspace theme">${svg('theme')}</button><button id="desktopNotify" title="Notifications">${svg('bell')}</button><button id="desktopSettings" title="Settings">${svg('settings')}</button></div></header>`}
function makeWindow(){return `<section class="desktop-window hidden" id="desktopWindow" aria-live="polite"><div class="desktop-window-titlebar"><div><span class="window-app-icon" id="windowAppIcon">${svg('dashboard')}</span><b id="windowTitle">LifeDashPro</b></div><div class="window-controls"><button id="windowMin" title="Minimize">—</button><button id="windowMax" title="Maximize">□</button><button id="windowClose" title="Close">×</button></div></div><div class="desktop-window-body" id="desktopWindowBody"></div></section>`}
function makeLauncher(){return `<section class="desktop-launcher hidden" id="desktopLauncher"><div class="launcher-top"><div><b>LifeDashPro Desktop</b><small>Apps & quick actions</small></div><button id="launcherClose">×</button></div><div class="launcher-search"><input id="launcherSearch" placeholder="Search apps…" autocomplete="off"></div><div class="launcher-apps" id="launcherApps">${APPS.map(a=>`<button data-workspace-route="${a[0]}" data-app-name="${a[1].toLowerCase()}"><span>${svg(a[2])}</span><b>${a[1]}</b></button>`).join('')}</div><div class="launcher-footer"><button id="launcherAddNote">＋ New note</button><button id="launcherAddExpense">＋ Expense</button><button id="launcherSync">↻ Sync now</button></div></section>`}
function makeHome(){return `<main class="desktop-home" id="desktopHome"><section class="home-hero"><div><span class="eyebrow">CONNECTED PERSONAL WORKSPACE</span><h1>Welcome back, <b id="desktopUser">User</b> <span>👋</span></h1><p id="desktopGreeting">Everything important, one glance away.</p></div><div class="hero-weather"><div class="weather-icon" id="heroWeatherIcon">◌</div><div><b id="heroTemp">Weather</b><span id="heroWeatherText">Location not enabled</span></div><div class="hero-date"><b id="desktopHeroDate">—</b><span id="desktopLocation">LifeDashPro Web</span></div></div></section><section class="home-widgets"><article class="glass-widget widget-today" data-workspace-route="today"><header><span>${svg('calendar')}</span><b>Today & Next 5</b></header><strong id="homeTodayCount">0 today</strong><div id="homeTodayList" class="mini-list"></div><button>Open timeline →</button></article><article class="glass-widget widget-weather"><header><span>${svg('compass')}</span><b>Live Weather</b></header><strong id="homeWeather">Location needed</strong><p id="homeWeatherMeta">Use your current location for live conditions.</p><button id="desktopLocate">Enable location →</button></article><article class="glass-widget widget-safety" data-workspace-route="explore"><header><span class="shield-mark">◇</span><b>Safety / Hazards</b></header><strong id="homeSafety">Live safety center</strong><p id="homeSafetyMeta">Earthquakes · fires · floods · alerts</p><button>Open safety center →</button></article><article class="glass-widget widget-finance" data-workspace-route="finance"><header><span>${svg('finance')}</span><b>Finance Snapshot</b></header><strong id="homeFinance">€0.00</strong><p id="homeFinanceMeta">This month balance</p><button>Open Finance →</button></article><article class="glass-widget widget-radio" data-workspace-route="radio"><header><span>${svg('radio')}</span><b>Radio Now Playing</b><em id="radioOnAir">READY</em></header><div class="radio-mini"><span class="radio-orb">BV</span><div><strong id="homeRadioName">Balkan Vibes</strong><p id="homeRadioMeta">Choose a station to start listening</p></div></div><button>Open Radio →</button></article><article class="glass-widget widget-explore" data-workspace-route="explore"><header><span>${svg('compass')}</span><b>Explore & Live</b></header><strong>Maps, road & live data</strong><p>Nearby · Safety · Road · Maritime</p><button>Open Explore →</button></article></section><section class="home-quick"><div><b>Quick actions</b><span>Jump straight into your day</span></div><button data-workspace-route="notes">＋ Note</button><button id="homeQuickExpense">＋ Expense</button><button data-workspace-route="route">⌖ Plan route</button><button data-workspace-route="documents">▣ Documents</button></section></main>`}
function makeStatus(){return `<section class="desktop-status"><div><i></i><b>System connected</b></div><span id="desktopSync">Secure cloud sync</span></section>`}
function build(){
 const appView=document.getElementById('appView'),page=document.getElementById('page');if(!appView||!page)return;
 document.body.classList.add('workspace-desktop');
 const root=document.createElement('div');root.id='lifeDashDesktop';root.className='desktop-root hidden';root.innerHTML=`<div class="desktop-aurora"></div>${makeTopbar()}<div class="desktop-canvas"><aside class="desktop-shortcuts left">${LEFT_SHORTCUTS.map(x=>makeShortcut(x,'left')).join('')}</aside>${makeHome()}<aside class="desktop-shortcuts right">${RIGHT_SHORTCUTS.map(x=>makeShortcut(x,'right')).join('')}<button class="desktop-add-shortcut" id="desktopAddShortcut">＋<span>Add shortcut</span></button></aside>${makeWindow()}${makeThemes()}${makeStatus()}${makeDock()}<button class="desktop-start" id="desktopStart" title="LifeDashPro launcher">${svg('dashboard')}</button>${makeLauncher()}</div>`;
 document.body.appendChild(root);W.root=root;W.window=root.querySelector('#desktopWindow');W.home=root.querySelector('#desktopHome');W.dock=root.querySelector('#desktopDock');W.launcher=root.querySelector('#desktopLauncher');root.querySelector('#desktopWindowBody').appendChild(page);
 bind();watchVisibility(appView);setDesktopTheme(themeNow(),false);tick();setInterval(tick,1000);syncRoute();
}
function watchVisibility(appView){const sync=()=>{const visible=!appView.classList.contains('hidden');W.root?.classList.toggle('hidden',!visible);if(visible){W.ready=true;hydrateThemeFromCloud();scheduleHome()}};sync();new MutationObserver(sync).observe(appView,{attributes:true,attributeFilter:['class']})}
function bind(){
 document.querySelectorAll('[data-workspace-route]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();openRoute(b.dataset.workspaceRoute)}));
 document.getElementById('desktopStart').onclick=toggleLauncher;document.getElementById('launcherClose').onclick=()=>W.launcher.classList.add('hidden');
 document.getElementById('desktopTheme').onclick=cycleTheme;document.getElementById('desktopNotify').onclick=()=>document.getElementById('notifyBtn')?.click();document.getElementById('desktopSettings').onclick=()=>openRoute('profile');document.getElementById('desktopQuick').onclick=()=>document.getElementById('quickAddBtn')?.click();
 document.querySelectorAll('[data-desktop-theme]').forEach(b=>b.onclick=()=>setDesktopTheme(b.dataset.desktopTheme));
 document.getElementById('windowMin').onclick=minimizeWindow;document.getElementById('windowMax').onclick=maximizeWindow;document.getElementById('windowClose').onclick=()=>openRoute('dashboard');
 document.getElementById('desktopLocate').onclick=()=>requestLocation(true);
 document.getElementById('homeQuickExpense').onclick=()=>{openRoute('finance');setTimeout(()=>document.querySelector('[data-add-tx]')?.click(),350)};
 document.getElementById('launcherAddNote').onclick=()=>{W.launcher.classList.add('hidden');openRoute('notes');setTimeout(()=>document.querySelector('[data-add-note]')?.click(),350)};
 document.getElementById('launcherAddExpense').onclick=()=>{W.launcher.classList.add('hidden');openRoute('finance');setTimeout(()=>document.querySelector('[data-add-tx]')?.click(),350)};
 document.getElementById('launcherSync').onclick=async()=>{W.launcher.classList.add('hidden');try{if(typeof loadAll==='function')await loadAll();toast?.('Workspace synced')}catch(e){toast?.(e.message||'Sync failed',true)}};
 document.getElementById('desktopAddShortcut').onclick=toggleLauncher;
 document.querySelectorAll('#launcherApps [data-workspace-route]').forEach(b=>b.addEventListener('click',()=>W.launcher.classList.add('hidden')));
 const s=document.getElementById('launcherSearch');s.oninput=()=>{const q=s.value.trim().toLowerCase();document.querySelectorAll('#launcherApps [data-app-name]').forEach(b=>b.classList.toggle('hidden',q&&!b.dataset.appName.includes(q)))};
 window.addEventListener('hashchange',syncRoute);document.addEventListener('click',e=>{if(!W.launcher||W.launcher.classList.contains('hidden'))return;if(e.target.closest('#desktopLauncher')||e.target.closest('#desktopStart'))return;W.launcher.classList.add('hidden')});
 setupDockMagnify();
}
function toggleLauncher(){W.launcher.classList.toggle('hidden');if(!W.launcher.classList.contains('hidden'))setTimeout(()=>document.getElementById('launcherSearch')?.focus(),50)}
function openRoute(id){if(!ROUTE_TITLES[id])id='dashboard';W.lastRoute=id;W.minimized=false;if(typeof setRoute==='function')setRoute(id);else location.hash=id;syncRoute()}
function syncRoute(){const r=routeNow();W.lastRoute=r;document.querySelectorAll('[data-workspace-route]').forEach(b=>b.classList.toggle('active',b.dataset.workspaceRoute===r));if(r==='dashboard'){W.window?.classList.add('hidden');W.home?.classList.remove('hidden');W.minimized=false}else{W.home?.classList.add('hidden');showWindow(r)}scheduleHome()}
function showWindow(route){if(!W.window)return;const a=appInfo(route);W.window.classList.remove('hidden','minimized');document.getElementById('windowTitle').textContent=ROUTE_TITLES[route]||a[1];document.getElementById('windowAppIcon').innerHTML=svg(a[2]);setTimeout(()=>window.dispatchEvent(new Event('resize')),220)}
function minimizeWindow(){if(!W.window)return;W.minimized=true;W.window.classList.add('minimized');W.home?.classList.remove('hidden')}
function maximizeWindow(){if(!W.window)return;W.maximized=!W.maximized;W.window.classList.toggle('maximized',W.maximized);document.getElementById('windowMax').textContent=W.maximized?'❐':'□';setTimeout(()=>window.dispatchEvent(new Event('resize')),220)}
function setupDockMagnify(){const dock=W.dock;if(!dock)return;const items=[...dock.querySelectorAll('.dock-app')];const reset=()=>items.forEach(i=>{i.style.setProperty('--dock-scale','1');i.style.setProperty('--dock-lift','0px');i.style.setProperty('--dock-space','0px')});dock.addEventListener('pointermove',e=>{items.forEach(i=>{const r=i.getBoundingClientRect(),cx=r.left+r.width/2,dist=Math.abs(e.clientX-cx),f=Math.max(0,1-dist/105);i.style.setProperty('--dock-scale',(1+f*.48).toFixed(3));i.style.setProperty('--dock-lift',`${(-f*15).toFixed(1)}px`);i.style.setProperty('--dock-space',`${(f*7).toFixed(1)}px`)})});dock.addEventListener('pointerleave',reset);reset()}
function tick(){const n=new Date(),clock=document.getElementById('desktopClock'),date=document.getElementById('desktopHeroDate');if(clock)clock.textContent=n.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});if(date)date.textContent=n.toLocaleDateString([],{weekday:'long',day:'2-digit',month:'short',year:'numeric'});const h=n.getHours(),g=document.getElementById('desktopGreeting');if(g)g.textContent=h<12?'Good morning. Your day is ready.':h<18?'Good afternoon. Everything important is in reach.':'Good evening. Your workspace is up to date.'}
function scheduleHome(){clearTimeout(W.homeTimer);W.homeTimer=setTimeout(renderHome,120)}
function renderHome(){if(!W.root||W.root.classList.contains('hidden'))return;try{
 const profile=typeof state!=='undefined'?state.profile:null,name=profile?.name||D?.session?.user?.user_metadata?.name||D?.session?.user?.email?.split('@')[0]||'User';const user=document.getElementById('desktopUser');if(user)user.textContent=String(name).split(' ')[0];
 const due=typeof dueItems==='function'?dueItems():[],today=localDay(),tod=due.filter(x=>x.date===today&&!x.overdue),next=due.filter(x=>x.date>today&&!x.overdue).slice(0,3);document.getElementById('homeTodayCount').textContent=`${tod.length} today · ${next.length} upcoming`;document.getElementById('homeTodayList').innerHTML=[...tod.slice(0,2),...next.slice(0,2)].slice(0,3).map(x=>`<span><i></i><b>${escapeText(x.title||'Item')}</b><em>${x.time||String(x.date||'').slice(5)}</em></span>`).join('')||'<span><b>Schedule clear</b><em>Nothing urgent</em></span>';
 const tx=col('finance_transactions'),m=today.slice(0,7),bal=tx.filter(x=>String(x.date||'').startsWith(m)).reduce((s,x)=>s+(x.type==='income'?1:-1)*Number(x.baseAmountAtEntry??x.amount??0),0),cur=profile?.currency||'EUR';document.getElementById('homeFinance').textContent=money(bal,cur);document.getElementById('homeFinanceMeta').textContent=`${tx.filter(x=>String(x.date||'').startsWith(m)).length} entries this month`;
 document.querySelectorAll('[data-shortcut-status]').forEach(x=>x.textContent=shortcutStatus(x.dataset.shortcutStatus));
 const audio=document.getElementById('audio'),audioName=document.getElementById('audioName')?.textContent||'Balkan Vibes';document.getElementById('homeRadioName').textContent=audioName;document.getElementById('homeRadioMeta').textContent=audio&&!audio.paused?'Playing now':'Choose a station to start listening';document.getElementById('radioOnAir').textContent=audio&&!audio.paused?'ON AIR':'READY';
 const sync=document.getElementById('syncStatus')?.textContent||'Secure cloud sync';document.getElementById('desktopSync').textContent=sync;
 if(!W.weather)requestLocation(false);
 }catch(e){console.warn('Desktop home update skipped',e)}}
function escapeText(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function requestLocation(force){if(!navigator.geolocation){weatherUnavailable('Geolocation unavailable');return}if(!force&&navigator.permissions?.query){try{const p=await navigator.permissions.query({name:'geolocation'});if(p.state!=='granted'){weatherUnavailable('Location not enabled');return}}catch{}}
 navigator.geolocation.getCurrentPosition(pos=>{W.geo={lat:pos.coords.latitude,lon:pos.coords.longitude};loadWeatherAndSafety()},()=>weatherUnavailable('Location permission needed'),{enableHighAccuracy:false,timeout:7000,maximumAge:600000})}
function weatherUnavailable(msg){const h=document.getElementById('homeWeatherMeta'),hero=document.getElementById('heroWeatherText');if(h)h.textContent=msg;if(hero)hero.textContent=msg}
async function loadWeatherAndSafety(){if(!W.geo)return;const {lat,lon}=W.geo;try{const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,apparent_temperature,weather_code&timezone=auto`);if(r.ok){const j=await r.json(),c=j.current||{};W.weather=c;const t=Math.round(Number(c.temperature_2m)),feel=Math.round(Number(c.apparent_temperature));document.getElementById('homeWeather').textContent=`${t}°C`;document.getElementById('homeWeatherMeta').textContent=`Feels like ${feel}°C · live conditions`;document.getElementById('heroTemp').textContent=`${t}°C`;document.getElementById('heroWeatherText').textContent=weatherLabel(c.weather_code);document.getElementById('heroWeatherIcon').textContent=weatherGlyph(c.weather_code);document.getElementById('desktopLocation').textContent='Current location'}}catch{}
 try{const r=await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson');if(r.ok){const j=await r.json(),near=(j.features||[]).map(f=>({mag:f.properties?.mag,coords:f.geometry?.coordinates})).filter(x=>Array.isArray(x.coords)&&distanceKm(lat,lon,x.coords[1],x.coords[0])<=300);W.hazard=near;document.getElementById('homeSafety').textContent=near.length?`${near.length} earthquake alert${near.length===1?'':'s'} nearby`:'No nearby earthquake alerts';document.getElementById('homeSafetyMeta').textContent=near.length?'Within 300 km · open Safety for details':'Earthquake check clear · open Safety for other hazards'}}catch{}}
function distanceKm(a,b,c,d){const R=6371,x=(c-a)*Math.PI/180,y=(d-b)*Math.PI/180,s=Math.sin(x/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(s))}
function weatherLabel(code){const c=Number(code);if(c===0)return'Clear sky';if(c<=3)return'Partly cloudy';if(c<=48)return'Fog';if(c<=67)return'Rain';if(c<=77)return'Snow';if(c<=82)return'Showers';if(c<=99)return'Thunderstorm';return'Live weather'}
function weatherGlyph(code){const c=Number(code);return c===0?'☀':c<=3?'⛅':c<=48?'≋':c<=82?'☂':c<=99?'ϟ':'◌'}
function hydrateThemeFromCloud(){try{const p=prefs(),t=p.desktopTheme;if(THEMES.some(x=>x[0]===t))setDesktopTheme(t,false)}catch{}}

try{if(typeof loadAll==='function'){const oldLoadAll=loadAll;loadAll=async function(){const r=await oldLoadAll();W.ready=true;hydrateThemeFromCloud();scheduleHome();return r}}}catch{}
try{if(typeof reload==='function'){const oldReload=reload;reload=async function(kind){const r=await oldReload(kind);scheduleHome();return r}}}catch{}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
})();
