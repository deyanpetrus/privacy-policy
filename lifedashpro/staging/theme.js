/* LifeDashPro Web A1 — appearance only. No auth, Supabase or user_data access. */
(function () {
  'use strict';
  var STORAGE_KEY='lifedash_web_appearance_v1';
  var valid=['auto','light','dark'];
  var system=window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var mode='auto';

  try {
    var saved=window.localStorage.getItem(STORAGE_KEY);
    if(valid.indexOf(saved)!==-1) mode=saved;
  } catch (error) { /* Private browsing may disallow storage. */ }

  function resolved(){
    return mode==='auto' ? (system&&system.matches ? 'dark':'light') : mode;
  }
  function apply(){
    var actual=resolved();
    var root=document.documentElement;
    root.setAttribute('data-ld-theme',actual);
    root.setAttribute('data-ld-theme-mode',mode);
    root.style.colorScheme=actual;
    var meta=document.querySelector('meta[name="theme-color"]');
    if(meta) meta.setAttribute('content',actual==='dark'?'#07111f':'#f5f8fe');
    var icon=document.getElementById('themeIcon');
    var label=document.getElementById('themeLabel');
    var toggle=document.getElementById('themeToggle');
    if(icon) icon.textContent=mode==='auto'?'◐':(mode==='dark'?'☾':'☀');
    if(label) label.textContent=mode.charAt(0).toUpperCase()+mode.slice(1);
    if(toggle){
      toggle.setAttribute('aria-label','Appearance: '+mode+'. Choose theme');
      toggle.setAttribute('title','Appearance: '+mode);
    }
    document.querySelectorAll('[data-theme-choice]').forEach(function(button){
      var selected=button.getAttribute('data-theme-choice')===mode;
      button.setAttribute('aria-pressed',String(selected));
      button.classList.toggle('selected',selected);
    });
  }
  function choose(next){
    if(valid.indexOf(next)===-1)return;
    mode=next;
    try { window.localStorage.setItem(STORAGE_KEY,mode); } catch(error) {}
    apply();
  }
  if(system){
    var systemChange=function(){if(mode==='auto')apply();};
    if(system.addEventListener)system.addEventListener('change',systemChange);
    else if(system.addListener)system.addListener(systemChange);
  }
  window.addEventListener('storage',function(event){
    if(event.key!==STORAGE_KEY)return;
    mode=valid.indexOf(event.newValue)!==-1?event.newValue:'auto';
    apply();
  });
  // Apply before the CSS loads to avoid a light/dark flash.
  apply();

  function bind(){
    apply();
    var host=document.getElementById('themeSwitcher');
    var toggle=document.getElementById('themeToggle');
    var menu=document.getElementById('themeMenu');
    if(!host||!toggle||!menu)return;
    function close(focusToggle){
      menu.hidden=true;
      toggle.setAttribute('aria-expanded','false');
      if(focusToggle)toggle.focus();
    }
    toggle.addEventListener('click',function(){
      var willOpen=menu.hidden;
      menu.hidden=!willOpen;
      toggle.setAttribute('aria-expanded',String(willOpen));
      if(willOpen){
        var active=menu.querySelector('[aria-pressed="true"]');
        if(active)active.focus();
      }
    });
    menu.querySelectorAll('[data-theme-choice]').forEach(function(button){
      button.addEventListener('click',function(){
        choose(button.getAttribute('data-theme-choice'));
        close(true);
      });
    });
    document.addEventListener('pointerdown',function(event){
      if(!menu.hidden&&!host.contains(event.target))close(false);
    });
    document.addEventListener('keydown',function(event){
      if(event.key==='Escape'&&!menu.hidden){event.preventDefault();close(true);}
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
})();
