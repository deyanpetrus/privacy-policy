(()=>{
  'use strict';
  // Canonical /lifedashpro/ must stay a normal auth page while signed out.
  // Desktop mode is enabled only after a valid Supabase session by the
  // v37.21.10 recovery/bootstrap layer.
  window.__LIFEDASH_CANONICAL_WEB__=true;

  window.addEventListener('DOMContentLoaded',()=>{
    // workspace/v are internal bootstrap parameters only. Once all deferred
    // desktop scripts have evaluated, keep the public URL clean.
    const clean=new URL(location.href);
    clean.searchParams.delete('workspace');
    clean.searchParams.delete('v');
    clean.searchParams.delete('desktopBootstrap');
    const qs=clean.searchParams.toString();
    const defaultHash=clean.hash==='#dashboard'?'':clean.hash;
    history.replaceState({},'',clean.pathname+(qs?'?'+qs:'')+defaultHash);
  },{once:true});
})();