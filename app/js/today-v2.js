(()=>{
'use strict';
if(new URLSearchParams(location.search).get('workspace')!=='desktop')return;
const link=document.createElement('link');link.rel='stylesheet';link.href='assets/today-v2.css?v=2';document.head.appendChild(link);

function findAction(i){
 const byId=(kind,id)=>collection(kind).find(x=>String(x.id)===String(id));
 if(i.source==='notes'){const r=byId('notes',i.id);return r?{kind:'notes',id:r.id,label:'note',edit:'note'}:null}
 if(i.source==='invoice'){const r=byId('notes',i.id);return r?{kind:'notes',id:r.id,label:'invoice',edit:'invoice'}:null}
 if(i.source==='finance'){
  const tx=byId('finance_transactions',i.id);if(tx)return{kind:'finance_transactions',id:tx.id,label:'transaction',edit:'tx'};
  const bill=byId('finance_bills',i.id);if(bill)return{kind:'finance_bills',id:bill.id,label:'bill',edit:'bill'};
 }
 if(i.source==='document'){const r=byId('documents',i.id);return r?{kind:'documents',id:r.id,label:'document',edit:'doc'}:null}
 if(i.source==='family'){
  const task=byId('family_tasks',i.id);if(task)return{kind:'family_tasks',id:task.id,label:'family task',edit:'family-task'};
 }
 if(i.source==='birthday'){const r=byId('family_members',i.id);return r?{kind:'family_members',id:r.id,label:'family member',edit:'family-member'}:null}
 if(i.source==='vehicle'){
  const r=collection('vehicles').find(v=>String(i.id)===String(v.id)||String(i.id).startsWith(`${v.id}-`));
  return r?{kind:'vehicles',id:r.id,label:'vehicle',edit:'vehicle'}:null;
 }
 return null;
}
function actionButtons(i){
 const a=findAction(i),open=`<button class="today-action open" data-go="${esc(i.route)}">Open</button>`;
 if(!a)return open;
 return `${open}<button class="today-action edit" data-today-edit="${esc(a.edit)}" data-today-kind="${esc(a.kind)}" data-today-id="${esc(a.id)}">Edit</button><button class="today-action delete" data-today-delete="1" data-today-kind="${esc(a.kind)}" data-today-id="${esc(a.id)}" data-today-label="${esc(a.label)}">Delete</button>`;
}
function row(i,today){
 const recurring=i.recurrence&&i.recurrence!=='once'?`<span class="today-badge recur">${esc(i.recurrence)}</span>`:'';
 const overdue=i.overdue?'<span class="today-badge overdue">Overdue</span>':'';
 return `<article class="today-record today-source-${esc(i.source||'other')} ${i.overdue?'is-overdue':''}">
   <div class="today-accent"></div>
   <div class="today-date"><b>${i.date===today?'TODAY':fmtDate(i.date)}</b>${i.time?`<small>${esc(i.time)}</small>`:''}</div>
   <div class="today-icon">${esc(i.icon||'•')}</div>
   <div class="today-copy"><strong>${esc(i.title)}</strong><span>${esc(i.meta||'')}${recurring||overdue?` <span class="today-inline-badges">${recurring}${overdue}</span>`:''}</span></div>
   <div class="today-actions">${actionButtons(i)}</div>
 </article>`;
}
function section(title,sub,rows,today,emptyTitle,emptyBody,klass=''){
 return `<section class="card today-section ${klass}"><div class="today-section-head"><div><h3>${esc(title)}</h3><span class="card-sub">${esc(sub)}</span></div><span class="today-count">${rows.length}</span></div><div class="today-records">${rows.length?rows.map(i=>row(i,today)).join(''):empty(emptyTitle,emptyBody)}</div></section>`;
}

todayPage=function(){
 const{today,end}=todayRange(),all=dueItems(),todayRows=all.filter(x=>x.date===today&&!x.overdue),next=all.filter(x=>x.date>today&&x.date<=end&&!x.overdue),past=all.filter(x=>x.overdue).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10);
 return `${pageHead('Today & Next 5 Days','Notes, finance, family, birthdays, documents, vehicles, travel and reminders.',`<button class="quiet" data-refresh>↻ Sync now</button>`)}
 <div class="today-v2-page">
   <div class="today-summary-v2"><div><b>${todayRows.length}</b><span>Today</span></div><div><b>${next.length}</b><span>Next 5 days</span></div><div class="${past.length?'has-overdue':''}"><b>${past.length}</b><span>Overdue</span></div></div>
   <div class="today-columns">${section('Today','Items due on your local calendar date',todayRows,today,'Nothing due today','Your synced LifeDashPro timeline is clear for today.','today-now')}${section('Next 5 days','Recurring items are resolved to their next occurrence',next,today,'No upcoming items','Nothing is due during the next five days.','today-next')}</div>
   ${past.length?section('Recently overdue','One-time items from the last 30 days',past,today,'No overdue items','','today-overdue'):''}
 </div>`;
};

function editRecord(type,kind,id){
 const r=collection(kind).find(x=>String(x.id)===String(id));if(!r)return toast('This item is no longer available',true);
 if(type==='note')return noteModal(r);
 if(type==='invoice')return invoiceModal(r);
 if(type==='tx')return txModal(r);
 if(type==='bill')return billModal(r);
 if(type==='doc')return documentModal(r);
 if(type==='family-task')return familyTaskModal(r);
 if(type==='family-member')return familyMemberModal(r);
 if(type==='vehicle')return vehicleModal(r);
}
document.addEventListener('click',e=>{
 const edit=e.target.closest('[data-today-edit]');if(edit){e.preventDefault();e.stopPropagation();return editRecord(edit.dataset.todayEdit,edit.dataset.todayKind,edit.dataset.todayId)}
 const del=e.target.closest('[data-today-delete]');if(del){e.preventDefault();e.stopPropagation();return confirmRemove(del.dataset.todayKind,del.dataset.todayId,del.dataset.todayLabel||'item')}
},true);
})();
