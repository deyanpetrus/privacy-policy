/* LifeDashPro Web v1.16 — on-demand News & RSS.
 * Standalone view, authenticated read-only edge provider, no background polling,
 * no permission prompt and no changes to Dashboard/Radio/navigation.
 */
(()=>{
'use strict';
const root=document.querySelector('#content');
const shell=document.querySelector('#appView');
if(!root||!shell)return;
const bridge=()=>window.LifeDashNewsBridge;
const CATEGORIES=[
 ['top','Top stories','✦'],['world','World','◎'],
 ['business','Business','↗'],['technology','Technology','⌘'],
 ['sports','Sports','⚑'],['science','Science','✧'],['health','Health','♡']
];
const ISO_CODES=("AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ "+
"CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET "+
"FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU "+
"ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS "+
"LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF "+
"NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC "+
"SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV "+
"TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW").trim().split(/\s+/);
const COUNTRY_SET=new Set(ISO_CODES);
const KEY_PREFIX='lifedash_web_news_country_v116_';
const cache=new Map();
const TTL_MS=8*60*1000;
let currentHost=null,requestCounter=0,currentUser='';
let activeNewsRequest=null;
function el(tag,cls,text){
 const element=document.createElement(tag);if(cls)element.className=cls;
 if(text!==undefined)element.textContent=text;return element;
}
const qs=(id,scope)=>scope.querySelector('#'+id);
function fmtDate(d){
 const date=new Date(d||'');
 if(!Number.isFinite(date.getTime()))return 'Recent';
 try{return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(date)}
 catch{return date.toLocaleString()}
}
function countryName(code){
 if(code==='BALKANS')return 'Balkans';
 if(code==='GLOBAL')return 'World headlines';
 try{return new Intl.DisplayNames([navigator.language||'en'],{type:'region'}).of(code)||code}
 catch{return code}
}
function normalizeCountry(raw){
 const a=String(raw||'').trim();
 const code=a.toUpperCase();
 if(COUNTRY_SET.has(code))return code;
 const aliases={
  GERMANY:'DE',DEUTSCHLAND:'DE',МАКЕДОНИЈА:'MK',MACEDONIA:'MK','NORTH MACEDONIA':'MK',
  SERBIA:'RS',SRBIJA:'RS',СРБИЈА:'RS',BULGARIA:'BG',CROATIA:'HR',HRVATSKA:'HR',
  SLOVENIA:'SI',AUSTRIA:'AT',SWITZERLAND:'CH',ALBANIA:'AL',BOSNIA:'BA',
  'BOSNIA AND HERZEGOVINA':'BA',MONTENEGRO:'ME',GREECE:'GR',
  'UNITED KINGDOM':'GB','UNITED STATES':'US'
 };
 if(aliases[code])return aliases[code];
 try{
  const native=new Intl.DisplayNames(['en'],{type:'region'});
  const found=ISO_CODES.find(c=>native.of(c)?.toUpperCase()===code);
  if(found)return found;
 }catch(_){}
 const locale=(navigator.language||'').split('-')[1]?.toUpperCase();
 return COUNTRY_SET.has(locale)?locale:'DE';
}
function savedCountry(identity){
 try{
  const prev=localStorage.getItem(KEY_PREFIX+identity);
  if(prev&&(COUNTRY_SET.has(prev)||prev==='BALKANS'||prev==='GLOBAL'))return prev;
 }catch(_){}
 return normalizeCountry(bridge()?.profileCountry());
}
function putCountry(identity,country){
 try{localStorage.setItem(KEY_PREFIX+identity,country)}catch(_){}
}
function valid(){
 return !shell.classList.contains('hidden')&&Boolean(bridge()?.ready());
}
function isCurrent(host,owner){
 return host.isConnected&&host===currentHost&&valid()&&bridge()?.identity()===owner;
}
function regionDropdown(select,country){
 const top=el('optgroup');top.label='Featured';
 for(const c of ['DE','MK','RS','AT','CH','BG','HR','BA','ME','AL','SI','GR','RO','TR','GB','US']){
  const option=el('option','',countryName(c));option.value=c;top.append(option);
 }
 select.append(top);
 const special=el('optgroup');special.label='Regions';
 for(const [code,name] of [['BALKANS','Balkans (combined)'],['GLOBAL','World (all countries)']]){
  const item=el('option','',name);item.value=code;special.append(item);
 }
 select.append(special);
 const all=el('optgroup');all.label='All countries (ISO 3166-1)';
 const featured=new Set([...top.children].map(o=>o.value));
 const items=ISO_CODES.filter(code=>!featured.has(code))
   .map(code=>({code,name:countryName(code)}))
   .sort((a,b)=>a.name.localeCompare(b.name));
 for(const item of items){const option=el('option','',item.name);option.value=item.code;all.append(option)}
 select.append(all);
 select.value=country;
 if(!select.value)select.value='DE';
}
function intro(host,owner){
 host.replaceChildren();
 const bar=el('section','news-filterbar');
 const label=el('label','news-country-label','Country / Region');
 const dropdown=el('select','news-country-select');dropdown.id='newsCountryV116';
 dropdown.setAttribute('aria-label','News country or region');
 regionDropdown(dropdown,savedCountry(owner));label.append(dropdown);
 const refresh=el('button','news-refresh','↻ Refresh');refresh.type='button';
 refresh.id='newsRefreshV116';
 const mini=el('span','news-compact-label','◉ RSS · Headlines');
 bar.append(mini,label,refresh);host.append(bar);
 const categories=el('nav','news-category-tabs');
 categories.setAttribute('aria-label','News categories');
 categories.id='newsCategoriesV116';host.append(categories);
 const info=el('div','news-info-line');
 const notice=el('span','news-status','Choose a country and category.');notice.id='newsStatusV116';
 notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
 const count=el('span','news-count','');count.id='newsCountV116';
 info.append(notice,count);host.append(info);
 const list=el('section','news-article-grid');list.id='newsArticlesV116';host.append(list);
 const footer=el('p','news-footnote','Headlines from regional and international RSS publishers. Article rights belong to their sources; read full stories at the original publisher.');
 host.append(footer);
 return {dropdown,refresh,categories,notice,count,list};
}
function showDialog(host,item){
 const d=document.createElement('dialog');d.className='news-reader-dialog';
 const outer=el('div','news-reader-content');
 const heading=el('div','news-reader-head');
 heading.append(el('span','news-reader-label','NEWS READER'));
 const close=el('button','news-reader-close','×');close.type='button';
 close.setAttribute('aria-label','Close news reader');
 heading.append(close);outer.append(heading);
 outer.append(el('h2','',item.title));
 const meta=el('p','news-reader-meta',(item.source||'News publisher')+' · '+fmtDate(item.publishedAt));
 outer.append(meta);
 const desc=el('p','news-reader-summary',
  item.summary||'This RSS source includes a headline and publisher details but does not supply a full article summary.');
 outer.append(desc);
 const note=el('p','news-reader-note','The original article is hosted by the publisher and may have a different language or require consent.');
 outer.append(note);
 const actions=el('div','news-reader-actions');
 const original=el('a','news-original-link','Read original article ↗');
 try{
  const url=new URL(String(item.url||''));if(url.protocol!=='https:')throw Error('invalid');
  original.href=url.toString();original.target='_blank';original.rel='noopener noreferrer';
  actions.append(original);
 }catch(_){}
 const dismiss=el('button','news-close-action','Close');dismiss.type='button';actions.append(dismiss);
 outer.append(actions);d.append(outer);
 document.body.append(d);
 const cleanup=()=>{d.remove()};
 close.onclick=()=>d.close();dismiss.onclick=()=>d.close();
 d.addEventListener('close',cleanup,{once:true});
 d.showModal();
}
function renderArticles(ui,data){
 const list=ui.list;list.replaceChildren();
 const items=Array.isArray(data.items)?data.items:[];
 const country=countryName(data.country||ui.dropdown.value);
 ui.count.textContent=String(items.length)+' article'+(items.length===1?'':'s');
 const mode=data.country==='GLOBAL'?'World feed':data.fallbackUsed?'Worldwide fallback':'Regional feed';
 ui.notice.textContent=country+' · '+mode+' · Updated '+fmtDate(data.updatedAt)+(data.cached?' · Cached':'');
 if(!items.length){list.append(el('div','news-empty','No headlines found for this selection. Try another category or country.'));return}
 for(const item of items){
  const card=el('article','news-story');
  const topline=el('div','news-story-topline');
  topline.append(el('span','news-story-source',item.source||'News source'));
  topline.append(el('span','news-story-date',fmtDate(item.publishedAt)));
  card.append(topline);
  const title=el('h3','',String(item.title||''));card.append(title);
  const summary=el('p','news-story-description',item.summary||'Open the in-app reader for publisher information.');
  card.append(summary);
  const open=el('button','news-read-btn','Read story  ↗');
  open.type='button';open.addEventListener('click',()=>showDialog(list,item));
  card.append(open);
  list.append(card);
 }
}
function placeholders(list){
 list.replaceChildren();
 for(let i=0;i<6;i++){
  const skeleton=el('div','news-story news-placeholder');
  skeleton.append(el('span','news-shimmer news-skel-meta'),el('span','news-shimmer news-skel-title'),el('span','news-shimmer news-skel-line'));
  list.append(skeleton);
 }
}
async function load(host,ui,owner,country,category,force=false){
 const ticket=++requestCounter;
 // Switching a country/category cancels the previous request immediately.
 // Never disable country selection or tabs during a slow publisher response.
 if(activeNewsRequest)activeNewsRequest.abort();
 const controller=new AbortController();
 activeNewsRequest=controller;
 const deadline=setTimeout(()=>controller.abort(),13200);
 for(const btn of ui.categories.querySelectorAll('button'))
   btn.setAttribute('aria-pressed',String(btn.dataset.category===category));
 const key=owner+'|'+country+'|'+category;
 const cached=cache.get(key);
 try{
  if(!force&&cached&&Date.now()-cached.at<TTL_MS){
   renderArticles(ui,cached.data);return;
  }
  ui.notice.textContent='Checking '+countryName(country)+' headlines…';
  ui.count.textContent='';
  placeholders(ui.list);
  const data=await bridge().news(country,category,controller.signal);
  if(!isCurrent(host,owner)||ticket!==requestCounter)return;
  if(data.country!==country||data.category!==category)
    throw new Error('News server returned an unexpected country/category.');
  cache.set(key,{at:Date.now(),data});
  if(cache.size>70)cache.delete(cache.keys().next().value);
  renderArticles(ui,data);
 }catch(e){
  if(!isCurrent(host,owner)||ticket!==requestCounter)return;
  ui.list.replaceChildren();
  if(cached?.data?.items?.length){
   renderArticles(ui,cached.data);
   ui.notice.textContent='Publisher temporarily unavailable · Showing last headlines';
  }else{
   const timedOut=controller.signal.aborted;
   ui.notice.textContent=timedOut?'RSS timed out · Choose another region or retry':
    'News source temporarily unavailable · Choose another region or retry';
   const errorText=timedOut?'Request stopped after 13 seconds. Country and category selection remain available.':
     String(e?.message||'RSS feed request failed.');
   ui.list.append(el('div','news-error',errorText));
  }
 }finally{
  clearTimeout(deadline);
  if(activeNewsRequest===controller)activeNewsRequest=null;
 }
}
function mount(host){
 if(!valid()||host.dataset.newsReady==='1')return;
 const owner=bridge().identity();if(!owner)return;
 if(owner!==currentUser){cache.clear();currentUser=owner}
 currentHost=host;host.dataset.newsReady='1';
 const ui=intro(host,owner);
 let category='top';
 const drawTabs=()=>{
  ui.categories.replaceChildren();
  for(const [id,name,icon] of CATEGORIES){
   const button=el('button','news-category',icon+' '+name);
   button.type='button';button.dataset.category=id;
   button.setAttribute('aria-pressed',String(id===category));
   button.addEventListener('click',()=>{
    if(category===id)return;
    category=id;void load(host,ui,owner,ui.dropdown.value,category);
   });
   ui.categories.append(button);
  }
 };
 drawTabs();
 ui.dropdown.addEventListener('change',()=>{
  putCountry(owner,ui.dropdown.value);
  void load(host,ui,owner,ui.dropdown.value,category);
 });
 ui.refresh.addEventListener('click',()=>void load(host,ui,owner,ui.dropdown.value,category,true));
 void load(host,ui,owner,ui.dropdown.value,category);
}
function observe(){
 const host=root.querySelector('#newsRssV116');
 if(!valid()){
  if(currentUser){currentUser='';cache.clear();requestCounter++;activeNewsRequest?.abort();activeNewsRequest=null}
  currentHost=null;return;
 }
 if(host&&!host.dataset.newsReady)mount(host);
 if(!host&&currentHost){currentHost=null;requestCounter++;activeNewsRequest?.abort();activeNewsRequest=null}
}
new MutationObserver(observe).observe(root,{childList:true});
new MutationObserver(observe).observe(shell,{attributes:true,attributeFilter:['class']});
observe();
})();