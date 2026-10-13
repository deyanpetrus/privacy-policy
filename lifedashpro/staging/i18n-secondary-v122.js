/* LifeDashPro Web v1.22 - additive secondary-screen localization.
 * Read-only display translations. Never touch transaction amounts, user-entered
 * data, map pins, POI results, or news article title/body/source.
 */
(()=>{
'use strict';
const LANG=["en","mk","sr","hr","bs","cnr","sl","bg","sq","el","ro","de"];
const WORDS={"calendarTitle":["Your calendar","Твојот календар","Tvoj kalendar","Tvoj kalendar","Tvoj kalendar","Tvoj kalendar","Tvoj koledar","Твоят календар","Kalendari yt","Το ημερολόγιό σου","Calendarul tău","Dein Kalender"],"organizer":["PERSONAL ORGANIZER","ЛИЧЕН ОРГАНИЗАТОР","LIČNI ORGANIZATOR","OSOBNI ORGANIZATOR","LIČNI ORGANIZATOR","LIČNI ORGANIZATOR","OSEBNI ORGANIZATOR","ЛИЧЕН ОРГАНАЙЗЕР","ORGANIZUES PERSONAL","ΠΡΟΣΩΠΙΚΗ ΟΡΓΑΝΩΣΗ","ORGANIZATOR PERSONAL","PERSÖNLICHER PLANER"],"calendarDesc":["Tasks, notes, reminders, documents and birthdays · synced with Android","Задачи, белешки, потсетници, документи и родендени · синхронизирано со Android","Zadaci, beleške, podsetnici, dokumenti i rođendani · Android sinhronizacija","Zadaci, bilješke, podsjetnici, dokumenti i rođendani · Android sinkronizacija","Zadaci, bilješke, podsjetnici, dokumenti i rođendani · Android sinhronizacija","Zadaci, bilješke, podsjetnici, dokumenti i rođendani · Android sinhronizacija","Opravila, zapiski, opomniki, dokumenti in rojstni dnevi · sinhronizirano z Androidom","Задачи, бележки, напомняния, документи и рождени дни · синхронизирано с Android","Detyra, shënime, rikujtime, dokumente dhe ditëlindje · sinkronizuar me Android","Εργασίες, σημειώσεις, υπενθυμίσεις, έγγραφα και γενέθλια · συγχρονισμός Android","Sarcini, notițe, mementouri, documente și aniversări · sincronizate cu Android","Aufgaben, Notizen, Erinnerungen, Dokumente und Geburtstage · mit Android synchronisiert"],"todayShort":["Today","Денес","Danas","Danas","Danas","Danas","Danes","Днес","Sot","Σήμερα","Astăzi","Heute"],"month":["Month","Месец","Mesec","Mjesec","Mjesec","Mjesec","Mesec","Месец","Muaji","Μήνας","Lună","Monat"],"week":["Week","Недела","Nedelja","Tjedan","Sedmica","Sedmica","Teden","Седмица","Java","Εβδομάδα","Săptămână","Woche"],"agenda":["Agenda","Агенда","Agenda","Dnevni red","Dnevni red","Agenda","Dnevni red","Програма","Agjenda","Ατζέντα","Agendă","Agenda"],"notesShort":["Notes","Белешки","Beleške","Bilješke","Bilješke","Bilješke","Zapiski","Бележки","Shënime","Σημειώσεις","Notițe","Notizen"],"tasksShort":["Tasks","Задачи","Zadaci","Zadaci","Zadaci","Zadaci","Opravila","Задачи","Detyra","Εργασίες","Sarcini","Aufgaben"],"reminders":["Reminders","Потсетници","Podsetnici","Podsjetnici","Podsjetnici","Podsjetnici","Opomniki","Напомняния","Rikujtime","Υπενθυμίσεις","Mementouri","Erinnerungen"],"birthdays":["Birthdays","Родендени","Rođendani","Rođendani","Rođendani","Rođendani","Rojstni dnevi","Рождени дни","Ditëlindje","Γενέθλια","Aniversări","Geburtstage"],"monthWeekdays":["Mon","Пон","Pon","Pon","Pon","Pon","Pon","Пон","Hën","Δευ","Lun","Mo"],"dayTue":["Tue","Вто","Uto","Uto","Uto","Uto","Tor","Вто","Mar","Τρι","Mar","Di"],"dayWed":["Wed","Сре","Sre","Sri","Sri","Sri","Sre","Сря","Mër","Τετ","Mie","Mi"],"dayThu":["Thu","Чет","Čet","Čet","Čet","Čet","Čet","Чет","Enj","Πεμ","Joi","Do"],"dayFri":["Fri","Пет","Pet","Pet","Pet","Pet","Pet","Пет","Pre","Παρ","Vin","Fr"],"daySat":["Sat","Саб","Sub","Sub","Sub","Sub","Sob","Съб","Sht","Σαβ","Sâm","Sa"],"daySun":["Sun","Нед","Ned","Ned","Ned","Ned","Ned","Нед","Die","Κυρ","Dum","So"],"financeInsights":["Finance insights","Финансиски анализи","Finansijske analize","Financijske analize","Finansijske analize","Finansijske analize","Finančni pregled","Финансови анализи","Analiza financiare","Οικονομική ανάλυση","Analize financiare","Finanzanalyse"],"financeMonth":["This month","Овој месец","Ovaj mesec","Ovaj mjesec","Ovaj mjesec","Ovaj mjesec","Ta mesec","Този месец","Këtë muaj","Αυτόν τον μήνα","Luna aceasta","Dieser Monat"],"exportCSV":["Export CSV","Извези CSV","Izvezi CSV","Izvezi CSV","Izvezi CSV","Izvezi CSV","Izvozi CSV","Експорт CSV","Eksporto CSV","Εξαγωγή CSV","Exportă CSV","CSV exportieren"],"withRepeats":["With monthly repeats","Со месечни повторувања","Sa mesečnim ponavljanjima","S mjesečnim ponavljanjima","S mjesečnim ponavljanjima","S mjesečnim ponavljanjima","Z mesečnimi ponovitvami","С месечни повторения","Me përsëritje mujore","Με μηνιαίες επαναλήψεις","Cu repetări lunare","Mit monatlichen Wiederholungen"],"savedOnly":["Saved only","Само зачувани","Samo sačuvano","Samo spremljeno","Samo sačuvano","Samo sačuvano","Samo shranjeno","Само записани","Vetëm të ruajtura","Μόνο αποθηκευμένα","Doar salvate","Nur gespeicherte"],"previousMonth":["Previous month","Претходен месец","Prethodni mesec","Prethodni mjesec","Prethodni mjesec","Prethodni mjesec","Prejšnji mesec","Предишен месец","Muaji i kaluar","Προηγούμενος μήνας","Luna precedentă","Vorheriger Monat"],"nextMonth":["Next month","Следен месец","Sledeći mesec","Sljedeći mjesec","Sljedeći mjesec","Sljedeći mjesec","Naslednji mesec","Следващ месец","Muaji tjetër","Επόμενος μήνας","Luna următoare","Nächster Monat"],"recurringTitle":["Monthly income & expenses · including repeats","Месечни приходи и расходи · со повторувања","Mesečni prihodi i rashodi · sa ponavljanjima","Mjesečni prihodi i rashodi · s ponavljanjima","Mjesečni prihodi i rashodi · s ponavljanjima","Mjesečni prihodi i rashodi · s ponavljanjima","Mesečni prihodki in odhodki · s ponovitvami","Месечни приходи и разходи · с повторения","Të ardhura dhe shpenzime mujore · me përsëritje","Μηνιαία έσοδα και έξοδα · με επαναλήψεις","Venituri și cheltuieli lunare · cu repetări","Monatliche Einnahmen und Ausgaben · inkl. Wiederholungen"],"savingsGoals":["Savings goals","Цели за штедење","Ciljevi štednje","Ciljevi štednje","Ciljevi štednje","Ciljevi štednje","Varčevalni cilji","Цели за спестяване","Objektivat e kursimit","Στόχοι αποταμίευσης","Obiective de economisire","Sparziele"],"lastSix":["Last 6 months","Последни 6 месеци","Poslednjih 6 meseci","Posljednjih 6 mjeseci","Posljednjih 6 mjeseci","Posljednjih 6 mjeseci","Zadnjih 6 mesecev","Последни 6 месеца","6 muajt e fundit","Τελευταίοι 6 μήνες","Ultimele 6 luni","Letzte 6 Monate"],"byCategory":["By category","По категорија","Po kategoriji","Po kategoriji","Po kategoriji","Po kategoriji","Po kategoriji","По категория","Sipas kategorisë","Ανά κατηγορία","După categorie","Nach Kategorie"],"countryRegion":["Country / Region","Држава / Регион","Država / Region","Država / Regija","Država / Regija","Država / Regija","Država / Regija","Държава / Регион","Shteti / Rajoni","Χώρα / Περιοχή","Țară / Regiune","Land / Region"],"refresh":["↻ Refresh","↻ Освежи","↻ Osveži","↻ Osvježi","↻ Osvježi","↻ Osvježi","↻ Osveži","↻ Опресни","↻ Rifresko","↻ Ανανέωση","↻ Reîmprospătează","↻ Aktualisieren"],"topStories":["Top stories","Главни вести","Glavne vesti","Glavne vijesti","Glavne vijesti","Glavne vijesti","Glavne novice","Водещи новини","Lajmet kryesore","Κύριες ειδήσεις","Știri principale","Topmeldungen"],"worldCategory":["World","Свет","Svet","Svijet","Svijet","Svijet","Svet","Свят","Bota","Κόσμος","Lume","Welt"],"business":["Business","Бизнис","Biznis","Poslovanje","Poslovanje","Biznis","Poslovanje","Бизнес","Biznes","Επιχειρήσεις","Afaceri","Wirtschaft"],"technology":["Technology","Технологија","Tehnologija","Tehnologija","Tehnologija","Tehnologija","Tehnologija","Технологии","Teknologji","Τεχνολογία","Tehnologie","Technologie"],"sports":["Sports","Спорт","Sport","Sport","Sport","Sport","Šport","Спорт","Sport","Αθλητικά","Sport","Sport"],"science":["Science","Наука","Nauka","Znanost","Nauka","Nauka","Znanost","Наука","Shkencë","Επιστήμη","Știință","Wissenschaft"],"health":["Health","Здравје","Zdravlje","Zdravlje","Zdravlje","Zdravlje","Zdravje","Здраве","Shëndet","Υγεία","Sănătate","Gesundheit"],"readStory":["Read story ↗","Прочитај вест ↗","Pročitaj vest ↗","Pročitaj vijest ↗","Pročitaj vijest ↗","Pročitaj vijest ↗","Preberi novico ↗","Прочети новина ↗","Lexo lajmin ↗","Διάβασε είδηση ↗","Citește știrea ↗","Meldung lesen ↗"],"exploreNearby":["Explore nearby","Истражи во близина","Istraži okolinu","Istraži u blizini","Istraži okolinu","Istraži u blizini","Razišči bližino","Разгледай наблизо","Eksploro afër","Εξερεύνηση κοντά","Explorează în apropiere","In der Nähe entdecken"],"location":["Location","Локација","Lokacija","Lokacija","Lokacija","Lokacija","Lokacija","Местоположение","Vendndodhja","Τοποθεσία","Locație","Standort"],"radius":["Radius","Радиус","Radijus","Polumjer","Radijus","Radijus","Polmer","Радиус","Rrezja","Ακτίνα","Rază","Radius"],"useGps":["⌖ Use my location","⌖ Користи моја локација","⌖ Koristi moju lokaciju","⌖ Koristi moju lokaciju","⌖ Koristi moju lokaciju","⌖ Koristi moju lokaciju","⌖ Uporabi mojo lokacijo","⌖ Използвай местоположението","⌖ Përdor vendndodhjen","⌖ Χρήση τοποθεσίας μου","⌖ Folosește locația mea","⌖ Meinen Standort verwenden"],"findCity":["Find city","Пронајди град","Pronađi grad","Pronađi grad","Pronađi grad","Pronađi grad","Poišči mesto","Намери град","Gjej qytetin","Εύρεση πόλης","Găsește orașul","Stadt suchen"],"nearbyMap":["Nearby map","Мапа во близина","Mapa u blizini","Karta u blizini","Mapa u blizini","Mapa u blizini","Zemljevid bližine","Карта наблизо","Harta afër","Χάρτης περιοχής","Hartă apropiere","Karte der Umgebung"],"nearbyPlaces":["Nearby places","Места во близина","Mesta u blizini","Mjesta u blizini","Mjesta u blizini","Mjesta u blizini","Kraji v bližini","Места наблизо","Vende afër","Κοντινά μέρη","Locuri din apropiere","Orte in der Nähe"],"markets":["Markets","Маркети","Prodavnice","Trgovine","Prodavnice","Prodavnice","Trgovine","Магазини","Markete","Αγορές","Magazine","Märkte"],"hospitals":["Hospitals","Болници","Bolnice","Bolnice","Bolnice","Bolnice","Bolnišnice","Болници","Spitale","Νοσοκομεία","Spitale","Krankenhäuser"],"atms":["ATMs","Банкомати","Bankomati","Bankomati","Bankomati","Bankomati","Bankomati","Банкомати","Bankomate","ΑΤΜ","Bancomate","Geldautomaten"],"attractions":["Attractions","Атракции","Atrakcije","Atrakcije","Atrakcije","Atrakcije","Znamenitosti","Забележителности","Atraksione","Αξιοθέατα","Atracții","Sehenswürdigkeiten"],"police":["Police","Полиција","Policija","Policija","Policija","Policija","Policija","Полиция","Policia","Αστυνομία","Poliție","Polizei"],"cafes":["Cafés","Кафулиња","Kafići","Kafići","Kafići","Kafići","Kavarne","Кафенета","Kafene","Καφέ","Cafenele","Cafés"]};
const old=()=>window.LifeDashWebI18n;
const root=document.querySelector('#content');
const shell=document.querySelector('#appView');
if(!root||!shell)return;
function language(){
 const raw=String(old()?.locale?.()||'en').toLowerCase();
 const value=raw==='me'?'cnr':raw;
 return LANG.includes(value)?value:'en';
}
function t(key){
 const index=LANG.indexOf(language());
 return WORDS[key]?.[index]||old()?.tr?.(key)||key;
}
function assign(selector,key,container=root){
 const node=container.querySelector(selector);
 if(node&&node.childElementCount===0&&node.textContent!==t(key))node.textContent=t(key);
}
function all(selector,key,container=root){
 for(const node of container.querySelectorAll(selector))
   if(node.childElementCount===0&&node.textContent!==t(key))node.textContent=t(key);
}
function headText(selector,key,container=root){
 const node=container.querySelector(selector);if(!node)return;
 const textNode=[...node.childNodes].find(n=>n.nodeType===3&&n.textContent.trim());
 if(textNode&&textNode.textContent.trim()!==t(key))textNode.textContent=t(key);
}
function months(){
 const c=root.querySelector('#personalCalendar');if(!c)return;
 assign('.calendar-head .eyebrow','organizer',c);
 assign('.calendar-head h2','calendarTitle',c);
 assign('.calendar-head .calendar-muted','calendarDesc',c);
 assign('.calendar-top-controls button:first-child','todayShort',c);
 const tabs=c.querySelectorAll('.calendar-view-tabs .calendar-tab');
 ['month','week','agenda'].forEach((key,i)=>{
  const b=tabs[i];if(b&&b.textContent!==t(key))b.textContent=t(key);
 });
 const wd=c.querySelectorAll('.calendar-weekday-head span');
 ['monthWeekdays','dayTue','dayWed','dayThu','dayFri','daySat','daySun'].forEach((key,i)=>{
  if(wd[i]&&wd[i].textContent!==t(key))wd[i].textContent=t(key);
 });
 const filterMap={notes:'notesShort',tasks:'tasksShort',reminders:'reminders',birthdays:'birthdays',documents:'documents'};
 for(const [cls,key] of Object.entries(filterMap)){
  const item=c.querySelector('.calendar-chip-'+cls+' span');
  if(!item)continue;
  const prefix=item.textContent.split(' ')[0]||'';
  const next=prefix+' '+t(key);
  if(item.textContent!==next)item.textContent=next;
 }
}
function finance(){
 const c=root.querySelector('#financePlus');if(!c)return;
 assign('.finance-plus-titlebar h3','financeInsights',c);
 assign('.finance-plus-actions button:not(.finance-plus-arrow):not(.finance-plus-export)','financeMonth',c);
 assign('.finance-plus-export','exportCSV',c);
 const arrows=c.querySelectorAll('.finance-plus-arrow');
 ['previousMonth','nextMonth'].forEach((key,i)=>{
  if(arrows[i])arrows[i].setAttribute('aria-label',t(key));
 });
 const tabs=c.querySelectorAll('.finance-plus-view-toggle .finance-plus-tab');
 ['withRepeats','savedOnly'].forEach((key,i)=>{
  if(tabs[i]&&tabs[i].textContent!==t(key))tabs[i].textContent=t(key);
 });
 for(const pair of [
  ['.finance-plus-recurring-main .finance-plus-panel-title','recurringTitle'],
  ['.finance-plus-panel h3','lastSix']
 ]){ // headings below use safe English/translated-match replacement
  const node=c.querySelector(pair[0]);if(node&&node.textContent===WORDS[pair[1]]?.[0])node.textContent=t(pair[1]);
 }
 const headerNames={'Last 6 months':'lastSix','By category':'byCategory',
   'Monthly income & expenses · including repeats':'recurringTitle','Savings goals':'savingsGoals'};
 for(const node of c.querySelectorAll('.finance-plus-panel h3,.finance-plus-panel h4,.finance-plus-panel strong')){
  if(node.children.length||node.closest('.finance-plus-goal'))continue;
  const key=Object.entries(headerNames).find(([english,k])=>[english,...WORDS[k]].includes(node.textContent.trim()))?.[1];
  if(key&&node.textContent!==t(key))node.textContent=t(key);
 }
}
function news(){
 const c=root.querySelector('#newsRssV116');if(!c)return;
 headText('.news-country-label','countryRegion',c);
 const refresh=c.querySelector('#newsRefreshV116');
 if(refresh&&['↻ Refresh',...WORDS.refresh].includes(refresh.textContent.trim()))
  refresh.textContent=t('refresh');
 const map={top:['✦','topStories'],world:['◎','worldCategory'],business:['↗','business'],
  technology:['⌘','technology'],sports:['⚑','sports'],science:['✧','science'],
  health:['♡','health']};
 for(const b of c.querySelectorAll('.news-category[data-category]')){
  const item=map[b.dataset.category];if(!item)continue;
  const caption=item[0]+' '+t(item[1]);
  if(b.textContent!==caption)b.textContent=caption;
 }
 all('.news-read-btn','readStory',c);
}
function explore(){
 const c=root.querySelector('#exploreAroundPage');if(!c)return;
 assign('.explore-header h2','exploreNearby',c);
 assign('.explore-controls .explore-field:nth-child(1) > span','location',c);
 assign('.explore-controls .explore-field:nth-child(2) > span','radius',c);
 assign('#exploreUseGps','useGps',c);
 const r=c.querySelector('#exploreRefresh');
 if(r&&['↻ Refresh',...WORDS.refresh].includes(r.textContent.trim()))r.textContent=t('refresh');
 assign('#exploreFindCity','findCity',c);
 assign('.explore-map-head strong','nearbyMap',c);
 const cats={fuel:'fuel',parking:'parking',restaurant:'food',hotel:'hotels',
  charging:'charging',market:'markets',pharmacy:'pharmacies',hospital:'hospitals',
  atm:'atms',tourism:'attractions',police:'police',cafes:'cafes'};
 const icons={fuel:'⛽',parking:'🅿',restaurant:'☕',hotel:'🛏',charging:'⚡',
  market:'🛒',pharmacy:'✚',hospital:'✚',atm:'€',tourism:'⌖',police:'◈',cafes:'☕'};
 for(const b of c.querySelectorAll('.explore-category[data-explore-category]')){
  const id=b.dataset.exploreCategory,key=cats[id];
  if(!key)continue;
  const next=(icons[id]||'')+' '+t(key);
  if(b.textContent!==next)b.textContent=next;
 }
}
function apply(){
 if(!old()?.locale||shell.classList.contains('hidden'))return;
 months();finance();news();explore();
}
let queued=false;
function schedule(){
 if(queued)return;queued=true;
 queueMicrotask(()=>{queued=false;apply()});
}
const observer=new MutationObserver(schedule);
observer.observe(root,{childList:true,subtree:true});
observer.observe(shell,{attributes:true,attributeFilter:['class']});
document.addEventListener('lifedash:locale-change',schedule);
window.LifeDashSecondaryI18nV122=Object.freeze({tr:t,locale:language,keys:Object.keys(WORDS).length,locales:LANG.slice()});
schedule();
})();