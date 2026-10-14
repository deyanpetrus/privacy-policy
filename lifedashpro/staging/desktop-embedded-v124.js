/* v1.25: mark isolated child apps and choose desktop BEFORE first paint. */
(()=>{
'use strict';
const allowed=new Set(['dashboard','today','calendar','notes','tasks','documents','finance','explore','vehicles','journey','world','news','radio','backup','profile']);
const value=new URLSearchParams(location.search).get('ldpWindow');
const doc=document.documentElement;
if(value&&allowed.has(value)){
 doc.classList.add('ldp-os-embedded');doc.dataset.osWindow=value;
 // Post a read-only READY signal. Never transmit session tokens or account data.
 document.addEventListener('DOMContentLoaded',()=>{
  const app=document.getElementById('appView');
  const content=document.getElementById('content');
  if(!app||!content)return;
  let done=false,checkTimer=null,watchdog=null;
  const signal=()=>{
   if(done||app.classList.contains('hidden')||
      !window.LifeDashDashboardBridge?.ready?.()||!content.children.length)return;
   done=true;
   clearInterval(checkTimer);clearTimeout(watchdog);
   try{window.parent.postMessage({type:'ldp-os-ready-v125',app:value,load:new URLSearchParams(location.search).get('ldpLoad')||''},location.origin)}catch(_){}
  };
  const observer=new MutationObserver(()=>{signal();if(done)observer.disconnect()});
  observer.observe(app,{attributes:true,attributeFilter:['class']});
  observer.observe(content,{childList:true});
  checkTimer=setInterval(signal,650);
  watchdog=setTimeout(()=>{clearInterval(checkTimer);observer.disconnect()},60000);
  signal();
 });
 return;
}
try{
 // Explicit no-JS-interaction rescue: /staging/?ldpRescue=1
 // Do not preload Desktop even if this device previously selected it.
 if(new URLSearchParams(location.search).get('ldpRescue')==='1'){
  doc.classList.remove('ldp-os-launch-pending');
  return;
 }
 const stored=localStorage.getItem('lifedash_web_device_mode_v125');
 const mode=(stored==='desktop'||stored==='classic')?stored:
  (window.matchMedia('(min-width: 1000px)').matches?'desktop':'classic');
 if(mode==='desktop'){
  doc.classList.add('ldp-os-launch-pending');
  // If login/network initialization cannot finish, never trap the user behind a splash.
  setTimeout(()=>doc.classList.remove('ldp-os-launch-pending'),25000);
 }
}catch(_){}
})();
