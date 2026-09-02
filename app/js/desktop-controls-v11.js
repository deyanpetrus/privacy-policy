(()=>{
'use strict';
if(new URLSearchParams(location.search).get('workspace')!=='desktop')return;
const ICON=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5 7 7M17 17l1.5 1.5M18.5 5.5 17 7M7 17l-1.5 1.5"/><path d="M15.8 8.2a5.4 5.4 0 0 0-7.6 7.6 5.4 5.4 0 0 1 7.6-7.6Z"/></svg>`;
function close(panel,toggle){panel.classList.remove('theme-menu-open-v11');toggle.classList.remove('active');toggle.setAttribute('aria-expanded','false')}
function init(){
 const root=document.getElementById('lifeDashDesktop'),panel=root?.querySelector('.desktop-theme-panel');
 if(!root||!panel){setTimeout(init,50);return}
 if(document.getElementById('workspaceThemeToggleV11'))return;
 const toggle=document.createElement('button');toggle.id='workspaceThemeToggleV11';toggle.type='button';toggle.className='workspace-theme-toggle-v11';toggle.title='Workspace theme';toggle.setAttribute('aria-label','Choose workspace theme');toggle.setAttribute('aria-expanded','false');toggle.innerHTML=ICON;root.appendChild(toggle);
 toggle.addEventListener('click',e=>{e.stopPropagation();const open=panel.classList.toggle('theme-menu-open-v11');toggle.classList.toggle('active',open);toggle.setAttribute('aria-expanded',String(open))});
 panel.addEventListener('click',e=>{if(e.target.closest('[data-desktop-theme]'))setTimeout(()=>close(panel,toggle),20);e.stopPropagation()});
 document.addEventListener('click',e=>{if(panel.classList.contains('theme-menu-open-v11')&&!e.target.closest('#workspaceThemeToggleV11')&&!e.target.closest('.desktop-theme-panel'))close(panel,toggle)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.classList.contains('theme-menu-open-v11'))close(panel,toggle)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
