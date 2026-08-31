(()=>{
'use strict';
const params=new URLSearchParams(location.search);if(params.get('workspace')!=='desktop')return;
const APP_ROUTES=new Set(['today','notes','finance','invoices','documents','family','vehicles','route','explore','air','radio','profile']);
const icons={
 today:'<path d="M5 4v3M19 4v3M4 9h16M5 6h14v14H5z"/><path d="M8 13h3M13 13h3M8 16h3"/>',
 notes:'<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 12h6M9 16h6"/>',
 finance:'<circle cx="12" cy="12" r="9"/><path d="M15.5 8.8c-.7-1-1.8-1.5-3.3-1.5-1.8 0-3.2.9-3.2 2.3 0 3.7 6.8 1.5 6.8 5 0 1.4-1.4 2.4-3.5 2.4-1.6 0-3-.6-3.8-1.7M12 5.5v13"/>',
 invoices:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
 documents:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/>',
 family:'<circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.3"/><path d="M3.5 20c.5-3.8 2.4-5.8 5.5-5.8s5.1 2 5.5 5.8M14 15.3c3.4-.6 5.8 1 6.4 4.7"/>',
 vehicles:'<path d="M4 15l1.8-5h12.4l1.8 5v4H4zM7 10l1.4-3h7.2l1.4 3"/><circle cx="7" cy="17" r="1.2"/><circle cx="17" cy="17" r="1.2"/>',
 route:'<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M7.7 16.3c2-2.5 2.2-5.1 5.3-5.8 2.5-.6 3.2-1.5 3.4-2.7"/>',
 explore:'<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2.2 4.8-4.8 2.2 2.2-4.8z"/>',
 air:'<path d="M22 2L11 13M15 3l4-1-1 4M3 11l8 2-2 8 3-3 3 3 1-7 5-2"/>',
 radio:'<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M7 7l10-4M7 12h5"/><circle cx="16" cy="14" r="2.5"/><path d="M7 16h3"/>',
 profile:'<circle cx="12" cy="8" r="4"/><path d="M4.5 21c.7-4.5 3.2-6.7 7.5-6.7s6.8 2.2 7.5 6.7"/>',
 edit:'<path d="M4 20h4l10.7-10.7a2.1 2.1 0 00-3-3L5 17v3zM14.7 7.3l3 3"/>',
 trash:'<path d="M4 7h16M9 3h6l1 4H8l1-4zM7 7l1 14h8l1-14M10 11v6M14 11v6"/>'
};
function svg(name){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.documents}</svg>`}
function rows(k){try{return typeof collection==='function'?(collection(k)||[]):[]}catch{return[]}}
function isoDay(v){if(!v)return'';const s=String(v);const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s);if(m)return`${m[1]}-${m[2]}-${m[3]}`;const d=new Date(v);if(Number.isNaN(d.getTime()))return'';return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function daysUntil(v){const s=isoDay(v);if(!s)return Infinity;const [y,m,d]=s.split('-').map(Number),t=new Date(),a=new Date(t.getFullYear(),t.getMonth(),t.getDate()),b=new Date(y,m-1,d);return Math.round((b-a)/86400000)}
function money(v,c){try{return typeof fmtMoney==='function'?fmtMoney(v,c||state?.profile?.currency||'EUR'):`${Number(v||0).toFixed(2)} ${c||'EUR'}`}catch{return String(v||0)}}
function metric(label,value,tone='',small=''){return`<div class="clean-metric"><span>${label}</span><strong class="${tone}">${value}</strong>${small?`<small>${small}</small>`:''}</div>`}
function metrics(route){
 if(route==='documents'){const a=rows('documents'),cloud=a.filter(x=>x.storagePath||x.attachments?.some?.(y=>y.storagePath)).length,soon=a.filter(x=>{const d=daysUntil(x.expiresAt);return d>=0&&d<=45}).length;return[metric('Total',a.length),metric('In cloud',cloud,'blue'),metric('Expiring soon',soon,soon?'bad':'')];}
 if(route==='notes'){const a=rows('notes').filter(x=>x.status!=='archived'),soon=a.filter(x=>{const d=daysUntil(x.dueDate);return d>=0&&d<=7}).length,inv=a.filter(x=>x.type==='invoice').length;return[metric('Active',a.length),metric('Due next 7 days',soon,soon?'amber':''),metric('Invoices',inv,'blue')];}
 if(route==='invoices'){const a=rows('notes').filter(x=>x.type==='invoice'),paid=a.filter(x=>x.status==='completed'||x.invoice?.status==='paid'||x.isPaid).length;return[metric('Invoices',a.length),metric('Paid',paid,'good'),metric('Open',Math.max(0,a.length-paid),a.length-paid?'amber':'')];}
 if(route==='family'){const members=rows('family_members'),tasks=rows('family_tasks'),shop=rows('family_shopping');return[metric('Members',members.length),metric('Open tasks',tasks.filter(x=>!x.done).length,'blue'),metric('Shopping',shop.filter(x=>!x.checked).length,'amber')];}
 if(route==='vehicles'){const a=rows('vehicles'),soon=a.filter(v=>[v.registrationExpires,v.insuranceExpires,v.technicalExpires].some(x=>{const d=daysUntil(x);return d>=0&&d<=45})).length,svc=a.reduce((s,v)=>s+(v.services||[]).length,0);return[metric('Vehicles',a.length),metric('Expiring soon',soon,soon?'bad':''),metric('Service records',svc,'blue')];}
 return[];
}
function routeNow(){return(location.hash||'#dashboard').slice(1)||'dashboard'}
function decorateHead(page,route){const head=page.querySelector('.page-head');if(!head)return;let first=head.querySelector(':scope > div:first-child');if(!first)return;if(!first.querySelector('.clean-head-icon'))first.insertAdjacentHTML('afterbegin',`<span class="clean-head-icon">${svg(route)}</span>`)}
function decorateMetrics(page,route){if(page.querySelector('.clean-metrics-strip'))return;const list=metrics(route);if(!list.length)return;const head=page.querySelector('.page-head');if(!head)return;head.insertAdjacentHTML('afterend',`<div class="clean-metrics-strip" style="--clean-metrics:${list.length}">${list.join('')}</div>`)}
function decorateSummaryCards(page,route){if(route==='finance'){const grid=page.querySelector(':scope > .grid');if(grid)[...grid.children].slice(0,3).forEach(x=>x.classList.add('clean-summary-card'))}page.querySelectorAll('.card').forEach(card=>{if(card.querySelector('.data-table'))card.classList.add('clean-table-card')})}
function decoratePills(page,route){
 if(route==='documents')page.querySelectorAll('.data-table tbody tr').forEach(tr=>{const td=tr.children[1];if(!td||td.dataset.cleanPill)return;const v=td.textContent.trim().toLowerCase()||'personal';td.dataset.cleanPill='1';td.innerHTML=`<span class="clean-category-pill clean-category-${v.replace(/[^a-z0-9_-]/g,'')}">${v}</span>`});
 if(route==='invoices')page.querySelectorAll('.data-table tbody tr').forEach(tr=>{const td=tr.children[3];if(!td||td.dataset.cleanPill)return;const v=td.textContent.trim().toLowerCase()||'draft';td.dataset.cleanPill='1';td.innerHTML=`<span class="clean-status-pill clean-status-${v.replace(/[^a-z0-9_-]/g,'_')}">${v}</span>`});
}
const editSel='[data-edit-note],[data-edit-tx],[data-edit-bill],[data-edit-invoice],[data-edit-doc],[data-edit-family-member],[data-edit-family-task],[data-edit-vehicle]';
const delSel='[data-del-note],[data-del-tx],[data-del-invoice],[data-del-doc],[data-del-vehicle]';
function decorateActions(page){page.querySelectorAll(editSel).forEach(b=>{if(b.dataset.cleanAction)return;b.dataset.cleanAction='edit';b.classList.add('clean-icon-action');b.title='Edit';b.setAttribute('aria-label','Edit');b.innerHTML=svg('edit')});page.querySelectorAll(delSel).forEach(b=>{if(b.dataset.cleanAction)return;b.dataset.cleanAction='delete';b.classList.add('clean-icon-action','clean-delete');b.title='Delete';b.setAttribute('aria-label','Delete');b.innerHTML=svg('trash')})}
let scheduled=false;
function enhance(){scheduled=false;const route=routeNow(),page=document.getElementById('page'),win=document.getElementById('desktopWindow');const active=APP_ROUTES.has(route)&&page&&win&&!win.classList.contains('hidden');document.body.classList.toggle('clean-workspace-active',!!active);if(!page||!win)return;if(!APP_ROUTES.has(route)){page.classList.remove('clean-app-page');delete page.dataset.cleanRoute;win.classList.remove('clean-app-window');delete win.dataset.cleanRoute;return}page.classList.add('clean-app-page');page.dataset.cleanRoute=route;win.classList.add('clean-app-window');win.dataset.cleanRoute=route;decorateHead(page,route);decorateMetrics(page,route);decorateSummaryCards(page,route);decoratePills(page,route);decorateActions(page)}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(enhance)}
function init(){const page=document.getElementById('page');if(!page){setTimeout(init,50);return}const obs=new MutationObserver(schedule);obs.observe(page,{childList:true,subtree:true});const win=document.getElementById('desktopWindow');if(win)new MutationObserver(schedule).observe(win,{attributes:true,attributeFilter:['class']});window.addEventListener('hashchange',schedule);window.addEventListener('resize',schedule);schedule()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
