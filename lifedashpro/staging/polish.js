/* LifeDashPro Staging — visual enhancements A2–A4.
   Read-only UI layer; no fetch, auth, mutation of user_data or Supabase access. */
(function(){
  'use strict';
  function byId(id){return document.getElementById(id)}
  function q(selector,root){return (root||document).querySelector(selector)}
  function qa(selector,root){return Array.from((root||document).querySelectorAll(selector))}
  function init(){
    var app=byId('appView'),content=byId('content'),sidebar=byId('sidebar'),sidebarToggle=byId('sidebarToggle'),scrim=byId('navScrim');
    var profileHost=byId('profileMenuHost'),profileBtn=byId('profileMenuBtn'),profileMenu=byId('profileMenu');
    var syncLabel=byId('syncLabel'),syncTime=byId('syncTime');
    var headerSync=byId('headerSync'),headerSyncLabel=byId('headerSyncLabel'),headerSyncTime=byId('headerSyncTime');
    var avatar=byId('avatar'),profileInitial=byId('profileMenuInitial');
    if(!app||!content)return;

    function updateSync(){
      if(!syncLabel||!headerSyncLabel)return;
      var label=syncLabel.textContent.trim()||'Sync not checked';
      var stamp=syncTime&&syncTime.textContent.trim()||'Not refreshed';
      headerSyncLabel.textContent=label;
      if(headerSyncTime)headerSyncTime.textContent=stamp;
      if(headerSync){
        var error=/issue|error|failed|offline/i.test(label);
        headerSync.classList.toggle('has-error',error);
        headerSync.classList.toggle('is-ok',!error&&(/updated/i.test(stamp)));
        headerSync.setAttribute('title',label+' · '+stamp);
      }
    }
    updateSync();
    if(syncLabel&&syncTime){
      var syncObserver=new MutationObserver(updateSync);
      syncObserver.observe(syncLabel,{childList:true,characterData:true,subtree:true});
      syncObserver.observe(syncTime,{childList:true,characterData:true,subtree:true});
    }
    if(avatar&&profileInitial){
      function updateAvatar(){profileInitial.textContent=avatar.textContent.trim().slice(0,1)||'U'}
      updateAvatar();
      new MutationObserver(updateAvatar).observe(avatar,{childList:true,subtree:true,characterData:true});
    }

    function closeProfile(){
      if(profileMenu)profileMenu.hidden=true;
      if(profileBtn)profileBtn.setAttribute('aria-expanded','false');
    }
    if(profileBtn&&profileMenu){
      profileBtn.addEventListener('click',function(){
        var open=profileMenu.hidden;
        profileMenu.hidden=!open;
        profileBtn.setAttribute('aria-expanded',String(open));
        if(open)closeMobile(false);
      });
      qa('[data-page]',profileMenu).forEach(function(button){button.addEventListener('click',closeProfile)});
    }

    var narrow=window.matchMedia('(max-width: 800px)');
    var STORAGE_KEY='lifedash_web_nav_collapsed_v1';
    var desktopCollapsed=false;
    try{desktopCollapsed=localStorage.getItem(STORAGE_KEY)==='true'}catch(e){}
    function mobile(){return narrow.matches}
    function setExpanded(open){
      app.classList.toggle('nav-drawer-open',mobile()&&open);
      if(scrim)scrim.hidden=!(mobile()&&open);
      if(sidebarToggle){
        sidebarToggle.setAttribute('aria-expanded',String(mobile()&&open));
        sidebarToggle.setAttribute('aria-label',mobile()?(open?'Close navigation':'Open navigation'):(desktopCollapsed?'Expand sidebar':'Collapse sidebar'));
      }
      if(sidebar)sidebar.setAttribute('aria-hidden',mobile()&&!open?'true':'false');
      if(sidebar)sidebar.inert=mobile()&&!open;
    }
    function closeMobile(restoreFocus){
      if(!mobile())return;
      setExpanded(false);
      if(restoreFocus&&sidebarToggle)sidebarToggle.focus();
    }
    function applyWidth(){
      app.classList.toggle('nav-collapsed',!mobile()&&desktopCollapsed);
      setExpanded(app.classList.contains('nav-drawer-open'));
    }
    if(sidebarToggle)sidebarToggle.addEventListener('click',function(){
      closeProfile();
      if(mobile()){setExpanded(!app.classList.contains('nav-drawer-open'))}
      else{
        desktopCollapsed=!desktopCollapsed;
        try{localStorage.setItem(STORAGE_KEY,String(desktopCollapsed))}catch(e){}
        applyWidth();
      }
    });
    if(scrim)scrim.addEventListener('click',function(){closeMobile(true)});
    qa('#nav [data-page],.mobile-nav [data-page]').forEach(function(button){
      button.addEventListener('click',function(){closeMobile(false);closeProfile()});
    });
    if(narrow.addEventListener)narrow.addEventListener('change',applyWidth);
    else if(narrow.addListener)narrow.addListener(applyWidth);
    applyWidth();

    document.addEventListener('pointerdown',function(e){
      if(profileHost&&!profileHost.contains(e.target))closeProfile();
    });
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'){
        if(app.classList.contains('nav-drawer-open'))closeMobile(true);
        else if(profileMenu&&!profileMenu.hidden){closeProfile();profileBtn.focus()}
      }
    });

    function addStat(parent,label,value,icon){
      var item=document.createElement('div');
      item.className='dash-stat';
      var pict=document.createElement('span');pict.className='dash-stat-icon';pict.textContent=icon;pict.setAttribute('aria-hidden','true');
      var copy=document.createElement('div');copy.className='dash-stat-copy';
      var text=document.createElement('span');text.className='dash-stat-label';text.textContent=label;
      var strong=document.createElement('strong');strong.textContent=value||'—';
      copy.appendChild(text);copy.appendChild(strong);item.appendChild(pict);item.appendChild(copy);parent.appendChild(item);
    }
    function decorate(){
      var isDashboard=(byId('pageTitle')&&byId('pageTitle').textContent.trim()==='Dashboard');
      content.classList.toggle('dashboard-view',isDashboard);
      if(!isDashboard)return;
      var grid=q(':scope > .grid',content);
      if(!grid||grid.dataset.polished==='1')return;
      if(grid.children.length<5)return;
      grid.dataset.polished='1';
      grid.classList.add('dash-grid');
      var cards=Array.from(grid.children);
      ['dash-upcoming','dash-finance','dash-notes','dash-tasks','dash-journey'].forEach(function(name,i){
        if(cards[i])cards[i].classList.add(name);
      });
      if(cards[0]){
        var internal=q('.pill',cards[0]);if(internal)internal.hidden=true;
      }
      if(cards[5])cards[5].hidden=true; // Detailed safety notes remain accessible in Profile.
      var bar=document.createElement('section');
      bar.className='dash-stats';
      bar.setAttribute('aria-label','Account overview');
      var amount=cards[1]&&q('.kpi-grid .kpi:last-child strong',cards[1]);
      function getCardNum(i){
        var head=cards[i]&&q('h3',cards[i]);return head?(head.textContent.match(/^\d+/)||[])[0]||'0':'0';
      }
      addStat(bar,'Balance',amount?amount.textContent:'—','€');
      addStat(bar,'Notes',getCardNum(2),'✎');
      addStat(bar,'Tasks due',getCardNum(3),'✓');
      addStat(bar,'Saved journeys',getCardNum(4),'⌖');
      content.insertBefore(bar,grid);
      qa('.dash-notes .timeline-item small,.dash-journey .timeline-item small',grid).forEach(function(node){
        var source=node.textContent.trim();
        if(!/^\d{4}-\d{2}-\d{2}/.test(source))return;
        var date=new Date(source);
        if(Number.isNaN(date.getTime()))return;
        node.title=source;
        node.textContent=new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric'}).format(date);
      });
    }
    new MutationObserver(decorate).observe(content,{childList:true});
    decorate();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
