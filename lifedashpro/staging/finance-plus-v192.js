/* LifeDashPro Web v1.9.2 — Finance Plus (staging only).
   Read-only analytic overlay on original Finance explorer and editor.
   Always separate posted records from informational monthly recurring templates.
   Never generate/update/delete transactions or convert currencies implicitly. */
(()=>{
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const node=(tag,cls,value)=>{
    const el=document.createElement(tag);
    if(cls)el.className=cls;
    if(value!==undefined)el.textContent=String(value);
    return el;
  };
  const content=$('#content'),app=$('#appView'),bridge=()=>window.LifeDashFinanceBridge;
  if(!content||!app)return;
  const MONTH_PREF='lifedash_web_finance_month_v192';
  let owner='',selectedMonth='',currency='',categoryMode='expense',tab='overview',tx=[],goals=[];
  const todayMonth=()=>monthFromDate(new Date());
  function monthFromDate(d){return String(d.getFullYear())+'-'+String(d.getMonth()+1).padStart(2,'0')}
  function parseDate(raw){
    const match=String(raw||'').trim().match(/^(\d{4})[- ](\d{1,2})[- ](\d{1,2})(?:[T\s].*)?$/);
    if(!match)return '';
    const y=+match[1],m=+match[2],d=+match[3];
    const dt=new Date(y,m-1,d,12);
    if(dt.getFullYear()!==y||dt.getMonth()+1!==m||dt.getDate()!==d)return '';
    return y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  }
  function plusMonths(month,diff){
    const m=String(month||'').match(/^(\d{4})-(\d{2})$/);
    if(!m)return todayMonth();
    return monthFromDate(new Date(+m[1],+m[2]-1+diff,1,12));
  }
  function monthTitle(month){
    const m=String(month).match(/^(\d{4})-(\d{2})$/);
    if(!m)return 'Select month';
    return new Intl.DateTimeFormat(undefined,{month:'long',year:'numeric'}).format(new Date(+m[1],+m[2]-1,1,12));
  }
  function money(value,c='EUR'){
    const amount=Number(value)||0;
    try{return new Intl.NumberFormat(undefined,{style:'currency',currency:c,maximumFractionDigits:2}).format(amount)}
    catch(_){return amount.toFixed(2)+' '+c}
  }
  const validAmount=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const normCurrency=v=>/^[A-Z]{3}$/.test(String(v||'EUR').toUpperCase())?String(v||'EUR').toUpperCase():'EUR';
  const normType=v=>v==='income'?'income':v==='expense'?'expense':null;
  const normCategory=v=>String(v||'Other').trim().slice(0,95)||'Other';
  const safe=(v,max=165)=>String(v??'').trim().slice(0,max);
  const startOfMonth=month=>month+'-01';
  const current=()=>!app.classList.contains('hidden')&&bridge()?.ready()?bridge():null;
  function normalize(){
    return tx.map((x,i)=>({
      id:String(x.id||''),date:parseDate(x.date),type:normType(x.type),
      amount:validAmount(x.amount)?Number(x.amount):null,
      currency:normCurrency(x.currency||x.baseCurrencyAtEntry),
      category:normCategory(x.category),
      description:safe(x.description||'Transaction'),
      recurring:String(x.periodicity||'once').toLowerCase()!=='once'&&Boolean(x.periodicity),
      periodicity:safe(x.periodicity||'once',25).toLowerCase(),
      paid:x.isPaid===true,source:safe(x.sourceModule||'',35),sourceId:safe(x.sourceId||'',90),
      original:x,ordinal:i
    }));
  }
  function validRows(){return normalize().filter(x=>x.date&&x.type&&x.amount!==null)}
  function allCurrencies(){
    const vals=new Set([...tx.map(x=>normCurrency(x.currency||x.baseCurrencyAtEntry)),
      ...goals.map(g=>normCurrency(g.currency))]);
    return [...vals].sort();
  }
  function savePref(){
    try{localStorage.setItem(MONTH_PREF,selectedMonth)}catch(_){}
  }
  function rowsForMonth(month=selectedMonth,c=currency){
    return validRows().filter(t=>t.date.slice(0,7)===month&&t.currency===c);
  }
  function aggregate(rows){
    const result={income:0,expense:0,paid:0,unpaid:0,count:0,incomeCount:0,expenseCount:0};
    for(const x of rows){
      if(x.type!=='income'&&x.type!=='expense')continue;
      result[x.type]+=x.amount;result[x.type+'Count']++;
      if(x.paid)result.paid+=x.amount;
      else result.unpaid+=x.amount;
      result.count++;
    }
    result.balance=result.income-result.expense;
    return result;
  }
  function shiftMonth(delta){selectedMonth=plusMonths(selectedMonth,delta);savePref();draw();}
  function button(label,cls,click){
    const b=node('button',cls,label);b.type='button';b.addEventListener('click',click);return b;
  }
  function sectionTitle(label,subtitle){
    const h=node('div','finance-plus-section-heading');
    h.append(node('h3','',label),node('p','finance-plus-muted',subtitle));
    return h;
  }
  function barRow(label,income,expense,maximum){
    const item=node('div','finance-plus-trend-row');
    const head=node('div','finance-plus-trend-labels');
    head.append(node('strong','',label),node('small','',money(income,currency)+' / '+money(expense,currency)));
    const bars=node('div','finance-plus-trend-track');
    const inc=node('span','finance-plus-bar finance-plus-income');
    const exp=node('span','finance-plus-bar finance-plus-expense');
    inc.style.width=(maximum>0?Math.max(0,Math.min(100,income/maximum*100)):0)+'%';
    exp.style.width=(maximum>0?Math.max(0,Math.min(100,expense/maximum*100)):0)+'%';
    inc.title='Income '+money(income,currency);exp.title='Expenses '+money(expense,currency);
    bars.append(inc,exp);item.append(head,bars);return item;
  }
  function renderKpis(root,stats){
    const grid=node('div','finance-plus-kpi-grid');
    for(const [key,label]of [['income','Income recorded'],['expense','Expenses recorded'],['balance','Net recorded'],['count','Transactions']]){
      const tile=node('div','finance-plus-kpi');
      tile.append(node('strong','',key==='count'?String(stats.count):money(stats[key],currency)),
        node('span','',label));grid.append(tile);
    }
    root.append(grid);
  }
  function renderTrend(root){
    const chart=node('section','finance-plus-panel');
    chart.append(sectionTitle('Last 6 months','Actual synced transaction amounts only · '+currency));
    const months=Array.from({length:6},(_,i)=>plusMonths(selectedMonth,i-5));
    const data=months.map(m=>({month:m,...aggregate(rowsForMonth(m))}));
    const maximum=Math.max(0,...data.flatMap(x=>[x.income,x.expense]));
    const legend=node('div','finance-plus-legend');
    legend.append(node('span','finance-plus-legend-income','Income'),node('span','finance-plus-legend-expense','Expenses'));
    chart.append(legend);
    for(const x of data){
      chart.append(barRow(monthTitle(x.month),x.income,x.expense,maximum));
    }
    root.append(chart);
  }
  function renderCategories(root){
    const chart=node('section','finance-plus-panel');
    const heading=sectionTitle('By category','Share of actually recorded '+(categoryMode==='income'?'income':'expenses')+' this month');
    const choose=node('div','finance-plus-type-tabs');
    for(const [key,label]of [['expense','Expenses'],['income','Income']]){
      const btn=button(label,'finance-plus-tab'+(categoryMode===key?' active':''),()=>{categoryMode=key;draw()});
      btn.setAttribute('aria-pressed',String(categoryMode===key));choose.append(btn);
    }
    chart.append(heading,choose);
    const buckets=new Map();
    for(const t of rowsForMonth().filter(x=>x.type===categoryMode))
      buckets.set(t.category,(buckets.get(t.category)||0)+t.amount);
    const entries=[...buckets.entries()].sort((a,b)=>b[1]-a[1]);
    const total=entries.reduce((n,entry)=>n+entry[1],0);
    if(!entries.length)chart.append(node('p','finance-plus-empty','No '+categoryMode+' records for the selected month.'));
    else for(const [label,value]of entries.slice(0,14)){
      const item=node('div','finance-plus-category-item');
      const line=node('div','finance-plus-category-head');
      const percentage=total?Math.round(value/total*100):0;
      line.append(node('strong','',label),node('span','',money(value,currency)+' · '+percentage+'%'));
      const track=node('div','finance-plus-category-track');
      const fill=node('span','finance-plus-category-fill');
      fill.style.width=(total?Math.min(100,Math.max(0,value/total*100)):0)+'%';
      track.append(fill);item.append(line,track);chart.append(item);
    }
    root.append(chart);
  }
  function daysInMonth(month){
    const [y,m]=month.split('-').map(Number);
    return new Date(y,m,0).getDate();
  }
  function monthOccurrence(row,month){
    if(!row.date||!row.recurring||row.periodicity!=='monthly'||month<row.date.slice(0,7))return null;
    const anchor=Number(row.date.slice(8,10));
    return month+'-'+String(Math.min(anchor,daysInMonth(month))).padStart(2,'0');
  }
  function renderRecurrence(root){
    const section=node('section','finance-plus-panel finance-plus-wide');
    section.append(sectionTitle('Recurring income & expenses',
      'Informational schedule from existing Android monthly records — not automatically posted on Web.'));
    const templates=validRows().filter(x=>x.currency===currency&&x.recurring);
    const monthly=templates.filter(x=>x.periodicity==='monthly').sort((a,b)=>a.description.localeCompare(b.description));
    const other=templates.filter(x=>x.periodicity!=='monthly');
    const head=node('div','finance-plus-schedule-head');
    head.append(node('strong','',monthly.length+' monthly source records'),
      node('span','','Original entries remain untouched'));
    section.append(head);
    const note=node('p','finance-plus-recurring-note',
      'Due dates are indicative based on each saved monthly record. Multiple source records may represent the same series; Web does not merge, create, pay or duplicate transactions. Only actual saved records contribute to monthly totals.');
    section.append(note);
    const list=node('div','finance-plus-recurring-list');
    const currentSaved=rowsForMonth();
    let displayed=0;
    for(const item of monthly){
      const due=monthOccurrence(item,selectedMonth);
      if(!due)continue;
      displayed++;
      const originalThisMonth=item.date.slice(0,7)===selectedMonth;
      const row=node('div','finance-plus-recurring-item');
      const icon=node('span','finance-plus-recurring-icon',item.type==='income'?'＋':'−');
      const description=node('div','finance-plus-recurring-info');
      description.append(node('strong','',item.description),
        node('small','',item.category+' · '+due+' · '+(originalThisMonth?'Saved original record':'Schedule only')));
      const amount=node('strong','finance-plus-amount',money(item.amount,currency));
      row.append(icon,description,amount);
      list.append(row);
    }
    if(!displayed)list.append(node('p','finance-plus-empty','No monthly recurring source records active for this month and currency.'));
    if(other.length){
      const note=node('p','finance-plus-muted',
        other.length+' other recurring source record(s) use a schedule not projected by this monthly view.');
      list.append(note);
    }
    section.append(list);root.append(section);
  }
  function renderGoals(root){
    const section=node('section','finance-plus-panel finance-plus-wide');
    section.append(sectionTitle('Savings goals','Synced from existing Android Finance Goals · progress is independent of transaction totals'));
    const chosen=goals.filter(g=>normCurrency(g.currency)===currency);
    if(!chosen.length)section.append(node('p','finance-plus-empty','No savings goals for '+currency+'.'));
    for(const goal of chosen){
      const name=safe(goal.title||'Savings goal',120),target=Number(goal.targetAmount)||0,
        currentAmount=Number(goal.currentAmount)||0;
      const percent=target>0?Math.max(0,Math.min(100,currentAmount/target*100)):0;
      const card=node('div','finance-plus-goal');
      const heading=node('div','finance-plus-goal-head');
      heading.append(node('strong','',name),node('span','',money(currentAmount,currency)+' / '+money(target,currency)));
      card.append(heading);
      const track=node('div','finance-plus-goal-track');
      const fill=node('span','finance-plus-goal-fill');fill.style.width=percent.toFixed(1)+'%';
      track.append(fill);card.append(track);
      const date=parseDate(goal.deadline);
      if(date)card.append(node('small','finance-plus-muted','Target date: '+date));
      section.append(card);
    }
    root.append(section);
  }
  function reportCsv(){
    const rows=rowsForMonth();
    const csvValue=v=>'"'+String(v??'').replace(/"/g,'""').replace(/^[=+\-@\t\r]/,'\'$&')+'"';
    const lines=[['Date','Type','Description','Category','Amount','Currency','Paid','Periodicity','Source']];
    for(const t of rows)lines.push([
      t.date,t.type,t.description,t.category,t.amount.toFixed(2),t.currency,
      t.paid?'Yes':'No',t.periodicity,t.source||'manual'
    ]);
    const csv='\uFEFF'+lines.map(values=>values.map(csvValue).join(',')).join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=node('a');a.href=url;a.download='lifedash-finance-'+selectedMonth+'-'+currency+'.csv';
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  function draw(){
    const root=$('#financePlus');
    if(!root)return;
    root.replaceChildren();
    const title=node('div','finance-plus-titlebar');
    const labels=node('div');
    labels.append(node('p','eyebrow','FINANCE PLUS · MONTHLY REPORT'),
      node('h3','','Finance insights'),
      node('p','finance-plus-muted','Real transactions are separated from indicative recurring schedules. No currencies are mixed.'));
    const actions=node('div','finance-plus-actions');
    const prev=button('‹','secondary finance-plus-arrow',()=>shiftMonth(-1));
    prev.setAttribute('aria-label','Previous month');
    const next=button('›','secondary finance-plus-arrow',()=>shiftMonth(1));
    next.setAttribute('aria-label','Next month');
    actions.append(button('This month','secondary',()=>{selectedMonth=todayMonth();savePref();draw()}),
      prev,node('strong','finance-plus-month',monthTitle(selectedMonth)),next);
    const currencies=allCurrencies();
    if(!currency||!currencies.includes(currency))currency=currencies.includes('EUR')?'EUR':currencies[0]||'EUR';
    if(currencies.length>1){
      const select=node('select','finance-plus-currency');
      select.setAttribute('aria-label','Report currency');
      for(const c of currencies){const o=node('option','',c);o.value=c;select.append(o)}
      select.value=currency;
      select.addEventListener('change',()=>{currency=select.value;draw()});
      actions.append(select);
    }
    actions.append(button('Export CSV','secondary finance-plus-export',reportCsv));
    title.append(labels,actions);root.append(title);
    const records=rowsForMonth();
    const kpis=aggregate(records);
    renderKpis(root,kpis);
    const subtitle=node('div','finance-plus-countline');
    const undated=normalize().filter(x=>!x.date||x.amount===null||!x.type).length;
    subtitle.append(node('span','',records.length+' saved transaction'+(records.length===1?'':'s')+
      ' in '+monthTitle(selectedMonth)+' · '+currency));
    if(undated)subtitle.append(node('span','finance-plus-warning',undated+' record(s) with invalid or missing date/amount/type not included'));
    root.append(subtitle);
    const grid=node('div','finance-plus-analytics-grid');
    renderTrend(grid);renderCategories(grid);root.append(grid);
    renderRecurrence(root);
    renderGoals(root);
    const footer=node('p','finance-plus-disclaimer',
      'Recorded means saved in your LifeDashPro transaction history, not necessarily paid. Existing Paid/Unpaid controls and Android-managed protection remain in the original Finance list below. No future installments are added to income, expenses or balance.');
    root.append(footer);
  }
  function mount(){
    const list=content.querySelector(':scope > .list');
    const empty=content.querySelector(':scope > .empty');
    const anchor=list||empty;
    if(!anchor||$('#financePlus',content))return;
    const panel=node('section','finance-plus-shell');panel.id='financePlus';
    panel.setAttribute('aria-label','Finance Plus monthly analytics');
    content.insertBefore(panel,anchor);
    draw();
  }
  function sync(){
    const b=current();
    if(!b){if(owner){owner='';tx=[];goals=[];}return}
    const id=b.identity();
    if(owner!==id){
      owner=id;
      let m='';try{m=localStorage.getItem(MONTH_PREF)||''}catch(_){}
      selectedMonth=/^\d{4}-(0[1-9]|1[0-2])$/.test(m)?m:todayMonth();
      currency='';categoryMode='expense';
    }
    const snapshot=b.snapshot();
    if(!snapshot)return;
    tx=Array.isArray(snapshot.transactions)?snapshot.transactions:[];
    goals=Array.isArray(snapshot.goals)?snapshot.goals:[];
    if((location.hash||'#dashboard')==='#finance')mount();
  }
  new MutationObserver(sync).observe(content,{childList:true});
  new MutationObserver(sync).observe(app,{attributes:true,attributeFilter:['class']});
  sync();
})();
