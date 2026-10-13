/* LifeDashPro Web v1.23 — opt-in Desktop-style workspace, Cards v1+v2.
 * Non-destructive: reuses existing Dashboard modules and their real synced data.
 * No Supabase schema changes, no record writes, no new navigation engine.
 */
(()=>{
'use strict';
const root=document.querySelector('#content');
const app=document.querySelector('#appView');
const sidebar=document.querySelector('#nav');
if(!root||!app||!sidebar)return;
const bridge=()=>window.LifeDashDashboardBridge;
const loc=()=>window.LifeDashWebI18n?.locale?.()||'en';
const baseT=(k,alt)=>window.LifeDashWebI18n?.tr?.(k)||alt;
const dateLocale=()=>{
 const k=String(loc()||'en').split('-')[0].toLowerCase();
 return k==='cnr'||k==='me'?'sr-ME':k;
};
const PREFIX='lifedash_web_desktop_v123_';
const IDS=['today','weather','calendar','notes','budget','around','world','news','radio','vehicles','route'];
const SELECTORS={
 today:'.ldp119-today',weather:'.ldp123-weather',calendar:'.ldp123-calendar',
 notes:'.ldp121-notes',budget:'.ldp120-dashboard-budget',
 around:'.ldp119-around',world:'.ldp119-world',news:'.ldp119-news',
 radio:'.ldp123-radio',vehicles:'.ldp123-vehicles',route:'.ldp119-route'
};
const LABELS={
 today:'todayShort',notes:'notesShort',budget:'finance',around:'explore',
 world:'world',news:'news',route:'journey',calendar:'calendar',
 radio:'radio',vehicles:'vehicles'
};
const ICONS={
 today:'◷',weather:'☁',calendar:'▦',notes:'✎',budget:'€',
 around:'⌖',world:'◉',news:'▤',radio:'♫',vehicles:'◈',route:'🗺'
};
const COPY={
 desktop:['Desktop Mode','Десктоп режим','Desktop režim','Radna površina','Desktop način','Desktop režim','Namizni način','Настолен режим','Modaliteti desktop','Λειτουργία επιφάνειας','Mod desktop','Desktop-Modus'],
 classic:['Classic Mode','Класичен режим','Klasični režim','Klasični način','Klasični način','Klasični režim','Klasični način','Класически режим','Modaliteti klasik','Κλασική προβολή','Mod clasic','Klassischer Modus'],
 workspace:['Your workspace','Твојот работен простор','Tvoj radni prostor','Tvoj radni prostor','Tvoj radni prostor','Tvoj radni prostor','Tvoj delovni prostor','Твоето работно пространство','Hapësira jote e punës','Ο χώρος εργασίας σου','Spațiul tău de lucru','Dein Arbeitsbereich'],
 subtitle:['One place for your everyday apps','Сите твои секојдневни апликации на едно место','Sve tvoje aplikacije na jednom mestu','Sve aplikacije na jednom mjestu','Sve aplikacije na jednom mjestu','Sve aplikacije na jednom mjestu','Vse vsakdanje aplikacije na enem mestu','Всичките ти приложения на едно място','Të gjitha aplikacionet në një vend','Όλες οι εφαρμογές σου σε ένα μέρος','Toate aplicațiile într-un singur loc','Alle Alltags-Apps an einem Ort'],
 apps:['Quick launcher','Брзи апликации','Brze aplikacije','Brze aplikacije','Brze aplikacije','Brze aplikacije','Hitre aplikacije','Бърз достъп','Aplikacione të shpejta','Γρήγορη εκκίνηση','Acces rapid','Schnellstart'],
 customize:['Customize workspace','Уреди распоред','Uredi raspored','Uredi raspored','Uredi raspored','Uredi raspored','Uredi postavitev','Подреди екрана','Personalizo hapësirën','Προσαρμογή','Personalizează','Arbeitsbereich anpassen'],
 finish:['Done','Готово','Gotovo','Gotovo','Gotovo','Gotovo','Končano','Готово','Gati','Τέλος','Gata','Fertig'],
 reset:['Reset layout','Врати почетен распоред','Vrati početni raspored','Vrati početni raspored','Vrati početni raspored','Vrati početni raspored','Ponastavi postavitev','Върни подредбата','Rivendos paraqitjen','Επαναφορά διάταξης','Resetează aspectul','Layout zurücksetzen'],
 show:['Show','Прикажи','Prikaži','Prikaži','Prikaži','Prikaži','Prikaži','Покажи','Shfaq','Εμφάνιση','Arată','Anzeigen'],
 cardSize:['Card size','Големина','Veličina kartice','Veličina kartice','Veličina kartice','Veličina kartice','Velikost kartice','Размер','Madhësia e kartës','Μέγεθος κάρτας','Dimensiune','Kartengröße'],
 small:['Small','Мала','Mala','Mala','Mala','Mala','Majhna','Малка','E vogël','Μικρό','Mic','Klein'],
 medium:['Medium','Средна','Srednja','Srednja','Srednja','Srednja','Srednja','Средна','Mesatare','Μεσαίο','Mediu','Mittel'],
 large:['Large','Голема','Velika','Velika','Velika','Velika','Velika','Голяма','E madhe','Μεγάλο','Mare','Groß'],
 up:['Move up','Нагоре','Gore','Gore','Gore','Gore','Gor','Нагоре','Lart','Πάνω','Sus','Nach oben'],
 down:['Move down','Надолу','Dole','Dolje','Dolje','Dolje','Dol','Надолу','Poshtë','Κάτω','Jos','Nach unten'],
 weather:['Local weather','Време во градот','Vreme u gradu','Vrijeme u gradu','Vrijeme u gradu','Vrijeme u gradu','Lokalno vreme','Времето в града','Moti lokal','Τοπικός καιρός','Vreme locală','Wetter vor Ort'],
 weatherCheck:['Check weather','Провери време','Proveri vreme','Provjeri vrijeme','Provjeri vrijeme','Provjeri vrijeme','Preveri vreme','Провери времето','Kontrollo motin','Έλεγχος καιρού','Verifică vremea','Wetter abrufen'],
 weatherNoCity:['Set your city in Profile first.','Прво внеси град во Профил.','Prvo upiši grad u Profil.','Prvo unesi grad u Profil.','Prvo unesi grad u Profil.','Prvo unesi grad u Profil.','Najprej vnesi mesto v Profil.','Първо посочи град в профила.','Vendos qytetin në profil.','Όρισε πρώτα πόλη στο προφίλ.','Alege orașul în Profil.','Bitte zuerst Stadt im Profil festlegen.'],
 weatherOnDemand:['Updates only when you request it.','Се проверува само на твој клик.','Provera samo na klik.','Provjera samo na klik.','Provjera samo na klik.','Provjera samo na klik.','Preverjanje samo na klik.','Проверка само при натискане.','Kontroll vetëm me klikim.','Έλεγχος μόνο με κλικ.','Verificare la cerere.','Abruf nur auf Klick.'],
 weatherFail:['Weather unavailable. Please try again.','Времето не е достапно. Обиди се повторно.','Vremenska prognoza nije dostupna.','Prognoza trenutno nije dostupna.','Prognoza trenutno nije dostupna.','Prognoza nije dostupna.','Vreme trenutno ni na voljo.','Прогнозата е недостъпна.','Moti nuk është i disponueshëm.','Ο καιρός δεν είναι διαθέσιμος.','Prognoza nu este disponibilă.','Wetter derzeit nicht verfügbar.'],
 weatherLoading:['Loading weather…','Се проверува времето…','Učitavanje vremena…','Učitavanje prognoze…','Učitavanje prognoze…','Učitavanje vremena…','Nalagam vreme…','Зареждане на времето…','Duke ngarkuar motin…','Φόρτωση καιρού…','Se încarcă vremea…','Wetter wird geladen…'],
 upcoming:['Coming up','Претстојни','Predstojeće','Nadolazeće','Predstojeće','Predstojeće','Prihajajoče','Предстоящи','Në vijim','Προσεχώς','Urmează','Anstehende Termine'],
 noUpcoming:['No dated items in the next 10 days.','Нема записи со рок во следните 10 дена.','Nema rokova u sledećih 10 dana.','Nema rokova u sljedećih 10 dana.','Nema rokova u sljedećih 10 dana.','Nema rokova u sljedećih 10 dana.','Ni rokov v naslednjih 10 dneh.','Няма срокове в следващите 10 дни.','Pa afate në 10 ditët e ardhshme.','Δεν υπάρχουν προθεσμίες στις επόμενες 10 ημέρες.','Fără termene în următoarele 10 zile.','Keine Termine in den nächsten 10 Tagen.'],
 playing:['Radio player','Радио плеер','Radio plejer','Radio player','Radio player','Radio plejer','Radijski predvajalnik','Радио плеър','Radio','Ραδιόφωνο','Player radio','Radioplayer'],
 vehiclesTrips:['Vehicles & journeys','Возила и патувања','Vozila i putovanja','Vozila i putovanja','Vozila i putovanja','Vozila i putovanja','Vozila in potovanja','Превозни средства и пътувания','Automjete dhe udhëtime','Οχήματα και ταξίδια','Vehicule și călătorii','Fahrzeuge & Reisen'],
 fromAndroid:['Existing synced records','Постојни синхронизирани записи','Postojeći sinhronizovani zapisi','Postojeći sinkronizirani zapisi','Postojeći sinhronizovani zapisi','Postojeći sinhronizovani zapisi','Sinhronizirani zapisi','Синхронизирани записи','Regjistrime të sinkronizuara','Συγχρονισμένες εγγραφές','Înregistrări sincronizate','Synchronisierte Einträge'],
 weatherSource:['Source: Open-Meteo · on demand','Извор: Open-Meteo · по барање','Izvor: Open-Meteo · na zahtev','Izvor: Open-Meteo · na zahtjev','Izvor: Open-Meteo · na zahtjev','Izvor: Open-Meteo · na zahtjev','Vir: Open-Meteo · na zahtevo','Източник: Open-Meteo · при поискване','Burimi: Open-Meteo · sipas kërkesës','Πηγή: Open-Meteo · κατόπιν αιτήματος','Sursa: Open-Meteo · la cerere','Quelle: Open-Meteo · auf Abruf'],
};
const LANGS=['en','mk','sr','hr','bs','cnr','sl','bg','sq','el','ro','de'];
const name=(id)=>baseT(LABELS[id]||'', ({weather:'Weather',today:'Today',calendar:'Calendar',notes:'Notes',budget:'Finance',around:'Around Me',world:'World Live',news:'News & RSS',radio:'Radio',vehicles:'Vehicles',route:'Journey'})[id]||id);
function t(key){
 const raw=String(loc()||'en').split('-')[0].toLowerCase();
 const code=raw==='me'?'cnr':raw;
 const at=LANGS.indexOf(code);
 return COPY[key]?.[at<0?0:at]||key;
}
const E=(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=String(value);return n;};
const $=(s,node=document)=>node.querySelector(s);
const all=(s,node=document)=>Array.from(node.querySelectorAll(s));
const safeRead=(key)=>{
 try{return JSON.parse(localStorage.getItem(key)||'null')}
 catch{return null}
};
const save=(key,data)=>{
 try{localStorage.setItem(key,JSON.stringify(data));return true}catch{return false}
};
const defaults=()=>{
 const widths={today:'large',weather:'medium',calendar:'medium',notes:'medium',
  budget:'medium',around:'medium',world:'medium',news:'large',radio:'small',
  vehicles:'small',route:'medium'};
 return {mode:window.matchMedia?.('(min-width: 1000px)')?.matches?'desktop':'classic',
  order:IDS.slice(),sizes:widths,hidden:[]};
};
function normalize(prefs){
 const base=defaults();
 if(!prefs||typeof prefs!=='object'||Array.isArray(prefs))return base;
 const validOrder=Array.isArray(prefs.order)?prefs.order.filter(x=>IDS.includes(x)):[];
 const order=[...new Set(validOrder),...IDS.filter(x=>!validOrder.includes(x))];
 const sizes=Object.fromEntries(IDS.map(id=>[id,
  ['small','medium','large'].includes(prefs.sizes?.[id])?prefs.sizes[id]:base.sizes[id]]));
 return {mode:['classic','desktop'].includes(prefs.mode)?prefs.mode:base.mode,
  order,sizes,hidden:Array.isArray(prefs.hidden)?
   [...new Set(prefs.hidden.filter(k=>IDS.includes(k)))]:[]};
}
let uid='',settings=null,host=null,top=null,editing=false,dragged='',weatherState={};
function ready(){return Boolean(bridge()?.ready())&&!app.classList.contains('hidden')}
function stored(){return PREFIX+uid}
function persist(){if(uid&&settings)save(stored(),settings)}
function currentMode(){return settings?.mode||'classic'}
function navigate(page){
 const b=$('#nav button[data-page="'+page+'"]')||$('.mobile-nav button[data-page="'+page+'"]');
 if(b)b.click();
}
function makeButton(label,cls,click){
 const b=E('button',cls,label);b.type='button';b.addEventListener('click',click);return b;
}
function launchItems(){
 return [
  ['today','◷','today'],['calendar','▦','calendar'],['notes','✎','notes'],
  ['finance','€','budget'],['explore','⌖','around'],['world','◉','world'],
  ['news','▤','news'],['radio','♫','radio'],['vehicles','◈','vehicles'],
  ['journey','🗺','route']
 ];
}
function initModeSwitch(){
 let wrap=$('#ldp123ModeSwitch');
 if(wrap)return wrap;
 wrap=E('div','ldp123-mode-switch');wrap.id='ldp123ModeSwitch';
 const classic=makeButton(t('classic'),'ldp123-mode-choice',()=>changeMode('classic'));
 const desktop=makeButton(t('desktop'),'ldp123-mode-choice',()=>changeMode('desktop'));
 classic.dataset.mode='classic';desktop.dataset.mode='desktop';
 wrap.append(classic,desktop);
 const actions=$('.topbar .top-actions');
 if(actions)actions.prepend(wrap);
 return wrap;
}
function syncModeUI(){
 const container=initModeSwitch();
 for(const b of all('button[data-mode]',container)){
  const on=b.dataset.mode===currentMode();
  b.classList.toggle('is-active',on);
  b.setAttribute('aria-pressed',String(on));
  b.textContent=t(b.dataset.mode);
 }
 root.classList.toggle('ldp123-desktop',currentMode()==='desktop'&&!!$('#androidDashboardParityV119',root));
 root.classList.toggle('ldp123-classic',currentMode()!=='desktop');
 app.classList.toggle('ldp123-desktop-shell',currentMode()==='desktop');
}
function changeMode(mode){
 if(!settings||!['desktop','classic'].includes(mode))return;
 if(currentMode()===mode)return;
 const d=$('#androidDashboardParityV119',root);
 if(mode==='desktop'&&d?.classList.contains('ldp121-editing')){
  d.querySelector('#ldp121LayoutControls .ldp121-layout-button')?.click();
 }
 settings.mode=mode;editing=false;persist();syncModeUI();
 if(d){
  if(mode==='desktop')activate(d);
  else{
   d.classList.remove('ldp123-grid','ldp123-customizing');
   all('[data-desktop-key]',d).forEach(card=>{
    card.draggable=false;
    card.removeAttribute('data-desktop-hidden');
    card.removeAttribute('data-desktop-size');
   });
   document.dispatchEvent(new Event('lifedash:mode-change'));
  }
 }
}
function makeTop(){
 const existing=$('#ldp123DesktopTop',root);
 if(existing)return existing;
 const section=E('section','ldp123-desktop-top');section.id='ldp123DesktopTop';
 const hero=E('div','ldp123-hero');
 const main=E('div','ldp123-hero-main');
 main.append(E('p','ldp123-eyebrow','LIFEDASHPRO · DESKTOP WORKSPACE'),
  E('h2','',t('workspace')),E('p','ldp123-hero-subtitle',t('subtitle')));
 const clock=E('div','ldp123-clock');clock.id='ldp123Clock';
 const updateClock=()=>{
  const lang=dateLocale();
  const now=new Date();
  let clockText='',dateText='';
  try{
   clockText=new Intl.DateTimeFormat(lang,{hour:'2-digit',minute:'2-digit'}).format(now);
   dateText=new Intl.DateTimeFormat(lang,{weekday:'long',month:'short',day:'numeric'}).format(now);
  }catch(_){clockText=now.toLocaleTimeString();dateText=now.toLocaleDateString()}
  clock.replaceChildren(E('strong','',clockText),E('small','',dateText));
 };
 updateClock();
 hero.append(main,clock);
 section.append(hero);
 const apps=E('div','ldp123-apps');
 const label=E('div','ldp123-apps-heading');
 label.append(E('strong','',t('apps')),E('span','ldp123-app-count',String(launchItems().length)+' apps'));
 apps.append(label);
 const tray=E('nav','ldp123-launcher');
 tray.setAttribute('aria-label',t('apps'));
 for(const [page,icon,key] of launchItems()){
  const button=makeButton('', 'ldp123-app-shortcut',()=>navigate(page));
  button.dataset.launchPage=page;button.title=name(key);
  button.append(E('span','ldp123-app-icon',icon),E('small','',name(key)));
  tray.append(button);
 }
 apps.append(tray);section.append(apps);
 const dashboard=$('#androidDashboardParityV119',root);
 if(dashboard)dashboard.before(section);
 return section;
}
function cardOf(id,container=host){return container?.querySelector(SELECTORS[id]||'never')||null}
function readCalendar(){
 const snapshot=window.LifeDashCalendarBridge?.snapshot?.();
 if(!snapshot)return [];
 const dateKey=value=>{
  const m=String(value||'').match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/);
  if(!m)return '';
  const d=new Date(+m[1],+m[2]-1,+m[3],12);
  if(d.getFullYear()!==+m[1]||d.getMonth()+1!==+m[2]||d.getDate()!==+m[3])return '';
  return String(m[1])+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[3]).padStart(2,'0');
 };
 const mkDate=days=>{
  const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+days);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 };
 const today=mkDate(0),end=mkDate(10),items=[];
 const configs=[
  ['family_tasks','dueDate','✓','Task'],['notes','dueDate','✎','Note'],
  ['manual_reminders','dueDate','◷','Reminder'],['documents','expiresAt','▣','Document']
 ];
 for(const [kind,dateField,icon,caption] of configs){
  for(const record of snapshot[kind]||[]){
   if(record.status==='archived'||record.done===true||record.completed===true)continue;
   const date=dateKey(record[dateField]||record.scheduledFor||record.date||
    record.expiryDate||record.expirationDate);
   if(!date||date<today||date>end)continue;
   items.push({date,title:String(record.title||record.name||record.text||caption).slice(0,115),icon});
  }
 }
 items.sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title));
 return items.slice(0,3);
}
function makeCalendarCard(container){
 let card=cardOf('calendar',container);if(card)return card;
 card=E('section','ldp119-panel ldp123-aux ldp123-calendar');
 const head=E('div','ldp123-widget-heading');
 head.append(E('span','ldp123-widget-symbol','▦'),E('h3','',name('calendar')));
 head.append(makeButton('↗','ldp123-card-open',()=>navigate('calendar')));
 card.append(head);
 card.append(E('p','ldp123-widget-subtitle',t('upcoming')));
 const items=readCalendar();
 if(!items.length)card.append(E('p','ldp123-empty',t('noUpcoming')));
 for(const item of items){
  const line=makeButton('','ldp123-next-line',()=>navigate('calendar'));
  line.append(E('span','ldp123-next-icon',item.icon),E('strong','',item.title),E('small','',item.date));
  card.append(line);
 }
 container.append(card);return card;
}
function makeRadioCard(container){
 let card=cardOf('radio',container);if(card)return card;
 card=E('section','ldp119-panel ldp123-aux ldp123-radio');
 const head=E('div','ldp123-widget-heading');
 head.append(E('span','ldp123-widget-symbol','♫'),E('h3','',name('radio')));
 head.append(makeButton('↗','ldp123-card-open',()=>navigate('radio')));
 card.append(head);
 const nameNode=E('strong','ldp123-radio-name',
  $('#radioDockName')?.textContent||t('playing'));
 card.append(nameNode,E('p','ldp123-widget-subtitle',
  $('#radioDockStatus')?.textContent||t('playing')));
 card.append(makeButton('♫ '+t('playing'),'ldp123-primary-action',()=>navigate('radio')));
 container.append(card);return card;
}
function makeVehiclesCard(container){
 let card=cardOf('vehicles',container);if(card)return card;
 card=E('section','ldp119-panel ldp123-aux ldp123-vehicles');
 const head=E('div','ldp123-widget-heading');
 head.append(E('span','ldp123-widget-symbol','◈'),E('h3','',t('vehiclesTrips')));
 card.append(head);
 const snapshot=bridge()?.snapshot()||{};
 const list=E('div','ldp123-counts');
 for(const [key,page,number,symbol]of [
  ['vehicles','vehicles',(snapshot.vehicles||[]).length,'🚗'],
  ['route','journey',(snapshot.journey_plans_beta||[]).length,'🗺']
 ]){
  const button=makeButton('','ldp123-count-tile',()=>navigate(page));
  button.append(E('span','',symbol),E('strong','',number),E('small','',name(key)));
  list.append(button);
 }
 card.append(list,E('p','ldp123-widget-note',t('fromAndroid')));
 container.append(card);return card;
}
function weatherCode(code){
 if([0,1].includes(code))return ['☀','Clear'];
 if([2,3].includes(code))return ['☁','Cloudy'];
 if([45,48].includes(code))return ['☁','Fog'];
 if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code))return ['☂','Rain'];
 if([71,73,75,77,85,86].includes(code))return ['❄','Snow'];
 if([95,96,99].includes(code))return ['⚡','Thunderstorm'];
 return ['☁','Weather'];
}
async function getWeather(city){
 const locator=window.LifeDashExploreBridge;
 if(!locator?.ready?.()||typeof locator.cities!=='function')throw new Error('Geocoding unavailable');
 const matches=await locator.cities(city);
 const first=matches.find(x=>Number.isFinite(Number(x.lat))&&Number.isFinite(Number(x.lon)));
 if(!first)throw new Error('City not found');
 const lat=Number(first.lat),lon=Number(first.lon);
 if(Math.abs(lat)>90||Math.abs(lon)>180)throw new Error('Invalid coordinates');
 const u=new URL('https://api.open-meteo.com/v1/forecast');
 u.searchParams.set('latitude',String(lat));
 u.searchParams.set('longitude',String(lon));
 u.searchParams.set('current','temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m');
 u.searchParams.set('daily','temperature_2m_min,temperature_2m_max');
 u.searchParams.set('forecast_days','3');
 u.searchParams.set('timezone','auto');
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),10500);
 try{
  const response=await fetch(u.toString(),{signal:controller.signal,headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error('Weather HTTP '+response.status);
  const data=await response.json();
  const temp=Number(data?.current?.temperature_2m),code=Number(data?.current?.weather_code);
  if(!Number.isFinite(temp)||temp<-120||temp>70)throw new Error('Invalid weather data');
  const lo=Number(data?.daily?.temperature_2m_min?.[0]);
  const hi=Number(data?.daily?.temperature_2m_max?.[0]);
  return {city:String(first.label||city).slice(0,90),temp,code,
   low:Number.isFinite(lo)?lo:null,high:Number.isFinite(hi)?hi:null,
   updated:String(data?.current?.time||'').slice(0,30)};
 }finally{clearTimeout(timer)}
}
function makeWeatherCard(container){
 let card=cardOf('weather',container);if(card)return card;
 card=E('section','ldp119-panel ldp123-aux ldp123-weather');
 const head=E('div','ldp123-widget-heading');
 head.append(E('span','ldp123-widget-symbol','☁'),E('h3','',t('weather')));
 head.append(makeButton('↗','ldp123-card-open',()=>navigate('profile')));
 card.append(head);
 const city=String(bridge()?.profile()?.city||'').trim();
 card.append(E('p','ldp123-widget-subtitle',city||t('weatherNoCity')));
 const readout=E('div','ldp123-weather-output');
 readout.setAttribute('role','status');readout.setAttribute('aria-live','polite');
 const status=E('p','ldp123-widget-note',t('weatherOnDemand'));
 card.append(readout,status);
 const action=makeButton(t('weatherCheck'),'ldp123-primary-action',async()=>{
  if(!city){navigate('profile');return}
  if(action.disabled)return;
  action.disabled=true;status.textContent=t('weatherLoading');
  try{
   const next=await getWeather(city);
   if(!card.isConnected||!ready()||!uid)return;
   const glyph=weatherCode(next.code)[0];
   readout.replaceChildren(E('span','ldp123-weather-glyph',glyph),
    E('strong','',Math.round(next.temp)+'°C'));
   if(next.low!==null&&next.high!==null)
    readout.append(E('small','',
     Math.round(next.low)+'° / '+Math.round(next.high)+'°C'));
   status.textContent=t('weatherSource')+' · '+next.city;
  }catch(_){
   status.textContent=t('weatherFail');
  }finally{action.disabled=false}
 });
 card.append(action);
 container.append(card);return card;
}
function makeAux(container){
 makeWeatherCard(container);makeCalendarCard(container);makeRadioCard(container);makeVehiclesCard(container);
}
function makeControls(container){
 let toolbar=$('#ldp123LayoutToolbar',container);
 if(toolbar)return toolbar;
 toolbar=E('section','ldp123-layout-toolbar');toolbar.id='ldp123LayoutToolbar';
 const title=E('div','ldp123-layout-title');
 title.append(E('strong','',t('workspace')),E('small','',t('subtitle')));
 const actions=E('div','ldp123-toolbar-actions');
 const toggle=makeButton(t('customize'),'ldp123-customize',()=>{
  editing=!editing;container.classList.toggle('ldp123-customizing',editing);
  toggle.textContent=editing?t('finish'):t('customize');
  toggle.setAttribute('aria-pressed',String(editing));
  settingsPanel.hidden=!editing;
  if(editing)drawManager(container,settingsPanel);
  applyLayout(container);
 });
 toggle.setAttribute('aria-pressed','false');
 const reset=makeButton(t('reset'),'ldp123-reset',()=>{
  if(!window.confirm(t('reset')+'?'))return;
  const base=defaults();
  settings.order=base.order;settings.sizes=base.sizes;settings.hidden=[];
  persist();applyLayout(container);drawManager(container,settingsPanel);
 });
 actions.append(toggle,reset);
 toolbar.append(title,actions);
 const settingsPanel=E('section','ldp123-manager');
 settingsPanel.id='ldp123Manager';settingsPanel.hidden=true;
 toolbar.append(settingsPanel);
 container.prepend(toolbar);
 // The existing Classic toolbar remains in the DOM and is hidden by Desktop CSS.
 let dragKey='';
 container.addEventListener('dragstart',event=>{
  if(!editing||currentMode()!=='desktop')return;
  const card=event.target.closest('[data-desktop-key]');
  if(!card||card.dataset.desktopHidden==='true')return;
  dragKey=card.dataset.desktopKey;
  if(event.dataTransfer){
   event.dataTransfer.effectAllowed='move';
   event.dataTransfer.setData('text/plain',dragKey);
  }
 });
 container.addEventListener('dragover',event=>{
  if(!editing||!dragKey||currentMode()!=='desktop')return;
  if(event.target.closest('[data-desktop-key]'))event.preventDefault();
 });
 container.addEventListener('drop',event=>{
  if(!editing||!dragKey||currentMode()!=='desktop')return;
  const dest=event.target.closest('[data-desktop-key]')?.dataset.desktopKey;
  if(dest&&dest!==dragKey){
   event.preventDefault();
   settings.order=changeOrder(settings.order,dragKey,dest);
   persist();applyLayout(container);drawManager(container,settingsPanel);
  }
  dragKey='';
 });
 container.addEventListener('dragend',()=>{dragKey=''});
 return toolbar;
}
function changeOrder(order,source,target){
 const ids=order.slice(),from=ids.indexOf(source),to=ids.indexOf(target);
 if(from<0||to<0||from===to)return ids;
 ids.splice(from,1);ids.splice(to,0,source);
 return ids;
}
function drawManager(container,panel){
 panel.replaceChildren();
 const wrap=E('div','ldp123-manager-grid');
 for(const [idx,id] of settings.order.entries()){
  const card=cardOf(id,container);
  if(!card)continue;
  const item=E('div','ldp123-manager-item');
  item.append(E('span','ldp123-manager-icon',ICONS[id]||'◈'));
  const visibleLabel=E('label','ldp123-manager-visibility');
  const cb=E('input');cb.type='checkbox';cb.checked=!settings.hidden.includes(id);
  cb.setAttribute('aria-label',t('show')+' '+name(id));
  cb.addEventListener('change',()=>{
   if(cb.checked)settings.hidden=settings.hidden.filter(x=>x!==id);
   else settings.hidden=[...new Set([...settings.hidden,id])];
   persist();applyLayout(container);
  });
  visibleLabel.append(cb,E('strong','',name(id)));item.append(visibleLabel);
  const size=E('select','ldp123-size-select');
  size.setAttribute('aria-label',t('cardSize')+' '+name(id));
  for(const key of ['small','medium','large']){
   const option=E('option','',t(key));option.value=key;size.append(option);
  }
  size.value=settings.sizes[id];
  size.addEventListener('change',()=>{
   settings.sizes[id]=size.value;
   persist();applyLayout(container);
  });
  item.append(size);
  const arrows=E('div','ldp123-manager-movers');
  const up=makeButton('↑','ldp123-arrow',()=>move(id,-1));
  const down=makeButton('↓','ldp123-arrow',()=>move(id,1));
  up.disabled=idx===0;down.disabled=idx===settings.order.length-1;
  up.setAttribute('aria-label',t('up')+' '+name(id));
  down.setAttribute('aria-label',t('down')+' '+name(id));
  arrows.append(up,down);item.append(arrows);wrap.append(item);
 }
 panel.append(wrap);
}
function move(id,dir){
 const from=settings.order.indexOf(id),to=from+dir;
 if(from<0||to<0||to>=settings.order.length)return;
 const target=settings.order[to];
 settings.order=changeOrder(settings.order,id,target);
 persist();applyLayout(host);
 const panel=$('#ldp123Manager',host);
 if(panel&&!panel.hidden)drawManager(host,panel);
}
function applyLayout(container){
 if(!settings||!container||currentMode()!=='desktop')return;
 container.classList.add('ldp123-grid');
 const cards={};
 for(const id of IDS){
  const node=cardOf(id,container);
  if(!node)continue;
  cards[id]=node;
  node.dataset.desktopKey=id;
  node.dataset.desktopSize=settings.sizes[id];
  node.dataset.desktopHidden=settings.hidden.includes(id)?'true':'false';
  node.draggable=editing&&!settings.hidden.includes(id);
 }
 const ctl=$('#ldp123LayoutToolbar',container);
 if(!ctl)return;
 let cursor=ctl;
 for(const id of settings.order){
  const card=cards[id];if(!card)continue;
  if(card.previousElementSibling!==cursor)cursor.after(card);
  cursor=card;
 }
 container.classList.toggle('ldp123-customizing',editing);
}
function activate(container){
 makeTop();makeAux(container);makeControls(container);
 applyLayout(container);
}
function sync(){
 if(!ready()){
  if(uid){
   uid='';settings=null;host=null;top=null;editing=false;dragged='';weatherState={};
   root.classList.remove('ldp123-desktop','ldp123-classic');
   app.classList.remove('ldp123-desktop-shell');
   $('#ldp123ModeSwitch')?.remove();
  }
  return;
 }
 const identity=bridge().identity();
 if(!identity)return;
 if(uid!==identity){
  uid=identity;settings=normalize(safeRead(stored()));host=null;top=null;editing=false;
 }
 const container=$('#androidDashboardParityV119',root);
 syncModeUI();
 if(!container||container.dataset.readyFor!==identity)return;
 if(currentMode()==='desktop'){
  if(host!==container){host=container;editing=false;activate(container)}
  else if(!$('#ldp123LayoutToolbar',container))activate(container);
  else{
   const cards=IDS.filter(id=>cardOf(id,container));
   const ordered=all(':scope > [data-desktop-key]',container).map(n=>n.dataset.desktopKey);
   if(ordered.join('|')!==settings.order.filter(x=>cards.includes(x)).join('|'))applyLayout(container);
  }
 }else{
  host=container;
  container.classList.remove('ldp123-grid','ldp123-customizing');
  editing=false;
 }
}
let queued=false;
const schedule=()=>{
 if(queued)return;queued=true;
 queueMicrotask(()=>{queued=false;sync()});
};
new MutationObserver(schedule).observe(root,{childList:true});
new MutationObserver(schedule).observe(app,{attributes:true,attributeFilter:['class']});
document.addEventListener('lifedash:locale-change',()=>{
 if(!ready())return;
 const oldMode=currentMode();
 const topbar=$('#ldp123ModeSwitch');
 for(const b of all('[data-mode]',topbar||document)){
  b.textContent=t(b.dataset.mode);
 }
 const desktopTop=$('#ldp123DesktopTop',root);
 if(desktopTop&&oldMode==='desktop'){
  desktopTop.remove();
  makeTop();
 }
 const container=$('#androidDashboardParityV119',root);
 if(container){
  const toolbar=$('#ldp123LayoutToolbar',container);
  if(toolbar){
   toolbar.querySelector('.ldp123-layout-title strong').textContent=t('workspace');
   toolbar.querySelector('.ldp123-layout-title small').textContent=t('subtitle');
   toolbar.querySelector('.ldp123-customize').textContent=editing?t('finish'):t('customize');
   toolbar.querySelector('.ldp123-reset').textContent=t('reset');
   const panel=$('#ldp123Manager',container);
   if(panel&&!panel.hidden)drawManager(container,panel);
  }
 }
});
sync();
})();