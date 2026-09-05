(()=>{
'use strict';
if(new URLSearchParams(location.search).get('workspace')!=='desktop')return;
const parity=window.LifeDashWebParity;if(!parity)return;
const baseFinance=financePage;
financePage=function(){
 let html=baseFinance();
 const goals=collection('finance_goals'),utils=collection('finance_utilities'),base=parity.baseCurrency?.()||'EUR';
 const extra=`<div class="card span-6"><div class="parity-card-head"><div><h3>Savings goals</h3><span class="card-sub">Synced goals remain editable on Web.</span></div><button class="mini-btn" data-add-goal>＋ Goal</button></div><div class="list">${goals.map(g=>`<div class="list-item"><div class="grow"><b>${esc(g.title||'Goal')}</b><span>${fmtMoney(g.currentAmount||0,g.currency||base)} / ${fmtMoney(g.targetAmount||0,g.currency||base)}${g.deadline?' · '+fmtDate(g.deadline):''}</span></div><button class="mini-btn" data-edit-goal="${esc(g.id)}">Edit</button><button class="mini-btn" data-del-goal="${esc(g.id)}">Delete</button></div>`).join('')||'<span class="card-sub">No savings goals.</span>'}</div></div><div class="card span-6"><div class="parity-card-head"><div><h3>Utilities</h3><span class="card-sub">Readings, costs and attachments use the synced Finance collection.</span></div><button class="mini-btn" data-add-utility>＋ Utility</button></div><div class="list">${utils.slice(0,12).map(u=>`<div class="list-item"><div class="grow"><b>${esc(u.type||'utility')}</b><span>${fmtDate(u.date)} · ${fmtMoney(u.cost||0,u.currency||base)} · reading ${esc(u.reading??'—')}</span></div><button class="mini-btn" data-edit-utility="${esc(u.id)}">Edit</button><button class="mini-btn" data-del-utility="${esc(u.id)}">Delete</button></div>`).join('')||'<span class="card-sub">No utility readings.</span>'}</div></div>`;
 return html.replace(/<\/div>\s*$/,extra+'</div>');
};
function tidyParityBanners(){for(const host of [document.getElementById('page'),document.getElementById('desktopWindowBody')]){if(!host)continue;const banners=[...host.querySelectorAll('.web-parity-banner')];if(banners.length>1)banners.filter(x=>x.dataset.auto==='1').forEach(x=>x.remove())}}
function soften(id,label){const box=document.getElementById(id);const bad=box?.querySelector('.pill.bad');if(bad)bad.textContent=`${label} is temporarily unavailable in the Web version. This provider integration is being upgraded; synced LifeDashPro account data is not affected.`}
try{const f=loadExplore;loadExplore=async function(){const r=await f.apply(this,arguments);soften('exploreBody','Live Explore');return r}}catch{}
try{const f=loadAir;loadAir=async function(){const r=await f.apply(this,arguments);soften('airList','Air Traffic');return r}}catch{}
try{const f=loadRadio;loadRadio=async function(){const r=await f.apply(this,arguments);soften('radioGrid','Radio catalog');return r}}catch{}
const baseRender=render;render=async function(){const r=await baseRender.apply(this,arguments);setTimeout(tidyParityBanners,280);return r};
})();
