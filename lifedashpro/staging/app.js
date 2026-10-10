(() => {
'use strict';
const cfg=window.LIFEDASH_CONFIG||{};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const state={client:null,session:null,user:null,profile:null,page:'dashboard',data:{},editor:null,loading:false,syncReady:false,lastSync:null,deviceId:localStorage.getItem('lifedash_web_device_id')||`web-${crypto.randomUUID?.()||Date.now()}`};
localStorage.setItem('lifedash_web_device_id',state.deviceId);
const KINDS=['notes','finance_transactions','finance_goals','family_tasks','documents','vehicles','journey_plans_beta','manual_reminders','travel','radio_favorites','family_members'];
const TITLES={dashboard:'Dashboard',today:'Today & Next 5',calendar:'Personal Calendar',notes:'Notes Pro',tasks:'Tasks',documents:'Documents',finance:'Finance',explore:'Explore & Around Me',vehicles:'Vehicles',journey:'Journey',radio:'World Radio',world:'World Live',backup:'Backup & Restore',profile:'Profile & Settings'};

function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function fmtMoney(v,c='EUR'){try{return new Intl.NumberFormat(undefined,{style:'currency',currency:c||'EUR'}).format(Number(v)||0)}catch{return `${Number(v||0).toFixed(2)} ${c||'EUR'}`}}
function today(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function isoNow(){return new Date().toISOString()}
function msg(text,type=''){const n=$('#notice');n.textContent=text;n.className=`notice ${type}`;n.classList.remove('hidden');clearTimeout(msg.t);msg.t=setTimeout(()=>n.classList.add('hidden'),5000)}
function authMsg(text,type=''){const n=$('#authMessage');n.textContent=text;n.className=`message ${type}`;n.classList.toggle('hidden',!text)}
function setBusy(on){state.loading=on;$('#refreshBtn').disabled=on;$('#refreshBtn').textContent=on?'…':'↻'}
function publicKey(){return String(cfg.publishableKey||localStorage.getItem('lifedash_web_publishable_key')||'').trim()}

async function init(){
  window.LIFEDASH_BOOT_OK?.();
  $('#boot').classList.add('hidden');
  const key=publicKey();
  if(!cfg.supabaseUrl||!key){showAuthShell(true);return}
  if(!window.supabase?.createClient){showAuthShell(true);authMsg('Secure login did not load. Please refresh this page.','error');return}
  // Show a real state immediately. No network operation can trap users on a splash screen.
  showAuthShell(false);
  try{
    state.client=window.supabase.createClient(cfg.supabaseUrl,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});
    // Install the callback BEFORE session recovery, so sign-in still works if recovery times out.
    state.client.auth.onAuthStateChange((event,session)=>{
      const oldId=state.user?.id||null;
      state.session=session;state.user=session?.user||null;
      if(event==='PASSWORD_RECOVERY')queueMicrotask(()=>$('#passwordDialog').showModal());
      if(event==='SIGNED_OUT'){
        state.data={};state.profile=null;state.lastSync=null;state.loading=false;state.syncReady=false;
        queueMicrotask(()=>showAuthShell(false));
      }else if(event==='SIGNED_IN'&&session&&(!oldId||oldId!==session.user.id)){
        // Auth callback must not run asynchronous database queries inside the lock.
        setTimeout(()=>enterApp().catch(e=>{showAuthShell(false);authMsg('Could not load your account: '+e.message,'error')}),0);
      }
    });
    const {data,error}=await Promise.race([state.client.auth.getSession(),new Promise((_,rej)=>setTimeout(()=>rej(new Error('Login session check timed out. Please try signing in again.')),12000))]);
    if(error)throw error;
    state.session=data.session;state.user=data.session?.user||null;
    if(state.session)await enterApp();
  }catch(e){showAuthShell(false);authMsg('Secure login is temporarily unavailable: '+e.message,'error')}
}
function showAuthShell(needsKey){$('#appView').classList.add('hidden');$('#authView').classList.remove('hidden');$('#keySetup').classList.toggle('hidden',!needsKey);$('#authCard').classList.toggle('hidden',needsKey)}
async function enterApp(){
  state.data={};state.profile=null;state.syncReady=false;
  $('#authView').classList.add('hidden');$('#appView').classList.remove('hidden');
  await loadProfile();await refreshAll();render();
}
async function loadProfile(){
  if(!state.user)return;
  const {data,error}=await state.client.from('profiles').select('id,name,first_name,last_name,city,country,language,avatar_url').eq('id',state.user.id).maybeSingle();
  if(error){console.warn('profile',error)}
  state.profile=data||{id:state.user.id,name:state.user.user_metadata?.name||state.user.user_metadata?.full_name||'',city:'',country:state.user.user_metadata?.country||'',language:state.user.user_metadata?.language||'en',avatar_url:null};
  const initial=(state.profile?.name||state.user.email||'U').trim().charAt(0).toUpperCase()||'U';$('#avatar').textContent=initial;
}
async function loadKind(kind){
  const {data,error}=await state.client.from('user_data').select('item_id,payload,updated_at,deleted_at,revision').eq('user_id',state.user.id).eq('kind',kind).order('updated_at',{ascending:false}).limit(1000);
  if(error)throw error;
  return (data||[]).filter(x=>!x.deleted_at).map(x=>({...x.payload,id:String(x.payload?.id||x.item_id),_sync:{updated_at:x.updated_at,revision:x.revision}}));
}
async function refreshAll(){
  if(!state.user||state.loading)return;setBusy(true);$('#syncLabel').textContent='Syncing…';
  try{const rows=await Promise.all(KINDS.map(async k=>[k,await loadKind(k)]));state.data=Object.fromEntries(rows);state.syncReady=true;state.lastSync=new Date();$('#syncDot').classList.add('good');$('#syncLabel').textContent='Secure sync';$('#syncTime').textContent=`Updated ${state.lastSync.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;updateCounts();render()}
  catch(e){state.syncReady=false;$('#syncLabel').textContent='Sync issue';msg(`Sync error: ${e.message}`,'error');render()}
  finally{setBusy(false)}
}
async function assertFresh(kind,record){
  if(!state.syncReady)throw new Error('Data sync is not ready. Refresh before editing.');
  const meta=record?._sync;if(!meta)return;
  const {data,error}=await state.client.from('user_data')
    .select('revision,updated_at,deleted_at').eq('user_id',state.user.id).eq('kind',kind)
    .eq('item_id',String(record.id)).maybeSingle();
  if(error)throw error;
  if(!data||data.deleted_at||Number(data.revision)!==Number(meta.revision))
    throw new Error('This item changed on another device. Refresh and review it before saving.');
}
async function upsertRecord(kind,item){
  if(!state.syncReady)throw new Error('Data not loaded; cannot save until sync succeeds.');
  const loaded=(state.data[kind]||[]).find(x=>String(x.id)===String(item.id));
  if(loaded)await assertFresh(kind,loaded);
  const payload={...item,id:String(item.id)};delete payload._sync;
  const row={user_id:state.user.id,kind,item_id:String(item.id),payload,deleted_at:null,device_id:state.deviceId,updated_at:isoNow()};
  const {data,error}=await state.client.from('user_data').upsert(row,{onConflict:'user_id,kind,item_id'}).select('revision,updated_at,payload').single();if(error)throw error;
  const saved={...(data?.payload||payload),id:String(item.id),_sync:{revision:data?.revision,updated_at:data?.updated_at}};
  const arr=state.data[kind]||[];state.data[kind]=[saved,...arr.filter(x=>String(x.id)!==String(item.id))];updateCounts();render();
}
async function tombstoneRecord(kind,id){
  if(!state.syncReady)throw new Error('Data not loaded; cannot delete until sync succeeds.');
  const loaded=(state.data[kind]||[]).find(x=>String(x.id)===String(id));
  if(!loaded)throw new Error('Item not loaded. Refresh before deleting.');
  await assertFresh(kind,loaded);
  const now=isoNow();const row={user_id:state.user.id,kind,item_id:String(id),payload:{},deleted_at:now,device_id:state.deviceId,updated_at:now};
  const {error}=await state.client.from('user_data').upsert(row,{onConflict:'user_id,kind,item_id'});if(error)throw error;
  state.data[kind]=(state.data[kind]||[]).filter(x=>String(x.id)!==String(id));updateCounts();render();
}
function updateCounts(){const d=state.data;$('#navNotes').textContent=(d.notes||[]).length;$('#navTasks').textContent=(d.family_tasks||[]).filter(x=>!x.done).length;$('#navDocs').textContent=(d.documents||[]).length;$('#navVehicles').textContent=(d.vehicles||[]).length;$('#navJourneys').textContent=(d.journey_plans_beta||[]).length}
function setPage(page){state.page=page;location.hash=page;$$('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));$('#pageTitle').textContent=TITLES[page]||'LifeDashPro';$('#quickAddBtn').classList.toggle('hidden',!['notes','finance','tasks','dashboard'].includes(page));render()}
function render(){if(!state.session)return;const c=$('#content');if(!state.syncReady){c.innerHTML='<section class="card span-12"><h3>Checking secure sync…</h3><p>Could not verify all cloud records yet. No records have been changed. Use Refresh (↻) when your connection is available.</p></section>';$('#quickAddBtn').disabled=true;return;}$('#quickAddBtn').disabled=false;const fn={dashboard:renderDashboard,today:renderToday,calendar:()=>'<section id="personalCalendar" class="personal-calendar" aria-label="Personal Organizer Calendar"></section>',notes:renderNotes,tasks:renderTasks,documents:()=>'<section id="documentsProPage" class="documents-pro-page" aria-label="Documents Pro"></section>',finance:renderFinance,explore:()=>'<section id="exploreAroundPage" class="explore-around-page" aria-label="Explore and Around Me"></section>',vehicles:()=>'<section id="vehicleManagerV111" class="mobility-v111" aria-label="Vehicle Manager"></section>',journey:()=>'<section id="journeyManagerV111" class="mobility-v111" aria-label="Journey Manager"></section>',backup:()=>'<section id="backupRestoreV112" class="backup-v112" aria-label="Backup and Restore"></section>',profile:renderProfile,radio:()=>'<section id="worldRadioPage" class="radio-page-shell" aria-label="World Radio"></section>',world:()=>'<section id="worldLivePage" class="world-live-page" aria-label="World Live"></section>'}[state.page]||renderDashboard;c.innerHTML=fn();wirePageRows()}
function financeStats(){const tx=state.data.finance_transactions||[];let inc=0,exp=0;const currencies=new Set();for(const x of tx){const currency=String(x.currency||x.baseCurrencyAtEntry||'EUR').toUpperCase();currencies.add(currency);const a=Number(x.amount)||0;if(x.type==='income')inc+=a;else exp+=a}return{inc,exp,bal:inc-exp,currency:[...currencies][0]||'EUR',mixed:currencies.size>1}}
function fmtTotal(stats,key){return stats.mixed?'Multiple currencies':fmtMoney(stats[key],stats.currency)}
function timelineItems(){const out=[];for(const n of state.data.notes||[]){if(n.dueDate&&n.status!=='completed'&&n.status!=='archived')out.push({date:n.dueDate,time:n.dueTime||'',type:'Note',title:n.title||'Note'})}for(const t of state.data.family_tasks||[]){if(t.dueDate&&!t.done)out.push({date:t.dueDate,time:t.reminderTime||'',type:'Task',title:t.title||'Task'})}for(const r of state.data.manual_reminders||[]){const d=r.dueDate||r.date||String(r.scheduledFor||'').slice(0,10);if(d)out.push({date:d,time:r.time||r.reminderTime||'',type:'Reminder',title:r.title||r.text||'Reminder'})}return out.sort((a,b)=>`${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0,12)}
function renderDashboard(){const s=financeStats(),notes=state.data.notes||[],tasks=(state.data.family_tasks||[]).filter(x=>!x.done),journeys=state.data.journey_plans_beta||[],events=timelineItems().slice(0,3);return `<div class="grid"><section class="card span-7"><div class="card-head"><div><p class="eyebrow">TODAY AT A GLANCE</p><h3>${esc(greeting())}, ${esc(state.profile?.name||'there')}</h3></div><span class="pill">${esc(cfg.contractVersion||'v38.13')} contract</span></div><div class="timeline">${events.length?events.map(eventHtml).join(''):'<div class="empty">Nothing urgent in the current synced timeline.</div>'}</div></section><section class="card span-5"><div class="card-head"><div><p class="eyebrow">FINANCE</p><h3>Current synced totals</h3></div><button class="text-btn" data-go="finance">Open →</button></div><div class="kpi-grid"><div class="kpi"><strong>${fmtTotal(s,'inc')}</strong><span>Income</span></div><div class="kpi"><strong>${fmtTotal(s,'exp')}</strong><span>Expenses</span></div><div class="kpi"><strong>${fmtTotal(s,'bal')}</strong><span>Balance</span></div></div></section><section class="card"><div class="card-head"><div><p class="eyebrow">NOTES PRO</p><h3>${notes.length} synced notes</h3></div><button class="text-btn" data-go="notes">Open →</button></div>${miniRows(notes.slice(0,3),'note')}</section><section class="card"><div class="card-head"><div><p class="eyebrow">TASKS</p><h3>${tasks.length} waiting</h3></div><button class="text-btn" data-go="tasks">Open →</button></div>${miniRows(tasks.slice(0,3),'task')}</section><section class="card"><div class="card-head"><div><p class="eyebrow">JOURNEY</p><h3>${journeys.length} saved trips</h3></div><button class="text-btn" data-go="journey">Open →</button></div>${miniRows(journeys.slice(0,3),'journey')}</section><section class="card span-12"><p class="eyebrow">WEB ↔ ANDROID SAFETY</p><div class="info-grid"><div class="info-tile"><strong>RLS</strong><span>user-scoped database access</span></div><div class="info-tile"><strong>1 row</strong><span>record-by-record writes only</span></div><div class="info-tile"><strong>0</strong><span>full-collection replaces from web</span></div><div class="info-tile"><strong>↻</strong><span>manual refresh keeps control visible</span></div></div></section></div>`}
function greeting(){const h=new Date().getHours();return h<12?'Good morning':h<18?'Good afternoon':'Good evening'}
function eventHtml(x){return `<div class="timeline-item"><time>${esc(x.date)}${x.time?` · ${esc(x.time)}`:''}</time><i class="dot"></i><div><strong>${esc(x.type)}</strong> · ${esc(x.title)}</div></div>`}
function miniRows(items,type){if(!items.length)return '<div class="empty">No synced items yet.</div>';return `<div class="list">${items.map(x=>`<div class="timeline-item"><span class="row-icon">${type==='note'?'✎':type==='task'?'✓':'⌖'}</span><div><strong>${esc(x.title||x.description||x.destination||'Item')}</strong><small>${esc(x.dueDate||x.updatedAt||x.startDate||'')}</small></div><span>›</span></div>`).join('')}</div>`}
function renderToday(){const items=timelineItems();return pageWrap('Today & Next 5','Synced notes, tasks and reminders with due dates.',items.length?`<div class="list">${items.map(eventHtml).join('')}</div>`:'<div class="empty">No dated items found.</div>')}
function renderNotes(){const a=state.data.notes||[];return pageWrap('Notes Pro','Safe per-record web sync. Existing Android fields are preserved when editing.',listToolbar('New note','notes')+(a.length?`<div class="list">${a.map(n=>rowHtml('notes',n,'✎',n.title||'Untitled',n.description||n.dueDate||'',n.status||'active')).join('')}</div>`:'<div class="empty">No synced notes.</div>'))}
function renderTasks(){const a=state.data.family_tasks||[];return pageWrap('Tasks','Safe per-record task sync. Native Android reminder scheduling remains device-local.',listToolbar('New task','tasks')+(a.length?`<div class="list">${a.map(t=>rowHtml('tasks',t,t.done?'✓':'○',t.title||'Task',`${t.assignedTo||'Me'}${t.dueDate?' · '+t.dueDate:''}`,t.done?'done':t.priority||'medium')).join('')}</div>`:'<div class="empty">No synced tasks.</div>'))}
function renderFinance(){const a=state.data.finance_transactions||[],s=financeStats();return pageWrap('Finance','Record-level transaction sync; source-managed Android-linked rows are shown but protected from web deletion.',`<div class="info-grid"><div class="info-tile"><strong>${fmtTotal(s,'inc')}</strong><span>Income</span></div><div class="info-tile"><strong>${fmtTotal(s,'exp')}</strong><span>Expenses</span></div><div class="info-tile"><strong>${fmtTotal(s,'bal')}</strong><span>Balance</span></div><div class="info-tile"><strong>${a.length}</strong><span>Transactions</span></div></div><div style="height:14px"></div>${listToolbar('New transaction','finance')}${a.length?`<div class="list">${a.map(t=>rowHtml('finance',t,t.type==='income'?'＋':'−',t.description||'Transaction',`${t.category||'other'} · ${t.date||''}`,fmtMoney(t.amount,t.currency||'EUR'),t.type)).join('')}</div>`:'<div class="empty">No synced transactions.</div>'}`)}
function renderReadOnly(kind,title,icon){const a=state.data[kind]||[];return pageWrap(title,'Synced from the same LifeDashPro account. This web phase is read-only for this module to avoid schema-specific destructive edits.',a.length?`<div class="list">${a.map(x=>rowHtml('readonly',x,icon,x.title||x.name||x.description||[x.brand,x.model].filter(Boolean).join(' ')||'Item',x.category||x.type||x.updatedAt||'',x.status||'synced')).join('')}</div>`:'<div class="empty">No synced items.</div>')}
function renderJourney(){const a=state.data.journey_plans_beta||[];return pageWrap('Journey','Same canonical saved Journey records as Android. Editing remains Android-first in this safe-sync phase.',a.length?`<div class="list">${a.map(x=>rowHtml('readonly',x,'⌖',x.title||'Journey',`${(x.stops||[]).length} stops${x.startDate?' · '+x.startDate:''}`,x.timeMode||'saved')).join('')}</div>`:'<div class="empty">No saved journeys.</div>')}
function renderProfile(){
 const p=state.profile||{};
 const full=String(p.name||state.user?.user_metadata?.name||'').trim();
 const first=String(p.first_name||full.split(/\s+/)[0]||'').trim();
 const last=String(p.last_name!=null?p.last_name:full.split(/\s+/).slice(1).join(' ')).trim();
 return pageWrap('Profile & Settings','Manage your LifeDashPro identity and account security.',`
<section class='card span-12 profile-card ldp-profile-section ldp-profile-personal'><div class='profile-avatar'>${esc((first||state.user?.email||'U').charAt(0).toUpperCase())}</div><div>
<div class='ldp-profile-heading'><span class='ldp-profile-icon' aria-hidden='true'>◉</span><div><h3>Personal information</h3><p>Your identity and preferences, synced with LifeDashPro.</p></div></div><div class='form-grid'>
<label>First name (required)<input id='profileFirstName' autocomplete='given-name' maxlength='80' required value='${esc(first)}'></label>
<label>Last name (optional)<input id='profileLastName' autocomplete='family-name' maxlength='80' value='${esc(last)}'></label>
<label>Email (account)<input value='${esc(state.user?.email||'')}' disabled></label>
<label>City<input id='profileCity' value='${esc(p.city||'')}'></label>
<label>Country<input id='profileCountry' value='${esc(p.country||'')}'></label>
<label>Language<input id='profileLanguage' value='${esc(p.language||'en')}'></label></div>
<div class='ldp-profile-actions'><button type='button' class='primary' id='saveProfile'>Save changes</button><button type='button' class='secondary' id='logoutBtn'>Sign out</button></div></div></section>
<section class='card span-12 ldp-profile-section ldp-profile-email'><div class='ldp-profile-heading'><span class='ldp-profile-icon' aria-hidden='true'>✉</span><div><h3>Change email address</h3><p>Keep your sign-in email up to date.</p></div></div><p class='ldp-profile-description'>You may need to confirm messages at both your old and new email addresses. The current email remains active until verification is complete.</p>
<div class='form-grid'><label>New email address<input id='profileNewEmail' type='email' autocomplete='email' maxlength='254' placeholder='new@example.com'></label></div>
<div class='ldp-profile-actions'><button id='requestEmailChangeBtn' type='button' class='secondary'>Send verification request</button></div>
<p id='accountEmailMessage' class='message' role='status' aria-live='polite'></p></section>
<section class='card span-12 ldp-profile-section ldp-profile-password'><div class='ldp-profile-heading'><span class='ldp-profile-icon' aria-hidden='true'>✧</span><div><h3>Password & security</h3><p>Protect your LifeDashPro account.</p></div></div><p class='ldp-profile-description'>Enter your current password or use an email verification code. Your password is handled by Supabase Auth and is not stored in LifeDashPro records.</p>
<div class='form-grid'><label>Current password<input id='profileCurrentPassword' type='password' autocomplete='current-password'></label>
<label>New password<input id='profileNewPassword' type='password' autocomplete='new-password' minlength='12'></label>
<label>Confirm new password<input id='profileConfirmPassword' type='password' autocomplete='new-password' minlength='12'></label>
<label>One-time verification code (when used)<input id='profileReauthCode' type='text' inputmode='numeric' autocomplete='one-time-code' maxlength='12'></label></div>
<div class='ldp-profile-actions'><button id='sendAccountNonceBtn' type='button' class='secondary'>Send verification code</button><button id='changeAccountPasswordBtn' type='button' class='primary'>Update password</button></div>
<p id='accountPasswordMessage' class='message' role='status' aria-live='polite'></p></section>
<section id='accountDeletionV114' class='account-deletion-v114 ldp-profile-danger-zone' aria-label='Delete My Data or Delete Account'></section>
<section class='card span-12'><p class='eyebrow'>SYNC CONTRACT</p><p>Web version <b>${esc(cfg.webVersion||'safe-sync')}</b> · Android data contract <b>${esc(cfg.contractVersion||'v38.13')}</b>. Native Android alarms, background navigation, Car Mode and other native services are not recreated by the browser.</p></section>`);
}
function pageWrap(title,desc,body){return `<div class="section-head"><div><p class="eyebrow">LIFEDASHPRO WEB</p><h2>${esc(title)}</h2><p>${esc(desc)}</p></div></div>${body}`}
function listToolbar(label,mode){return `<div class="section-head"><div class="toolbar"><button class="primary" data-new="${mode}">＋ ${esc(label)}</button></div></div>`}
function rowHtml(mode,x,icon,title,sub,badge,cls=''){return `<div class="data-row" data-open="${mode}" data-id="${esc(x.id)}" data-ui-kind="${esc(mode)}" data-ui-date="${esc(x.date||x.dueDate||x.updatedAt||x._sync?.updated_at||'')}" data-ui-due="${esc(x.dueDate||'')}" data-ui-expires="${esc(x.expiresAt||x.expiryDate||x.expirationDate||x.validUntil||'')}" data-ui-status="${esc(x.status||'')}" data-ui-completed="${x.done===true||x.done==='true'?'true':'false'}" data-ui-type="${esc(x.type||'')}" data-ui-category="${esc(x.category||'')}" data-ui-amount="${esc(x.amount??'')}" data-ui-currency="${esc(x.currency||x.baseCurrencyAtEntry||'EUR')}"><span class="row-icon">${esc(icon)}</span><div class="row-main"><strong>${esc(title)}</strong><small>${esc(sub)}</small></div><span class="${mode==='finance'&&cls?'amount '+cls:'pill'}">${esc(badge||'')}</span></div>`}
function wirePageRows(){
  $$('[data-go]').forEach(b=>b.onclick=()=>setPage(b.dataset.go));$$('[data-new]').forEach(b=>b.onclick=()=>openEditor(b.dataset.new));
  $$('[data-open]').forEach(r=>{if(r.dataset.open!=='readonly')r.onclick=()=>openEditor(r.dataset.open,r.dataset.id)});
  $('#saveProfile')?.addEventListener('click',saveProfile);$('#logoutBtn')?.addEventListener('click',()=>state.client.auth.signOut());
  $('#requestEmailChangeBtn')?.addEventListener('click',requestEmailChange);
  $('#sendAccountNonceBtn')?.addEventListener('click',sendAccountNonce);
  $('#changeAccountPasswordBtn')?.addEventListener('click',changeAccountPassword);
}
function openEditor(mode,id){
  if(!state.syncReady)return msg('Wait until all cloud data is loaded.','error');
  const kind={notes:'notes',finance:'finance_transactions',tasks:'family_tasks'}[mode];if(!kind)return;
  const item=(state.data[kind]||[]).find(x=>String(x.id)===String(id))||null;state.editor={mode,kind,item};
  $('#editorEyebrow').textContent=item?'EDIT':'NEW';$('#editorTitle').textContent=mode==='notes'?'Note':mode==='finance'?'Transaction':'Task';$('#editorDelete').classList.toggle('hidden',!item||isProtectedFinance(item));$('#editorSave').classList.toggle('hidden',isProtectedFinance(item));
  $('#editorFields').innerHTML=mode==='notes'?noteFields(item):mode==='finance'?financeFields(item):taskFields(item);$('#editorDialog').showModal();
}
function val(id){return document.getElementById(id)?.value?.trim()||''}function checked(id){return !!document.getElementById(id)?.checked}
function noteFields(n={}){return `<div class="form-grid"><label class="wide">Title<input id="fTitle" value="${esc(n?.title||'')}"></label><label class="wide">Description<textarea id="fDescription">${esc(n?.description||'')}</textarea></label><label>Due date<input id="fDue" type="date" value="${esc(n?.dueDate||'')}"></label><label>Status<select id="fStatus"><option ${n?.status==='active'?'selected':''}>active</option><option ${n?.status==='pending_payment'?'selected':''}>pending_payment</option><option ${n?.status==='completed'?'selected':''}>completed</option><option ${n?.status==='archived'?'selected':''}>archived</option></select></label></div>`}
function financeFields(t={}){return `<div class="form-grid"><label class="wide">Description<input id="fDescription" value="${esc(t?.description||'')}"></label><label>Type<select id="fType"><option value="expense" ${t?.type!=='income'?'selected':''}>Expense</option><option value="income" ${t?.type==='income'?'selected':''}>Income</option></select></label><label>Amount<input id="fAmount" type="number" step="0.01" min="0" value="${esc(t?.amount??'')}"></label><label>Currency<input id="fCurrency" maxlength="3" value="${esc(t?.currency||'EUR')}"></label><label>Category<input id="fCategory" value="${esc(t?.category||'other')}"></label><label>Date<input id="fDate" type="date" value="${esc(t?.date||today())}"></label><label style="display:flex;align-items:center;grid-template-columns:auto 1fr;gap:8px"><input id="fPaid" type="checkbox" ${t?.isPaid?'checked':''} style="width:auto"> Paid</label>${isProtectedFinance(t)?'<p class="wide message">This transaction is managed by another Android module. Web editing and deletion are disabled.</p>':''}</div>`}
function taskFields(t={}){return `<div class="form-grid"><label class="wide">Title<input id="fTitle" value="${esc(t?.title||'')}"></label><label>Assigned to<input id="fAssigned" value="${esc(t?.assignedTo||'Me')}"></label><label>Due date<input id="fDue" type="date" value="${esc(t?.dueDate||today())}"></label><label>Priority<select id="fPriority"><option ${t?.priority==='high'?'selected':''}>high</option><option ${!t?.priority||t?.priority==='medium'?'selected':''}>medium</option><option ${t?.priority==='low'?'selected':''}>low</option></select></label><label style="display:flex;align-items:center;grid-template-columns:auto 1fr;gap:8px"><input id="fDone" type="checkbox" ${t?.done?'checked':''} style="width:auto"> Completed</label></div>`}
function isProtectedFinance(t){return !!(t&&t.sourceModule&&t.sourceModule!=='web')}
async function saveEditor(){
  const e=state.editor;if(!e)return;if(isProtectedFinance(e.item))return msg('Android-managed transactions are read-only on Web.','error');const old=e.item||{},now=isoNow();let item;
  if(e.mode==='notes'){const title=val('fTitle');if(!title)return msg('Note title is required.','error');item={...old,id:old.id||`web-note-${Date.now()}`,type:old.type||'note',title,description:val('fDescription'),dueDate:val('fDue')||undefined,createdAt:old.createdAt||now,updatedAt:now,status:val('fStatus')||old.status||'active'}}
  if(e.mode==='finance'){const d=val('fDescription'),rawAmount=val('fAmount'),amount=Number(rawAmount);if(!d||!rawAmount||!Number.isFinite(amount)||amount<0)return msg('Description and valid amount are required.','error');item={...old,id:old.id||`web-tx-${Date.now()}`,type:val('fType')==='income'?'income':'expense',amount,currency:(val('fCurrency')||'EUR').toUpperCase(),description:d,category:val('fCategory')||'other',date:val('fDate')||today(),createdAt:old.createdAt||now,updatedAt:now,periodicity:old.periodicity||'once',isPaid:checked('fPaid'),sourceModule:old.sourceModule||'web',sourceId:old.sourceId}}
  if(e.mode==='tasks'){const title=val('fTitle');if(!title)return msg('Task title is required.','error');item={...old,id:old.id||`web-task-${Date.now()}`,title,assignedTo:val('fAssigned')||'Me',done:checked('fDone'),priority:val('fPriority')||'medium',dueDate:val('fDue')||undefined,createdAt:old.createdAt||now,updatedAt:now}}
  try{$('#editorSave').disabled=true;await upsertRecord(e.kind,item);$('#editorDialog').close();msg('Saved and synchronized.','good')}catch(x){msg(`Save failed: ${x.message}`,'error')}finally{$('#editorSave').disabled=false}
}
async function deleteEditor(){const e=state.editor;if(!e?.item||isProtectedFinance(e.item))return;if(!confirm('Delete this item? This will synchronize the deletion to the same LifeDashPro account.'))return;try{await tombstoneRecord(e.kind,e.item.id);$('#editorDialog').close();msg('Deleted with synchronized tombstone.','good')}catch(x){msg(`Delete failed: ${x.message}`,'error')}}
async function saveProfile(){
 const first=String($('#profileFirstName')?.value||'').trim();
 const last=String($('#profileLastName')?.value||'').trim();
 if(!first||first.length>80||last.length>80)return msg('First name is required (80 characters maximum per field).','error');
 const row={id:state.user.id,name:[first,last].filter(Boolean).join(' '),first_name:first,last_name:last,city:$('#profileCity').value.trim(),country:$('#profileCountry').value.trim(),language:$('#profileLanguage').value.trim()||'en'};
 const button=$('#saveProfile');if(button)button.disabled=true;
 try{
  if(!state.session||!state.syncReady)throw new Error('Sign in and finish sync before updating your profile.');
  const {data,error}=await state.client.from('profiles').upsert(row,{onConflict:'id'}).select().single();
  if(error)throw error;
  state.profile=data;const initial=first.charAt(0).toUpperCase();$('#avatar').textContent=initial;
  msg('Profile saved.','good');render();
 }catch(e){msg('Profile save failed: '+e.message,'error')}finally{if(button?.isConnected)button.disabled=false}
}
function accountMessage(id,message,error=false){
 const el=$('#'+id);if(!el)return;el.textContent=String(message||'').slice(0,400);
 el.className='message'+(error?' error':'');
}
async function assertCurrentAccount(){
 if(!state.user||!state.session||!state.client)throw new Error('Please sign in again.');
 const uid=state.user.id;
 const {data,error}=await state.client.auth.getUser();
 if(error||!data?.user||data.user.id!==uid||state.user?.id!==uid)throw new Error('Session changed. Sign in again before changing credentials.');
 return uid;
}
async function requestEmailChange(){
 const input=$('#profileNewEmail'),button=$('#requestEmailChangeBtn');
 const newEmail=String(input?.value||'').trim().toLowerCase();
 if(newEmail.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail))return accountMessage('accountEmailMessage','Enter a valid new email address. ',true);
 if(newEmail===String(state.user?.email||'').toLowerCase())return accountMessage('accountEmailMessage','This is already your current email.',true);
 if(!window.confirm('Request an email change to '+newEmail+'? You may need to confirm messages at both email addresses.'))return;
 if(button)button.disabled=true;
 try{
  await assertCurrentAccount();
  const {error}=await state.client.auth.updateUser({email:newEmail},{emailRedirectTo:location.origin+(cfg.basePath||'/lifedashpro/staging/')});
  if(error)throw error;
  if(input)input.value='';
  accountMessage('accountEmailMessage','Email change requested. Follow the verification messages. Your old email remains active until confirmation.');
 }catch(e){accountMessage('accountEmailMessage','Email change failed: '+e.message,true)}
 finally{if(button?.isConnected)button.disabled=false}
}
async function sendAccountNonce(){
 const button=$('#sendAccountNonceBtn');if(button)button.disabled=true;
 try{await assertCurrentAccount();
  const {error}=await state.client.auth.reauthenticate();if(error)throw error;
  accountMessage('accountPasswordMessage','Verification code requested. Check your confirmed email and enter the code before updating the password.');
 }catch(e){accountMessage('accountPasswordMessage','Could not send verification code: '+e.message,true)}
 finally{if(button?.isConnected)button.disabled=false}
}
async function changeAccountPassword(){
 const oldEl=$('#profileCurrentPassword'),newEl=$('#profileNewPassword'),confirmEl=$('#profileConfirmPassword'),nonceEl=$('#profileReauthCode'),button=$('#changeAccountPasswordBtn');
 const currentPassword=String(oldEl?.value||''),password=String(newEl?.value||''),confirmation=String(confirmEl?.value||''),nonce=String(nonceEl?.value||'').trim();
 const clear=()=>{for(const el of [oldEl,newEl,confirmEl,nonceEl])if(el)el.value=''};
 if(password.length<12||password.length>128)return accountMessage('accountPasswordMessage','Choose a password of 12–128 characters.',true);
 if(password!==confirmation)return accountMessage('accountPasswordMessage','New passwords do not match.',true);
 if(!currentPassword&&!nonce)return accountMessage('accountPasswordMessage','Provide your current password or a verification code.',true);
 if(currentPassword&&currentPassword===password)return accountMessage('accountPasswordMessage','New password must differ from the current password.',true);
 if(button)button.disabled=true;
 try{
  await assertCurrentAccount();
  const attrs={password};if(currentPassword)attrs.current_password=currentPassword;if(nonce)attrs.nonce=nonce;
  const {error}=await state.client.auth.updateUser(attrs);if(error)throw error;
  clear();accountMessage('accountPasswordMessage','Password changed successfully. Use the new password the next time you sign in.');
 }catch(e){clear();accountMessage('accountPasswordMessage','Password change failed: '+e.message,true)}
 finally{if(button?.isConnected)button.disabled=false}
}
$$('[data-auth]').forEach(b=>b.onclick=()=>{const mode=b.dataset.auth;$$('[data-auth]').forEach(x=>x.classList.toggle('active',x===b));$('#signinForm').classList.toggle('hidden',mode!=='signin');$('#registerForm').classList.toggle('hidden',mode!=='register');authMsg('')});
$('#saveKeyBtn').onclick=()=>{const k=$('#setupKey').value.trim();if(!k)return authMsg('Enter a public publishable/anon key.','error');if(k.startsWith('sb_secret_')||k.includes('service_role'))return authMsg('Secret/service-role keys must never be used in the browser.','error');localStorage.setItem('lifedash_web_publishable_key',k);location.reload()};
$('#signinForm').onsubmit=async e=>{e.preventDefault();authMsg('Signing in…');const {error}=await state.client.auth.signInWithPassword({email:$('#signinEmail').value.trim(),password:$('#signinPassword').value});if(error)authMsg(error.message,'error')};
$('#registerForm').onsubmit=async e=>{e.preventDefault();authMsg('Creating account…');const email=$('#registerEmail').value.trim(),password=$('#registerPassword').value,firstName=$('#registerFirstName').value.trim(),lastName=$('#registerLastName').value.trim(),country=$('#registerCountry').value,language=$('#registerLanguage').value;if(!firstName||firstName.length>80||lastName.length>80)return authMsg('First name is required (up to 80 characters).','error');const name=[firstName,lastName].filter(Boolean).join(' ');const emailRedirectTo=`${location.origin}${cfg.basePath||'/lifedashpro/'}`;const {data,error}=await state.client.auth.signUp({email,password,options:{emailRedirectTo,data:{name,full_name:name,first_name:firstName,last_name:lastName,country,language}}});if(error)return authMsg(error.message,'error');if(data.session){authMsg('Account created and signed in.','good')}else authMsg('Account created. Check your email to confirm, then sign in.','good')};
$('#forgotBtn').onclick=async()=>{const email=$('#signinEmail').value.trim();if(!email)return authMsg('Enter your email first.','error');const redirectTo=`${location.origin}${cfg.basePath||'/lifedashpro/'}`;const {error}=await state.client.auth.resetPasswordForEmail(email,{redirectTo});authMsg(error?error.message:'Password reset email sent.',error?'error':'good')};
$('#updatePasswordBtn').onclick=async()=>{const p=$('#newPassword').value;if(p.length<8)return $('#passwordMessage').textContent='Use at least 8 characters.';const {error}=await state.client.auth.updateUser({password:p});if(error){$('#passwordMessage').textContent=error.message;$('#passwordMessage').classList.remove('hidden');return}$('#passwordDialog').close();msg('Password updated.','good')};
$('#refreshBtn').onclick=refreshAll;$('#quickAddBtn').onclick=()=>openEditor(state.page==='finance'?'finance':state.page==='tasks'?'tasks':'notes');$('#editorSave').onclick=saveEditor;$('#editorDelete').onclick=deleteEditor;
$$('[data-page]').forEach(b=>b.onclick=()=>setPage(b.dataset.page));
// V1.7 radio adapter: strictly scoped to the existing Android radio_favorites kind.
// Reuse the same user-scoped RLS and revision-safe CRUD routines.
// v1.8 read-only World Live adapter to the existing authenticated Edge Function.
// Never expose the JWT, Supabase client or data write operations to the view.
// World Live Edge requests: recover once from a stale authenticated web token.
// The Edge Functions keep verify_jwt=true, user validation and per-user throttling.
let worldAuthRefreshPromise=null;
async function invokeWorldSecure(slug,body){
  if(!state.user||!state.session||!state.client)throw new Error('Sign in first.');
  const userId=state.user.id;
  let response=await state.client.functions.invoke(slug,{body});
  if(response.error&&Number(response.error?.context?.status)===401){
    // One shared refresh avoids concurrent FIRMS / ADS-B token rotation races.
    if(!worldAuthRefreshPromise){
      const requestedClient=state.client;
      worldAuthRefreshPromise=requestedClient.auth.refreshSession().finally(()=>{
        worldAuthRefreshPromise=null;
      });
    }
    let renewed;
    try{renewed=await worldAuthRefreshPromise}
    catch(_){throw new Error('Login session expired. Please sign out and sign in again.');}
    if(renewed?.error||!renewed?.data?.session?.access_token||
       renewed.data.session.user?.id!==userId||
       state.user?.id!==userId)
      throw new Error('Login session expired. Please sign out and sign in again.');
    response=await state.client.functions.invoke(slug,{body});
  }
  if(response.error){
    const status=Number(response.error?.context?.status)||0;
    let detail='';
    try{
      const context=response.error?.context;
      const message=context?.clone?await context.clone().json():null;
      if(typeof message?.error==='string')detail=message.error.slice(0,140);
    }catch(_){}
    if(status===401)throw new Error('Login authorization failed (401). Sign out and sign in again.');
    if(status===429)throw new Error('Source rate limit reached (429). Wait before refreshing.');
    if(status===503)throw new Error(detail||'Live source is temporarily unavailable (503).');
    throw new Error(detail||(status?'Live source request failed (HTTP '+status+').':
      'Live source connection failed.'));
  }
  if(!response.data||response.data.ok!==true)throw new Error(
    String(response.data?.error||'Live source returned invalid data').slice(0,140));
  return response.data;
}
// Read-only v1.9 calendar adapter. Uses the existing per-user, RLS-scoped sync.
// Calendar displays the same Android records; no new table, alarms or mutations.
// Web v1.9.1: read-only Documents Pro bridge. Private attachments are downloaded
// only on explicit user action using existing authenticated Storage RLS.
// Web v1.9.2: additive read-only finance analytics. Use the existing canonical
// Android user_data collections; never create recurring occurrences or edit records.
window.LifeDashFinanceBridge=Object.freeze({
  ready:()=>Boolean(state.user&&state.session&&state.syncReady),
  identity:()=>state.user?.id||null,
  snapshot:()=>{
    if(!state.user||!state.session||!state.syncReady)return null;
    return {
      transactions:(state.data.finance_transactions||[]).map(row=>({...row})),
      goals:(state.data.finance_goals||[]).map(row=>({...row}))
    };
  }
});
// Web v1.11: read-only vehicle / journey adapter to Android's exact RLS-scoped
// user_data records. Does not modify native navigation, service alarms, or SAR.
// Web v1.12: server snapshots through existing per-user RLS backup APIs.
// Never store passwords, auth tokens, or unsafe silent overwrite actions here.
const BACKUP_SAFE_KINDS=Object.freeze([
  'notes','notes_contacts','notes_settings','finance_transactions','finance_goals',
  'family_tasks','manual_reminders','documents','vehicles','journey_plans_beta',
  'travel','radio_favorites','family_members','family_events','family_moments',
  'habits','habit_entries','home_utility_meters','home_utility_readings',
  'weather_saved_cities','app_preferences','car_mode_preferences'
]);
function backupReady(){
  return Boolean(state.client&&state.user&&state.session&&state.syncReady);
}
function backupClient(write=false){
  if(!backupReady()||(write&&state.loading))
    throw new Error('Wait for authenticated sync to finish before modifying backups or restoring records.');
  return {client:state.client,userId:state.user.id};
}
// Web v1.14 isolated erasure adapter; only existing JWT-protected functions can delete.
window.LifeDashAccountDeletionBridge=Object.freeze({
 ready:()=>Boolean(state.client&&state.session&&state.user&&state.syncReady),
 status:async()=>{
   if(!state.client||!state.session||!state.user||!state.syncReady)
     throw new Error('Sign in and finish syncing before deleting.');
   const uid=state.user.id;
   const {data,error}=await state.client.auth.getUser();
   if(error||!data?.user||data.user.id!==uid||state.user?.id!==uid)
     throw new Error('Session changed. Sign in again.');
   return {userId:uid,email:String(data.user.email||''),lastSignInAt:String(data.user.last_sign_in_at||'')};
 },
 execute:async mode=>{
   if(!['data','account'].includes(mode))throw new Error('Unsupported deletion mode.');
   const identity=await window.LifeDashAccountDeletionBridge.status();
   if(!identity.email)throw new Error('An account email is required.');
   const last=Date.parse(identity.lastSignInAt);
   if(!Number.isFinite(last)||Date.now()-last>15*60*1000||last>Date.now()+60000)
     throw new Error('Recent sign-in required. Sign out and sign in again, then try within 15 minutes.');
   const slug=mode==='data'?'delete-user-data':'delete-account';
   const confirm=mode==='data'?'DELETE DATA':'DELETE';
   const {data,error}=await state.client.functions.invoke(slug,{body:{confirm}});
   if(error)throw new Error('Server completion not confirmed. Partial deletion is possible; contact support before retrying.');
   if(data?.ok!==true)throw new Error(String(data?.error||'Deletion not confirmed; partial deletion is possible.').slice(0,240));
   return {deletedFiles:Number(data.deletedFiles)||0};
 },
 clearSession:async()=>{
   const client=state.client;
   state.data={};state.profile=null;state.syncReady=false;state.lastSync=null;
   if(client){
     try{
       const result=await client.auth.signOut({scope:'global'});
       if(result?.error)await client.auth.signOut({scope:'local'});
     }catch(_){try{await client.auth.signOut({scope:'local'})}catch(__){}}
   }
   state.session=null;state.user=null;showAuthShell(false);
 }
});
window.LifeDashBackupBridge=Object.freeze({
  ready:backupReady,
  identity:()=>state.user?.id||null,
  availableKinds:()=>BACKUP_SAFE_KINDS.slice(),
  list:async()=>{
    const {client,userId}=backupClient();
    const {data,error}=await client.from('user_data_backups')
      .select('id,reason,row_count,created_at')
      .eq('user_id',userId).order('created_at',{ascending:false}).limit(50);
    if(error)throw error;
    return data||[];
  },
  create:async reason=>{
    backupClient(true);
    const {data,error}=await state.client.rpc('create_user_data_backup',{
      p_reason:String(reason||'manual:web-v1.12').slice(0,100)
    });
    if(error)throw error;
    if(!Number.isSafeInteger(Number(data))||Number(data)<=0)throw new Error('Unexpected backup creation response.');
    return Number(data);
  },
  read:async backupId=>{
    const {client,userId}=backupClient();
    if(!Number.isSafeInteger(Number(backupId))||Number(backupId)<=0)throw new Error('Invalid backup identifier.');
    const {data,error}=await client.from('user_data_backups')
      .select('id,user_id,reason,row_count,created_at,snapshot')
      .eq('user_id',userId).eq('id',Number(backupId)).maybeSingle();
    if(error)throw error;
    if(!data||data.user_id!==userId)throw new Error('Backup not found or not owned by current user.');
    return data;
  },
  currentIndex:async()=>{
    const {client,userId}=backupClient(),rows=[];
    for(let offset=0;offset<10000;offset+=500){
      if(state.user?.id!==userId||!state.syncReady)throw new Error('Session changed while reading live data.');
      const {data,error}=await client.from('user_data')
        .select('kind,item_id,deleted_at').eq('user_id',userId)
        .order('kind',{ascending:true}).order('item_id',{ascending:true})
        .range(offset,offset+499);
      if(error)throw error;
      rows.push(...(data||[]));
      if(!data||data.length<500)return rows;
    }
    throw new Error('Live dataset exceeds the supported 10,000-row preview limit. No records changed.');
  },
  restoreMissing:async (rows,expectedOwner)=>{
    const {client,userId}=backupClient(true);
    if(expectedOwner!==userId)throw new Error('Backup belongs to a different account.');
    if(!Array.isArray(rows)||!rows.length||rows.length>5000)
      throw new Error('Invalid or oversized missing-row selection.');
    const safe=new Set(BACKUP_SAFE_KINDS),known=new Set();
    // Validate every row before creating a pre-restore snapshot.
    for(const r of rows){
      const key=String(r?.kind||'')+'|'+String(r?.item_id||'');
      if(!r||!safe.has(r.kind)||typeof r.item_id!=='string'||
        !r.item_id||r.item_id.length>180||r.item_id.includes('|')||
        !r.payload||typeof r.payload!=='object'||Array.isArray(r.payload)||
        (r.payload.id!=null&&String(r.payload.id)!==r.item_id)||
        r.deleted_at!=null||known.has(key))throw new Error('Invalid or duplicate restore record. Nothing changed.');
      known.add(key);
    }
    const {data:snapshotId,error:backupError}=await client.rpc('create_user_data_backup',{
      p_reason:'pre-restore-missing:web-v1.12'
    });
    if(backupError||!Number(snapshotId))throw backupError||new Error('Safety backup failed. Restore cancelled.');
    let inserted=0;
    // Small batches: onConflict do nothing. Active AND soft-deleted rows are
    // preserved. Server constraints enforce uniqueness atomically with every batch.
    for(let i=0;i<rows.length;i+=25){
      if(!backupReady()||state.user?.id!==userId)
        throw new Error('Restore stopped: login/sync state changed. '+inserted+' rows may have been created.');
      const batch=rows.slice(i,i+25).map(r=>({
        user_id:userId,kind:r.kind,item_id:r.item_id,payload:r.payload,
        deleted_at:null,device_id:state.deviceId,updated_at:new Date().toISOString()
      }));
      const {data,error}=await client.from('user_data')
        .upsert(batch,{onConflict:'user_id,kind,item_id',ignoreDuplicates:true})
        .select('item_id');
      if(error)throw new Error('Restore stopped after '+inserted+' new rows. '+error.message);
      inserted+=(data||[]).length;
    }
    return {inserted,preBackupId:Number(snapshotId)};
  },
  // The existing server RPC OVERWRITES matching active records and resurrects
  // soft-deleted rows. UI must show exact risk and require explicit typed consent.
  restoreFullMerge:async backupId=>{
    backupClient(true);
    if(!Number.isSafeInteger(Number(backupId))||Number(backupId)<=0)
      throw new Error('Invalid restore backup ID.');
    const {data,error}=await state.client.rpc('restore_user_data_backup_merge',{
      p_backup_id:Number(backupId)
    });
    if(error)throw error;
    return Number(data)||0;
  },
  refresh:async()=>{
    backupClient(true);
    await refreshAll();
    return state.syncReady;
  }
});
window.LifeDashMobilityBridge=Object.freeze({
  ready:()=>Boolean(state.user&&state.session&&state.syncReady),
  identity:()=>state.user?.id||null,
  snapshot:()=>{
    if(!state.user||!state.session||!state.syncReady)return null;
    const kinds=['vehicles','journey_plans_beta','documents'];
    return Object.fromEntries(kinds.map(kind=>[
      kind,(state.data[kind]||[]).map(item=>({...item}))
    ]));
  }
});
window.LifeDashDocumentsBridge=Object.freeze({
  ready:()=>Boolean(state.user&&state.session&&state.syncReady),
  identity:()=>state.user?.id||null,
  snapshot:()=>state.user&&state.session&&state.syncReady?
    (state.data.documents||[]).map(doc=>({...doc})):null,
  readFile:async id=>{
    if(!state.user||!state.session||!state.syncReady||!state.client)
      throw new Error('Sign in and finish secure sync first.');
    const doc=(state.data.documents||[]).find(x=>String(x.id)===String(id));
    if(!doc)throw new Error('Document is no longer in your synced records. Refresh data.');
    const path=String(doc.storagePath||'');
    // Local Android file:// URIs are not web-readable. Never use an untrusted URL.
    if(!path.startsWith(state.user.id+'/documents/')||
       path.includes('..')||/[?#\\]/.test(path))
      throw new Error('This document has no accessible cloud file. It may exist only on your Android device.');
    const {data,error}=await state.client.storage.from('lifedash-attachments').download(path);
    if(error||!(data instanceof Blob))
      throw new Error('Could not securely download this document: '+(error?.message||'File unavailable.'));
    return {blob:data,name:String(doc.name||'Document').slice(0,170),
      mime:String(doc.mimeType||data.type||'application/octet-stream').slice(0,90)};
  }
});
window.LifeDashCalendarBridge=Object.freeze({
  ready:()=>Boolean(state.user&&state.session&&state.syncReady),
  identity:()=>state.user?.id||null,
  snapshot:()=>{
    if(!state.user||!state.session||!state.syncReady)return null;
    const kinds=['notes','family_tasks','manual_reminders','documents','family_members'];
    return Object.fromEntries(kinds.map(kind=>[
      kind,(state.data[kind]||[]).map(item=>({...item}))
    ]));
  }
});
// Web v1.10 Explore: existing per-user protected nearby-places service.
// No exposed provider keys, no continuous GPS tracking, and no data writes.
window.LifeDashExploreBridge=Object.freeze({
  ready:()=>Boolean(state.user&&state.session&&state.syncReady),
  identity:()=>state.user?.id||null,
  profileCity:()=>String(state.profile?.city||''),
  nearby:async options=>{
    const response=await invokeWorldSecure('nearby-places',options);
    if(!Array.isArray(response.places))throw new Error('Nearby places response unavailable.');
    return response;
  },
  cities:async query=>{
    const response=await invokeWorldSecure('nearby-places',{action:'geocode-city',query,lang:'en'});
    if(!Array.isArray(response.cities))throw new Error('City search response unavailable.');
    return response.cities;
  }
});
window.LifeDashWorldBridge=Object.freeze({
  authenticated:()=>Boolean(state.user&&state.session),
  identity:()=>state.user?.id||null,
  profileCity:()=>String(state.profile?.city||''),
  air:async location=>{
    const data=await invokeWorldSecure('air-traffic-nearby',location);
    if(!Array.isArray(data.aircraft))throw new Error('Air Traffic response unavailable');
    return data;
  },
  fires:async bounds=>{
    const data=await invokeWorldSecure('nasa-firms-nearby',bounds);
    if(!Array.isArray(data.fires))throw new Error('FIRMS response unavailable');
    return data.fires;
  }
});
window.LifeDashRadioBridge=Object.freeze({
  authenticated:()=>Boolean(state.user&&state.session),
  ready:()=>Boolean(state.user&&state.session&&state.syncReady),
  favorites:()=>state.user&&state.syncReady?[...(state.data.radio_favorites||[])]:[],
  saveFavorite:async item=>{
    if(!state.user||!state.syncReady)throw new Error('Sign in and finish sync first.');
    if(!item||typeof item.id!=='string'||!item.id.trim()||item.stationuuid!==item.id)throw new Error('Invalid station identifier.');
    return upsertRecord('radio_favorites',item);
  },
  removeFavorite:async id=>{
    if(!state.user||!state.syncReady)throw new Error('Sign in and finish sync first.');
    return tombstoneRecord('radio_favorites',String(id));
  }
});
window.addEventListener('hashchange',()=>{const p=location.hash.slice(1);if(TITLES[p])setPage(p)});
window.addEventListener('online',()=>state.session&&refreshAll());
window.addEventListener('focus',()=>{if(state.session&&state.lastSync&&Date.now()-state.lastSync.getTime()>120000)refreshAll()});
init().then(()=>{const p=location.hash.slice(1);if(TITLES[p])setPage(p)});
})();
