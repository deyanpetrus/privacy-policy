/* LifeDashPro staging Web v1.14 - explicit account erasure controls.
 * Never delete on navigation, mount, reload, or preview.
 * Server validates the JWT, recent sign-in, and confirmation.
 */
(()=>{
'use strict';
const root=document.querySelector('#content'),app=document.querySelector('#appView');
if(!root||!app)return;
const bridge=()=>window.LifeDashAccountDeletionBridge;
let busy=false,owner='';
const markup=()=>`
 <section class="card ldp-delete-pane">
  <h3>Delete My Data</h3>
  <p>Permanent deletion of synced LifeDashPro records, server backups, archived backups, private uploaded attachments and your shared contributions. Your account and profile remain. Download your JSON backup first if needed.</p>
  <p class="ldp-delete-caution">The deletion cannot be undone using server backups, and any JSON files already downloaded to your devices are not removed. Offline Android data may sync again after a later sign-in and must be handled separately.</p>
  <label>Confirm your account email<input id="ldpDeleteDataEmail" type="email" autocomplete="off" spellcheck="false" placeholder="Your current account email"></label>
  <label>Type DELETE DATA<input id="ldpDeleteDataPhrase" type="text" autocomplete="off" spellcheck="false" placeholder="DELETE DATA"></label>
  <label class="ldp-delete-ack"><input id="ldpDeleteDataAck" type="checkbox"> I understand this permanently deletes my saved app data and all server backups.</label>
  <button id="ldpDeleteDataButton" class="danger" type="button" disabled>Delete My Data permanently</button>
  <p id="ldpDeleteDataResult" class="ldp-delete-result" role="status" aria-live="polite"></p>
 </section>
 <section class="card ldp-delete-pane">
  <h3>Delete Account</h3>
  <p>Permanent deletion of the LifeDashPro account, profile, synchronized data, backups, private files, and access to this account. You will be signed out. Family group ownership may transfer to another member.</p>
  <label>Confirm your account email<input id="ldpDeleteAccountEmail" type="email" autocomplete="off" spellcheck="false" placeholder="Your current account email"></label>
  <label>Type DELETE ACCOUNT<input id="ldpDeleteAccountPhrase" type="text" autocomplete="off" spellcheck="false" placeholder="DELETE ACCOUNT"></label>
  <label class="ldp-delete-ack"><input id="ldpDeleteAccountAck" type="checkbox"> I understand this is permanent and cannot be undone.</label>
  <button id="ldpDeleteAccountButton" class="danger" type="button" disabled>Delete Account permanently</button>
  <p id="ldpDeleteAccountResult" class="ldp-delete-result" role="status" aria-live="polite"></p>
 </section>
 <p class="ldp-delete-note">For account security, deletion requires a sign-in within the last 15 minutes. If the request is refused, sign out and sign in again. Never test this with your main account.</p>
`;
function field(host,id){return host.querySelector('#'+id)}
function update(host){
 for(const mode of ['Data','Account']){
  const input=field(host,'ldpDelete'+mode+'Email');
  const phrase=field(host,'ldpDelete'+mode+'Phrase');
  const ack=field(host,'ldpDelete'+mode+'Ack');
  const button=field(host,'ldpDelete'+mode+'Button');
  const required=mode==='Data'?'DELETE DATA':'DELETE ACCOUNT';
  button.disabled=busy||!owner||input.value.trim().toLowerCase()!==owner.toLowerCase()||phrase.value.trim()!==required||!ack.checked;
 }
}
async function perform(host,mode){
 if(busy||!owner)return;
 const kind=mode==='Data'?'data':'account';
 const target=mode==='Data'?'ldpDeleteDataResult':'ldpDeleteAccountResult';
 const status=field(host,target),button=field(host,'ldpDelete'+mode+'Button');
 update(host);
 if(button.disabled)return;
 const phrase=mode==='Data'?'DELETE DATA':'DELETE ACCOUNT';
 const question=kind==='data'?
   'FINAL WARNING: Permanently delete ALL synchronized app data, attachments and server backups for '+owner+'? Your account/profile will remain.':
   'FINAL WARNING: Permanently DELETE your entire LifeDashPro account '+owner+' and all its server data?';
 if(!window.confirm(question))return;
 busy=true;update(host);
 status.textContent='Verifying recent sign-in and processing the confirmed request…';
 try{
  const current=await bridge().status();
  if(current.email.toLowerCase()!==owner.toLowerCase())throw new Error('Account changed. Reload before deleting.');
  const result=await bridge().execute(kind);
  status.textContent='Deletion confirmed by the server; signing out…';
  for(const el of host.querySelectorAll('input'))el.value=el.type==='checkbox'?el.value:'';
  await bridge().clearSession();
  window.alert((kind==='account'?'Account':'App data')+' deletion confirmed. '+result.deletedFiles+' stored file(s) removed. You have been signed out.');
 }catch(e){
  status.textContent=String(e?.message||'Deletion could not be confirmed. Contact support before trying again.').slice(0,390);
 }finally{busy=false;if(host.isConnected)update(host)}
}
async function mount(host){
 if(host.dataset.deletionReady)return;
 host.dataset.deletionReady='1';host.innerHTML=markup();busy=false;owner='';
 for(const mode of ['Data','Account']){
  for(const suffix of ['Email','Phrase','Ack']){
   const el=field(host,'ldpDelete'+mode+suffix);
   el.addEventListener(el.type==='checkbox'?'change':'input',()=>update(host));
  }
  field(host,'ldpDelete'+mode+'Button').addEventListener('click',()=>void perform(host,mode));
 }
 const message=field(host,'ldpDeleteDataResult');
 try{
  if(!bridge()?.ready())throw new Error('Finish signing in and syncing before managing your account.');
  const status=await bridge().status();
  if(!host.isConnected||!bridge()?.ready())return;
  owner=status.email;
  if(!owner)throw new Error('Your account has no confirmed email; contact support for deletion.');
  const last=Date.parse(status.lastSignInAt);
  if(!Number.isFinite(last)||Date.now()-last>15*60*1000)
    message.textContent='Your sign-in is older than 15 minutes. Please sign out and sign in again to delete.';
 }catch(e){message.textContent=String(e?.message||'Account status unavailable.').slice(0,250)}
 update(host);
}
function observe(){
 if(app.classList.contains('hidden')){owner='';return}
 const host=root.querySelector('#accountDeletionV114');
 if(host&&!host.dataset.deletionReady)void mount(host);
}
new MutationObserver(observe).observe(root,{childList:true});
new MutationObserver(observe).observe(app,{attributes:true,attributeFilter:['class']});
observe();
})();
