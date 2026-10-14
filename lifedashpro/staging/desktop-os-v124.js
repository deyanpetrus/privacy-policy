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
const LOCALE={"en":{"start":"Start","apps":"All applications","search":"Search apps…","windows":"Open windows","desktop":"Desktop","classic":"Classic","customize":"Customize","widgets":"Widgets","background":"Background","restore":"Restore workspace","empty":"No open windows","hint":"Open an application from Start or a desktop icon.","weather":"Weather","waiting":"Upcoming","noEvents":"No items for this period","save":"Saving workspace…","saved":"Workspace saved ✓","offline":"Saved on this device · cloud unavailable","max":"Up to 8 apps can stay open at once.","close":"Close","min":"Minimize","maximize":"Maximize","again":"Restore","show":"Show","hide":"Hide","pin":"Pin","unpin":"Unpin","reload":"Reload app","starting":"Starting application…","stalled":"Application is taking too long. Reload this window.","todayLabel":"Today","nextTen":"Next 10 days","waitingLate":"Waiting","more":"More","newsCountry":"News country","global":"Global","balkans":"Balkans","newsRefresh":"Refresh headlines","newsLoading":"Loading headlines…","newsEmpty":"Headlines unavailable","openNews":"Open news","paused":"Paused to save memory. Select Resume to continue.","resume":"Resume","notes":"Notes","tasks":"Tasks","reminders":"Reminders","documents":"Documents","birthdays":"Birthdays","finance":"Finance","todaySummary":"Today · Next 10 days"},"mk":{"start":"Старт","apps":"Сите апликации","search":"Пребарај апликации…","windows":"Отворени прозорци","desktop":"Десктоп","classic":"Класичен","customize":"Прилагоди","widgets":"Виџети","background":"Позадина","restore":"Врати работен простор","empty":"Нема отворени прозорци","hint":"Отвори апликација од Старт или преку икона.","weather":"Време","waiting":"Претстојни","noEvents":"Нема записи за овој период","save":"Се зачувува работниот простор…","saved":"Работниот простор е зачуван ✓","offline":"Зачувано на уредот · нема cloud","max":"Може да останат отворени до 8 апликации.","close":"Затвори","min":"Минимизирај","maximize":"Максимизирај","again":"Врати","show":"Прикажи","hide":"Сокриј","pin":"Закачи","unpin":"Откачи","reload":"Освежи ја апликацијата","starting":"Се отвора апликацијата…","stalled":"Апликацијата предолго се вчитува. Освежи го овој прозорец.","todayLabel":"Денес","nextTen":"Следни 10 дена","waitingLate":"Чекаат","more":"уште","newsCountry":"Држава за вести","global":"Свет","balkans":"Балкан","newsRefresh":"Освежи вести","newsLoading":"Се вчитуваат вестите…","newsEmpty":"Вестите не се достапни","openNews":"Отвори вести","paused":"Паузирано за заштеда на меморија. Притисни Продолжи.","resume":"Продолжи","notes":"Белешки","tasks":"Задачи","reminders":"Потсетници","documents":"Документи","birthdays":"Родендени","finance":"Финансии","todaySummary":"Денес · Следни 10 дена"},"de":{"start":"Start","apps":"Alle Apps","search":"Apps suchen…","windows":"Offene Fenster","desktop":"Desktop","classic":"Klassisch","customize":"Anpassen","widgets":"Widgets","background":"Hintergrund","restore":"Arbeitsbereich wiederherstellen","empty":"Keine offenen Fenster","hint":"App über Start oder Desktop-Symbol öffnen.","weather":"Wetter","waiting":"Demnächst","noEvents":"Keine Einträge für diesen Zeitraum","save":"Arbeitsbereich speichern…","saved":"Arbeitsbereich gespeichert ✓","offline":"Lokal gespeichert · Cloud nicht verfügbar","max":"Bis zu 8 Apps können gleichzeitig geöffnet sein.","close":"Schließen","min":"Minimieren","maximize":"Maximieren","again":"Wiederherstellen","show":"Anzeigen","hide":"Verbergen","pin":"Anheften","unpin":"Lösen","reload":"App neu laden","starting":"Anwendung wird gestartet…","stalled":"Die Anwendung lädt zu lange. Dieses Fenster neu laden.","todayLabel":"Heute","nextTen":"Nächste 10 Tage","waitingLate":"Überfällig","more":"weitere","newsCountry":"Nachrichtenland","global":"Welt","balkans":"Balkan","newsRefresh":"Nachrichten aktualisieren","newsLoading":"Nachrichten werden geladen…","newsEmpty":"Keine Nachrichten verfügbar","openNews":"Nachrichten öffnen","paused":"Zum Speichersparen pausiert. Mit Fortsetzen weiter.","resume":"Fortsetzen","notes":"Notizen","tasks":"Aufgaben","reminders":"Erinnerungen","documents":"Dokumente","birthdays":"Geburtstage","finance":"Finanzen","todaySummary":"Heute · Nächste 10 Tage"},"sr":{"start":"Start","apps":"Sve aplikacije","search":"Pretraži aplikacije…","windows":"Otvoreni prozori","desktop":"Desktop","classic":"Klasično","customize":"Prilagodi","widgets":"Vidžeti","background":"Pozadina","restore":"Vrati radni prostor","empty":"Nema otvorenih prozora","hint":"Otvori aplikaciju iz Start menija ili sa radne površine.","weather":"Vreme","waiting":"Predstojeće","noEvents":"Nema stavki za ovaj period","save":"Čuvanje radnog prostora…","saved":"Radni prostor je sačuvan ✓","offline":"Sačuvano lokalno · oblak nije dostupan","max":"Najviše 8 aplikacija može biti otvoreno.","close":"Zatvori","min":"Minimizuj","maximize":"Uvećaj","again":"Vrati","show":"Prikaži","hide":"Sakrij","pin":"Zakači","unpin":"Otkači","reload":"Osveži aplikaciju","starting":"Pokretanje aplikacije…","stalled":"Aplikacija se predugo učitava. Osveži ovaj prozor.","todayLabel":"Danas","nextTen":"Sledećih 10 dana","waitingLate":"Čekaju","more":"više","newsCountry":"Država vesti","global":"Svet","balkans":"Balkan","newsRefresh":"Osveži vesti","newsLoading":"Učitavanje vesti…","newsEmpty":"Vesti nisu dostupne","openNews":"Otvori vesti","paused":"Pauzirano radi uštede memorije. Pritisni Nastavi.","resume":"Nastavi","notes":"Beleške","tasks":"Zadaci","reminders":"Podsetnici","documents":"Dokumenti","birthdays":"Rođendani","finance":"Finansije","todaySummary":"Danas · Sledećih 10 dana"},"hr":{"start":"Start","apps":"Sve aplikacije","search":"Pretraži aplikacije…","windows":"Otvoreni prozori","desktop":"Radna površina","classic":"Klasično","customize":"Prilagodi","widgets":"Widgeti","background":"Pozadina","restore":"Vrati radni prostor","empty":"Nema otvorenih prozora","hint":"Otvori aplikaciju iz Start izbornika ili s radne površine.","weather":"Vrijeme","waiting":"Nadolazeće","noEvents":"Nema stavki za ovo razdoblje","save":"Spremanje radnog prostora…","saved":"Radni prostor je spremljen ✓","offline":"Spremljeno na uređaju · oblak nije dostupan","max":"Može biti otvoreno najviše 8 aplikacija.","close":"Zatvori","min":"Minimiziraj","maximize":"Povećaj","again":"Vrati","show":"Prikaži","hide":"Sakrij","pin":"Prikvači","unpin":"Otkvači","reload":"Osvježi aplikaciju","starting":"Pokretanje aplikacije…","stalled":"Aplikacija se predugo učitava. Osvježi ovaj prozor.","todayLabel":"Danas","nextTen":"Sljedećih 10 dana","waitingLate":"Čekaju","more":"više","newsCountry":"Država vijesti","global":"Svijet","balkans":"Balkan","newsRefresh":"Osvježi vijesti","newsLoading":"Učitavanje vijesti…","newsEmpty":"Vijesti nisu dostupne","openNews":"Otvori vijesti","paused":"Pauzirano radi uštede memorije. Pritisni Nastavi.","resume":"Nastavi","notes":"Bilješke","tasks":"Zadaci","reminders":"Podsjetnici","documents":"Dokumenti","birthdays":"Rođendani","finance":"Financije","todaySummary":"Danas · Sljedećih 10 dana"},"bs":{"start":"Start","apps":"Sve aplikacije","search":"Pretraži aplikacije…","windows":"Otvoreni prozori","desktop":"Desktop","classic":"Klasično","customize":"Prilagodi","widgets":"Vidžeti","background":"Pozadina","restore":"Vrati radni prostor","empty":"Nema otvorenih prozora","hint":"Otvori aplikaciju iz Start menija ili s radne površine.","weather":"Vrijeme","waiting":"Predstojeće","noEvents":"Nema stavki za ovaj period","save":"Čuvanje radnog prostora…","saved":"Radni prostor je sačuvan ✓","offline":"Sačuvano lokalno · oblak nije dostupan","max":"Može biti otvoreno najviše 8 aplikacija.","close":"Zatvori","min":"Minimiziraj","maximize":"Povećaj","again":"Vrati","show":"Prikaži","hide":"Sakrij","pin":"Zakači","unpin":"Otkači","reload":"Osvježi aplikaciju","starting":"Pokretanje aplikacije…","stalled":"Aplikacija se predugo učitava. Osvježi ovaj prozor.","todayLabel":"Danas","nextTen":"Sljedećih 10 dana","waitingLate":"Čekaju","more":"više","newsCountry":"Država vijesti","global":"Svijet","balkans":"Balkan","newsRefresh":"Osvježi vijesti","newsLoading":"Učitavanje vijesti…","newsEmpty":"Vijesti nisu dostupne","openNews":"Otvori vijesti","paused":"Pauzirano radi uštede memorije. Pritisni Nastavi.","resume":"Nastavi","notes":"Bilješke","tasks":"Zadaci","reminders":"Podsjetnici","documents":"Dokumenti","birthdays":"Rođendani","finance":"Finansije","todaySummary":"Danas · Sljedećih 10 dana"},"cnr":{"start":"Start","apps":"Sve aplikacije","search":"Pretraži aplikacije…","windows":"Otvoreni prozori","desktop":"Desktop","classic":"Klasično","customize":"Prilagodi","widgets":"Vidžeti","background":"Pozadina","restore":"Vrati radni prostor","empty":"Nema otvorenih prozora","hint":"Otvori aplikaciju iz Start menija ili s radne površine.","weather":"Vrijeme","waiting":"Predstojeće","noEvents":"Nema stavki za ovaj period","save":"Čuvanje radnog prostora…","saved":"Radni prostor je sačuvan ✓","offline":"Sačuvano na uređaju · oblak nije dostupan","max":"Može biti otvoreno najviše 8 aplikacija.","close":"Zatvori","min":"Minimiziraj","maximize":"Povećaj","again":"Vrati","show":"Prikaži","hide":"Sakrij","pin":"Zakači","unpin":"Otkači","reload":"Osvježi aplikaciju","starting":"Pokretanje aplikacije…","stalled":"Aplikacija se predugo učitava. Osvježi ovaj prozor.","todayLabel":"Danas","nextTen":"Sljedećih 10 dana","waitingLate":"Čekaju","more":"više","newsCountry":"Država vijesti","global":"Svijet","balkans":"Balkan","newsRefresh":"Osvježi vijesti","newsLoading":"Učitavanje vijesti…","newsEmpty":"Vijesti nijesu dostupne","openNews":"Otvori vijesti","paused":"Pauzirano radi uštede memorije. Pritisni Nastavi.","resume":"Nastavi","notes":"Bilješke","tasks":"Zadaci","reminders":"Podsjetnici","documents":"Dokumenti","birthdays":"Rođendani","finance":"Finansije","todaySummary":"Danas · Sljedećih 10 dana"},"sl":{"start":"Start","apps":"Vse aplikacije","search":"Poišči aplikacije…","windows":"Odprta okna","desktop":"Namizje","classic":"Klasično","customize":"Prilagodi","widgets":"Pripomočki","background":"Ozadje","restore":"Obnovi delovni prostor","empty":"Ni odprtih oken","hint":"Odpri aplikacijo iz menija Start ali z namizja.","weather":"Vreme","waiting":"Prihajajoče","noEvents":"Ni zapisov za to obdobje","save":"Shranjevanje delovnega prostora…","saved":"Delovni prostor shranjen ✓","offline":"Shranjeno lokalno · oblak ni na voljo","max":"Odprtih je lahko največ 8 aplikacij.","close":"Zapri","min":"Pomanjšaj","maximize":"Povečaj","again":"Obnovi","show":"Prikaži","hide":"Skrij","pin":"Pripni","unpin":"Odpni","reload":"Osveži aplikacijo","starting":"Zagon aplikacije…","stalled":"Aplikacija se predolgo nalaga. Osveži to okno.","todayLabel":"Danes","nextTen":"Naslednjih 10 dni","waitingLate":"Čakajo","more":"več","newsCountry":"Država novic","global":"Svet","balkans":"Balkan","newsRefresh":"Osveži novice","newsLoading":"Nalagam novice…","newsEmpty":"Novice niso na voljo","openNews":"Odpri novice","paused":"Začasno ustavljeno zaradi pomnilnika. Izberi Nadaljuj.","resume":"Nadaljuj","notes":"Zapiski","tasks":"Naloge","reminders":"Opomniki","documents":"Dokumenti","birthdays":"Rojstni dnevi","finance":"Finance","todaySummary":"Danes · Naslednjih 10 dni"},"bg":{"start":"Старт","apps":"Всички приложения","search":"Търси приложения…","windows":"Отворени прозорци","desktop":"Работен плот","classic":"Класически","customize":"Персонализирай","widgets":"Уиджети","background":"Фон","restore":"Възстанови работния плот","empty":"Няма отворени прозорци","hint":"Отвори приложение от Старт или икона на работния плот.","weather":"Време","waiting":"Предстоящи","noEvents":"Няма записи за този период","save":"Запазване на работното пространство…","saved":"Работното пространство е запазено ✓","offline":"Запазено на устройството · облакът е недостъпен","max":"Могат да бъдат отворени до 8 приложения.","close":"Затвори","min":"Минимизирай","maximize":"Максимизирай","again":"Възстанови","show":"Покажи","hide":"Скрий","pin":"Закачи","unpin":"Откачи","reload":"Презареди приложението","starting":"Приложението се зарежда…","stalled":"Приложението се зарежда твърде дълго. Презареди прозореца.","todayLabel":"Днес","nextTen":"Следващи 10 дни","waitingLate":"Чакат","more":"още","newsCountry":"Държава за новини","global":"Свят","balkans":"Балкани","newsRefresh":"Опресни новините","newsLoading":"Зареждане на новини…","newsEmpty":"Новините са недостъпни","openNews":"Отвори новини","paused":"Паузирано за пестене на памет. Избери Продължи.","resume":"Продължи","notes":"Бележки","tasks":"Задачи","reminders":"Напомняния","documents":"Документи","birthdays":"Рождени дни","finance":"Финанси","todaySummary":"Днес · Следващи 10 дни"},"sq":{"start":"Start","apps":"Të gjitha aplikacionet","search":"Kërko aplikacione…","windows":"Dritare të hapura","desktop":"Desktop","classic":"Klasike","customize":"Personalizo","widgets":"Miniaplikacione","background":"Sfondi","restore":"Rikthe hapësirën e punës","empty":"Nuk ka dritare të hapura","hint":"Hap aplikacionin nga Start ose ikona në desktop.","weather":"Moti","waiting":"Në vijim","noEvents":"Nuk ka të dhëna për këtë periudhë","save":"Duke ruajtur hapësirën e punës…","saved":"Hapësira e punës u ruajt ✓","offline":"Ruajtur në pajisje · reja nuk është e disponueshme","max":"Mund të jenë të hapura deri në 8 aplikacione.","close":"Mbyll","min":"Minimizo","maximize":"Maksimizo","again":"Rikthe","show":"Shfaq","hide":"Fshih","pin":"Fikso","unpin":"Hiq fiksimin","reload":"Ringarko aplikacionin","starting":"Duke hapur aplikacionin…","stalled":"Aplikacioni po ngarkohet shumë gjatë. Ringarko këtë dritare.","todayLabel":"Sot","nextTen":"10 ditët e ardhshme","waitingLate":"Në pritje","more":"të tjera","newsCountry":"Vendi i lajmeve","global":"Bota","balkans":"Ballkani","newsRefresh":"Rifresko lajmet","newsLoading":"Duke ngarkuar lajmet…","newsEmpty":"Lajmet nuk janë të disponueshme","openNews":"Hap lajmet","paused":"Pauzuar për të kursyer memorie. Shtyp Vazhdo.","resume":"Vazhdo","notes":"Shënime","tasks":"Detyra","reminders":"Kujtues","documents":"Dokumente","birthdays":"Ditëlindje","finance":"Financa","todaySummary":"Sot · 10 ditët e ardhshme"},"el":{"start":"Έναρξη","apps":"Όλες οι εφαρμογές","search":"Αναζήτηση εφαρμογών…","windows":"Ανοιχτά παράθυρα","desktop":"Επιφάνεια εργασίας","classic":"Κλασική προβολή","customize":"Προσαρμογή","widgets":"Γραφικά στοιχεία","background":"Φόντο","restore":"Επαναφορά χώρου εργασίας","empty":"Δεν υπάρχουν ανοιχτά παράθυρα","hint":"Άνοιξε μια εφαρμογή από την Έναρξη ή το εικονίδιο.","weather":"Καιρός","waiting":"Προσεχώς","noEvents":"Δεν υπάρχουν εγγραφές","save":"Αποθήκευση χώρου εργασίας…","saved":"Ο χώρος εργασίας αποθηκεύτηκε ✓","offline":"Τοπική αποθήκευση · το cloud δεν είναι διαθέσιμο","max":"Μπορούν να είναι ανοιχτές έως 8 εφαρμογές.","close":"Κλείσιμο","min":"Ελαχιστοποίηση","maximize":"Μεγιστοποίηση","again":"Επαναφορά","show":"Εμφάνιση","hide":"Απόκρυψη","pin":"Καρφίτσωμα","unpin":"Ξεκαρφίτσωμα","reload":"Επαναφόρτωση εφαρμογής","starting":"Εκκίνηση εφαρμογής…","stalled":"Η εφαρμογή αργεί πολύ. Επαναφόρτωσε αυτό το παράθυρο.","todayLabel":"Σήμερα","nextTen":"Επόμενες 10 ημέρες","waitingLate":"Εκκρεμούν","more":"ακόμη","newsCountry":"Χώρα ειδήσεων","global":"Παγκόσμια","balkans":"Βαλκάνια","newsRefresh":"Ανανέωση ειδήσεων","newsLoading":"Φόρτωση ειδήσεων…","newsEmpty":"Οι ειδήσεις δεν είναι διαθέσιμες","openNews":"Άνοιγμα ειδήσεων","paused":"Παύση για εξοικονόμηση μνήμης. Πάτησε Συνέχεια.","resume":"Συνέχεια","notes":"Σημειώσεις","tasks":"Εργασίες","reminders":"Υπενθυμίσεις","documents":"Έγγραφα","birthdays":"Γενέθλια","finance":"Οικονομικά","todaySummary":"Σήμερα · Επόμενες 10 ημέρες"},"ro":{"start":"Start","apps":"Toate aplicațiile","search":"Caută aplicații…","windows":"Ferestre deschise","desktop":"Desktop","classic":"Clasic","customize":"Personalizează","widgets":"Widgeturi","background":"Fundal","restore":"Restaurează spațiul de lucru","empty":"Nu sunt ferestre deschise","hint":"Deschide o aplicație din Start sau de pe desktop.","weather":"Vremea","waiting":"Urmează","noEvents":"Nu există înregistrări în această perioadă","save":"Se salvează spațiul de lucru…","saved":"Spațiul de lucru a fost salvat ✓","offline":"Salvat local · cloud indisponibil","max":"Se pot deschide până la 8 aplicații.","close":"Închide","min":"Minimizează","maximize":"Maximizează","again":"Restaurează","show":"Arată","hide":"Ascunde","pin":"Fixează","unpin":"Anulează fixarea","reload":"Reîncarcă aplicația","starting":"Se deschide aplicația…","stalled":"Aplicația se încarcă prea mult. Reîncarcă fereastra.","todayLabel":"Astăzi","nextTen":"Următoarele 10 zile","waitingLate":"În așteptare","more":"mai multe","newsCountry":"Țara știrilor","global":"Global","balkans":"Balcani","newsRefresh":"Actualizează știrile","newsLoading":"Se încarcă știrile…","newsEmpty":"Știrile nu sunt disponibile","openNews":"Deschide știrile","paused":"Pauză pentru economie de memorie. Apasă Continuă.","resume":"Continuă","notes":"Notițe","tasks":"Sarcini","reminders":"Mementouri","documents":"Documente","birthdays":"Zile de naștere","finance":"Finanțe","todaySummary":"Astăzi · Următoarele 10 zile"}};
let owner='',data=null,ui=null,saving=0,saveRun=Promise.resolve(),z=50,focusId='',drag=null;
const startQueue=[],runningWindows=new Set(),loadTimers=new Map();
const MAX_PARALLEL_STARTS=1; // Full SPA iframes sync many datasets; serialize their startup.
let loadSerial=0;
const HEAVY_APPS=new Set(['explore','world','news']);
const idleHeavyTimers=new Map();
const RSS_COUNTRIES=['DE','MK','RS','BG','HR','BA','ME','AL','SI','AT','CH','GR','RO','GB','US','BALKANS','GLOBAL'];
const RSS_KEY='lifedash_web_news_country_v116_';
const RSS_TTL=15*60*1000;
const newsState={owner:'',country:'',items:[],index:0,at:0,loading:false,controller:null};
let todayTab='today';
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
function displayName(id){
 const key={dashboard:'dashboard',today:'today',calendar:'calendar',notes:'notes',
  tasks:'tasks',documents:'documents',finance:'finance',explore:'explore',
  vehicles:'vehicles',journey:'journey',world:'world',news:'news',radio:'radio',
  backup:'backup',profile:'profile'}[id];
 const value=key&&window.LifeDashWebI18n?.tr?.(key);
 return value&&value!==key?value:INFO[id]?.name||id;
}
function shell(){
 if(ui)return ui;
 ui=mk('section','ldp124-os');ui.id='ldp124OS';
 ui.setAttribute('aria-label','LifeDashPro Desktop Workspace');
 const wallpaper=mk('div','ldp124-wallpaper');wallpaper.id='ldp124Wallpaper';
 const top=mk('header','ldp124-topstrip');
 const brand=mk('div','ldp124-brand');
 const logo=mk('img','ldp124-brandmark ldp126-brand-logo');
 logo.alt='LifeDashPro';logo.width=38;logo.height=38;logo.decoding='async';
 logo.src=new URL('../../assets/lifedash-icon.webp',location.href).href;
 logo.addEventListener('error',()=>logo.replaceWith(mk('span','ldp124-brandmark','LD')),{once:true});
 brand.append(logo,mk('strong','', 'LifeDashPro'),mk('span','ldp124-top-tag','DESKTOP OS'));
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
 const start=button('','ldp124-start',()=>toggleStart());start.title=t('start');start.id='ldp124Start';
 const startLogo=mk('img','ldp126-start-logo');startLogo.alt='';startLogo.width=33;startLogo.height=33;
 startLogo.src=new URL('../../assets/lifedash-icon.webp',location.href).href;
 startLogo.addEventListener('error',()=>startLogo.replaceWith(mk('span','','◈')),{once:true});
 start.append(startLogo);
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
   if(!title.toLocaleLowerCase().includes(match)&&!displayName(id).toLocaleLowerCase().includes(match)&&!id.includes(match))continue;
   const b=button('','ldp124-menu-app',()=>{hideStart();openApp(id)});
   b.append(mk('span','ldp124-menu-symbol',icon),mk('small','',displayName(id)));
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
function urlFor(id,token=''){
 const u=new URL('./index.html',location.href);
 u.searchParams.set('ldpWindow',id);
 if(token)u.searchParams.set('ldpLoad',token);
 u.hash=id;
 return u.href;
}
function forgetIdle(id){
 const timer=idleHeavyTimers.get(id);
 if(timer!==undefined){clearTimeout(timer);idleHeavyTimers.delete(id)}
}
function pauseHeavy(id){
 if(!HEAVY_APPS.has(id)||!data?.windows[id]||!ui||ui.hidden)return;
 const node=$('#ldp124Windows [data-app="'+id+'"]',ui);
 if(!node||node.dataset.osState!=='ready')return;
 forgetStart(id);
 const frame=$('.ldp124-frame',node);
 if(frame)frame.src='about:blank';
 node.dataset.frameStarted='false';
 node.dataset.loadToken='';
 setWindowStatus(node,t('paused'),true);
 node.dataset.osState='paused';
 const spinner=$('.ldp125-loading-spinner',node);
 if(spinner)spinner.hidden=true;
 const retry=$('.ldp125-loading-retry',node);
 if(retry)retry.textContent='↻ '+t('resume');
}
function delayHeavyPause(id,ms){
 forgetIdle(id);
 if(!HEAVY_APPS.has(id)||!data?.windows[id])return;
 idleHeavyTimers.set(id,setTimeout(()=>{
  idleHeavyTimers.delete(id);
  if(!active()||!data?.windows[id]||ui?.hidden)return;
  if(data.windows[id].min||focusId!==id)pauseHeavy(id);
 },ms));
}
function forgetStart(id){
 const index=startQueue.indexOf(id);
 if(index>=0)startQueue.splice(index,1);
 const timer=loadTimers.get(id);
 if(timer!==undefined){clearTimeout(timer);loadTimers.delete(id)}
 runningWindows.delete(id);
}
function clearStarts(){
 for(const id of [...runningWindows,...startQueue])forgetStart(id);
 startQueue.length=0;
 for(const id of idleHeavyTimers.keys())forgetIdle(id);
 if(newsState.controller){newsState.controller.abort();newsState.controller=null}
 newsState.loading=false;
}
function setWindowStatus(node,text,failed=false){
 const message=$('.ldp125-loading-text',node),retry=$('.ldp125-loading-retry',node);
 if(message)message.textContent=text;
 if(retry)retry.hidden=!failed;
 node.dataset.osState=failed?'stalled':'loading';
}
function pumpStarts(){
 if(!active()||!data||!ui||ui.hidden)return;
 while(runningWindows.size<MAX_PARALLEL_STARTS&&startQueue.length){
  const id=startQueue.shift(),w=data.windows[id];
  const node=$('#ldp124Windows [data-app="'+id+'"]',ui);
  if(!w||w.min||!node||node.dataset.frameStarted==='true')continue;
  const frame=$('.ldp124-frame',node);if(!frame)continue;
  const token=String(++loadSerial);
  node.dataset.frameStarted='true';node.dataset.loadToken=token;
  setWindowStatus(node,t('starting'));
  const spinner=$('.ldp125-loading-spinner',node);
  if(spinner)spinner.hidden=false;
  const retry=$('.ldp125-loading-retry',node);
  if(retry)retry.textContent='↻ '+t('reload');
  runningWindows.add(id);
  loadTimers.set(id,setTimeout(()=>{
   if(node.isConnected&&node.dataset.loadToken===token&&node.dataset.osState!=='ready'){
    setWindowStatus(node,t('stalled'),true);
   }
   finishStart(id,token);
  },26000));
  frame.src=urlFor(id,token);
 }
}
function finishStart(id,token){
 const node=$('#ldp124Windows [data-app="'+id+'"]',ui);
 if(!node||node.dataset.loadToken!==token)return;
 const timer=loadTimers.get(id);
 if(timer!==undefined){clearTimeout(timer);loadTimers.delete(id)}
 runningWindows.delete(id);
 pumpStarts();
}
function scheduleStart(id,priority=false){
 if(!data?.windows[id]||data.windows[id].min||!active())return;
 const node=$('#ldp124Windows [data-app="'+id+'"]',ui);
 if(!node||node.dataset.frameStarted==='true'||runningWindows.has(id))return;
 if(!startQueue.includes(id))priority?startQueue.unshift(id):startQueue.push(id);
 pumpStarts();
}
function retryWindow(id){
 if(!data?.windows[id]||!active())return;
 const node=$('#ldp124Windows [data-app="'+id+'"]',ui);
 if(!node)return;
 forgetStart(id);
 // Stop only this app instance; all other windows, data and audio stay intact.
 const frame=$('.ldp124-frame',node);
 if(frame)frame.src='about:blank';
 node.dataset.frameStarted='false';node.dataset.loadToken='';
 setWindowStatus(node,t('starting'));
 if(data.windows[id].min)data.windows[id].min=false;
 position(node,data.windows[id]);
 scheduleStart(id,true);
 raise(id);
}
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.data?.type!=='ldp-os-ready-v125')return;
 const id=event.data.app,token=String(event.data.load||'');
 if(!INFO[id]||!active()||!data?.windows[id])return;
 const node=$('#ldp124Windows [data-app="'+id+'"]',ui);
 const frame=$('.ldp124-frame',node);
 if(!node||!frame||frame.contentWindow!==event.source||
  node.dataset.loadToken!==token)return;
 node.dataset.osState='ready';
 finishStart(id,token);
 // A heavy app may finish starting after its window has lost focus.
 if(HEAVY_APPS.has(id)&&(data.windows[id].min||focusId!==id))
  delayHeavyPause(id,data.windows[id].min?10000:90000);
});
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
 const reload=button('↻','ldp125-window-reload',()=>retryWindow(id));
 reload.title=t('reload');reload.setAttribute('aria-label',t('reload'));
 const mini=button('−','ldp124-window-mini',()=>minimize(id));
 mini.title=t('min');mini.setAttribute('aria-label',t('min'));
 const max=button('□','ldp124-window-max',()=>maximize(id));
 max.title=t('maximize');max.setAttribute('aria-label',t('maximize'));
 const close=button('×','ldp124-window-close',()=>closeWindow(id));
 close.title=t('close');close.setAttribute('aria-label',t('close'));
 actions.append(reload,mini,max,close);bar.append(label,actions);
 bar.addEventListener('dblclick',e=>{if(!e.target.closest('button'))maximize(id)});
 bar.addEventListener('pointerdown',e=>startDrag(e,id,node,bar));
 const frame=mk('iframe','ldp124-frame');
 frame.title=displayName(id);
 frame.setAttribute('loading','eager');frame.setAttribute('referrerpolicy','same-origin');
 // Same-origin iframe deliberately preserves complete existing auth, event and
 // module isolation, including the Radio audio element when minimized.
 frame.addEventListener('load',()=>{
  node.classList.add('ldp124-loaded');
  // Same-origin child app clicks must raise their owning Desktop window.
  try{frame.contentDocument?.addEventListener('pointerdown',()=>raise(id),true)}catch(_){}
 });
 const grip=mk('div','ldp124-resize-grip');
 grip.setAttribute('role','separator');grip.setAttribute('aria-label','Resize '+displayName(id));
 grip.addEventListener('pointerdown',e=>startResize(e,id,node,grip));
 node.addEventListener('pointerdown',()=>raise(id));
 const loading=mk('div','ldp125-loading');
 loading.setAttribute('role','status');
 const message=mk('span','ldp125-loading-text',t('starting'));
 const retry=button('↻ '+t('reload'),'ldp125-loading-retry',()=>retryWindow(id));
 retry.hidden=true;
 loading.append(mk('span','ldp125-loading-spinner','◌'),message,retry);
 node.dataset.frameStarted='false';node.dataset.osState='loading';
 node.append(bar,frame,loading,grip);return node;
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
 if(ui){
  const anyMax=Object.values(data?.windows||{}).some(x=>x.max&&!x.min);
  ui.classList.toggle('ldp126-max-active',anyMax);
 }
}
function mountWindow(id){
 const w=data.windows[id];if(!w)return;
 const host=$('#ldp124Windows',ui);
 let node=host?.querySelector('[data-app="'+id+'"]');
 if(!node){node=makeWindow(id);host.append(node)}
 position(node,w);
 if(!w.min)scheduleStart(id);
 return node;
}
function raise(id){
 if(!data.windows[id])return;
 for(const heavy of HEAVY_APPS){
  if(heavy!==id&&data.windows[heavy])delayHeavyPause(heavy,90000);
 }
 forgetIdle(id);
 focusId=id;
 const existing=$('#ldp124Windows [data-app="'+id+'"]',ui);
 if(existing?.dataset.osState==='paused')scheduleStart(id,true);
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
 forgetIdle(id);
 if(w.min){w.min=false;mountWindow(id);persist()}
 raise(id);
}
function minimize(id){
 const w=data.windows[id];if(!w)return;
 w.min=true;
 if(HEAVY_APPS.has(id))delayHeavyPause(id,10000);
 const queued=startQueue.indexOf(id);
 if(queued>=0)startQueue.splice(queued,1);
 position(mountWindow(id),w);focusId='';drawTaskbar();persist();
}
function maximize(id){
 const w=data.windows[id];if(!w)return;
 w.max=!w.max;w.min=false;position(mountWindow(id),w);raise(id);persist();
}
function closeWindow(id,saveChange=true){
 const node=$('#ldp124Windows [data-app="'+id+'"]',ui);
 forgetIdle(id);
 forgetStart(id);
 if(node)node.remove();
 pumpStarts();
 delete data.windows[id];
 if(ui)ui.classList.toggle('ldp126-max-active',Object.values(data.windows).some(x=>x.max&&!x.min));
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
function eventGroups(){
 return window.LifeDashTodayV127?.collect?.(
  window.LifeDashCalendarBridge?.snapshot?.()||{},
  dash()?.snapshot?.()?.finance_transactions||[],new Date()
 )||{today:[],next:[],overdue:[]};
}
function showTodayRecords(box,section){
 const data=eventGroups(),groups=[
  ['today',data.today],['next',data.next],['overdue',data.overdue]
 ];
 box.replaceChildren();
 const counts=mk('div','ldp127-event-tabs');
 for(const [id,records] of groups){
  const btn=button(t(id==='next'?'nextTen':id==='overdue'?'waitingLate':'todayLabel')+' '+records.length,
   'ldp127-event-tab'+(todayTab===id?' selected':''),()=>{todayTab=id;showTodayRecords(box,section)});
  btn.setAttribute('aria-pressed',String(todayTab===id));
  counts.append(btn);
 }
 box.append(counts);
 const records=(data[todayTab]||[]);
 if(!records.length){
  box.append(mk('p','ldp124-widget-muted',t('noEvents')));return;
 }
 for(const e of records.slice(0,5)){
  const row=button('','ldp124-widget-event',()=>openApp(e.page||'today'));
  const typeIcon={notes:'✎',tasks:'✓',reminders:'◷',documents:'▣',birthdays:'♡',finance:'€'}[e.kind]||'◷';
  const icon=mk('span','ldp127-event-type',typeIcon);
  const info=mk('span','ldp127-event-detail');
  info.append(mk('strong','',e.title),mk('small','',
   e.date+(e.time?' · '+e.time:'')+' · '+t(e.kind)));
  row.append(icon,info);
  box.append(row);
 }
 if(records.length>5)box.append(mk('small','ldp127-event-more','+'+(records.length-5)+' '+t('more')));
}
function rssCode(raw){
 const c=String(raw||'').trim().toUpperCase();
 if(c==='BALKANS'||c==='GLOBAL'||/^[A-Z]{2}$/.test(c))return c;
 const map={GERMANY:'DE',DEUTSCHLAND:'DE','NORTH MACEDONIA':'MK',
  МАКЕДОНИЈА:'MK',MACEDONIA:'MK',SRBIJA:'RS',SERBIA:'RS'};
 return map[c]||'DE';
}
function readNewsCountry(){
 let stored='';
 try{stored=localStorage.getItem(RSS_KEY+owner)||''}catch(_){}
 return rssCode(stored||window.LifeDashNewsBridge?.profileCountry?.()||'DE');
}
function setNewsCountry(code){
 const country=rssCode(code);
 newsState.country=country;newsState.index=0;newsState.at=0;newsState.items=[];
 if(newsState.controller){newsState.controller.abort();newsState.controller=null}
 newsState.loading=false;
 try{localStorage.setItem(RSS_KEY+owner,country)}catch(_){}
 paintNews();
 void fetchNews(true);
}
function paintNews(){
 const widget=$('#ldp124Widgets [data-widget="news"]',ui);
 if(!widget)return;
 const body=$('.ldp127-news-body',widget),country=$('.ldp127-news-country',widget);
 if(country&&country.value!==newsState.country)country.value=newsState.country;
 if(!body)return;
 body.replaceChildren();
 if(!newsState.items.length){
  body.append(mk('p','ldp124-widget-muted',
   newsState.loading?t('newsLoading'):t('newsEmpty')));
  return;
 }
 const item=newsState.items[newsState.index%newsState.items.length];
 const link=button('','ldp127-news-story',()=>openApp('news'));
 link.title=t('openNews');
 link.append(mk('strong','ldp127-news-title',String(item.title||'').slice(0,180)),
  mk('small','ldp127-news-publisher',String(item.source||'').slice(0,65)));
 body.append(link);
 const meta=mk('small','ldp127-news-position',
  (newsState.index%newsState.items.length+1)+' / '+newsState.items.length);
 body.append(meta);
}
async function fetchNews(force=false){
 const b=window.LifeDashNewsBridge,newsBox=$('#ldp124Widgets [data-widget="news"]',ui);
 if(!newsBox||!b?.ready?.()||!active()||ui?.hidden||document.visibilityState==='hidden')return;
 const chosen=readNewsCountry();
 if(newsState.owner!==owner||newsState.country!==chosen){
  newsState.owner=owner;newsState.country=chosen;newsState.items=[];newsState.at=0;newsState.index=0;
 }
 if(newsState.loading||(!force&&Date.now()-newsState.at<RSS_TTL))return;
 const reqOwner=owner,reqCountry=newsState.country;
 newsState.loading=true;const controller=new AbortController();
 newsState.controller=controller;
 paintNews();
 const timeout=setTimeout(()=>controller.abort(),13500);
 try{
  const result=await b.news(reqCountry,'top',controller.signal);
  if(controller.signal.aborted||reqOwner!==owner||newsState.country!==reqCountry||!active())return;
  if(result?.country!==reqCountry||result?.category!=='top'||!Array.isArray(result.items))
    throw new Error('RSS response mismatch');
  newsState.items=result.items.filter(item=>typeof item.title==='string'&&item.title.trim()).slice(0,12);
  newsState.at=Date.now();newsState.index=0;
 }catch(_){
  if(reqOwner===owner&&newsState.country===reqCountry)newsState.at=Date.now();
 }finally{
  clearTimeout(timeout);
  if(newsState.controller===controller){newsState.controller=null;newsState.loading=false}
  if(reqOwner===owner)paintNews();
 }
}
function newsWidget(box){
 const picker=mk('select','ldp127-news-country');
 picker.setAttribute('aria-label',t('newsCountry'));
 const current=readNewsCountry();
 const allowed=[...new Set([current,...RSS_COUNTRIES])];
 for(const c of allowed){
  const option=mk('option','',c==='GLOBAL'?t('global'):c==='BALKANS'?t('balkans'):c);
  option.value=c;picker.append(option);
 }
 picker.value=current;
 if(!newsState.country)newsState.country=current;
 picker.addEventListener('change',()=>setNewsCountry(picker.value));
 const controls=mk('div','ldp127-news-controls');
 const refresh=button('↻','ldp127-news-reload',()=>void fetchNews(true));
 refresh.title=t('newsRefresh');refresh.setAttribute('aria-label',t('newsRefresh'));
 controls.append(picker,refresh);
 const body=mk('div','ldp127-news-body');
 box.append(controls,body);
 paintNews();
 // Fetch only when the visible Desktop widget is mounted. It uses the
 // existing authenticated news-rss gateway, never a second RSS provider.
 if(!newsState.loading&&Date.now()-newsState.at>=RSS_TTL)
  queueMicrotask(()=>void fetchNews());
}
function widget(id){
 const box=mk('article','ldp124-widget');box.dataset.widget=id;
 const title={today:t('todaySummary'),weather:t('weather'),calendar:displayName('calendar'),
 finance:displayName('finance'),world:displayName('world'),news:displayName('news')}[id]||id;
 const btn=button('↗','ldp124-widget-open',()=>openApp(id==='weather'?'world':id==='today'?'today':id));
 btn.setAttribute('aria-label','Open '+title);
 const heading=mk('div','ldp124-widget-head');
 heading.append(mk('strong','',title),btn);
 box.append(heading);
 if(id==='today'||id==='calendar'){
  const area=mk('div','ldp127-today-list');
  box.append(area);
  if(id==='today')showTodayRecords(area,id);
  else{
   const e=eventGroups().next.slice(0,5);
   if(!e.length)area.append(mk('p','ldp124-widget-muted',t('noEvents')));
   for(const item of e){
    const row=button('','ldp124-widget-event',()=>openApp(item.page));
    row.append(mk('strong','',item.title),mk('small','',item.date));
    area.append(row);
   }
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
  newsWidget(box);
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
  // Never reuse an embedded app from a previous signed-in account.
  clearStarts();
  newsState.owner='';newsState.country='';newsState.items=[];newsState.index=0;newsState.at=0;
  todayTab='today';
  if(ui){ui.classList.remove('ldp126-max-active');$('#ldp124Windows',ui)?.replaceChildren()}
  if(saving){clearTimeout(saving);saving=0}
  owner=next;
  const local=readLocal(),cloud=bridge().prefs?.();
  data=clean(cloud&&Number(cloud.updatedAt||0)>=Number(local?.updatedAt||0)?cloud:local);
  if(!cloud&&!local)data=base();
 }
 shell();ui.hidden=false;wallpaper();drawIcons();drawWidgets();
 document.documentElement.classList.add('ldp-os-running');
 document.documentElement.classList.remove('ldp-os-launch-pending');
 updateWindows();drawTaskbar();updateClock();
 // Keep classic mode and existing dashboard alive underneath for safe rollback.
}
function deactivate(){
 if(ui&&!ui.hidden){
  ui.hidden=true;hideStart();closeSettings();
  document.documentElement.classList.remove('ldp-os-running');
  clearStarts();
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
window.setInterval(()=>{
 if(!ui||ui.hidden||!active()||document.visibilityState==='hidden')return;
 if(newsState.items.length){newsState.index=(newsState.index+1)%newsState.items.length;paintNews()}
 if(!newsState.loading&&Date.now()-newsState.at>RSS_TTL)void fetchNews();
},13000);
window.addEventListener('storage',event=>{
 if(!owner||!active()||event.key!==RSS_KEY+owner)return;
 const choice=readNewsCountry();
 if(choice!==newsState.country){
  newsState.country=choice;newsState.at=0;newsState.items=[];newsState.index=0;
  void fetchNews(true);
 }
});
schedule();
})();