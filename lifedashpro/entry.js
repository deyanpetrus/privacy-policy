(()=>{
  'use strict';
  const initial=new URL(location.href);
  window.__LIFEDASH_CANONICAL_WEB__=true;
  window.__LIFEDASH_DESKTOP_BOOTSTRAPPED__=initial.searchParams.get('workspace')==='desktop';

  // Signed-out visitors stay on the clean canonical URL. A valid session is
  // allowed to bootstrap Desktop mode once; after all deferred scripts have
  // evaluated we remove the internal parameters from the address bar.
  window.addEventListener('DOMContentLoaded',()=>{
    const clean=new URL(location.href);
    clean.searchParams.delete('workspace');
    clean.searchParams.delete('v');
    clean.searchParams.delete('desktopBootstrap');
    const qs=clean.searchParams.toString();
    const defaultHash=clean.hash==='#dashboard'?'':clean.hash;
    history.replaceState({},'',clean.pathname+(qs?'?'+qs:'')+defaultHash);
  },{once:true});
})();