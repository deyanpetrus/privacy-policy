(function () {
  'use strict';
  var completed=false;
  var status=document.getElementById('bootStatus');
  var help=document.getElementById('bootHelp');
  var retry=document.getElementById('retryBoot');
  var failures=0;
  var vendors=[
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js'
  ];
  function explain(message){
    if(completed)return;
    status.textContent=message;help.classList.remove('hidden');
  }
  if(retry)retry.addEventListener('click',function(){location.reload();});
  // The initial splash MUST never remain indefinitely, including during lost-CDN requests.
  var watchdog=setTimeout(function(){explain('Connection is taking longer than expected.');},12000);
  window.LIFEDASH_BOOT_OK=function(){completed=true;clearTimeout(watchdog);};
  window.addEventListener('error',function(event){
    if(completed)return;
    var source=String(event.filename||'');
    if(source.includes('/lifedashpro/')||source.includes('supabase')){
      explain('Web application failed to initialize. Please retry.');
    }
  });
  function loadApp(){
    if(!window.supabase||typeof window.supabase.createClient!=='function'){
      explain('Secure login library is unavailable. Please retry.');return;
    }
    var s=document.createElement('script');s.src='./app.js?v=1.12.2';s.async=true;
    s.onerror=function(){explain('The application file could not be loaded. Please retry.');};
    document.body.appendChild(s);
  }
  function loadVendor(){
    if(window.supabase&&window.supabase.createClient){loadApp();return;}
    if(failures>=vendors.length){explain('Secure login cannot load. Check internet access, then retry.');return;}
    var url=vendors[failures++];
    status.textContent=failures===1?'Connecting secure login…':'Trying backup login server…';
    var s=document.createElement('script');s.src=url;s.async=true;
    var settled=false;var timer=setTimeout(function(){finish(false);},8500);
    function finish(ok){
      if(settled)return;settled=true;clearTimeout(timer);
      if(!ok){s.remove();loadVendor();return;}
      loadApp();
    }
    s.onload=function(){finish(!!(window.supabase&&window.supabase.createClient));};
    s.onerror=function(){finish(false);};
    document.body.appendChild(s);
  }
  loadVendor();
})();
