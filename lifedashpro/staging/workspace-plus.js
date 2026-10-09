/* LifeDashPro Web v1.5 — additive personal organizer, layout & accent.
   UI only: no Supabase, login, network requests, or data writes. */
(function(){
 'use strict';
 const content=document.getElementById('content');
 if(!content)return;
 const $=(s,root=document)=>root.querySelector(s);
 const $$=(s,root=document)=>Array.from(root.querySelectorAll(s));
 const el=(tag,cls,value)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(value!==undefined)x.textContent=value;return x};
 const ACCENT_KEY='lifedash_web_accent_v15',LAYOUT_KEY='lifedash_web_widget_order_v15';
 const WIDGETS=['dash-upcoming','dash-finance','dash-notes','dash-tasks','dash-journey'];
 const LABELS={notes:'Notes Pro',tasks:'Tasks',documents:'Documents',journey:'Journey'};
 let docsFilter='all', docsCategory='all', customizing=false;

 function storageGet(key,fallback){try{return localStorage.getItem(key)||fallback}catch(_){return fallback}}
 function storageSet(key,value){try{localStorage.setItem(key,value)}catch(_){}}
 function initAccent(){
   const menu=document.getElementById('themeMenu');
   if(!menu)return;
   const caption=el('div','theme-menu-title','Color accent');
   caption.style.borderTop='1px solid var(--line)';
   caption.style.marginTop='7px';caption.style.paddingTop='12px';
   menu.appendChild(caption);
   for(const [mode,icon,title] of [['classic','◈','Classic'],['aurora','✦','Violet · Rose']]){
     const b=el('button','theme-option');
     b.type='button';b.setAttribute('data-accent-choice',mode);
     b.setAttribute('aria-pressed','false');
     b.append(el('span','theme-choice-icon',icon),document.createTextNode(title),el('span','theme-choice-check','✓'));
     b.addEventListener('click',()=>{
       applyAccent(mode);const toggle=document.getElementById('themeToggle');
       if(toggle?.getAttribute('aria-expanded')==='true')toggle.click();
     });
     menu.appendChild(b);
   }
   applyAccent(storageGet(ACCENT_KEY,'classic'));
 }
 function applyAccent(mode){
   if(mode!=='aurora')mode='classic';
   document.documentElement.setAttribute('data-ld-accent',mode);
   storageSet(ACCENT_KEY,mode);
   $$('[data-accent-choice]').forEach(b=>{
     const current=b.dataset.accentChoice===mode;
     b.classList.toggle('selected',current);
     b.setAttribute('aria-pressed',String(current));
   });
 }
 function navTo(page){
   const button=$('#nav [data-page="'+page+'"]')||$('.mobile-nav [data-page="'+page+'"]');
   if(button)button.click();
 }
 function count(id){
   const x=document.getElementById(id);
   return x?x.textContent.trim():'0';
 }
 function layoutSaved(){
   const saved=storageGet(LAYOUT_KEY,'');
   try{
     const a=JSON.parse(saved);
     if(Array.isArray(a)&&a.length===WIDGETS.length&&a.every(x=>WIDGETS.includes(x))&&new Set(a).size===WIDGETS.length)return a;
   }catch(_){}
   return WIDGETS.slice();
 }
 function applyOrder(grid,order){
   const cards=Object.fromEntries(WIDGETS.map(key=>[key,$('.'+key,grid)]));
   const tail=$('.span-12',grid);
   order.forEach(key=>{if(cards[key])grid.insertBefore(cards[key],tail||null)});
 }
 function currentOrder(grid){
   return $$(':scope > .card',grid).map(n=>WIDGETS.find(k=>n.classList.contains(k))).filter(Boolean);
 }
 function persist(grid){storageSet(LAYOUT_KEY,JSON.stringify(currentOrder(grid)))}
 function decorateDashboard(){
   if(location.hash&&location.hash!=='#dashboard')return;
   const grid=$('.dash-grid',content);
   if(!grid||grid.dataset.organizerV15==='1')return;
   if(WIDGETS.some(k=>!$('.'+k,grid)))return;
   grid.dataset.organizerV15='1';
   customizing=false;
   applyOrder(grid,layoutSaved());
   const toolbar=el('div','widget-layout-toolbar');
   toolbar.setAttribute('aria-label','Dashboard layout');
   const text=el('span','widget-layout-hint','Your dashboard · Customize widget positions on desktop');
   const controls=el('div','widget-layout-actions');
   const customize=el('button','secondary','Customize layout');
   customize.type='button';customize.setAttribute('aria-pressed','false');
   const reset=el('button','secondary','Reset positions');reset.type='button';reset.hidden=true;
   controls.append(customize,reset);toolbar.append(text,controls);
   content.insertBefore(toolbar,grid);
   const help=el('p','widget-layout-feedback','Drag cards, or use the move buttons. Positions are saved in this browser only.');
   help.hidden=true;toolbar.append(help);
   function setEdit(on){
     customizing=on;grid.classList.toggle('widget-layout-edit',on);
     customize.textContent=on?'Finish customizing':'Customize layout';
     customize.setAttribute('aria-pressed',String(on));
     reset.hidden=!on;help.hidden=!on;
     for(const key of WIDGETS){
       const card=$('.'+key,grid);
       if(!card)continue;
       card.draggable=on;
       let bar=$('.widget-move-controls',card);
       if(!bar){
         bar=el('div','widget-move-controls');
         const drag=el('span','widget-grip','↕');
         drag.title='Drag card to rearrange';bar.appendChild(drag);
         for(const [delta,symbol,label] of [[-1,'←','Move earlier'],[1,'→','Move later']]){
           const b=el('button','widget-move-btn',symbol);b.type='button';b.setAttribute('aria-label',label);
           b.addEventListener('click',()=>{
             const order=currentOrder(grid),i=order.indexOf(key),j=i+delta;
             if(i<0||j<0||j>=order.length)return;
             [order[i],order[j]]=[order[j],order[i]];applyOrder(grid,order);persist(grid);
           });
           bar.appendChild(b);
         }
         card.insertBefore(bar,card.firstChild);
       }
       bar.hidden=!on;
     }
   }
   customize.addEventListener('click',()=>setEdit(!customizing));
   reset.addEventListener('click',()=>{applyOrder(grid,WIDGETS);persist(grid);});
   let dragged='';
   grid.addEventListener('dragstart',e=>{
     if(!customizing)return;
     const card=e.target.closest('.card');
     dragged=card&&WIDGETS.find(k=>card.classList.contains(k))||'';
     if(!dragged){e.preventDefault();return}
     e.dataTransfer.effectAllowed='move';
     e.dataTransfer.setData('text/plain',dragged);
     card.classList.add('widget-dragging');
   });
   grid.addEventListener('dragover',e=>{
     if(!customizing||!dragged||!e.target.closest('.card'))return;
     const target=e.target.closest('.card');
     if(!WIDGETS.some(k=>target.classList.contains(k)))return;
     e.preventDefault();e.dataTransfer.dropEffect='move';
   });
   grid.addEventListener('drop',e=>{
     if(!customizing||!dragged)return;
     const card=e.target.closest('.card');
     const target=card&&WIDGETS.find(k=>card.classList.contains(k));
     e.preventDefault();
     if(target&&target!==dragged){
       const order=currentOrder(grid);
       order.splice(order.indexOf(dragged),1);
       order.splice(order.indexOf(target),0,dragged);
       applyOrder(grid,order);persist(grid);
     }
     $$('.widget-dragging',grid).forEach(n=>n.classList.remove('widget-dragging'));
     dragged='';
   });
   grid.addEventListener('dragend',()=>{$$('.widget-dragging',grid).forEach(n=>n.classList.remove('widget-dragging'));dragged=''});
   // Read-only launcher, not a second copy of any account record.
   const organizer=el('section','card organizer-hub');
   organizer.appendChild(el('p','eyebrow','PERSONAL ORGANIZER'));
   organizer.appendChild(el('h3','organizer-title','Everything important, one click away'));
   organizer.appendChild(el('p','organizer-subtitle','Open your synced sections. Document validity is available under Documents.'));
   const modules=el('div','organizer-module-grid');
   for(const [page,icon,id] of [['notes','✎','navNotes'],['tasks','✓','navTasks'],['documents','▣','navDocs'],['journey','⌖','navJourneys']]){
     const b=el('button','organizer-module');b.type='button';
     b.appendChild(el('span','organizer-module-icon',icon));
     const copy=el('span','organizer-module-copy');
     copy.append(el('strong','',LABELS[page]),el('small','',count(id)+' synced / saved'));
     b.appendChild(copy);b.appendChild(el('span','organizer-module-arrow','→'));
     b.addEventListener('click',()=>navTo(page));
     modules.appendChild(b);
   }
   organizer.appendChild(modules);content.appendChild(organizer);
 }
 function expiryDate(row){
   const raw=(row.dataset.uiExpires||'').trim();
   if(!raw)return null;
   const match=/^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
   if(!match)return null;
   const y=Number(match[1]),m=Number(match[2]),d=Number(match[3]);
   const date=new Date(Date.UTC(y,m-1,d));
   if(date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)return null;
   return date;
 }
 function todayUTC(){
   const date=new Date();
   return Date.UTC(date.getFullYear(),date.getMonth(),date.getDate());
 }
 function daysUntil(date){return Math.round((date.getTime()-todayUTC())/86400000)}
 function statusOf(row){
   const date=expiryDate(row);
   if(!date)return{type:'missing',days:null,label:'No expiry date'};
   const d=daysUntil(date);
   if(d<0)return{type:'expired',days:d,label:'Expired '+Math.abs(d)+'d ago'};
   if(d<=30)return{type:'soon',days:d,label:d===0?'Expires today':'Expires in '+d+'d'};
   return{type:'valid',days:d,label:'Valid · '+d+'d left'};
 }
 function buildDocumentOrganizer(){
   if(location.hash!=='#documents')return;
   if($('#documentOrganizer',content))return;
   const list=$(':scope > .list',content),empty=$(':scope > .empty',content);
   if(!list&&!empty)return;
   const rows=list?$$(':scope > .data-row',list):[];
   const categories=Array.from(new Set(rows.map(r=>r.dataset.uiCategory||'').filter(Boolean))).sort();
   const panel=el('section','doc-organizer');
   panel.id='documentOrganizer';
   const heading=el('div','doc-organizer-heading');
   const title=el('div');
   title.append(el('p','eyebrow','DOCUMENT ORGANIZER'),el('h3','','Validity & categories'));
   title.appendChild(el('p','doc-explainer','Only dates stored in synced document records are shown. No files or reminders are modified.'));
   heading.appendChild(title);panel.appendChild(heading);
   const summary=el('div','doc-summary');
   for(const [key,label,icon] of [['all','Documents','▣'],['soon','Due in 30 days','◷'],['expired','Expired','!'],['missing','No expiry date','—']]){
     const box=el('div','doc-summary-tile');box.append(el('span','doc-tile-icon',icon));
     const info=el('div');info.append(el('small','',label),el('strong','doc-summary-num','0'));
     info.querySelector('strong').dataset.docStat=key;box.append(info);summary.appendChild(box);
   }
   panel.appendChild(summary);
   const filters=el('div','doc-controls');
   const label1=el('label','doc-filter-field');
   label1.appendChild(el('span','','Validity'));
   const status=el('select','doc-select');status.setAttribute('aria-label','Filter documents by validity');
   for(const [key,title] of [['all','All documents'],['expired','Expired'],['soon','Next 30 days'],['within60','Next 60 days'],['missing','No expiry date'],['valid','Valid later']]){
     const opt=el('option','',title);opt.value=key;status.appendChild(opt);
   }
   status.value=docsFilter;label1.appendChild(status);filters.appendChild(label1);
   const label2=el('label','doc-filter-field');label2.appendChild(el('span','','Category'));
   const category=el('select','doc-select');category.setAttribute('aria-label','Filter document category');
   const opt=el('option','','All categories');opt.value='all';category.appendChild(opt);
   for(const name of categories){const o=el('option','',name);o.value=name;category.appendChild(o)}
   if(categories.includes(docsCategory))category.value=docsCategory;else docsCategory='all';
   label2.appendChild(category);filters.appendChild(label2);
   const reset=el('button','secondary doc-reset','Show all');reset.type='button';
   filters.appendChild(reset);panel.appendChild(filters);
   const result=el('p','doc-filter-caption');panel.appendChild(result);
   const anchor=$('#featureToolbar',content)||list||empty;
   content.insertBefore(panel,anchor);
   for(const row of rows){
     if($('.doc-validity-chip',row))continue;
     const status=statusOf(row);
     const chip=el('span','doc-validity-chip doc-'+status.type,status.label);
     const main=$('.row-main',row);
     if(main)main.appendChild(chip);
   }
   const update=()=>{
     let expired=0,soon=0,missing=0,matching=0;
     for(const row of rows){
       const info=statusOf(row);
       if(info.type==='expired')expired++;
       if(info.type==='soon')soon++;
       if(info.type==='missing')missing++;
       const categoryOk=docsCategory==='all'||row.dataset.uiCategory===docsCategory;
       const statusOk=docsFilter==='all'||
         (docsFilter==='within60'&&info.days!==null&&info.days>=0&&info.days<=60)||
         (docsFilter==='valid'&&info.type==='valid')||
         (docsFilter===info.type);
       const ok=categoryOk&&statusOk;
       row.dataset.docFiltered=ok?'false':'true';
       if(ok)matching++;
     }
     const values={all:rows.length,expired,soon,missing};
     Object.keys(values).forEach(k=>{const node=$('[data-doc-stat="'+k+'"]',panel);if(node)node.textContent=String(values[k])});
     result.textContent=matching+' document'+(matching===1?'':'s')+' match the validity/category filters.';
   };
   status.addEventListener('change',()=>{docsFilter=status.value;update()});
   category.addEventListener('change',()=>{docsCategory=category.value;update()});
   reset.addEventListener('click',()=>{docsFilter='all';docsCategory='all';status.value='all';category.value='all';update()});
   update();
 }
 function financeDisclosure(){
   if(location.hash!=='#finance'||$('#recurringFinanceInfo',content))return;
   const panel=$('#featureToolbar',content);
   if(!panel)return;
   const note=el('aside','finance-recurring-note');
   note.id='recurringFinanceInfo';note.setAttribute('role','note');
   note.appendChild(el('strong','','Actual synced transactions only'));
   note.appendChild(el('span','',' Monthly totals include records already saved for the selected month. Scheduled recurring salary/expenses are not projected or duplicated here; the Android recurrence engine remains unchanged.'));
   panel.insertAdjacentElement('afterend',note);
 }
 function enhance(){
   decorateDashboard();buildDocumentOrganizer();financeDisclosure();
 }
 initAccent();
 new MutationObserver(enhance).observe(content,{childList:true});
 enhance();
})();
