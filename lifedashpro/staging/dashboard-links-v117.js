/* LifeDashPro Web Dashboard v1.17: navigation-only progressive enhancement.
   Does not mutate user data, Finance or Notes records.
   Works with existing dynamic Dashboard polish, widget rearrangement and mobile nav. */
(()=>{
  'use strict';
  const root=document.querySelector('#content'),shell=document.querySelector('#appView');
  if(!root||!shell)return;
  const cfg=[
    {cls:'dash-upcoming',page:'today',title:'Today & Next 5',actions:[['Today','today'],['Calendar','calendar']]},
    {cls:'dash-finance',page:'finance',title:'Finance',actions:[['Transactions','finance'],['+ New','finance','finance']]},
    {cls:'dash-notes',page:'notes',title:'Notes Pro',actions:[['All notes','notes'],['+ New note','notes','notes']]},
    {cls:'dash-tasks',page:'tasks',title:'Tasks',actions:[['All tasks','tasks'],['+ New task','tasks','tasks']]},
    {cls:'dash-journey',page:'journey',title:'Saved journeys',actions:[['Saved trips','journey']]}
  ];
  function go(page){
    const nav=document.querySelector('#nav button[data-page="'+page+'"]')||
      document.querySelector('.mobile-nav button[data-page="'+page+'"]');
    if(nav)nav.click();
  }
  function quick(page,mode){
    go(page);
    if(mode){
      const button=root.querySelector('button[data-new="'+mode+'"]');
      if(button)button.click();
    }
  }
  function enhanceCard(card,config){
    if(card.dataset.dashV117)return;
    card.dataset.dashV117='1';
    card.classList.add('dash-card-linkable');
    card.setAttribute('aria-label',config.title+' — open section');
    card.setAttribute('tabindex','0');
    card.addEventListener('click',e=>{
      if(card.closest('.widget-layout-edit'))return;
      if(e.target.closest('button,a,input,select,textarea,[role=button]'))return;
      go(config.page);
    });
    card.addEventListener('keydown',e=>{
      if(card.closest('.widget-layout-edit'))return;
      if(e.target!==card)return;
      if(e.key==='Enter'||e.key===' '){e.preventDefault();go(config.page)}
    });
    const actions=document.createElement('div');
    actions.className='dash-card-actions';
    actions.setAttribute('aria-label',config.title+' quick actions');
    for(const [label,page,mode] of config.actions){
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='dash-card-action';
      btn.textContent=label;
      btn.addEventListener('click',e=>{e.stopPropagation();quick(page,mode)});
      actions.append(btn);
    }
    card.append(actions);
  }
  function enhanceStat(tile,page){
    if(tile.dataset.dashStatV117)return;
    tile.dataset.dashStatV117='1';
    tile.tabIndex=0;
    tile.setAttribute('role','button');
    tile.setAttribute('aria-label','Open '+page);
    tile.classList.add('dash-stat-linkable');
    tile.addEventListener('click',()=>go(page));
    tile.addEventListener('keydown',e=>{
      if(e.target===tile&&(e.key==='Enter'||e.key===' ')){
        e.preventDefault();go(page);
      }
    });
  }
  function decorate(){
    if(shell.classList.contains('hidden')||document.querySelector('#pageTitle')?.textContent?.trim()!=='Dashboard')return;
    const grid=root.querySelector('.dash-grid');
    if(grid){
      for(const conf of cfg){
        const card=grid.querySelector('.'+conf.cls);
        if(card)enhanceCard(card,conf);
      }
    }
    const stat=root.querySelector('.dash-stats');
    if(stat){
      const destinations=['finance','notes','tasks','journey'];
      Array.from(stat.querySelectorAll('.dash-stat')).forEach((tile,index)=>{
        if(destinations[index])enhanceStat(tile,destinations[index]);
      });
    }
  }
  // Dashboard is rendered from memory, then asynchronously decorated by
  // polish.js. Observe once; do not redraw or rebind existing app handlers.
  new MutationObserver(decorate).observe(root,{childList:true,subtree:true});
  new MutationObserver(decorate).observe(shell,{attributes:true,attributeFilter:['class']});
  window.addEventListener('hashchange',decorate);
  decorate();
})();