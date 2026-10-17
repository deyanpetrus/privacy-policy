/* LifeDashPro Web v1.38 — additive vehicle editor. Shared user_data vehicles records.
   Do not schedule Android alarms or alter unrelated fields. */
(()=>{'use strict';
const $=s=>document.querySelector(s);
const bridge=()=>window.LifeDashMobilityBridge;
const tr=k=>window.LifeDashParityI18nV138?.tr?.(k)||k;
const iso=()=>new Date().toISOString().slice(0,10);
const text=(v,n=180)=>String(v??'').slice(0,n);
const validDate=v=>!v||/^\d{4}-\d{2}-\d{2}$/.test(v);
const el=(tag,cls,txt)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=txt;return x};
let modal=null,saving=false,owner='';
function input(parent,name,label,value='',type='text',max=120){
 const box=el('label','mob138-field'),caption=el('span','',tr(label)),ctrl=el(type==='textarea'?'textarea':'input','');
 ctrl.name=name;if(type!=='textarea')ctrl.type=type;
 if(type==='number')ctrl.step='any';
 if(max&&type!=='date'&&type!=='number')ctrl.maxLength=max;
 ctrl.value=value===undefined||value===null?'':String(value);
 box.append(caption,ctrl);parent.append(box);return ctrl;
}
function build(title,fields,saveCallback){
 if(modal?.open)modal.close();
 modal=el('dialog','mob138-dialog');modal.setAttribute('aria-label',tr(title));
 const root=el('form','mob138-form');root.method='dialog';
 const heading=el('div','mob138-heading');
 heading.append(el('h2','',tr(title)));
 const cancelTop=el('button','mob138-close','×');cancelTop.type='button';cancelTop.setAttribute('aria-label',tr('Cancel'));cancelTop.onclick=()=>modal.close();heading.append(cancelTop);
 root.append(heading);
 const grid=el('div','mob138-form-grid');fields(grid);root.append(grid);
 const status=el('div','mob138-status');status.setAttribute('role','status');root.append(status);
 const footer=el('div','mob138-footer'),cancel=el('button','secondary',tr('Cancel'));cancel.type='button';cancel.onclick=()=>modal.close();
 const save=el('button','primary',tr('Save changes'));save.type='submit';footer.append(cancel,save);root.append(footer);modal.append(root);
 modal.addEventListener('close',()=>{modal?.remove();if(modal===root.parentNode)modal=null},{once:true});
 root.addEventListener('submit',async e=>{e.preventDefault();if(saving)return;
  if(!bridge()?.ready?.()){status.textContent=tr('Sync first');return}
  saving=true;save.disabled=true;status.textContent=tr('Saving');
  try{await saveCallback(Object.fromEntries([...new FormData(root).entries()]));
   modal.close();document.dispatchEvent(new CustomEvent('lifedash:vehicle-saved',{detail:{id:owner}}));
  }catch(err){status.textContent=tr('Save failed')+': '+text(err?.message,200)}
  finally{saving=false;save.disabled=false}
 });
 document.body.append(modal);modal.showModal();
}
function checkNumber(v,label){if(v==='')return null;const n=Number(v);if(!Number.isFinite(n)||n<0||n>50000000)throw Error(tr('Invalid value')+': '+tr(label));return n}
function open(vehicle){
 if(!bridge()?.ready?.())return;
 const isNew=!vehicle,existing=vehicle||{};
 owner=existing.id||'';
 build(isNew?'Add vehicle':'Edit vehicle',grid=>{
  for(const [key,label]of [['name','Vehicle name'],['brand','Brand'],['model','Model'],['year','Year'],
   ['licensePlate','License plate'],['color','Color'],['fuelType','Fuel type']])
   input(grid,key,label,existing[key]||'');
  input(grid,'currentKm','Odometer',existing.currentKm??'','number');
  input(grid,'nextServiceKm','Next service at km',existing.nextServiceKm??'','number');
  for(const [key,label]of [['lastService','Last service'],['insuranceExpires','Insurance expires'],
   ['registrationExpires','Registration expires'],['technicalExpires','Technical inspection expires']])
   input(grid,key,label,existing[key]?.slice?.(0,10)||'','date');
  input(grid,'notes','Notes',existing.notes||'','textarea',2000);
 },async values=>{
  for(const key of ['currentKm','nextServiceKm'])values[key]=checkNumber(values[key],key);
  for(const key of ['lastService','insuranceExpires','registrationExpires','technicalExpires'])
   if(!validDate(values[key]))throw Error(tr('Invalid value')+': '+key);
  const old=existing||{},record={...old,...values};
  if(isNew){record.services=[];record.fuelHistory=[];record.attachments=[];}
  const saved=await bridge().saveVehicle(record);owner=saved?.id||record.id;
 });
}
function history(vehicle,kind){
 if(!bridge()?.ready?.()||!vehicle||!['services','fuelHistory'].includes(kind))return;
 owner=String(vehicle.id);const service=kind==='services';
 build(service?'Add service':'Add fuel',grid=>{
  input(grid,'date','Date',iso(),'date');
  if(service){
   input(grid,'type','Service type','');
   input(grid,'km','Odometer',vehicle.currentKm??'','number');
   input(grid,'cost','Cost','','number');
   input(grid,'currency','Currency','EUR');
   input(grid,'notes','Notes','','textarea',800);
  }else{
   input(grid,'station','Station','');
   input(grid,'liters','Liters','','number');
   input(grid,'total','Total','','number');
   input(grid,'km','Odometer',vehicle.currentKm??'','number');
   input(grid,'currency','Currency','EUR');
   input(grid,'fuelType','Fuel type',vehicle.fuelType||'');
  }
 },async values=>{
  if(!validDate(values.date)||!values.date)throw Error(tr('Invalid value')+': '+tr('Date'));
  const nums=service?['km','cost']:['km','liters','total'];
  for(const k of nums)values[k]=checkNumber(values[k],k);
  if(!service&&(!(values.liters>0)||values.total===null))throw Error(tr('Enter liters and total'));
  if(service&&!values.type.trim())throw Error(tr('Service type'));
  values.currency=String(values.currency||'EUR').toUpperCase();
  if(!/^[A-Z]{3}$/.test(values.currency))throw Error(tr('Currency'));
  values.id='web-entry-'+(crypto.randomUUID?.()||Date.now());
  const latest=bridge().snapshot()?.vehicles?.find(v=>String(v.id)===String(vehicle.id));
  if(!latest)throw Error(tr('Sync first'));
  const merged={...latest,[kind]:[...(Array.isArray(latest[kind])?latest[kind]:[]),values]};
  const saved=await bridge().saveVehicle(merged);owner=saved.id;
 });
}
async function remove(vehicle){
 if(!bridge()?.ready?.()||!vehicle)return;
 if(!confirm(tr('Delete vehicle confirmation')))return;
 try{await bridge().deleteVehicle(vehicle.id);
  document.dispatchEvent(new CustomEvent('lifedash:vehicle-saved',{detail:{id:''}}));
 }catch(e){alert(tr('Save failed')+': '+text(e?.message,170))}
}
window.LifeDashVehicleEditorV138=Object.freeze({open,history,remove});
})();
