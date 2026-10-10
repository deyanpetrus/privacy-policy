/* LifeDashPro Web v1.20 - derived monthly totals, read-only, no database writes. */
window.LifeDashMonthlyMathV120=Object.freeze((()=>{
 const pad=n=>String(n).padStart(2,'0');
 const localDate=(d=new Date())=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
 function parseDate(value){
   const m=String(value||'').trim().match(/^(\d{4})[- /](\d{1,2})[- /](\d{1,2})(?:$|T|\s)/);
   if(!m)return '';
   const y=+m[1],mo=+m[2],day=+m[3],d=new Date(y,mo-1,day,12);
   return d.getFullYear()===y&&d.getMonth()+1===mo&&d.getDate()===day?y+'-'+pad(mo)+'-'+pad(day):'';
 }
 function normalize(records){
  return (Array.isArray(records)?records:[]).map(r=>{
   const val=r?.amount;
   const amount=val==null||val===''||!Number.isFinite(Number(val))?null:Math.round(Number(val)*100);
   return {id:String(r?.id||''),sourceId:String(r?.sourceId||''),
     sourceModule:String(r?.sourceModule||''),parent:String(r?.recurringSourceId||r?.recurrenceParentId||r?.parentTransactionId||r?.templateId||''),
     date:parseDate(r?.date),periodicity:String(r?.periodicity||'once').toLowerCase(),
     type:String(r?.type||''),currency:String(r?.currency||r?.baseCurrencyAtEntry||'EUR').toUpperCase(),
     amount,paid:r?.isPaid===true,unpaid:r?.isPaid===false};
  }).filter(x=>x.date&&x.amount!==null&&x.amount>=0&&
     /^(income|expense)$/.test(x.type)&&/^[A-Z]{3}$/.test(x.currency));
 }
 const endOfMonth=month=>{
  const [y,m]=month.split('-').map(Number);
  return month+'-'+pad(new Date(y,m,0).getDate());
 };
 function ledger(rows,month,currency){
  const saved=rows.filter(x=>x.currency===currency&&x.date.slice(0,7)===month);
  const generated=[];
  for(const row of rows){
   if(row.currency!==currency||row.periodicity!=='monthly'||row.date.slice(0,7)>=month)continue;
   const already=saved.some(x=>
    (row.id&&x.parent===row.id)||
    (row.sourceId&&row.sourceId===x.sourceId&&row.sourceModule===x.sourceModule&&row.id!==x.id));
   if(already)continue;
   const due=month+'-'+pad(Math.min(+row.date.slice(8,10),+endOfMonth(month).slice(8,10)));
   generated.push({...row,date:due,derived:true});
  }
  return saved.concat(generated);
 }
 function totals(rows,limit){
  const r={income:0,expense:0,unpaid:0,repeats:0,count:0};
  for(const x of rows){
   if(x.date>limit)continue;
   if(x.unpaid){if(x.type==='expense')r.unpaid+=x.amount;continue}
   if(!x.paid)continue;
   r[x.type]+=x.amount;r.count++;
   if(x.derived&&x.periodicity==='monthly')r.repeats++;
  }
  r.balance=r.income-r.expense;return r;
 }
 function calculate(records,asOf=localDate(),currency='EUR'){
  const rows=normalize(records),month=asOf.slice(0,7);
  const current=ledger(rows,month,currency);
  const ytd=[];
  for(let m=1;m<=+month.slice(5,7);m++)
   ytd.push(...ledger(rows,month.slice(0,4)+'-'+pad(m),currency));
  return {month,posted:totals(current,asOf),
    forecast:totals(current,endOfMonth(month)),
    year:totals(ytd,asOf),
    currencies:[...new Set(rows.map(x=>x.currency))].sort(),
    sources:rows.filter(x=>x.periodicity==='monthly'&&x.currency===currency).length};
 }
 return {calculate,parseDate,normalize,ledger,localDate};
})());