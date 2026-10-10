/* LifeDashPro Web v1.9.1 — Documents Pro (staging)
   Detail-rich read-only view of canonical Android 'documents' payloads.
   Cloud files are downloaded on user action from existing PRIVATE Storage via RLS.
   No mutations, upload endpoints, notifications, public URLs, or data migration. */
(()=>{
'use strict';
const $=(selector,root=document)=>root.querySelector(selector);
const node=(tag,cls,text)=>{
  const el=document.createElement(tag);
  if(cls)el.className=cls;
  if(text!==undefined)el.textContent=String(text);
  return el;
};
const content=$('#content'),app=$('#appView');
if(!content||!app)return;
const bridge=()=>window.LifeDashDocumentsBridge;
let docs=[],owner='',search='',category='all',status='all',type='all',sort='expiry',selectedId='',objectURL=null,loadToken=0,busy=false;
const htmlDate=/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/;
const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const nowDate=()=>iso(new Date());
const trim=(v,max=180)=>String(v??'').trim().slice(0,max);
const text=(v,max=160)=>trim(v,max)||'—';
function parseDate(raw){
 const str=trim(raw,40),m=str.match(htmlDate);
 if(!m)return '';
 const y=+m[1],mo=+m[2],d=+m[3];
 const x=new Date(y,mo-1,d,12);
 if(x.getFullYear()!==y||x.getMonth()+1!==mo||x.getDate()!==d)return '';
 return iso(x);
}
function dateFmt(raw){
 const parsed=parseDate(raw);
 if(!parsed)return 'Not set';
 return new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'2-digit'}).format(
   new Date(Number(parsed.slice(0,4)),Number(parsed.slice(5,7))-1,Number(parsed.slice(8,10)),12));
}
function dayDiff(isoDate){
 const ref=parseDate(isoDate);
 if(!ref)return null;
 const [y,m,d]=ref.split('-').map(Number);
 const today=nowDate().split('-').map(Number);
 return Math.round((Date.UTC(y,m-1,d)-Date.UTC(today[0],today[1]-1,today[2]))/86400000);
}
function classify(doc){
 const days=dayDiff(doc.expiresAt);
 if(days===null)return {key:'no-date',label:'No expiry date',days:null};
 if(days<0)return {key:'expired',label:'Expired '+Math.abs(days)+'d ago',days};
 if(days===0)return {key:'soon',label:'Expires today',days};
 if(days<=30)return {key:'soon',label:'Expires in '+days+'d',days};
 return {key:'valid',label:'Valid · '+dateFmt(doc.expiresAt),days};
}
function categoryName(doc){
 const raw=trim(doc.category||'',45);
 return raw?raw.charAt(0).toUpperCase()+raw.slice(1):'Uncategorized';
}
function docType(doc){
 const raw=trim(doc.type||'',25).toLowerCase();
 return raw==='image'?'Image':raw==='pdf'?'PDF':raw==='file'?'File':raw?raw.toUpperCase():'Document';
}
function hasCloud(doc){return Boolean(trim(doc.storagePath||'',450))}
function safeDocDate(doc){
 const v=parseDate(doc.updatedAt)||parseDate(doc.createdAt)||'';
 return v||'';
}
function sizeFmt(bytes){
 const n=Number(bytes);
 if(!Number.isFinite(n)||n<=0)return 'Not recorded';
 if(n<1024)return n+' B';
 if(n<1024*1024)return (n/1024).toFixed(1)+' KB';
 return (n/(1024*1024)).toFixed(1)+' MB';
}
function current(){
 if(!bridge()?.ready()||app.classList.contains('hidden'))return null;
 return bridge();
}
function visible(){
 const q=search.trim().toLocaleLowerCase();
 return docs.filter(d=>{
   if(category!=='all'&&String(d.category||'').toLocaleLowerCase()!==category)return false;
   if(status!=='all'&&classify(d).key!==status)return false;
   if(type!=='all'&&docType(d).toLocaleLowerCase()!==type)return false;
   if(!q)return true;
   return [d.name,d.category,d.type,d.note,d.linkedLabel,(Array.isArray(d.tags)?d.tags.join(' '):'')]
     .some(x=>String(x??'').toLocaleLowerCase().includes(q));
 }).sort((a,b)=>{
   if(sort==='name')return String(a.name||'').localeCompare(String(b.name||''));
   if(sort==='recent')return safeDocDate(b).localeCompare(safeDocDate(a));
   if(sort==='category')return categoryName(a).localeCompare(categoryName(b))||
     String(a.name||'').localeCompare(String(b.name||''));
   const x=parseDate(a.expiresAt)||'9999-12-31',y=parseDate(b.expiresAt)||'9999-12-31';
   return x.localeCompare(y)||String(a.name||'').localeCompare(String(b.name||''));
 });
}
function controlOption(select,value,label){
 const o=node('option','',label);o.value=value;select.append(o);
}
function filterField(label,values,key,selected){
 const field=node('label','docs-filter-field');
 field.append(node('span','',label));
 const select=node('select','docs-select');
 select.setAttribute('aria-label',label);
 for(const [value,title]of values)controlOption(select,value,title);
 select.value=selected;
 select.addEventListener('change',()=>{
   if(key==='category')category=select.value;
   if(key==='status')status=select.value;
   if(key==='type')type=select.value;
   if(key==='sort')sort=select.value;
   updateResults();
 });
 field.append(select);
 return field;
}
function categoryOptions(){
 const set=new Set(docs.map(d=>String(d.category||'').toLocaleLowerCase()));
 return [['all','All categories'],...([...set].sort().map(x=>[x||'',x?x.charAt(0).toUpperCase()+x.slice(1):'Uncategorized']))];
}
function typeOptions(){
 return [['all','All formats'],...([...new Set(docs.map(d=>docType(d).toLocaleLowerCase()))].sort().map(x=>[x,x.toUpperCase()]))];
}
function stats(){
 const total=docs.length,expired=docs.filter(d=>classify(d).key==='expired').length,
 soon=docs.filter(d=>classify(d).key==='soon').length,cloud=docs.filter(hasCloud).length;
 return [{label:'All documents',value:total,filter:'all'},
 {label:'Expired',value:expired,filter:'expired'},
 {label:'Next 30 days',value:soon,filter:'soon'},
 {label:'Cloud files',value:cloud,filter:null}];
}
function setStatusFilter(next){
 status=next;
 const f=$('#docsStatus');
 if(f)f.value=next;
 updateResults();
}
function build(){
 const host=$('#documentsProPage',content);
 if(!host)return;
 host.dataset.docsReady='1';host.replaceChildren();
 const header=node('div','docs-heading');
 const textwrap=node('div');
 textwrap.append(node('p','eyebrow','DOCUMENTS PRO'),
   node('h2','','Your documents'),
   node('p','docs-subtitle','Private, Android-synced documents · categories, expiry dates and secure file access'));
 const tools=node('div','docs-top-tools');
 tools.append(node('span','docs-read-only','Synced · read only'));
 header.append(textwrap,tools);host.append(header);
 const kpis=node('div','docs-stats');
 for(const s of stats()){
   const card=node('button','card docs-stat');
   card.type='button';card.disabled=s.filter===null;
   card.append(node('strong','',s.value),node('span','',s.label));
   if(s.filter!==null){
     card.addEventListener('click',()=>setStatusFilter(s.filter));
     if(s.filter===status)card.classList.add('selected');
   }else card.title='Files accessible from protected Supabase Storage';
   kpis.append(card);
 }
 host.append(kpis);
 const filters=node('section','docs-toolbar');
 const searchField=node('label','docs-filter-field docs-search-field');
 searchField.append(node('span','','Find documents'));
 const input=node('input','docs-search');
 input.type='search';input.maxLength=160;input.value=search;
 input.placeholder='Search name, notes, tags…';
 input.setAttribute('aria-label','Search documents');
 input.addEventListener('input',()=>{search=input.value;updateResults()});
 searchField.append(input);
 const categoryField=filterField('Category',categoryOptions(),'category',category);
 const statusField=filterField('Validity',[['all','Any validity'],['expired','Expired'],['soon','Expiring ≤30d'],['valid','Valid'],['no-date','No expiry date']],'status',status);
 statusField.querySelector('select').id='docsStatus';
 const typeField=filterField('Type',typeOptions(),'type',type);
 const sortField=filterField('Sort',[['expiry','Expiry date'],['recent','Recently updated'],['name','Name A–Z'],['category','Category']],'sort',sort);
 filters.append(searchField,categoryField,statusField,typeField,sortField);
 host.append(filters);
 const summary=node('p','docs-results-summary');summary.id='docsResultsSummary';
 summary.setAttribute('role','status');host.append(summary);
 const grid=node('div','docs-grid');grid.id='docsGrid';host.append(grid);
 const foot=node('p','docs-footnote',
 'Private files are opened only after you request them. Android-local file URIs cannot be opened in a browser. Upload and metadata editing will be added after the Android secure-upload contract is verified end to end.');
 host.append(foot);
 updateResults();
}
function badge(doc){
 const x=classify(doc);
 return node('span','docs-expiry-badge docs-expiry-'+x.key,x.label);
}
function fileIcon(doc){return docType(doc)==='PDF'?'▤':docType(doc)==='Image'?'▣':'▧'}
function card(doc){
 const item=node('article','card docs-card');
 const top=node('div','docs-card-top');
 const icon=node('span','docs-file-icon',fileIcon(doc));
 const label=node('div','docs-card-label');
 label.append(node('strong','',text(doc.name||'Untitled',160)),
   node('span','docs-card-category',categoryName(doc)+' · '+docType(doc)));
 top.append(icon,label);item.append(top,badge(doc));
 const description=node('p','docs-card-description',trim(doc.note,170)||'No description provided');
 item.append(description);
 const sub=node('div','docs-card-info');
 sub.append(node('span','','Expires: '+dateFmt(doc.expiresAt)));
 sub.append(node('span','',hasCloud(doc)?'Protected cloud file':'Android/local metadata'));
 item.append(sub);
 const actions=node('div','docs-card-actions');
 const btn=node('button','secondary docs-details-button','Details →');btn.type='button';
 btn.addEventListener('click',()=>showDetails(String(doc.id)));
 actions.append(btn);item.append(actions);
 return item;
}
function updateResults(){
 const host=$('#documentsProPage',content),grid=$('#docsGrid',host||document);
 if(!host||!grid)return;
 const rows=visible();
 const caption=$('#docsResultsSummary',host);
 if(caption)caption.textContent=rows.length+' of '+docs.length+' documents · '+nowDate();
 grid.replaceChildren();
 if(!rows.length){
   grid.append(node('div','docs-empty',docs.length?
     'No documents match these filters. Try another category or status.':
     'No documents synced to this account yet.'));
 }else for(const doc of rows)grid.append(card(doc));
 // Keep KPI active state in sync without rebuilding / losing the search input focus.
 host.querySelectorAll('.docs-stat').forEach(b=>{
   const val=b.querySelector('span')?.textContent;
   b.classList.toggle('selected',
     (val==='All documents'&&status==='all')||
     (val==='Expired'&&status==='expired')||
     (val==='Next 30 days'&&status==='soon'));
 });
}
function ensureDialog(){
 let dialog=$('#docsDetailsDialog');
 if(dialog)return dialog;
 dialog=node('dialog','docs-detail-dialog');
 dialog.id='docsDetailsDialog';dialog.setAttribute('aria-label','Document details');
 const wrap=node('div','docs-detail-wrap');
 const heading=node('div','docs-detail-heading');
 const title=node('h3','docs-detail-title','Document details');title.id='docsDialogTitle';
 const close=node('button','docs-close','×');close.type='button';
 close.setAttribute('aria-label','Close document details');
 close.addEventListener('click',()=>dialog.close());
 heading.append(title,close);wrap.append(heading);
 const body=node('div','docs-detail-body');body.id='docsDetailBody';wrap.append(body);
 const feedback=node('p','docs-feedback','');feedback.id='docsFeedback';
 feedback.setAttribute('role','status');wrap.append(feedback);
 const preview=node('div','docs-preview');preview.id='docsPreview';wrap.append(preview);
 const actions=node('div','docs-detail-actions');
 const view=node('button','primary','Preview file');view.type='button';view.id='docsPreviewBtn';
 view.addEventListener('click',()=>loadFile(false));
 const download=node('button','secondary','Download file');download.type='button';download.id='docsDownloadBtn';
 download.addEventListener('click',()=>loadFile(true));
 actions.append(view,download);wrap.append(actions);
 dialog.append(wrap);
 dialog.addEventListener('close',()=>{
   selectedId='';busy=false;loadToken++;
   clearFileURL();
   $('#docsPreview')?.replaceChildren();
   $('#docsFeedback').textContent='';
 });
 document.body.append(dialog);
 return dialog;
}
function detailPair(parent,label,value){
 const row=node('div','docs-detail-pair');
 row.append(node('span','',label),node('strong','',value||'—'));parent.append(row);
}
function clearFileURL(){if(objectURL){URL.revokeObjectURL(objectURL);objectURL=null}}
function showDetails(id){
 const doc=docs.find(d=>String(d.id)===id);
 if(!doc||!current())return;
 selectedId=id;loadToken++;
 const dialog=ensureDialog(),body=$('#docsDetailBody');
 body.replaceChildren();$('#docsPreview').replaceChildren();$('#docsFeedback').textContent='';
 clearFileURL();
 $('#docsDialogTitle').textContent=text(doc.name||'Document');
 const state=classify(doc);
 const badgeEl=badge(doc);body.append(badgeEl);
 const grid=node('div','docs-detail-grid');
 detailPair(grid,'Category',categoryName(doc));
 detailPair(grid,'File type',docType(doc));
 detailPair(grid,'Expires',dateFmt(doc.expiresAt));
 detailPair(grid,'Validity',state.label);
 detailPair(grid,'Cloud access',hasCloud(doc)?'Protected user storage':'Only local metadata / Android file');
 detailPair(grid,'File size',sizeFmt(doc.size));
 detailPair(grid,'Reminder on Android',doc.reminderEnabled===true?'Enabled':'Not enabled / not set');
 if(doc.reminderEnabled===true&&doc.reminderDaysBefore!=null)
   detailPair(grid,'Reminder lead',String(doc.reminderDaysBefore)+' days');
 if(trim(doc.reminderTime))detailPair(grid,'Reminder time',trim(doc.reminderTime,30));
 if(trim(doc.linkedType)&&doc.linkedType!=='none')
   detailPair(grid,'Linked to',text(doc.linkedLabel||doc.linkedType,100));
 if(trim(doc.createdAt))detailPair(grid,'Created',dateFmt(doc.createdAt));
 if(trim(doc.updatedAt))detailPair(grid,'Last updated',dateFmt(doc.updatedAt));
 body.append(grid);
 const note=trim(doc.note,2500);
 if(note){body.append(node('h4','docs-detail-subhead','Notes'),node('p','docs-detail-notes',note))}
 if(Array.isArray(doc.tags)&&doc.tags.length){
   const row=node('div','docs-tags');
   for(const tag of doc.tags.slice(0,24)){
     const safe=trim(tag,40);if(safe)row.append(node('span','docs-tag',safe));
   }
   body.append(row);
 }
 if(!hasCloud(doc)){
   body.append(node('p','docs-private-warning',
     'No verified cloud file is linked. This document may use an Android-only file URI. Its metadata is still available.'));
 }
 $('#docsPreviewBtn').disabled=!hasCloud(doc);
 $('#docsDownloadBtn').disabled=!hasCloud(doc);
 dialog.showModal();
}
function setBusy(state){
 busy=state;
 $('#docsPreviewBtn').disabled=state;
 $('#docsDownloadBtn').disabled=state;
}
function fileName(doc,mime){
 let name=trim(doc.name||'Document',130).replace(/[\/\\<>:"|?*\x00-\x1f]/g,'_');
 if(!name)name='Document';
 if(!/\.[a-z0-9]{1,6}$/i.test(name)){
   const ext=mime==='application/pdf'?'.pdf':mime==='image/png'?'.png':
     mime==='image/jpeg'?'.jpg':mime==='image/webp'?'.webp':mime==='image/gif'?'.gif':'';
   name+=ext;
 }
 return name;
}
async function loadFile(asDownload){
 if(busy||!selectedId||!current())return;
 const doc=docs.find(d=>String(d.id)===selectedId);if(!doc)return;
 const request=++loadToken,identity=owner;
 const feedback=$('#docsFeedback'),container=$('#docsPreview');
 setBusy(true);
 feedback.textContent='Reading your private document…';
 try{
   const {blob,mime}=await bridge().readFile(selectedId);
   if(request!==loadToken||identity!==owner||!current()||bridge().identity()!==identity)return;
   if(blob.size>26*1024*1024)throw new Error('The file exceeds the supported web preview limit.');
   const type=trim(mime,80).toLowerCase().split(';')[0]||blob.type;
   if(asDownload){
     const href=URL.createObjectURL(blob);
     const a=document.createElement('a');a.href=href;a.download=fileName(doc,type);
     document.body.append(a);a.click();a.remove();
     // Delay revocation to allow browsers to complete the download.
     setTimeout(()=>URL.revokeObjectURL(href),60000);
     feedback.textContent='Download requested from private storage.';
   }else{
     clearFileURL();container.replaceChildren();
     const allowed=type==='application/pdf'||['image/jpeg','image/png','image/webp','image/gif'].includes(type);
     if(!allowed){feedback.textContent='Preview is available only for PDF and standard images. Use Download for this file.';return}
     const previewBlob=blob.type===type?blob:new Blob([blob],{type});
     objectURL=URL.createObjectURL(previewBlob);
     if(type==='application/pdf'){
       const frame=node('iframe','docs-preview-frame');
       frame.title='Private PDF preview';frame.src=objectURL;
       frame.setAttribute('referrerpolicy','no-referrer');
       container.append(frame);
     }else{
       const img=node('img','docs-preview-image');
       img.alt='Preview of '+text(doc.name,130);img.src=objectURL;
       container.append(img);
     }
     feedback.textContent='Private preview loaded locally in your browser.';
   }
 }catch(error){
   if(request===loadToken&&identity===owner)
     feedback.textContent=String(error?.message||'Could not open private document.').slice(0,220);
 }finally{
   if(request===loadToken)setBusy(false);
 }
}
function sync(){
 const ready=current(),host=$('#documentsProPage',content);
 if(!ready){
   if(owner){owner='';docs=[];loadToken++;if($('#docsDetailsDialog')?.open)$('#docsDetailsDialog').close()}
   return;
 }
 const id=ready.identity();
 if(id!==owner){
   owner=id;docs=[];
   search='';category='all';status='all';type='all';sort='expiry';
   loadToken++;if($('#docsDetailsDialog')?.open)$('#docsDetailsDialog').close();
 }
 const source=ready.snapshot();
 if(!Array.isArray(source))return;
 docs=source;
 if(host&&!host.dataset.docsReady)build();
}
new MutationObserver(sync).observe(content,{childList:true});
new MutationObserver(sync).observe(app,{attributes:true,attributeFilter:['class']});
sync();
})();
