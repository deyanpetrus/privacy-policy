(()=>{
  'use strict';
  const url=new URL(location.href);
  const needsDesktop=!url.searchParams.has('workspace');
  if(needsDesktop){
    url.searchParams.set('workspace','desktop');
    url.searchParams.set('v','13');
    history.replaceState({},'',url.pathname+'?'+url.searchParams.toString()+url.hash);
  }
  window.addEventListener('DOMContentLoaded',()=>{
    const clean=new URL(location.href);
    clean.searchParams.delete('workspace');
    clean.searchParams.delete('v');
    const qs=clean.searchParams.toString();
    const defaultHash=clean.hash==='#dashboard'?'':clean.hash;
    history.replaceState({},'',clean.pathname+(qs?'?'+qs:'')+defaultHash);
  },{once:true});
})();