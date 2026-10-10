/* LifeDashPro staging Web v1.12 — Data Safety / Backup & Restore
 * Uses existing RLS-protected public.user_data_backups and server snapshot RPCs.
 * Missing-only inserts do NOT overwrite active/tombstoned records.
 * Full merge is deliberately distinct and requires typed OVERWRITE confirmation.
 * No backend migration, no automatic actions or storage file uploads.
 */
(()=>{
'use strict';
const $=(q,r=document)=>r.querySelector(q);
const E=(tag,cls,value)=>{
 const n=document.createElement(tag);
 if(cls)n.className=cls;
 if(value!==undefined)n.textContent=String(value);
 return n;
};
const content=$('#content'),app=$('#appView');if(!content||!app)return;
const bridge=()=>window.LifeDashBackupBridge;
const FORMAT_VERSION=2,MAX_ROWS=5000,MAX_FILE_BYTES=25*1024*1024;
const ALLOWED_SOURCES=new Set(['server','local-first']); // server RPC and Android local-first sync snapshots
const statusText=msg=>String(msg??'').slice(0,550);
let user='',backups=[],loading=false,selected=null,origin='',currentRows=null,plan=null;
let verified=null,previewPending=false,confirmation=false,overwriteText='';
let noticeText='',noticeKind='';
const nameOf=k=>({
 notes:'Notes Pro',notes_contacts:'Notes Contacts',notes_settings:'Notes settings',
 finance_transactions:'Finance transactions',finance_goals:'Savings goals',
 family_tasks:'Tasks',manual_reminders:'Reminders',documents:'Documents',
 vehicles:'Vehicles',journey_plans_beta:'Journey',radio_favorites:'Radio favorites',
 family_members:'Family members',family_events:'Family events',family_moments:'Family moments',
 habits:'Habits',habit_entries:'Habit entries',home_utility_meters:'Utility meters',
 home_utility_readings:'Utility readings',weather_saved_cities:'Saved weather cities',
 app_preferences:'App preferences',car_mode_preferences:'Car Mode preferences',
 travel:'Travel',notification_registry:'Native notification registry',
 notification_settings:'Notification settings'
})[k]||String(k||'Other');
function stamp(t){
 if(!t)return 'Unknown date';
 const d=new Date(t);
 return !Number.isFinite(d.getTime())?String(t).slice(0,50):
   new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(d);
}
const valid=()=>Boolean(bridge()?.ready())&&!app.classList.contains('hidden');
const button=(text,fn,cls='secondary')=>{const b=E('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;};
function show(message,severity=''){
 noticeText=statusText(message);noticeKind=severity;
 const n=$('#backupMessageV112');
 if(n){n.textContent=noticeText;n.className='backup-message '+noticeKind}
}
function oneLine(obj){
 if(typeof obj==='string')return obj.slice(0,180);
 return String(obj?.message||obj?.error||'Unexpected error').slice(0,180);
}
function resetSelection(){
 selected=null;origin='';currentRows=null;plan=null;verified=null;previewPending=false;confirmation=false;overwriteText='';
}
function jsonCheck(snapshot,owner){
 if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)||!Array.isArray(snapshot.rows))
   throw new Error('Invalid backup structure. No records changed.');
 if(snapshot.schemaVersion!==FORMAT_VERSION)
   throw new Error('Unsupported backup schema version. No records changed.');
 if(!ALLOWED_SOURCES.has(snapshot.source))
   throw new Error('Unsupported backup source. No records changed.');
 if(snapshot.ownerUserId!==owner)
   throw new Error('Backup belongs to another account. No records changed.');
 if(snapshot.rows.length>MAX_ROWS)
   throw new Error('Snapshot exceeds the 5,000-row safety limit; no records changed.');
 const seen=new Set(),safe=new Set(bridge()?.availableKinds()||[]);
 const categories=new Map();let active=0,deleted=0,unsafe=0;
 for(const r of snapshot.rows){
   if(!r||typeof r!=='object'||Array.isArray(r)||
      typeof r.kind!=='string'||!r.kind||r.kind.length>100||
      typeof r.item_id!=='string'||!r.item_id||r.item_id.length>180||
      !r.payload||typeof r.payload!=='object'||Array.isArray(r.payload)||
      (r.payload.id!=null&&String(r.payload.id)!==r.item_id)||
      (r.deleted_at!==null&&r.deleted_at!==undefined&&typeof r.deleted_at!=='string'))
       throw new Error('Malformed backup row found; no records changed.');
   const key=r.kind+'\u001f'+r.item_id;
   if(seen.has(key))throw new Error('Duplicate row keys in backup; no records changed.');
   seen.add(key);
   if(r.deleted_at==null){
     active++;categories.set(r.kind,(categories.get(r.kind)||0)+1);
     if(!safe.has(r.kind))unsafe++;
   }else deleted++;
 }
 return {snapshot,active,deleted,unsafe,categories};
}
function diffBackup(check,live){
 const seen=new Map();
 for(const r of live)seen.set(String(r.kind)+'\u001f'+String(r.item_id),r);
 const allowed=new Set(bridge().availableKinds());
 const missing=[],blocked=[];
 let existing=0,softDeleted=0,unsupported=0;
 for(const r of check.snapshot.rows){
   if(r.deleted_at!=null)continue;
   const row=seen.get(r.kind+'\u001f'+r.item_id);
   if(row){
     if(row.deleted_at!=null){softDeleted++;blocked.push(r)}
     else existing++;
   }else if(allowed.has(r.kind))missing.push(r);
   else unsupported++;
 }
 return {missing,blocked,existing,softDeleted,unsupported,
    active:check.active,deleted:check.deleted,unsafe:check.unsafe,
    categories:check.categories};
}
function kpi(label,value){
 const box=E('div','backup-kpi');
 box.append(E('strong','',value),E('span','',label));return box;
}
function download(snapshot){
 const content=JSON.stringify(snapshot,null,2);
 if(content.length>MAX_FILE_BYTES)throw new Error('Backup too large for browser download.');
 const blob=new Blob([content],{type:'application/json;charset=utf-8'});
 const href=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=href;a.download='lifedashpro-backup-'+
  String(snapshot.createdAt||new Date().toISOString()).slice(0,10)+'.json';
 document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(href),45000);
}
async function reloadList(){
 if(!valid())return;
 loading=true;draw();show('Loading your private backup history…');
 try{
   const list=await bridge().list();
   if(!valid()||bridge().identity()!==user)return;
   backups=list;show('Backup list refreshed · '+list.length+' saved snapshots.');
 }catch(e){show('Could not load backups: '+oneLine(e),'error')}
 finally{loading=false;draw()}
}
async function createBackup(){
 if(!valid()||loading)return;
 loading=true;draw();show('Creating full server-side snapshot…');
 try{
   const id=await bridge().create('manual:web-v1.12');
   show('Server backup #'+id+' created. You can inspect or download it.','success');
   backups=await bridge().list();
 }catch(e){show('Backup creation failed: '+oneLine(e),'error')}
 finally{loading=false;draw()}
}
async function selectServer(id){
 if(!valid()||loading)return;
 loading=true;draw();show('Reading private snapshot and checking live record IDs…');
 try{
   const data=await bridge().read(id);
   const check=jsonCheck(data.snapshot,user);
   const live=await bridge().currentIndex();
   if(!valid()||bridge().identity()!==user)return;
   resetSelection();selected={id:data.id,reason:data.reason,createdAt:data.created_at,
    rowCount:data.row_count,snapshot:check.snapshot};
   origin='server';verified=check;currentRows=live;plan=diffBackup(check,live);
   show('Backup validated for this account. Review the preview before restoring.','success');
 }catch(e){show('Backup validation failed: '+oneLine(e),'error')}
 finally{loading=false;draw()}
}
async function importJson(file){
 if(!valid()||loading||!file)return;
 if(file.size>MAX_FILE_BYTES){show('File exceeds 25 MB; not read or uploaded.','error');return}
 loading=true;draw();show('Validating selected local JSON file (nothing is uploaded)…');
 try{
   const raw=await file.text();
   const snapshot=JSON.parse(raw);
   const check=jsonCheck(snapshot,user);
   const live=await bridge().currentIndex();
   if(!valid()||bridge().identity()!==user)return;
   resetSelection();selected={id:null,reason:String(snapshot.reason||'Local file').slice(0,90),
      createdAt:snapshot.createdAt||'',rowCount:snapshot.rows.length,snapshot};
   origin='file';verified=check;currentRows=live;plan=diffBackup(check,live);
   show('Local file validated. File stays in your browser; nothing was restored or uploaded.','success');
 }catch(e){show('Import preview rejected: '+oneLine(e),'error')}
 finally{loading=false;draw()}
}
async function recheckPlan(){
 // Always re-read current state before any mutation; otherwise preview may be stale.
 if(!selected||!valid()||!verified)throw new Error('Select a validated backup first.');
 const live=await bridge().currentIndex();
 if(!valid()||bridge().identity()!==user)throw new Error('Session changed; restore cancelled.');
 currentRows=live;plan=diffBackup(verified,live);
 return plan;
}
async function restoreMissing(){
 if(!valid()||!plan||!confirmation||loading)return;
 if(!plan.missing.length){show('No missing eligible records in this snapshot. No changes required.');return}
 loading=true;draw();show('Refreshing restore preview against the latest records…');
 try{
   const updated=await recheckPlan();
   if(!updated.missing.length){show('Nothing new to restore. All eligible records are present.');return}
   if(!window.confirm('Restore '+updated.missing.length+
     ' missing records? Existing and soft-deleted entries stay untouched. A pre-restore server backup is created first.'))return;
   show('Creating safety snapshot and restoring missing records…');
   const saved=await bridge().restoreMissing(updated.missing,user);
   resetSelection();
   const refreshed=await bridge().refresh();
   if(refreshed){
     try{backups=await bridge().list()}catch(_){}
     show('Restore completed: '+saved.inserted+' new records · pre-restore backup #'+saved.preBackupId+
       '. Existing and soft-deleted records were preserved.','success');
   }else{
     show('Restore committed: '+saved.inserted+' new records, safety backup #'+saved.preBackupId+
       '. Refresh could not finish; reload the page to verify counts.','error');
   }
 }catch(e){show('Restore stopped: '+oneLine(e)+'. Review backups before retrying.','error')}
 finally{loading=false;confirmation=false;draw()}
}
async function restoreFull(){
 if(!valid()||!selected||origin!=='server'||!plan||loading||
    !confirmation||overwriteText.trim()!=='OVERWRITE')return;
 loading=true;draw();show('Rechecking the complete merge preview…');
 try{
   const updated=await recheckPlan();
   const message='DANGER: this restores '+updated.active+' active backup records, replacing matching CURRENT records ('+
     updated.existing+') and potentially resurrecting '+updated.softDeleted+
     ' soft-deleted records. An automatic pre-restore snapshot is made first. Continue?';
   if(!window.confirm(message))return;
   const id=Number(selected.id);
   show('Running confirmed server merge restore. Do not close this tab…');
   const count=await bridge().restoreFullMerge(id);
   resetSelection();
   const refreshed=await bridge().refresh();
   if(refreshed){
     try{backups=await bridge().list()}catch(_){}
     show('Full merge completed: '+count+' backup rows. An automatic server safety snapshot was created.','success');
   }else{
     show('Full merge completed on server: '+count+' rows, but refreshing the web list failed. Reload and inspect the new safety backup.','error');
   }
 }catch(e){show('Full merge failed: '+oneLine(e)+'. No retry without reviewing backup history.','error')}
 finally{loading=false;confirmation=false;overwriteText='';draw()}
}
function intro(host){
 const top=E('div','backup-intro');
 const heading=E('div');
 heading.append(E('p','eyebrow','DATA SAFETY · WEB v1.12'),E('h2','','Backup & Restore'),
   E('p','backup-muted',
      'Private Supabase snapshots, independent local download, validated preview, and controlled recovery.'));
 top.append(heading);host.append(top);
 const caution=E('p','backup-warning');
 caution.append(E('strong','','Your data stays under your account. '),
   document.createTextNode('Server backups include all user_data kinds, even ones that do not have a web page. '+
   'Attached PDF/image file bytes are NOT included in this JSON backup — only their metadata and storage references.'));
 host.append(caution);
}
function history(host){
 const panel=E('section','backup-panel');
 const heading=E('div','backup-section-head');
 const title=E('div');title.append(E('h3','','Server backups'),
   E('p','backup-muted','Existing per-account snapshots. No backups are deleted here.'));
 const buttons=E('div','backup-actions');
 const refresh=button('↻ Refresh list',reloadList);
 const create=button('＋ Create backup',createBackup,'primary');
 refresh.disabled=loading;create.disabled=loading;
 buttons.append(refresh,create);heading.append(title,buttons);panel.append(heading);
 const info=E('div','backup-list');
 if(!backups.length)info.append(E('p','backup-empty',
   loading?'Loading snapshots…':'No backup history displayed. Choose Refresh list or Create backup.'));
 for(const item of backups){
   const row=E('div','backup-entry');
   const label=E('div','backup-entry-meta');
   label.append(E('strong','','Backup #'+item.id),
     E('span','',stamp(item.created_at)+' · '+item.row_count+' rows · '+String(item.reason||'manual').slice(0,100)));
   const choose=button(selected?.id===item.id&&origin==='server'?'Selected':'Preview ↗',
     ()=>selectServer(item.id));
   choose.disabled=loading;row.append(label,choose);info.append(row);
 }
 panel.append(info);host.append(panel);
}
function importPanel(host){
 const panel=E('section','backup-panel');
 panel.append(E('div','backup-section-head',undefined));
 const header=panel.firstElementChild;
 const title=E('div');
 title.append(E('h3','','Local backup file'),E('p','backup-muted',
   'Choose a JSON file previously downloaded from LifeDashPro. Preview runs locally without uploading the file.'));
 header.append(title);
 const input=E('input','backup-file');
 input.type='file';input.accept='.json,application/json';input.disabled=loading;
 input.setAttribute('aria-label','Choose local LifeDashPro JSON backup');
 input.addEventListener('change',()=>{const file=input.files?.[0];if(file)void importJson(file)});
 panel.append(input);
 panel.append(E('p','backup-muted',
   'A downloaded JSON file is NOT encrypted. Store it privately; it may contain finance, notes, locations and other personal data.'));
 host.append(panel);
}
function preview(host){
 const panel=E('section','backup-panel');
 panel.append(E('h3','','Restore preview'));
 if(!selected||!plan){
   panel.append(E('p','backup-empty','Select a server backup above, or choose a local JSON file. Nothing will be restored until you explicitly confirm.'));
   host.append(panel);return;
 }
 const src=origin==='server'?'Server backup #'+selected.id:'Local JSON file';
 panel.append(E('p','backup-muted',src+' · '+stamp(selected.createdAt)+' · '+String(selected.reason||'manual').slice(0,110)));
 const cards=E('div','backup-kpis');
 for(const [label,value]of [
   ['Active snapshot rows',plan.active],['Missing eligible',plan.missing.length],
   ['Already active',plan.existing],['Soft-deleted (preserved)',plan.softDeleted],
   ['Snapshot tombstones',plan.deleted],['Unsupported for safe restore',plan.unsupported]
 ])cards.append(kpi(label,value));
 panel.append(cards);
 const cats=E('div','backup-categories');
 cats.append(E('h4','','Snapshot content by module'));
 const entries=[...plan.categories].sort((a,b)=>a[0].localeCompare(b[0]));
 for(const [kind,count]of entries){
   const item=E('span','backup-category',nameOf(kind)+' · '+count);
   cats.append(item);
 }
 if(!entries.length)cats.append(E('p','backup-muted','This snapshot has no active records.'));
 panel.append(cats);
 const controls=E('div','backup-controls');
 if(origin==='server'){
   const save=button('↓ Download JSON',()=>{try{download(selected.snapshot);show('Private JSON download started. Keep it in a secure location.','success')}
     catch(e){show('Download failed: '+oneLine(e),'error')}});
   controls.append(save);
 }else controls.append(E('p','backup-muted','Local backup file: full server merge is disabled. Missing-only restore is available.'));
 panel.append(controls);
 const safe=E('div','backup-restore-safe');
 safe.append(E('h4','','Restore missing only · safer'));
 safe.append(E('p','backup-muted',
   'Adds only records with no existing database row and only for supported user-data modules. '+
   'Never overwrites active records or revives soft-deleted records. Creates a new server backup first.'));
 const agree=E('label','backup-consent');
 const box=E('input');box.type='checkbox';box.checked=confirmation;
 box.disabled=loading;
 box.addEventListener('change',()=>{confirmation=box.checked;draw()});
 agree.append(box,E('span','','I reviewed the preview and want to restore only truly missing rows.'));
 safe.append(agree);
 const restore=button('Restore '+plan.missing.length+' missing record(s)',
   restoreMissing,'primary');
 restore.disabled=loading||!confirmation||!plan.missing.length;
 safe.append(restore);
 panel.append(safe);
 const danger=E('div','backup-restore-danger');
 danger.append(E('h4','','Full merge restore · overwrite risk'),
   E('p','backup-muted',
      'This uses the existing server restore function. It restores ALL active snapshot kinds, overwrites current rows with matching IDs and can revive soft-deleted records. A server pre-restore snapshot is created automatically. Do not use this if you only need missing rows.'));
 if(origin==='server'){
   const label=E('label','backup-confirm-label');
   label.append(E('span','','To enable full merge, type OVERWRITE'));
   const entry=E('input','backup-overwrite');
   entry.type='text';entry.autocomplete='off';entry.placeholder='OVERWRITE';
   entry.maxLength=14;entry.value=overwriteText;entry.disabled=loading;
   entry.addEventListener('input',()=>{overwriteText=entry.value;const b=$('#backupMergeNow');if(b)b.disabled=loading||!confirmation||overwriteText.trim()!=='OVERWRITE'});
   label.append(entry);danger.append(label);
   const merge=button('Full merge restore · '+plan.active+' rows',restoreFull,'backup-danger-button');
   merge.id='backupMergeNow';merge.disabled=loading||!confirmation||overwriteText.trim()!=='OVERWRITE';
   danger.append(merge);
 }else danger.append(E('p','backup-muted','Only server-stored backups support full merge restore.'));
 panel.append(danger);
 host.append(panel);
}
function draw(){
 const host=$('#backupRestoreV112',content);
 if(!host)return;
 host.dataset.backupV112Ready='1';host.replaceChildren();
 intro(host);
 const stats=E('div','backup-header-kpis');
 stats.append(kpi('Server backups shown',backups.length),
    kpi('Account verified',user?'Yes':'No'),
    kpi('Restore mode',plan?'Reviewing':'Idle'));
 host.append(stats);
 const grid=E('div','backup-workspace');
 const left=E('div','backup-workspace-left'),right=E('div','backup-workspace-right');
 history(left);importPanel(left);preview(right);
 grid.append(left,right);host.append(grid);
 const m=E('p','backup-message '+noticeKind,noticeText);
 m.id='backupMessageV112';m.setAttribute('role','status');
 host.append(m);
 host.append(E('p','backup-footer',
   'No automatic restore, background backup polling or destructive cleanup. Server snapshots and local files are user-scoped. Native Android alarms and stored attachment files are not regenerated by JSON restoration.'));
 if(loading){host.querySelectorAll('button').forEach(b=>{b.disabled=true})}
}
function observe(){
 const host=$('#backupRestoreV112',content);
 if(!valid()){
   if(user){user='';backups=[];loading=false;resetSelection();noticeText='';noticeKind=''}
   return;
 }
 const newUser=String(bridge().identity()||'');
 if(newUser!==user){user=newUser;backups=[];resetSelection();noticeText='';noticeKind=''}
 if(!host)return;
 if(!host.dataset.backupV112Ready){draw();void reloadList()}
}
new MutationObserver(observe).observe(content,{childList:true});
new MutationObserver(observe).observe(app,{attributes:true,attributeFilter:['class']});
observe();
})();
