(()=>{
'use strict';
const params=new URLSearchParams(location.search);
if(params.get('workspace')!=='desktop')return;
if(!document.querySelector('link[data-workspace-ux-v4]')){const link=document.createElement('link');link.rel='stylesheet';link.href='assets/workspace-ux.css?v=4';link.dataset.workspaceUxV4='1';document.head.appendChild(link)}
const EDIT_SELECTOR='[data-edit-note],[data-edit-tx],[data-edit-bill],[data-edit-invoice],[data-edit-doc],[data-edit-family-member],[data-edit-family-task],[data-edit-vehicle]';
const RECORD_SELECTOR='#page .data-table tbody tr,#page .list-item,#page .card.span-6';
const INTERACTIVE='button,a,input,select,textarea,label,[role="button"],[contenteditable="true"],[data-go],[data-toggle-task],[data-toggle-shop]';
let pageObserver=null,windowObserver=null;
function markEditable(){
 const page=document.getElementById('page');if(!page)return;
 page.querySelectorAll('.ux-click-edit').forEach(x=>x.classList.remove('ux-click-edit'));
 page.querySelectorAll('tbody tr,.list-item,.card.span-6').forEach(row=>{if(row.querySelector(EDIT_SELECTOR)){row.classList.add('ux-click-edit');row.setAttribute('title','Open / edit')}});
}
function syncFullscreenClass(){
 const win=document.getElementById('desktopWindow');
 document.body.classList.toggle('workspace-focus-v4',Boolean(win?.classList.contains('maximized')&&!win.classList.contains('hidden')));
 if(win){const b=document.getElementById('windowMax');if(b)b.title=win.classList.contains('maximized')?'Restore workspace':'Maximize to work fullscreen'}
}
function bindClickAnywhere(){
 document.addEventListener('click',e=>{
  if(!document.body.classList.contains('workspace-ux-v4'))return;
  if(e.target.closest(INTERACTIVE))return;
  const record=e.target.closest(RECORD_SELECTOR);if(!record)return;
  const edit=record.querySelector(EDIT_SELECTOR);if(!edit)return;
  e.preventDefault();e.stopPropagation();edit.click();
 });
}
function bindFullscreenUX(){
 const win=document.getElementById('desktopWindow');if(!win)return;
 windowObserver?.disconnect();windowObserver=new MutationObserver(syncFullscreenClass);windowObserver.observe(win,{attributes:true,attributeFilter:['class']});syncFullscreenClass();
 const title=win.querySelector('.desktop-window-titlebar');if(title)title.addEventListener('dblclick',e=>{if(e.target.closest('button'))return;document.getElementById('windowMax')?.click()});
 document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const modal=document.getElementById('modal');if(modal&&!modal.classList.contains('hidden'))return;if(win.classList.contains('maximized'))document.getElementById('windowMax')?.click()});
}
function bindPageObserver(){
 const page=document.getElementById('page');if(!page)return;
 pageObserver?.disconnect();pageObserver=new MutationObserver(()=>requestAnimationFrame(markEditable));pageObserver.observe(page,{childList:true,subtree:true});markEditable();
}
function start(){
 const root=document.getElementById('lifeDashDesktop');if(!root){setTimeout(start,40);return}
 document.body.classList.add('workspace-ux-v4');root.classList.add('workspace-ux-v4');
 bindClickAnywhere();bindFullscreenUX();bindPageObserver();
 window.addEventListener('resize',()=>requestAnimationFrame(markEditable));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
