/* LifeDashPro Web v1.8.1 — additive compact workspace & Dashboard Settings.
   Presentation-only: retains original Add click handlers and widget order logic.
   No database or network calls, no changes to protected v1.6.1 theme. */
(()=>{
 'use strict';
 const content=document.getElementById('content');
 const host=document.getElementById('dashboardSettingsHost');
 const toggle=document.getElementById('dashboardSettingsToggle');
 const menu=document.getElementById('dashboardSettingsMenu');
 const mount=document.getElementById('dashboardLayoutMount');
 if(!content)return;
 const compactPages=new Set(['Notes Pro','Finance','Tasks','Documents','Vehicles','Journey','Today & Next 5','Profile & Settings']);
 function activePage(){
   return document.getElementById('pageTitle')?.textContent.trim()||'';
 }
 function compact(){
   const page=activePage();
   if(!compactPages.has(page))return;
   // The page title is already permanently visible in the top bar.
   const repeated=content.querySelector(':scope > .section-head');
   if(!repeated)return;
   const actionHead=content.querySelector(':scope > .section-head:has([data-new])');
   const add=actionHead?.querySelector('[data-new]');
   if(add){
     const toolbar=content.querySelector('#featureToolbar');
     if(toolbar){
       const heading=toolbar.querySelector('.feature-toolbar-heading');
       if(heading){
         let actions=heading.querySelector('.compact-feature-actions');
         if(!actions){
           actions=document.createElement('div');actions.className='compact-feature-actions';
           const reset=heading.querySelector('.feature-reset');
           if(reset)actions.appendChild(reset);
           heading.appendChild(actions);
         }
         actions.insertBefore(add,actions.firstChild);
         add.classList.add('compact-add-button');
       }
     }else{
       let bar=content.querySelector('.compact-actionbar');
       if(!bar){
         bar=document.createElement('div');bar.className='compact-actionbar';
         repeated.insertAdjacentElement('afterend',bar);
       }
       bar.append(add);
     }
     if(!actionHead.querySelector('button'))actionHead.remove();
   }
   // Remove only the redundant top heading, never the records or editor actions.
   repeated.remove();
 }
 function closeMenu(focus=false){
   if(!menu||!toggle)return;
   menu.hidden=true;
   toggle.setAttribute('aria-expanded','false');
   if(focus)toggle.focus();
 }
 function dashboardSettings(){
   if(!host||!menu||!mount||!toggle)return;
   const grid=content.querySelector('.dash-grid');
   const isDashboard=activePage()==='Dashboard'&&Boolean(grid);
   host.hidden=!isDashboard;
   if(!isDashboard){closeMenu();return}
   const toolbar=content.querySelector(':scope > .widget-layout-toolbar');
   if(toolbar&&!mount.contains(toolbar)){
     // Move the actual v1.5 Customize layout buttons; keep their existing listeners.
     mount.replaceChildren(toolbar);
   }
 }
 toggle?.addEventListener('click',()=>{
   if(!menu||host.hidden)return;
   const open=menu.hidden;
   menu.hidden=!open;
   toggle.setAttribute('aria-expanded',String(open));
 });
 document.addEventListener('pointerdown',event=>{
   if(host&&!host.contains(event.target))closeMenu();
 });
 document.addEventListener('keydown',event=>{
   if(event.key==='Escape'&&!menu?.hidden)closeMenu(true);
 });
 function enhance(){
   compact();
   dashboardSettings();
 }
 new MutationObserver(enhance).observe(content,{childList:true});
 enhance();
})();
