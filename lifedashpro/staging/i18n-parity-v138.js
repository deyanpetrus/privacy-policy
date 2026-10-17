/* LifeDashPro Web v1.38 — supplementary 12-language UI strings for Documents/Vehicles/Journey.
   Uses the same authenticated profiles.language as the existing Web i18n; never translates user data. */
(()=>{'use strict';
const codes=['en','mk','sr','hr','bs','cnr','sl','bg','sq','el','ro','de'];
const d={
'Your documents':['Your documents','Твоите документи','Tvoji dokumenti','Tvoji dokumenti','Tvoji dokumenti','Tvoji dokumenti','Tvoji dokumenti','Твоите документи','Dokumentet e tua','Τα έγγραφά σου','Documentele tale','Deine Dokumente'],
'All documents':['All documents','Сите документи','Svi dokumenti','Svi dokumenti','Svi dokumenti','Svi dokumenti','Vsi dokumenti','Всички документи','Të gjitha dokumentet','Όλα τα έγγραφα','Toate documentele','Alle Dokumente'],
'Expired':['Expired','Истечени','Istekli','Istekli','Istekli','Istekli','Potekli','Изтекли','Të skaduara','Ληγμένα','Expirate','Abgelaufen'],
'Next 30 days':['Next 30 days','Следни 30 дена','Narednih 30 dana','Sljedećih 30 dana','Narednih 30 dana','Narednih 30 dana','Naslednjih 30 dni','Следващите 30 дни','30 ditët e ardhshme','Επόμενες 30 ημέρες','Următoarele 30 de zile','Nächste 30 Tage'],
'Cloud files':['Cloud files','Облачни датотеки','Datoteke u oblaku','Datoteke u oblaku','Datoteke u oblaku','Datoteke u oblaku','Datoteke v oblaku','Облачни файлове','Skedarët në renë kompjuterike','Αρχεία cloud','Fișiere în cloud','Cloud-Dateien'],
'Find documents':['Find documents','Најди документи','Pronađi dokumente','Pronađi dokumente','Pronađi dokumente','Pronađi dokumente','Poišči dokumente','Намери документи','Gjej dokumente','Εύρεση εγγράφων','Caută documente','Dokumente suchen'],
'Category':['Category','Категорија','Kategorija','Kategorija','Kategorija','Kategorija','Kategorija','Категория','Kategoria','Κατηγορία','Categorie','Kategorie'],
'Validity':['Validity','Важност','Važenje','Valjanost','Važenje','Važenje','Veljavnost','Валидност','Vlefshmëria','Ισχύς','Valabilitate','Gültigkeit'],
'Type':['Type','Тип','Tip','Vrsta','Tip','Tip','Vrsta','Тип','Lloji','Τύπος','Tip','Typ'],
'Sort':['Sort','Подреди','Poređaj','Poredaj','Poredaj','Poređaj','Razvrsti','Подреди','Rendit','Ταξινόμηση','Sortează','Sortieren'],
'Synced · read only':['Synced · read only','Синхронизирано · само преглед','Sinhronizovano · samo pregled','Sinkronizirano · samo pregled','Sinhronizovano · samo pregled','Sinhronizovano · samo pregled','Sinhronizirano · samo ogled','Синхронизирано · само преглед','Sinkronizuar · vetëm lexim','Συγχρονισμένο · μόνο προβολή','Sincronizat · doar citire','Synchronisiert · nur lesen'],
'Details →':['Details →','Детали →','Detalji →','Detalji →','Detalji →','Detalji →','Podrobnosti →','Подробности →','Detaje →','Λεπτομέρειες →','Detalii →','Details →'],
'Save changes':['Save changes','Зачувај промени','Sačuvaj izmene','Spremi promjene','Sačuvaj izmjene','Sačuvaj izmjene','Shrani spremembe','Запази промените','Ruaj ndryshimet','Αποθήκευση αλλαγών','Salvează modificările','Änderungen speichern'],
'Cancel':['Cancel','Откажи','Otkaži','Odustani','Otkaži','Otkaži','Prekliči','Отказ','Anulo','Άκυρο','Anulează','Abbrechen'],
'Add vehicle':['Add vehicle','Додај возило','Dodaj vozilo','Dodaj vozilo','Dodaj vozilo','Dodaj vozilo','Dodaj vozilo','Добави превозно средство','Shto automjet','Προσθήκη οχήματος','Adaugă vehicul','Fahrzeug hinzufügen'],
'Edit vehicle':['Edit vehicle','Уреди возило','Uredi vozilo','Uredi vozilo','Uredi vozilo','Uredi vozilo','Uredi vozilo','Редактирай превозно средство','Ndrysho automjetin','Επεξεργασία οχήματος','Editează vehicul','Fahrzeug bearbeiten'],
'Delete vehicle':['Delete vehicle','Избриши возило','Obriši vozilo','Izbriši vozilo','Obriši vozilo','Obriši vozilo','Izbriši vozilo','Изтрий превозно средство','Fshi automjetin','Διαγραφή οχήματος','Șterge vehicul','Fahrzeug löschen'],
'Add service':['Add service','Додај сервис','Dodaj servis','Dodaj servis','Dodaj servis','Dodaj servis','Dodaj servis','Добави сервиз','Shto servis','Προσθήκη συντήρησης','Adaugă service','Service hinzufügen'],
'Add fuel':['Add fuel','Додај гориво','Dodaj gorivo','Dodaj gorivo','Dodaj gorivo','Dodaj gorivo','Dodaj gorivo','Добави зареждане','Shto karburant','Προσθήκη καυσίμου','Adaugă alimentare','Tankvorgang hinzufügen'],
'Vehicle name':['Vehicle name','Име на возило','Naziv vozila','Naziv vozila','Naziv vozila','Naziv vozila','Ime vozila','Име на превозно средство','Emri i automjetit','Όνομα οχήματος','Nume vehicul','Fahrzeugname'],
'Brand':['Brand','Марка','Marka','Marka','Marka','Marka','Znamka','Марка','Marka','Μάρκα','Marcă','Marke'],
'Model':['Model','Модел','Model','Model','Model','Model','Model','Модел','Modeli','Μοντέλο','Model','Modell'],
'Year':['Year','Година','Godina','Godina','Godina','Godina','Leto','Година','Viti','Έτος','An','Baujahr'],
'License plate':['License plate','Регистарска табличка','Registarska oznaka','Registracijska oznaka','Registracijska oznaka','Registarska oznaka','Registrska oznaka','Регистрационен номер','Targa','Πινακίδα','Număr înmatriculare','Kennzeichen'],
'Color':['Color','Боја','Boja','Boja','Boja','Boja','Barva','Цвят','Ngjyra','Χρώμα','Culoare','Farbe'],
'Fuel type':['Fuel type','Тип гориво','Vrsta goriva','Vrsta goriva','Vrsta goriva','Vrsta goriva','Vrsta goriva','Вид гориво','Lloji i karburantit','Τύπος καυσίμου','Tip combustibil','Kraftstoffart'],
'Odometer':['Odometer','Километража','Kilometraža','Kilometraža','Kilometraža','Kilometraža','Števec kilometrov','Километраж','Kilometrazhi','Χιλιόμετρα','Kilometraj','Kilometerstand'],
'Next service at km':['Next service at km','Следен сервис на km','Sledeći servis na km','Sljedeći servis na km','Sljedeći servis na km','Sljedeći servis na km','Naslednji servis pri km','Следващ сервиз при км','Servisi tjetër në km','Επόμενο σέρβις στα χλμ.','Următorul service la km','Nächster Service bei km'],
'Last service':['Last service','Последен сервис','Poslednji servis','Zadnji servis','Posljednji servis','Posljednji servis','Zadnji servis','Последен сервиз','Servisi i fundit','Τελευταίο σέρβις','Ultimul service','Letzter Service'],
'Insurance expires':['Insurance expires','Истек на осигурување','Istek osiguranja','Istek osiguranja','Istek osiguranja','Istek osiguranja','Potek zavarovanja','Изтичане на застраховка','Skadimi i sigurimit','Λήξη ασφάλισης','Expirare asigurare','Versicherung läuft ab'],
'Registration expires':['Registration expires','Истек на регистрација','Istek registracije','Istek registracije','Istek registracije','Istek registracije','Potek registracije','Изтичане на регистрация','Skadimi i regjistrimit','Λήξη άδειας','Expirare înmatriculare','Zulassung läuft ab'],
'Technical inspection expires':['Technical inspection expires','Истек на технички преглед','Istek tehničkog pregleda','Istek tehničkog pregleda','Istek tehničkog pregleda','Istek tehničkog pregleda','Potek tehničnega pregleda','Изтичане на технически преглед','Skadimi i kontrollit teknik','Λήξη ΚΤΕΟ','Expirare ITP','HU läuft ab'],
'Notes':['Notes','Белешки','Beleške','Bilješke','Bilješke','Bilješke','Opombe','Бележки','Shënime','Σημειώσεις','Note','Notizen'],
'Service type':['Service type','Вид сервис','Vrsta servisa','Vrsta servisa','Vrsta servisa','Vrsta servisa','Vrsta servisa','Вид сервиз','Lloji i servisit','Είδος σέρβις','Tip service','Serviceart'],
'Cost':['Cost','Цена','Trošak','Trošak','Trošak','Trošak','Strošek','Разход','Kosto','Κόστος','Cost','Kosten'],
'Currency':['Currency','Валута','Valuta','Valuta','Valuta','Valuta','Valuta','Валута','Monedha','Νόμισμα','Monedă','Währung'],
'Date':['Date','Датум','Datum','Datum','Datum','Datum','Datum','Дата','Data','Ημερομηνία','Dată','Datum'],
'Station':['Station','Бензинска','Pumpa','Postaja','Pumpa','Pumpa','Postaja','Бензиностанция','Stacioni','Πρατήριο','Stație','Tankstelle'],
'Liters':['Liters','Литри','Litri','Litre','Litri','Litri','Litri','Литри','Litra','Λίτρα','Litri','Liter'],
'Total':['Total','Вкупно','Ukupno','Ukupno','Ukupno','Ukupno','Skupaj','Общо','Totali','Σύνολο','Total','Gesamt'],
'My garage':['My garage','Моја гаража','Moja garaža','Moja garaža','Moja garaža','Moja garaža','Moja garaža','Моят гараж','Garazhi im','Το γκαράζ μου','Garajul meu','Meine Garage'],
'Saved vehicles':['Saved vehicles','Зачувани возила','Sačuvana vozila','Spremljena vozila','Sačuvana vozila','Sačuvana vozila','Shranjena vozila','Запазени превозни средства','Automjete të ruajtura','Αποθηκευμένα οχήματα','Vehicule salvate','Gespeicherte Fahrzeuge'],
'Urgent / expired dates':['Urgent / expired dates','Итни / истечени датуми','Hitni / istekli rokovi','Hitni / istekli rokovi','Hitni / istekli rokovi','Hitni / istekli rokovi','Nujni / pretečeni roki','Спешни / изтекли срокове','Afate urgjente / të skaduara','Επείγουσες / ληγμένες ημερομηνίες','Termene urgente / expirate','Dringende / abgelaufene Termine'],
'Service records':['Service records','Сервисни записи','Servisni zapisi','Servisni zapisi','Servisni zapisi','Servisni zapisi','Servisni zapisi','Сервизни записи','Regjistra servisi','Αρχεία συντήρησης','Înregistrări service','Serviceeinträge'],
'Fuel entries':['Fuel entries','Полнења гориво','Točenja goriva','Točenja goriva','Točenja goriva','Točenja goriva','Točenja goriva','Зареждания','Furnizime karburanti','Ανεφοδιασμοί','Alimentări','Tankvorgänge'],
'Overview':['Overview','Преглед','Pregled','Pregled','Pregled','Pregled','Pregled','Общ преглед','Përmbledhje','Επισκόπηση','Prezentare generală','Übersicht'],
'Services':['Services','Сервиси','Servisi','Servisi','Servisi','Servisi','Servisi','Сервизи','Servise','Συντηρήσεις','Service-uri','Services'],
'Fuel':['Fuel','Гориво','Gorivo','Gorivo','Gorivo','Gorivo','Gorivo','Гориво','Karburant','Καύσιμο','Combustibil','Kraftstoff'],
'Service history':['Service history','Историја на сервиси','Istorija servisa','Povijest servisa','Historija servisa','Istorija servisa','Zgodovina servisov','История на сервизи','Historia e serviseve','Ιστορικό συντήρησης','Istoric service','Serviceverlauf'],
'Fuel history':['Fuel history','Историја на гориво','Istorija goriva','Povijest goriva','Historija goriva','Istorija goriva','Zgodovina goriva','История на горивото','Historia e karburantit','Ιστορικό ανεφοδιασμών','Istoric alimentări','Tankverlauf'],
'Vehicle details':['Vehicle details','Детали за возило','Detalji vozila','Detalji vozila','Detalji vozila','Detalji vozila','Podrobnosti vozila','Данни за превозното средство','Detajet e automjetit','Στοιχεία οχήματος','Detalii vehicul','Fahrzeugdetails'],
'Saved journeys':['Saved journeys','Зачувани патувања','Sačuvana putovanja','Spremljena putovanja','Sačuvana putovanja','Sačuvana putovanja','Shranjena potovanja','Запазени пътувания','Udhëtime të ruajtura','Αποθηκευμένα ταξίδια','Călătorii salvate','Gespeicherte Reisen'],
'Document details':['Document details','Детали за документ','Detalji dokumenta','Detalji dokumenta','Detalji dokumenta','Detalji dokumenta','Podrobnosti dokumenta','Данни за документа','Detaje dokumenti','Λεπτομέρειες εγγράφου','Detalii document','Dokumentdetails'],
'Preview file':['Preview file','Прегледај датотека','Pregled datoteke','Pregled datoteke','Pregled datoteke','Pregled datoteke','Predogled datoteke','Преглед на файл','Shiko skedarin','Προεπισκόπηση αρχείου','Previzualizare fișier','Dateivorschau'],
'Download file':['Download file','Преземи датотека','Preuzmi datoteku','Preuzmi datoteku','Preuzmi datoteku','Preuzmi datoteku','Prenesi datoteko','Изтегли файл','Shkarko skedarin','Λήψη αρχείου','Descarcă fișier','Datei herunterladen'],
'Sync first':['Sync first','Прво синхронизирај','Prvo sinhronizuj','Prvo sinkroniziraj','Prvo sinhronizuj','Prvo sinhronizuj','Najprej sinhroniziraj','Първо синхронизирай','Sinkronizo së pari','Συγχρόνισε πρώτα','Sincronizează mai întâi','Zuerst synchronisieren'],
'Saving':['Saving','Се зачувува','Čuvanje','Spremanje','Čuvanje','Čuvanje','Shranjevanje','Запазване','Duke ruajtur','Αποθήκευση','Se salvează','Speichern'],
'Save failed':['Save failed','Неуспешно зачувување','Čuvanje nije uspelo','Spremanje nije uspjelo','Čuvanje nije uspjelo','Čuvanje nije uspjelo','Shranjevanje ni uspelo','Неуспешно запазване','Ruajtja dështoi','Αποτυχία αποθήκευσης','Salvare eșuată','Speichern fehlgeschlagen'],
'Invalid value':['Invalid value','Невалидна вредност','Neispravna vrednost','Neispravna vrijednost','Neispravna vrijednost','Neispravna vrijednost','Neveljavna vrednost','Невалидна стойност','Vlerë e pavlefshme','Μη έγκυρη τιμή','Valoare invalidă','Ungültiger Wert'],
'Enter liters and total':['Enter liters and total','Внеси литри и вкупна цена','Unesi litre i ukupno','Unesi litre i ukupno','Unesi litre i ukupno','Unesi litre i ukupno','Vnesi litre in skupni znesek','Въведи литри и сума','Shkruaj litra dhe totalin','Συμπλήρωσε λίτρα και σύνολο','Introdu litri și total','Liter und Gesamtbetrag eingeben'],
'Delete vehicle confirmation':['Delete vehicle confirmation','Сигурно да го избришеме возилото? Ова се синхронизира со Android.','Sigurno obrisati vozilo? Briše se i na Androidu.','Zaista izbrisati vozilo? Sinkronizira se s Androidom.','Sigurno obrisati vozilo? Sinhronizuje se s Androidom.','Sigurno obrisati vozilo? Sinhronizuje se sa Androidom.','Res izbrisati vozilo? Sinhronizira se z Androidom.','Да изтрием ли автомобила? Синхронизира се с Android.','Të fshihet automjeti? Sinkronizohet me Android.','Διαγραφή οχήματος; Συγχρονίζεται με Android.','Ștergi vehiculul? Se sincronizează cu Android.','Fahrzeug löschen? Wird auch mit Android synchronisiert.']
};
const toMap=Object.fromEntries(Object.entries(d).map(([key,translations])=>[key,translations]));
function locale(){const c=String(window.LifeDashWebI18n?.locale?.()||'en').toLowerCase().split('-')[0];return codes.includes(c)?c:'en'}
function tr(text){const k=String(text||'').replace(/^[＋✎×]\s*/,'').trim();const row=toMap[k];return row?row[codes.indexOf(locale())]||row[0]:text}
const selectors=[
 '.documents-pro-page .docs-heading h2','.documents-pro-page .docs-read-only',
 '.documents-pro-page .docs-stats .docs-stat span',
 '.documents-pro-page .docs-filter-field>span','.documents-pro-page .docs-details-button',
 '.documents-pro-page .docs-select option','#docsDetailsDialog .docs-detail-title',
 '#docsDetailsDialog .docs-detail-actions button','#docsDetailsDialog .docs-detail-pair>span',
 '.mobility-v111 .mob111-intro h2','.mobility-v111 .mob111-kpi span',
 '.mobility-v111 .mob111-chooser>strong','.mobility-v111 .mob111-tabs button',
 '.mobility-v111 .mob111-section-head h3','.mobility-v111 .mob111-details-grid .mob111-pair span',
 '.mobility-v111 .mob111-expiry-grid .mob111-expiry-card small',
 '.mobility-v111 .mob138-action'
];
function translateNode(n){
 if(!n||n.children?.length)return;
 const raw=n.dataset.ldp138Original||n.textContent.trim();
 if(!toMap[raw])return;
 n.dataset.ldp138Original=raw;
 const value=tr(raw);if(n.textContent!==value)n.textContent=value;
}
function apply(){
 if(document.querySelector('#appView')?.classList.contains('hidden'))return;
 for(const sel of selectors)for(const el of document.querySelectorAll(sel))translateNode(el);
}
let queued=false;
function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;apply()})}
new MutationObserver(schedule).observe(document.querySelector('#content'),{subtree:true,childList:true});
document.addEventListener('lifedash:locale-change',schedule);
window.LifeDashParityI18nV138=Object.freeze({tr,locale,codes:codes.slice()});
schedule();
})();
