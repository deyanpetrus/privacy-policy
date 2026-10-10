/* Web v1.21 localization — 12 Android languages, keyed UI text only. */
(()=>{
'use strict';
const CODES=["en","mk","sr","hr","bs","cnr","sl","bg","sq","el","ro","de"];
const WORDS={"dashboard":["Dashboard","Контролна табла","Kontrolna tabla","Nadzorna ploča","Kontrolna tabla","Kontrolna tabla","Nadzorna plošča","Табло","Paneli kryesor","Πίνακας ελέγχου","Panou de control","Übersicht"],"today":["Today & Next 5","Денес и следни 5","Danas i narednih 5","Danas i sljedećih 5","Danas i narednih 5","Danas i narednih 5","Danes in naslednjih 5","Днес и следващите 5","Sot dhe 5 ditët e ardhshme","Σήμερα και επόμενες 5","Astăzi și următoarele 5","Heute und nächste 5"],"calendar":["Personal Calendar","Личен календар","Lični kalendar","Osobni kalendar","Lični kalendar","Lični kalendar","Osebni koledar","Личен календар","Kalendari personal","Προσωπικό ημερολόγιο","Calendar personal","Persönlicher Kalender"],"notes":["Notes Pro","Белешки Pro","Beleške Pro","Bilješke Pro","Bilješke Pro","Bilješke Pro","Zapiski Pro","Бележки Pro","Shënime Pro","Σημειώσεις Pro","Notițe Pro","Notizen Pro"],"tasks":["Tasks","Задачи","Zadaci","Zadaci","Zadaci","Zadaci","Opravila","Задачи","Detyrat","Εργασίες","Sarcini","Aufgaben"],"documents":["Documents","Документи","Dokumenti","Dokumenti","Dokumenti","Dokumenti","Dokumenti","Документи","Dokumente","Έγγραφα","Documente","Dokumente"],"finance":["Finance","Финансии","Finansije","Financije","Finansije","Finansije","Finance","Финанси","Financat","Οικονομικά","Finanțe","Finanzen"],"explore":["Explore & Around Me","Истражи и околу мене","Istraži i oko mene","Istraži i oko mene","Istraži i oko mene","Istraži i oko mene","Razišči okolico","Разгледай наоколо","Eksploro përreth","Εξερεύνηση γύρω μου","Explorează în jur","Entdecken & Umgebung"],"vehicles":["Vehicles","Возила","Vozila","Vozila","Vozila","Vozila","Vozila","Превозни средства","Automjete","Οχήματα","Vehicule","Fahrzeuge"],"journey":["Journey","Патувања","Putovanja","Putovanja","Putovanja","Putovanja","Potovanja","Пътувания","Udhëtime","Ταξίδια","Călătorii","Reisen"],"world":["World Live","Свет во живо","Svet uživo","Svijet uživo","Svijet uživo","Svijet uživo","Svet v živo","Светът на живо","Bota drejtpërdrejt","Κόσμος ζωντανά","Lumea în direct","Welt live"],"news":["News & RSS","Вести и RSS","Vesti i RSS","Vijesti i RSS","Vijesti i RSS","Vijesti i RSS","Novice in RSS","Новини и RSS","Lajme dhe RSS","Ειδήσεις και RSS","Știri și RSS","Nachrichten & RSS"],"radio":["World Radio","Светско радио","Svetski radio","Svjetski radio","Svjetski radio","Svjetski radio","Svetovni radio","Световно радио","Radio botërore","Παγκόσμιο ραδιόφωνο","Radio mondial","Weltradio"],"backup":["Backup & Restore","Резервни копии","Bekap i vraćanje","Sigurnosne kopije","Sigurnosne kopije","Rezervne kopije","Varnostne kopije","Архивиране и възстановяване","Ruajtje dhe rikthim","Αντίγραφα και επαναφορά","Copii și restaurare","Sichern & Wiederherstellen"],"profile":["Profile & Settings","Профил и поставки","Profil i podešavanja","Profil i postavke","Profil i postavke","Profil i podešavanja","Profil in nastavitve","Профил и настройки","Profili dhe cilësimet","Προφίλ και ρυθμίσεις","Profil și setări","Profil & Einstellungen"],"personal":["Personal information","Лични податоци","Lični podaci","Osobni podaci","Lični podaci","Lični podaci","Osebni podatki","Лични данни","Të dhëna personale","Προσωπικά στοιχεία","Date personale","Persönliche Daten"],"first":["First name (required)","Име (задолжително)","Ime (obavezno)","Ime (obavezno)","Ime (obavezno)","Ime (obavezno)","Ime (obvezno)","Име (задължително)","Emri (i detyrueshëm)","Όνομα (υποχρεωτικό)","Prenume (obligatoriu)","Vorname (Pflichtfeld)"],"last":["Last name (optional)","Презиме (незадолжително)","Prezime (opciono)","Prezime (neobavezno)","Prezime (opcionalno)","Prezime (opciono)","Priimek (neobvezno)","Фамилия (по избор)","Mbiemri (opsional)","Επώνυμο (προαιρετικό)","Nume de familie (opțional)","Nachname (optional)"],"email":["Email (account)","Е-пошта (сметка)","E-pošta (nalog)","E-pošta (račun)","E-pošta (račun)","E-pošta (nalog)","E-pošta (račun)","Имейл (профил)","Email (llogaria)","Email (λογαριασμός)","E-mail (cont)","E-Mail (Konto)"],"city":["City","Град","Grad","Grad","Grad","Grad","Mesto","Град","Qyteti","Πόλη","Oraș","Stadt"],"country":["Country","Држава","Država","Država","Država","Država","Država","Държава","Shteti","Χώρα","Țară","Land"],"language":["Language","Јазик","Jezik","Jezik","Jezik","Jezik","Jezik","Език","Gjuha","Γλώσσα","Limbă","Sprache"],"save":["Save changes","Зачувај промени","Sačuvaj izmene","Spremi promjene","Sačuvaj izmjene","Sačuvaj izmjene","Shrani spremembe","Запази промените","Ruaj ndryshimet","Αποθήκευση αλλαγών","Salvează modificările","Änderungen speichern"],"signout":["Sign out","Одјави се","Odjavi se","Odjavi se","Odjavi se","Odjavi se","Odjava","Изход","Dil","Αποσύνδεση","Deconectare","Abmelden"],"emailChange":["Change email address","Промени е-пошта","Promeni e-poštu","Promijeni e-poštu","Promijeni e-poštu","Promijeni e-poštu","Spremeni e-pošto","Промяна на имейл","Ndrysho emailin","Αλλαγή email","Schimbă adresa de e-mail","E-Mail ändern"],"passwordChange":["Password & security","Лозинка и безбедност","Lozinka i bezbednost","Lozinka i sigurnost","Lozinka i sigurnost","Lozinka i bezbjednost","Geslo in varnost","Парола и сигурност","Fjalëkalimi dhe siguria","Κωδικός και ασφάλεια","Parolă și securitate","Passwort & Sicherheit"],"currentPass":["Current password","Тековна лозинка","Trenutna lozinka","Trenutna lozinka","Trenutna lozinka","Trenutna lozinka","Trenutno geslo","Текуща парола","Fjalëkalimi aktual","Τρέχων κωδικός","Parola actuală","Aktuelles Passwort"],"newPass":["New password","Нова лозинка","Nova lozinka","Nova lozinka","Nova lozinka","Nova lozinka","Novo geslo","Нова парола","Fjalëkalimi i ri","Νέος κωδικός","Parolă nouă","Neues Passwort"],"confirmPass":["Confirm new password","Потврди нова лозинка","Potvrdi novu lozinku","Potvrdi novu lozinku","Potvrdi novu lozinku","Potvrdi novu lozinku","Potrdi novo geslo","Потвърди новата парола","Konfirmo fjalëkalimin","Επιβεβαίωση νέου κωδικού","Confirmă parola nouă","Neues Passwort bestätigen"],"verificationCode":["One-time verification code (when used)","Код за потврда (ако е потребен)","Jednokratni kod (ako je potreban)","Jednokratni kod (po potrebi)","Jednokratni kod (po potrebi)","Jednokratni kod (po potrebi)","Enkratna koda (po potrebi)","Еднократен код (при нужда)","Kod njëpërdorimësh (nëse duhet)","Κωδικός μίας χρήσης (αν χρειάζεται)","Cod unic (dacă este necesar)","Einmalcode (falls nötig)"],"requestEmail":["Send verification request","Испрати барање за потврда","Pošalji zahtev za potvrdu","Pošalji zahtjev za potvrdu","Pošalji zahtjev za potvrdu","Pošalji zahtjev za potvrdu","Pošlji zahtevo za potrditev","Изпрати заявка за потвърждение","Dërgo kërkesën e verifikimit","Αποστολή αιτήματος επιβεβαίωσης","Trimite cererea de verificare","Bestätigung anfordern"],"sendCode":["Send verification code","Испрати код за потврда","Pošalji kod za potvrdu","Pošalji kod za potvrdu","Pošalji kod za potvrdu","Pošalji kod za potvrdu","Pošlji potrditveno kodo","Изпрати код за потвърждение","Dërgo kodin e verifikimit","Αποστολή κωδικού","Trimite codul de verificare","Bestätigungscode senden"],"updatePass":["Update password","Промени лозинка","Promeni lozinku","Promijeni lozinku","Promijeni lozinku","Promijeni lozinku","Posodobi geslo","Обнови паролата","Përditëso fjalëkalimin","Ενημέρωση κωδικού","Actualizează parola","Passwort ändern"],"todayNext":["Today · Next · Waiting","Денес · Следни · Чекаат","Danas · Sledeće · Na čekanju","Danas · Sljedeće · Na čekanju","Danas · Sljedeće · Na čekanju","Danas · Sljedeće · Na čekanju","Danes · Naslednje · Na čakanju","Днес · Следващи · Чакащи","Sot · Në vijim · Në pritje","Σήμερα · Επόμενα · Εκκρεμή","Astăzi · Următoarele · În așteptare","Heute · Demnächst · Offen"],"nextTen":["Next 10 days","Следни 10 дена","Sledećih 10 dana","Sljedećih 10 dana","Sljedećih 10 dana","Sljedećih 10 dana","Naslednjih 10 dni","Следващи 10 дни","10 ditët e ardhshme","Επόμενες 10 ημέρες","Următoarele 10 zile","Nächste 10 Tage"],"waiting":["Waiting","Чекаат","Na čekanju","Na čekanju","Na čekanju","Na čekanju","Na čakanju","Чакащи","Në pritje","Εκκρεμή","În așteptare","Offen"],"around":["Explore & Around Me","Истражи и во живо","Istraži u okolini","Istraži okolinu","Istraži okolinu","Istraži okolinu","Razišči okolico","Разгледай наоколо","Eksploro përreth","Εξερεύνηση γύρω μου","Explorează în jur","Umgebung erkunden"],"worldInfo":["World Intelligence","Светски информации","Svetske informacije","Svjetske informacije","Svjetske informacije","Svjetske informacije","Svetovne informacije","Световни данни","Informacione globale","Παγκόσμιες πληροφορίες","Informații globale","Weltinformationen"],"openRoute":["Open route","Отвори рута","Otvori rutu","Otvori rutu","Otvori rutu","Otvori rutu","Odpri pot","Отвори маршрут","Hap itinerarin","Άνοιγμα διαδρομής","Deschide ruta","Route öffnen"],"newsRss":["News · RSS","Вести · RSS","Vesti · RSS","Vijesti · RSS","Vijesti · RSS","Vijesti · RSS","Novice · RSS","Новини · RSS","Lajme · RSS","Ειδήσεις · RSS","Știri · RSS","Nachrichten · RSS"],"fuel":["Fuel","Гориво","Gorivo","Gorivo","Gorivo","Gorivo","Gorivo","Гориво","Karburant","Καύσιμα","Carburant","Tanken"],"parking":["Parking","Паркинг","Parking","Parking","Parking","Parking","Parkirišče","Паркинг","Parkim","Στάθμευση","Parcare","Parken"],"food":["Food & Coffee","Храна и кафе","Hrana i kafa","Hrana i kava","Hrana i kafa","Hrana i kafa","Hrana in kava","Храна и кафе","Ushqim dhe kafe","Φαγητό και καφές","Mâncare și cafea","Essen & Kaffee"],"hotels":["Hotels","Хотели","Hoteli","Hoteli","Hoteli","Hoteli","Hoteli","Хотели","Hotele","Ξενοδοχεία","Hoteluri","Hotels"],"charging":["EV charging","EV полначи","EV punjači","EV punjači","EV punjači","EV punjači","EV polnilnice","EV зарядни","Karikim EV","Φόρτιση EV","Încărcare EV","E-Ladestationen"],"pharmacies":["Pharmacies","Аптеки","Apoteke","Ljekarne","Apoteke","Apoteke","Lekarne","Аптеки","Farmaci","Φαρμακεία","Farmacii","Apotheken"],"fires":["Fires","Пожари","Požari","Požari","Požari","Požari","Požari","Пожари","Zjarre","Πυρκαγιές","Incendii","Brände"],"quakes":["Earthquakes","Земјотреси","Zemljotresi","Potresi","Zemljotresi","Zemljotresi","Potresi","Земетресения","Tërmete","Σεισμοί","Cutremure","Erdbeben"],"airTraffic":["Air Traffic","Воздушен сообраќај","Avio-saobraćaj","Zračni promet","Zračni saobraćaj","Avio-saobraćaj","Letalski promet","Въздушен трафик","Trafiku ajror","Εναέρια κυκλοφορία","Trafic aerian","Flugverkehr"],"roads":["Road Live","Патишта во живо","Putevi uživo","Ceste uživo","Putevi uživo","Putevi uživo","Ceste v živo","Пътища на живо","Rrugët live","Δρόμοι ζωντανά","Drumuri live","Straßen live"],"notesWidget":["Notes Pro","Белешки Pro","Beleške Pro","Bilješke Pro","Bilješke Pro","Bilješke Pro","Zapiski Pro","Бележки Pro","Shënime Pro","Σημειώσεις Pro","Notițe Pro","Notizen Pro"],"sort":["Sort","Сортирај","Sortiraj","Poredaj","Sortiraj","Sortiraj","Razvrsti","Сортиране","Rendit","Ταξινόμηση","Sortează","Sortieren"],"filter":["Filter","Филтер","Filter","Filtar","Filter","Filter","Filter","Филтър","Filtro","Φίλτρο","Filtru","Filter"],"limit":["Show","Прикажи","Prikaži","Prikaži","Prikaži","Prikaži","Prikaži","Покажи","Shfaq","Εμφάνιση","Afișează","Anzeigen"],"newest":["Newest first","Најнови прво","Najnovije prvo","Najnovije prvo","Najnovije prvo","Najnovije prvo","Najnovejše najprej","Най-новите първо","Më të rejat së pari","Νεότερα πρώτα","Cele mai noi","Neueste zuerst"],"oldest":["Oldest first","Најстари прво","Najstarije prvo","Najstarije prvo","Najstarije prvo","Najstarije prvo","Najstarejše najprej","Най-старите първо","Më të vjetrat së pari","Παλαιότερα πρώτα","Cele mai vechi","Älteste zuerst"],"dueSoon":["Due date","Рок","Rok","Rok","Rok","Rok","Rok","Краен срок","Afati","Προθεσμία","Scadență","Fälligkeit"],"alphabetical":["Title A–Z","Наслов А–Ш","Naslov A–Š","Naslov A–Ž","Naslov A–Ž","Naslov A–Ž","Naslov A–Ž","Заглавие А–Я","Titulli A–Z","Τίτλος Α–Ω","Titlu A–Z","Titel A–Z"],"allNotes":["All notes","Сите белешки","Sve beleške","Sve bilješke","Sve bilješke","Sve bilješke","Vsi zapiski","Всички бележки","Të gjitha shënimet","Όλες οι σημειώσεις","Toate notițele","Alle Notizen"],"dueToday":["Due today","Рок денес","Rok danas","Rok danas","Rok danas","Rok danas","Rok danes","Срок днес","Afati sot","Λήγουν σήμερα","Scadente azi","Heute fällig"],"nextTenFilter":["Next 10 days","Следни 10 дена","Sledećih 10 dana","Sljedećih 10 dana","Sljedećih 10 dana","Sljedećih 10 dana","Naslednjih 10 dni","Следващи 10 дни","10 ditët e ardhshme","Επόμενες 10 ημέρες","Următoarele 10 zile","Nächste 10 Tage"],"overdue":["Overdue","Задоцнети","Zakasnelo","Zakašnjelo","Zakašnjelo","Zakašnjelo","Zapadlo","Просрочени","Të vonuara","Εκπρόθεσμα","Restante","Überfällig"],"noDate":["No due date","Без рок","Bez roka","Bez roka","Bez roka","Bez roka","Brez roka","Без срок","Pa afat","Χωρίς προθεσμία","Fără termen","Ohne Fälligkeit"],"openAll":["All notes →","Сите белешки →","Sve beleške →","Sve bilješke →","Sve bilješke →","Sve bilješke →","Vsi zapiski →","Всички бележки →","Të gjitha shënimet →","Όλες οι σημειώσεις →","Toate notițele →","Alle Notizen →"],"emptyNotes":["No matching synced notes.","Нема белешки за овој избор.","Nema beleški za ovaj izbor.","Nema bilješki za ovaj odabir.","Nema bilješki za ovaj izbor.","Nema bilješki za ovaj izbor.","Ni ustreznih zapiskov.","Няма бележки по този филтър.","Nuk ka shënime për këtë filtër.","Δεν βρέθηκαν σημειώσεις.","Nu există notițe pentru acest filtru.","Keine passenden Notizen."],"layoutHint":["My dashboard","Мој Dashboard","Moj panel","Moja nadzorna ploča","Moj panel","Moj panel","Moja nadzorna plošča","Моето табло","Paneli im","Ο πίνακάς μου","Panoul meu","Mein Dashboard"],"editLayout":["Rearrange cards","Размести картички","Premesti kartice","Premjesti kartice","Premjesti kartice","Premjesti kartice","Premakni kartice","Пренареди картите","Rendit kartat","Αναδιάταξη καρτών","Rearanjează cardurile","Karten anordnen"],"finishLayout":["Finish","Заврши","Završi","Završi","Završi","Završi","Končaj","Готово","Përfundo","Τέλος","Gata","Fertig"],"resetLayout":["Reset order","Врати распоред","Vrati raspored","Vrati raspored","Vrati raspored","Vrati raspored","Ponastavi vrstni red","Нулирай реда","Rivendos rendin","Επαναφορά σειράς","Resetează ordinea","Reihenfolge zurücksetzen"],"earlier":["Move earlier","Помести нагоре","Pomeri gore","Pomakni gore","Pomjeri gore","Pomjeri gore","Premakni gor","Премести нагоре","Lëviz lart","Μετακίνηση πάνω","Mută mai sus","Nach oben"],"later":["Move later","Помести надолу","Pomeri dole","Pomakni dolje","Pomjeri dole","Pomjeri dolje","Premakni dol","Премести надолу","Lëviz poshtë","Μετακίνηση κάτω","Mută mai jos","Nach unten"],"showMore":["Show more","Прикажи повеќе","Prikaži više","Prikaži više","Prikaži više","Prikaži više","Pokaži več","Покажи още","Shfaq më shumë","Περισσότερα","Arată mai mult","Mehr anzeigen"]};
const translations=Object.freeze(WORDS);
let lastLanguage='';
const B=()=>window.LifeDashDashboardBridge;
function locale(){
 const raw=String(B()?.profile()?.language||'en').toLowerCase().split('-')[0];
 return raw==='cnr'||raw==='me'?'cnr':CODES.includes(raw)?raw:'en';
}
function tr(key){
 const value=translations[key];
 if(!value)return key;
 const index=CODES.indexOf(locale());
 return value[index]||value[0];
}
function text(selector,key,scope=document){
 const el=scope.querySelector(selector);
 if(el&&el.textContent!==tr(key))el.textContent=tr(key);
}
const NAV={"dashboard":"dashboard","today":"today","calendar":"calendar","notes":"notes","tasks":"tasks","documents":"documents","finance":"finance","explore":"explore","vehicles":"vehicles","journey":"journey","world":"world","news":"news","radio":"radio","backup":"backup","profile":"profile"};
function nav(){
 for(const button of document.querySelectorAll('#nav button[data-page],.mobile-nav button[data-page]')){
  const key=NAV[button.dataset.page];if(!key)continue;
  const textNode=[...button.childNodes].find(n=>n.nodeType===3&&n.textContent.trim());
  if(textNode&&textNode.textContent.trim()!==tr(key))textNode.textContent=' '+tr(key)+' ';
 }
 const active=document.querySelector('#nav button[data-page].active');
 const pageKey=active?NAV[active.dataset.page]:null;
 if(pageKey)text('#pageTitle',pageKey);
}
function profile(){
 const host=document.querySelector('#content .ldp-profile-personal');
 if(!host)return;
 const sel=document.querySelector('#profileLanguage');
 if(sel){
  for(const label of document.querySelectorAll('.ldp-profile-section label')){
   const input=label.querySelector('input,select');
   const key=({profileFirstName:'first',profileLastName:'last',profileCity:'city',
    profileCountry:'country',profileLanguage:'language',profileNewEmail:'email',
    profileCurrentPassword:'currentPass',profileNewPassword:'newPass',
    profileConfirmPassword:'confirmPass',profileReauthCode:'verificationCode'})[input?.id];
   if(!key)continue;
   const node=[...label.childNodes].find(n=>n.nodeType===3&&n.textContent.trim());
   if(node&&node.textContent.trim()!==tr(key))node.textContent=tr(key);
  }
  const disabled=host.querySelector('input:disabled');
  const disabledLabel=disabled?.closest('label');
  const first=[...(disabledLabel?.childNodes||[])].find(n=>n.nodeType===3&&n.textContent.trim());
  if(first&&first.textContent.trim()!==tr('email'))first.textContent=tr('email');
 }
 text('.ldp-profile-personal .ldp-profile-heading h3','personal');
 text('.ldp-profile-email .ldp-profile-heading h3','emailChange');
 text('.ldp-profile-password .ldp-profile-heading h3','passwordChange');
 const buttons={saveProfile:'save',logoutBtn:'signout',requestEmailChangeBtn:'requestEmail',
  sendAccountNonceBtn:'sendCode',changeAccountPasswordBtn:'updatePass'};
 for(const [id,key]of Object.entries(buttons))text('#'+id,key);
}
function dashboard(){
 const host=document.querySelector('#androidDashboardParityV119');
 if(!host)return;
 for(const [sel,key]of [
  ['.ldp119-today .ldp119-heading h2','todayNext'],
  ['.ldp119-around .ldp119-heading h2','around'],
  ['.ldp119-world .ldp119-heading h2','worldInfo'],
  ['.ldp119-route h2','openRoute'],['.ldp119-news .ldp119-heading h2','newsRss']
 ])text(sel,key,host);
 const tiles=[
  ['.ldp119-around .ldp119-shortcut',['fuel','parking','food','hotels','charging','pharmacies']],
  ['.ldp119-world .ldp119-shortcut',['fires','quakes','airTraffic','roads']]
 ];
 for(const [selector,keys]of tiles){
  [...host.querySelectorAll(selector)].forEach((tile,i)=>{
   const node=tile.lastElementChild;
   if(node&&keys[i]&&node.textContent!==tr(keys[i]))node.textContent=tr(keys[i]);
  });
 }
 for(const [selector,key]of [
  ['.ldp119-chip-today','today'],['.ldp119-chip-next','nextTen'],['.ldp119-chip-waiting','waiting']
 ]){
  const button=host.querySelector(selector);
  if(!button)continue;
  const digits=button.textContent.match(/\d+$/)?.[0]||'0';
  const result=tr(key)+' '+digits;
  if(button.textContent!==result)button.textContent=result;
 }
 const all=host.querySelector('.ldp119-today .ldp119-more');
 if(all&&all.textContent!==tr('showMore')+' →')all.textContent=tr('showMore')+' →';
}
function apply(){
 if(!B()?.ready())return;
 const code=locale();
 if(document.documentElement.lang!==code)document.documentElement.lang=code;
 nav();profile();dashboard();
 if(code!==lastLanguage){
  lastLanguage=code;
  document.dispatchEvent(new CustomEvent('lifedash:locale-change',{detail:{language:code}}));
 }
}
let queued=false;
function schedule(){
 if(queued)return;
 queued=true;
 queueMicrotask(()=>{queued=false;apply()});
}
new MutationObserver(schedule).observe(document.querySelector('#content'),{childList:true,subtree:true});
new MutationObserver(schedule).observe(document.querySelector('#nav'),{childList:true,subtree:true});
new MutationObserver(schedule).observe(document.querySelector('#appView'),{attributes:true,attributeFilter:['class']});
window.LifeDashWebI18n=Object.freeze({tr,locale,codes:CODES.slice(),options:CODES.map((id,i)=>({code:id,label:id}))});
schedule();
})();