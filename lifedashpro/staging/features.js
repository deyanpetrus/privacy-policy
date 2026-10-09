/* LifeDashPro Web Staging v1.4 — productivity filters.
   Uses already-rendered, user-scoped rows. No network, Auth or write operations. */
(function(){
  'use strict';
  var PAGE={
    notes:{title:'Notes Pro',search:'Search notes by title or description…'},
    finance:{title:'Finance',search:'Search transactions, categories or dates…'},
    tasks:{title:'Tasks',search:'Search tasks or assignees…'},
    documents:{title:'Documents',search:'Search documents…'},
    vehicles:{title:'Vehicles',search:'Search vehicles…'},
    journey:{title:'Journey',search:'Search saved journeys…'}
  };
  var prefs={};
  Object.keys(PAGE).forEach(function(k){prefs[k]={search:'',status:'all',type:'all',month:'all',category:'all',sort:'recent'}});
  var content=document.getElementById('content');
  if(!content)return;

  function currentPage(){
    var hash=window.location.hash.slice(1);
    if(PAGE[hash])return hash;
    var heading=document.getElementById('pageTitle');
    var headingText=heading?heading.getAttribute('aria-label')||heading.textContent.trim():'';
    return Object.keys(PAGE).find(function(k){return PAGE[k].title===headingText})||null;
  }
  function text(node){return (node&&node.textContent||'').trim()}
  function el(tag,className,textValue){
    var node=document.createElement(tag);
    if(className)node.className=className;
    if(textValue!==undefined)node.textContent=textValue;
    return node;
  }
  function option(select,value,label){
    var opt=document.createElement('option');
    opt.value=value;opt.textContent=label;
    select.appendChild(opt);
  }
  function labeledSelect(label,values,setting){
    var wrap=el('label','feature-field');
    wrap.appendChild(el('span','feature-label',label));
    var select=el('select','feature-select');
    select.setAttribute('data-feature-setting',setting);
    values.forEach(function(a){option(select,a[0],a[1])});
    wrap.appendChild(select);
    return wrap;
  }
  function dateKey(row){
    var value=row.dataset.uiDate||'';
    var match=/^(\d{4}-\d{2})(?:-\d{2})?/.exec(value);
    return match?match[1]:'';
  }
  function dueDate(row){
    var raw=row.dataset.uiDate||'';
    return /^\d{4}-\d{2}-\d{2}/.test(raw)?raw.slice(0,10):'';
  }
  function build(page,list){
    var all=Array.from(list.querySelectorAll(':scope > .data-row'));
    if(!all.length)return;
    all.forEach(function(row,index){row.dataset.featureOrder=String(index)});
    var settings=prefs[page];
    var panel=el('section','feature-toolbar');
    panel.id='featureToolbar';
    panel.dataset.featurePage=page;
    panel.setAttribute('aria-label',PAGE[page].title+' filters');
    var top=el('div','feature-toolbar-heading');
    var heading=el('div');
    heading.appendChild(el('strong','feature-title',page==='finance'?'Transaction explorer':page==='notes'?'Find your notes':page==='tasks'?'Organize tasks':'Quick search'));
    heading.appendChild(el('span','feature-subtitle','Instant filters · synced records stay unchanged'));
    top.appendChild(heading);
    var clear=el('button','feature-reset','Reset filters');
    clear.type='button';clear.id='featureReset';
    top.appendChild(clear);panel.appendChild(top);
    var row=el('div','feature-controls');
    var searchLabel=el('label','feature-field feature-search-field');
    searchLabel.appendChild(el('span','feature-label','Search'));
    var search=el('input','feature-search');
    search.type='search';search.autocomplete='off';search.spellcheck=false;
    search.placeholder=PAGE[page].search;
    search.setAttribute('aria-label',PAGE[page].search);
    search.setAttribute('data-feature-setting','search');
    searchLabel.appendChild(search);row.appendChild(searchLabel);
    if(page==='notes'){
      row.appendChild(labeledSelect('Status',[['all','All notes'],['active','Active'],['pending_payment','Pending payment'],['completed','Completed'],['archived','Archived']],'status'));
      row.appendChild(labeledSelect('Sort',[['recent','Last updated'],['title','Title A–Z'],['due','Due date']],'sort'));
    }else if(page==='tasks'){
      row.appendChild(labeledSelect('State',[['all','All tasks'],['open','Open'],['done','Completed']],'status'));
      row.appendChild(labeledSelect('Sort',[['recent','Last updated'],['due','Due date'],['title','Title A–Z']],'sort'));
    }else if(page==='finance'){
      row.appendChild(labeledSelect('Type',[['all','All transactions'],['income','Income'],['expense','Expenses']],'type'));
      var months=Array.from(new Set(all.map(dateKey).filter(Boolean))).sort().reverse();
      var monthSelect=labeledSelect('Month',[['all','All months']].concat(months.map(function(month){return [month,month]})),'month');
      row.appendChild(monthSelect);
      var categories=Array.from(new Set(all.map(function(r){return r.dataset.uiCategory||''}).filter(Boolean))).sort(function(a,b){return a.localeCompare(b)});
      if(categories.length)row.appendChild(labeledSelect('Category',[['all','All categories']].concat(categories.map(function(c){return [c,c]})),'category'));
      row.appendChild(labeledSelect('Sort',[['recent','Last updated'],['date-new','Newest date'],['date-old','Oldest date'],['amount-high','Highest amount'],['amount-low','Lowest amount']],'sort'));
    }
    panel.appendChild(row);
    var stats=el('div','feature-filter-footer');
    stats.appendChild(el('span','feature-count',''));
    stats.firstChild.id='featureCount';
    if(page==='finance'){
      var breakdown=el('div','feature-finance-summary');
      breakdown.setAttribute('aria-label','Filtered finance summary');
      [['income','Income'],['expense','Expenses'],['balance','Balance']].forEach(function(a){
        var box=el('div','feature-finance-tile');
        box.appendChild(el('span','',a[1]));
        var strong=el('strong','','—');
        strong.setAttribute('data-feature-total',a[0]);
        box.appendChild(strong);breakdown.appendChild(box);
      });
      panel.appendChild(breakdown);
      panel.appendChild(el('p','feature-help','Totals reflect the visible transactions only. Different currencies are never added together.'));
    }
    panel.appendChild(stats);
    var empty=el('div','empty feature-no-results','No matching records. Change the filters or press Reset filters.');
    empty.id='featureNoResults';empty.hidden=true;

    list.parentElement.insertBefore(panel,list);
    list.insertAdjacentElement('afterend',empty);

    var controls=Array.from(panel.querySelectorAll('[data-feature-setting]'));
    controls.forEach(function(control){
      var setting=control.dataset.featureSetting;
      if(control.tagName==='SELECT'&&!Array.from(control.options).some(function(o){return o.value===settings[setting]}))settings[setting]='all';
      control.value=settings[setting];
      control.addEventListener(control.tagName==='INPUT'?'input':'change',function(){
        settings[setting]=control.value;
        filter(page,list,panel,empty);
      });
    });
    search.addEventListener('keydown',function(e){
      if(e.key==='Escape'&&search.value){e.preventDefault();settings.search='';search.value='';filter(page,list,panel,empty);}
    });
    clear.addEventListener('click',function(){
      Object.keys(settings).forEach(function(k){settings[k]=k==='sort'?'recent':k==='search'?'':'all'});
      controls.forEach(function(control){control.value=settings[control.dataset.featureSetting]});
      filter(page,list,panel,empty);
      search.focus();
    });
    filter(page,list,panel,empty);
  }
  function getRowText(row){
    var main=row.querySelector('.row-main');
    return text(main).toLocaleLowerCase();
  }
  function numberAmount(row){
    var raw=row.dataset.uiAmount;
    if(raw==null||raw==='')return null;
    var amount=Number(raw);
    return Number.isFinite(amount)?amount:null;
  }
  function rowMatches(page,row,settings){
    var query=settings.search.trim().toLocaleLowerCase();
    if(query&&!getRowText(row).includes(query))return false;
    if(page==='notes'){
      var status=(row.dataset.uiStatus||'active').toLowerCase();
      if(settings.status!=='all'&&status!==settings.status)return false;
    }
    if(page==='tasks'){
      var done=row.dataset.uiCompleted==='true';
      if(settings.status==='open'&&done)return false;
      if(settings.status==='done'&&!done)return false;
    }
    if(page==='finance'){
      if(settings.type!=='all'&&row.dataset.uiType!==settings.type)return false;
      if(settings.month!=='all'&&dateKey(row)!==settings.month)return false;
      if(settings.category!=='all'&&row.dataset.uiCategory!==settings.category)return false;
    }
    return true;
  }
  function compare(page,settings,a,b){
    var sort=settings.sort;
    if(sort==='title')return getRowText(a).localeCompare(getRowText(b));
    if(sort==='due'||sort==='date-new'||sort==='date-old'){
      var first=dueDate(a)||'9999-99-99',second=dueDate(b)||'9999-99-99';
      if(sort==='date-new'){
        first=dueDate(a)||'0000-00-00';second=dueDate(b)||'0000-00-00';
        return second.localeCompare(first);
      }
      return first.localeCompare(second);
    }
    if(sort==='amount-high'||sort==='amount-low'){
      var av=numberAmount(a)||0,bv=numberAmount(b)||0;
      return sort==='amount-high'?bv-av:av-bv;
    }
    return Number(a.dataset.featureOrder)-Number(b.dataset.featureOrder);
  }
  function renderMoney(value,currency){
    var c=currency.toUpperCase();
    try{return new Intl.NumberFormat(undefined,{style:'currency',currency:c,maximumFractionDigits:2}).format(value)}
    catch(e){return c+' '+value.toFixed(2)}
  }
  function summarizeFinance(visible,panel){
    var buckets=new Map();
    visible.forEach(function(row){
      var amount=numberAmount(row);
      if(amount===null)return;
      var currency=(row.dataset.uiCurrency||'EUR').toUpperCase();
      var type=row.dataset.uiType;
      if(type!=='income'&&type!=='expense')return;
      var data=buckets.get(currency)||{income:0,expense:0};
      data[type]+=amount;
      buckets.set(currency,data);
    });
    ['income','expense','balance'].forEach(function(key){
      var target=panel.querySelector('[data-feature-total="'+key+'"]');
      if(!target)return;
      if(!buckets.size){target.textContent='—';return}
      var parts=Array.from(buckets).sort(function(a,b){return a[0].localeCompare(b[0])}).map(function(pair){
        var data=pair[1],value=key==='balance'?data.income-data.expense:data[key];
        return renderMoney(value,pair[0]);
      });
      target.textContent=parts.join(' · ');
    });
  }
  function filter(page,list,panel,empty){
    var settings=prefs[page];
    var rows=Array.from(list.querySelectorAll(':scope > .data-row'));
    rows.sort(function(a,b){return compare(page,settings,a,b)});
    // Moving existing DOM nodes preserves the original Notes/Tasks/Finance editor click handlers.
    rows.forEach(function(row){list.appendChild(row)});
    var visible=[];
    rows.forEach(function(row){
      var matches=rowMatches(page,row,settings);
      row.hidden=!matches;
      if(matches)visible.push(row);
    });
    empty.hidden=visible.length!==0;
    var count=panel.querySelector('#featureCount');
    if(count)count.textContent=visible.length+' of '+rows.length+' records shown';
    if(page==='finance')summarizeFinance(visible,panel);
  }
  function enhance(){
    var page=currentPage();
    if(!page)return;
    var list=content.querySelector(':scope > .list');
    if(!list||!list.querySelector(':scope > .data-row'))return;
    if(content.querySelector('#featureToolbar'))return;
    build(page,list);
  }
  // App rerenders #content during refresh, saving, route changes and sign-in.
  // Observe direct children only: sorting list rows does not retrigger this observer.
  new MutationObserver(enhance).observe(content,{childList:true});
  enhance();
})();
