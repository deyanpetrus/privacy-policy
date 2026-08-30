(()=>{
'use strict';
const params=new URLSearchParams(location.search);if(params.get('workspace')!=='desktop')return;
const THEMES=[['light','Light'],['soft-dark','Dark'],['frost','Frost']];
const KEY='lifedash_window_theme_v1';
function current(){const v=localStorage.getItem(KEY)||'light';return THEMES.some(t=>t[0]===v)?v:'light'}
function apply(v,save=true){if(!THEMES.some(t=>t[0]===v))v='light';document.body.dataset.windowTheme=v;if(save)localStorage.setItem(KEY,v);document.querySelectorAll('[data-window-theme-choice]').forEach(b=>b.classList.toggle('active',b.dataset.windowThemeChoice===v))}
function buttons(cls){return `<div class="${cls}">${cls==='window-theme-switch'?'<span>Window</span>':''}${THEMES.map(([v,n])=>`<button type="button" data-window-theme-choice="${v}" title="${n} window theme">${n}</button>`).join('')}</div>`}
function installWindowSwitch(){const bar=document.querySelector('#desktopWindow .desktop-window-titlebar');if(!bar||bar.querySelector('.window-theme-switch'))return false;const controls=bar.querySelector('.window-controls');controls?.insertAdjacentHTML('beforebegin',buttons('window-theme-switch'));return true}
function installModalSwitch(){const head=document.querySelector('#modal .modal-head');if(!head||head.querySelector('.modal-window-theme'))return false;const close=head.querySelector('#modalClose');close?.insertAdjacentHTML('beforebegin',buttons('modal-window-theme'));return true}
function bind(){document.addEventListener('click',e=>{const b=e.target.closest('[data-window-theme-choice]');if(!b)return;e.preventDefault();e.stopPropagation();apply(b.dataset.windowThemeChoice)});}
function watch(){const obs=new MutationObserver(()=>{const changed=installWindowSwitch()|installModalSwitch();if(changed)apply(current(),false)});obs.observe(document.body,{childList:true,subtree:true});}
function init(){const link=document.createElement('link');link.rel='stylesheet';link.href='assets/window-themes.css?v=1';document.head.appendChild(link);apply(current(),false);installWindowSwitch();installModalSwitch();apply(current(),false);bind();watch();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
