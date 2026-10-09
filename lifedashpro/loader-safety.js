(()=>{
  'use strict';
  // Startup UX guard only. Never reads sessions, credentials, or app data.
  window.addEventListener('DOMContentLoaded',()=>{
    window.setTimeout(()=>{
      const boot=document.getElementById('boot');
      if(!boot||boot.classList.contains('hidden')||document.getElementById('lifedash-boot-help'))return;
      const panel=document.createElement('div');
      panel.id='lifedash-boot-help';
      panel.setAttribute('role','status');
      panel.style.cssText='max-width:300px;margin:18px auto;padding:14px;border-radius:12px;background:#162540;color:#e8f0ff;text-align:center;font:14px/1.5 system-ui,sans-serif';
      const message=document.createElement('p');
      message.textContent='LifeDashPro is taking longer than expected to load. Try a clean web refresh.';
      const retry=document.createElement('a');
      retry.href='./reset.html';
      retry.textContent='Refresh web cache';
      retry.style.cssText='display:inline-block;padding:9px 14px;border-radius:9px;background:#2563eb;color:#fff;text-decoration:none;font-weight:600';
      panel.append(message,retry);
      boot.append(panel);
    },14000);
  },{once:true});
})();
