/* LifeDashPro Web v1.20 — Android dashboard layout + recurring finance display.
 * The existing widgets stay untouched under a user-controlled Details toggle.
 */
(()=>{
'use strict';
const root=document.querySelector('#content'),app=document.querySelector('#appView');
if(!root||!app)return;
const bridge=()=>window.LifeDashDashboardBridge;
const math=()=>window.LifeDashMonthlyMathV120;
const make=(tag,cls,label)=>{
 const node=document.createElement(tag);if(cls)node.className=cls;
 if(label!==undefined)node.textContent=String(label);return node;
};
const pref='lifedash_web_dashboard_details_v120';
let uid='',currency='';
const tr=(mk,en)=>/^mk(?:-|$)/i.test(bridge()?.profile()?.language||'')?mk:en;
const eur=(amount,cc)=>{
 try{return new Intl.NumberFormat(undefined,{style:'currency',currency:cc}).format(amount/100)}
 catch{return (amount/100).toFixed(2)+' '+cc}
};
const navigate=page=>{
 const link=document.querySelector('#nav [data-page="'+page+'"]')||
  document.querySelector('.mobile-nav [data-page="'+page+'"]');
 link?.click();
};
function financeCard(host,detail=false){
 if(!host||!bridge()?.ready()||!math())return;
 const who=bridge().identity();
 if(!who||host.dataset.finOwner===who)return;
 const rows=bridge().snapshot()?.finance_transactions;
 if(!Array.isArray(rows))return;
 const currencies=[...new Set(math().normalize(rows).map(x=>x.currency))].sort();
 if(!currencies.length)currencies.push('EUR');
 if(!currencies.includes(currency))currency=currencies.includes('EUR')?'EUR':currencies[0];
 function draw(){
  if(!host.isConnected)return;
  const d=math().calculate(rows,math().localDate(),currency);
  host.replaceChildren();
  const section=make('section','ldp120-budget-panel');
  const heading=make('header','ldp120-budget-header');
  const icon=make('span','ldp120-budget-icon','€');
  const text=make('div');
  text.append(make('h3','',tr('Месечен буџет · денес','Monthly budget · today')),
    make('small','',new Intl.DateTimeFormat(undefined,{month:'long',year:'numeric'}).format(new Date())));
  heading.append(icon,text);
  if(!detail){
   const btn=make('button','ldp120-open-finance',tr('Отвори →','Open →'));
   btn.type='button';btn.addEventListener('click',()=>navigate('finance'));heading.append(btn);
  }
  section.append(heading);
  if(currencies.length>1){
   const select=make('select','ldp120-currencies');
   select.setAttribute('aria-label','Finance currency');
   for(const value of currencies){const opt=make('option','',value);opt.value=value;select.append(opt)}
   select.value=currency;select.addEventListener('change',()=>{currency=select.value;draw()});
   section.append(select);
  }
  const board=make('div','ldp120-green');
  const cells=make('div','ldp120-budget-values');
  for(const [key,label] of [
   ['balance',tr('Салдо','Balance')],['income',tr('Приход','Income')],['expense',tr('Расход','Expenses')]
  ]){
   const cell=make('div','ldp120-budget-cell ldp120-budget-'+key);
   cell.append(make('span','',label),make('strong','',eur(d.posted[key],currency)));
   cells.append(cell);
  }
  board.append(cells);
  const forecast=make('div','ldp120-budget-forecast');
  forecast.append(make('span','',tr('Планирано за целиот месец','Projected for full month')),
   make('strong','','+'+eur(d.forecast.income,currency)+' / −'+eur(d.forecast.expense,currency)));
  board.append(forecast);section.append(board);
  if(detail){
   const annual=make('section','ldp120-year');
   annual.append(make('h4','',tr('Од почетокот на годината до денес','Year to date · estimate')));
   const stats=make('div','ldp120-year-stats');
   for(const [key,label] of [
    ['income',tr('Приход','Income')],['expense',tr('Расход','Expenses')],['balance',tr('Салдо','Balance')]
   ]){
    const stat=make('div');stat.append(make('span','',label),make('b','',eur(d.year[key],currency)));
    stats.append(stat);
   }
   annual.append(stats);section.append(annual);
  }
  const note=make('p','ldp120-budget-note',
   tr('Месечните повторувања се пресметуваат до денешниот датум, без запишување нови трансакции. Реалните износи на Android може да се разликуваат ако има несинхронизирани записи.',
      'Monthly repeats are included when due, without creating transactions. Android values may differ when local changes are not yet synced.'));
  if(d.posted.unpaid)note.append(make('span','',
    ' · '+tr('Неплатени до денес: ','Unpaid due: ')+eur(d.posted.unpaid,currency)));
  section.append(note);
  host.append(section);host.dataset.finOwner=who;
 }
 draw();
}
function savedExpanded(){
 try{return localStorage.getItem(pref)==='yes'}catch{return false}
}
function expand(btn,value){
 root.classList.toggle('ldp120-dashboard-compact',!value);
 btn.setAttribute('aria-expanded',String(value));
 btn.textContent=value?
  tr('▲ Сокриј го деталниот Web преглед','▲ Hide detailed Web overview'):
  tr('▼ Прикажи дополнителни детали','▼ Show additional details');
}
function dashboard(host){
 if(!host||!bridge()?.ready())return;
 const owner=bridge().identity();
 if(host.dataset.readyFor!==owner)return;
 let finance=host.querySelector('#financeMonthDashV120');
 if(!finance){
  finance=make('div','ldp120-dashboard-budget');finance.id='financeMonthDashV120';
  const news=host.querySelector('.ldp119-news');
  if(news)news.insertAdjacentElement('afterend',finance);
  else host.append(finance);
 }
 financeCard(finance);
 let toggle=host.querySelector('#dashboardDetailToggleV120');
 if(!toggle){
  toggle=make('button','ldp120-detail-toggle');
  toggle.type='button';toggle.id='dashboardDetailToggleV120';
  toggle.addEventListener('click',()=>{
   const next=toggle.getAttribute('aria-expanded')!=='true';
   expand(toggle,next);
   try{localStorage.setItem(pref,next?'yes':'no')}catch(_){}
  });
  host.append(toggle);
 }
 expand(toggle,savedExpanded());
}
function refresh(){
 if(app.classList.contains('hidden')||!bridge()?.ready()){
  if(uid){uid='';currency='';root.classList.remove('ldp120-dashboard-compact')}
  return;
 }
 const next=bridge().identity();
 if(uid!==next){uid=next;currency=''}
 const dashboardHost=root.querySelector('#androidDashboardParityV119');
 if(dashboardHost?.dataset.readyFor===next)dashboard(dashboardHost);
 else if(!dashboardHost)root.classList.remove('ldp120-dashboard-compact');
 const financeHost=root.querySelector('#financeMonthCardV120');
 if(financeHost)financeCard(financeHost,true);
}
new MutationObserver(refresh).observe(root,{childList:true});
new MutationObserver(refresh).observe(app,{attributes:true,attributeFilter:['class']});
refresh();
})();