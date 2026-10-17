/* LifeDashPro Web v1.37 — optional Cloudflare Turnstile integration.
   IMPORTANT: CAPTCHA must also be enabled in Supabase Auth with the SECRET key;
   the public site key alone is not a security boundary. */
(()=>{'use strict';
 const siteKey=String(window.LIFEDASH_CONFIG?.captchaSiteKey||'').trim();
 const widgets={signin:null,register:null};
 let loading=false;
 function issue(message){
  const el=document.getElementById('authMessage');
  if(el){el.textContent=message;el.classList.remove('hidden');el.classList.add('error')}
 }
 function render(){
  if(!siteKey||!window.turnstile)return;
  for(const type of ['signin','register']){
   if(widgets[type]!==null)continue;
   const el=document.getElementById(type+'Captcha');
   if(!el)continue;
   try{widgets[type]=window.turnstile.render(el,{sitekey:siteKey,theme:'auto'})}
   catch(_){issue('Security verification failed to load. Refresh to try again.')}
  }
 }
 function start(){
  if(!siteKey||loading)return;
  loading=true;
  const script=document.createElement('script');
  script.async=true;script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.onload=render;
  script.onerror=()=>issue('Security verification unavailable. Refresh to try again.');
  document.head.appendChild(script);
 }
 window.LifeDashCaptchaV137=Object.freeze({
  enabled:()=>!!siteKey,
  token:type=>{
   if(!siteKey)return null;
   const id=widgets[type];
   const token=id!==null&&window.turnstile?window.turnstile.getResponse(id):'';
   if(!token){issue('Complete CAPTCHA before continuing.');return false}
   return token;
  },
  reset:type=>{
   const id=widgets[type];
   if(id!==null&&window.turnstile)try{window.turnstile.reset(id)}catch(_){}
  }
 });
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
