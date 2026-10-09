/* LifeDashPro Web v1.7 World Radio
   Stream catalog: Radio Browser public mirrors; favorites: existing user-scoped radio_favorites.
   The HTML audio element lives outside #content so SPA navigation cannot interrupt playback.
   No autoplay and no new database schema. */
(() => {
  'use strict';
  const $=(selector,root=document)=>root.querySelector(selector);
  const $$=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
  const node=(tag,cls,label)=>{
    const el=document.createElement(tag);
    if(cls)el.className=cls;
    if(label!==undefined)el.textContent=label;
    return el;
  };
  const bridge=()=>window.LifeDashRadioBridge;
  const app=$('#appView'), content=$('#content'), dock=$('#radioDock'), audio=$('#radioAudio');
  if(!app||!content||!dock||!audio)return;
  const mirrors=['https://de1.api.radio-browser.info','https://at1.api.radio-browser.info','https://nl1.api.radio-browser.info','https://fr1.api.radio-browser.info','https://cz1.api.radio-browser.info'];
  const FALLBACK_COUNTRIES=[['DE','Germany'],['MK','North Macedonia'],['RS','Serbia'],['AT','Austria'],['CH','Switzerland'],['HR','Croatia'],['SI','Slovenia'],['BA','Bosnia and Herzegovina'],['BG','Bulgaria'],['GR','Greece'],['AL','Albania'],['IT','Italy'],['FR','France'],['ES','Spain'],['GB','United Kingdom'],['US','United States'],['CA','Canada'],['BR','Brazil'],['JP','Japan'],['TR','Türkiye'],['RO','Romania'],['NL','Netherlands'],['BE','Belgium'],['PL','Poland'],['CZ','Czechia'],['SE','Sweden'],['NO','Norway'],['AU','Australia'],['IN','India']];
  const PREF_VOLUME='lifedash_web_radio_volume_v17';
  let mirror=0, current=null, playing=false, view='top', stations=[],search='',country='',loading=false,error='',message='',requestSeq=0;
  let availableCountries=FALLBACK_COUNTRIES.slice(),countriesLoaded=false;
  const busyFavorites=new Set();
  let volume=70;
  try {const v=Number(localStorage.getItem(PREF_VOLUME));if(Number.isFinite(v)&&v>=0&&v<=100)volume=v;}catch(_){}
  audio.volume=volume/100;
  const volDock=$('#radioDockVolume');if(volDock)volDock.value=String(volume);

  function signedIn(){return !app.classList.contains('hidden')&&Boolean(bridge()?.ready())}
  function favorites(){return signedIn()?bridge().favorites():[]}
  function isFavorite(id){return favorites().some(x=>String(x.id||x.stationuuid)===String(id))}
  function safeText(v,max=140){return String(v??'').trim().slice(0,max)}
  function safeHttps(url){
    try {const u=new URL(String(url||''));return u.protocol==='https:'&&u.hostname&&!u.username&&!u.password?u.href:''}catch(_){return ''}
  }
  function normalize(s){
    if(!s||typeof s!=='object')return null;
    const id=safeText(s.stationuuid||s.id,120),name=safeText(s.name,140);
    if(!id||!name)return null;
    const raw=safeText(s.url_resolved||s.url,1500);
    const original=safeText(s.url||raw,1500);
    return {id,stationuuid:id,name,url:original,stream:safeHttps(raw)||safeHttps(original),rawStream:raw,
      country:safeText(s.country,80),countrycode:safeText(s.countrycode||s.countryCode,6).toUpperCase(),
      tags:safeText(s.tags,240),favicon:safeHttps(s.favicon),codec:safeText(s.codec,20),
      votes:Math.max(0,Number(s.votes)||0),bitrate:Math.max(0,Number(s.bitrate)||0),clickcount:Math.max(0,Number(s.clickcount)||0)};
  }
  function uniqueStations(rows){
    const ids=new Set();return (Array.isArray(rows)?rows:[]).map(normalize).filter(s=>{if(!s||ids.has(s.id))return false;ids.add(s.id);return true}).slice(0,65);
  }
  function favoritePayload(s){
    return {id:s.id,stationuuid:s.id,name:s.name,url:s.url||s.stream,url_resolved:s.stream||s.rawStream||s.url,
      country:s.country,countrycode:s.countrycode,countryCode:s.countrycode,tags:s.tags||'',favicon:s.favicon||'',
      homepage:'',language:'',codec:s.codec||'',bitrate:s.bitrate||0,votes:s.votes||0,clickcount:s.clickcount||0};
  }
  async function getJSON(path){
    let last;
    for(let i=0;i<mirrors.length;i++){
      const index=(mirror+i)%mirrors.length;
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),7500);
      try{
        const response=await fetch(mirrors[index]+'/json'+path,{signal:controller.signal,headers:{Accept:'application/json'},cache:'no-store'});
        if(!response.ok)throw new Error('Directory returned HTTP '+response.status);
        const result=await response.json();
        if(!Array.isArray(result))throw new Error('Unexpected station directory response');
        mirror=index;return result;
      }catch(err){last=err}finally{clearTimeout(timer)}
    }
    throw new Error('Radio directory unavailable. Try again later. '+(last?.message||''));
  }
  async function loadCountries(){
    if(countriesLoaded)return;
    countriesLoaded=true;
    try{
      const rows=await getJSON('/countries?order=name');
      const valid=rows.filter(x=>/^[A-Z]{2}$/.test(String(x.iso_3166_1||'').toUpperCase())&&x.name)
        .map(x=>[String(x.iso_3166_1).toUpperCase(),safeText(x.name,80)]);
      if(valid.length>50)availableCountries=valid.sort((a,b)=>a[1].localeCompare(b[1]));
      refreshCountrySelect();
    }catch(_){/* Built-in world selection remains usable. */}
  }
  function refreshCountrySelect(){
    const select=$('#radioCountrySelect');if(!select)return;
    const old=country;
    select.replaceChildren();
    const first=node('option','','Top worldwide');first.value='';select.append(first);
    availableCountries.forEach(([cc,name])=>{const o=node('option','',name);o.value=cc;select.append(o)});
    if(old&&availableCountries.some(x=>x[0]===old))select.value=old;
    else select.value='';
  }
  async function findStations(kind,q,cc){
    const k=kind==='favorites'?'favorites':kind==='country'?'country':kind==='search'?'search':'top';
    if(k==='favorites')return uniqueStations(favorites());
    if(k==='search'&&!q)return [];
    const path=k==='country'?'/stations/bycountrycodeexact/'+encodeURIComponent(cc)+'?hidebroken=true&order=clickcount&reverse=true&limit=60':
       k==='search'?'/stations/search?name='+encodeURIComponent(q.slice(0,75))+'&hidebroken=true&order=clickcount&reverse=true&limit=60':
       '/stations/topvote/60?hidebroken=true';
    let rows=await getJSON(path);
    if(k==='country'&&!rows.length)rows=await getJSON('/stations/search?countrycode='+encodeURIComponent(cc)+'&hidebroken=true&limit=60');
    return uniqueStations(rows);
  }
  async function load(kind=view){
    view=kind;
    const seq=++requestSeq;loading=true;error='';message='';draw();
    try{
      const result=await findStations(kind,search,country);
      if(seq!==requestSeq)return;
      stations=result;
      if(result.length===0)message=kind==='favorites'?'No favorite stations yet. Browse World Radio and tap ☆ to save one.':'No matching stations were found.';
    }catch(e){
      if(seq!==requestSeq)return;
      error=e.message||'Could not find stations.';
      stations=[];
    }finally{
      if(seq===requestSeq){loading=false;draw()}
    }
  }
  function setStatus(label){
    const status=$('#radioDockStatus');if(status)status.textContent=label;
    const statusPage=$('#radioPageStatus');if(statusPage)statusPage.textContent=label;
    const statusWidget=$('#radioWidgetStatus');if(statusWidget)statusWidget.textContent=label;
  }
  function syncControls(){
    const name=current?.name||'No station selected';
    const n=$('#radioDockName');if(n)n.textContent=name;
    const wn=$('#radioWidgetName');if(wn)wn.textContent=name;
    const pn=$('#radioCurrentName');if(pn)pn.textContent=name;
    for(const id of ['radioDockPlay','radioWidgetPlay','radioPagePlay']){
      const button=$('#'+id);if(!button)continue;
      button.textContent=playing?'Ⅱ':'▶';
      button.setAttribute('aria-label',playing?'Pause radio':'Play radio');
      button.setAttribute('title',playing?'Pause radio':'Play radio');
      button.disabled=!current||!current.stream;
    }
    for(const id of ['radioDockFav','radioPageFav']){
      const button=$('#'+id);if(!button)continue;
      const selected=current&&isFavorite(current.id);
      button.textContent=selected?'★':'☆';
      button.setAttribute('aria-label',selected?'Remove station from favorites':'Add station to favorites');
      button.setAttribute('aria-pressed',String(Boolean(selected)));
      button.disabled=!current||busyFavorites.has(current.id)||!signedIn();
    }
    for(const input of $$('#radioDockVolume,#radioPageVolume'))input.value=String(volume);
    const count=$('#navRadioFav');if(count)count.textContent=String(favorites().length);
    dock.hidden=!current||!signedIn();
    app.classList.toggle('radio-dock-active',!dock.hidden);
  }
  function stop(reset=true){
    playing=false;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    if(reset)current=null;
    setStatus(reset?'Ready':'Stopped');
    syncControls();
  }
  function playStation(station){
    if(!signedIn())return;
    if(!station?.stream){setStatus('This station needs an HTTPS stream compatible with your browser.');return;}
    if(!current||current.id!==station.id||audio.src!==station.stream){
      audio.pause();
      audio.src=station.stream;
      current=station;
      audio.load();
    }
    setStatus('Connecting…');
    syncControls();
    const result=audio.play();
    if(result?.catch)result.catch(()=>{playing=false;setStatus('Stream cannot play. Try a different station.');syncControls()});
  }
  function togglePlayback(){
    if(!current)return;
    if(playing){audio.pause();return}
    playStation(current);
  }
  audio.addEventListener('playing',()=>{playing=true;setStatus('Live · Playing');syncControls()});
  audio.addEventListener('pause',()=>{playing=false;if(current)setStatus('Paused');syncControls()});
  audio.addEventListener('waiting',()=>{if(current)setStatus('Buffering…')});
  audio.addEventListener('stalled',()=>{if(current)setStatus('Waiting for stream…')});
  audio.addEventListener('error',()=>{if(current){playing=false;setStatus('Stream unavailable or unsupported by this browser.');syncControls()}});
  function setVolume(value){
    volume=Math.max(0,Math.min(100,Number(value)||0));audio.volume=volume/100;
    try{localStorage.setItem(PREF_VOLUME,String(volume))}catch(_){}
    syncControls();
  }
  async function toggleFavorite(station){
    if(!station||!signedIn()||busyFavorites.has(station.id))return;
    busyFavorites.add(station.id);syncControls();draw();
    try{
      if(isFavorite(station.id))await bridge().removeFavorite(station.id);
      else await bridge().saveFavorite(favoritePayload(station));
      message='Favorites synchronized with your LifeDashPro account.';
      if(view==='favorites')stations=uniqueStations(favorites());
    }catch(e){message='Favorite was not changed: '+(e?.message||'Sync error')+'. Refresh to check for updates.'}
    finally{busyFavorites.delete(station.id);syncControls();draw()}
  }
  function radioButton(label,cls,handler,attrs={}){
    const b=node('button',cls,label);b.type='button';
    for(const [key,value]of Object.entries(attrs))b.setAttribute(key,String(value));
    b.addEventListener('click',handler);
    return b;
  }
  function optionCountry(select){
    const blank=node('option','','Top worldwide');blank.value='';select.appendChild(blank);
    for(const [code,name] of availableCountries){
      const opt=node('option','',name);opt.value=code;select.append(opt);
    }
    if(country&&availableCountries.some(x=>x[0]===country))select.value=country;
  }
  function mountPage(host){
    host.dataset.radioReady='1';host.replaceChildren();
    const head=node('div','radio-page-heading');
    head.append(node('div','eyebrow','WORLD RADIO'),node('h2','','Listen around the world'),
      node('p','radio-page-description','Discover global stations. Favorites sync with your Android LifeDashPro account.'));
    host.append(head);
    const toolbar=node('div','radio-toolbar');
    const countryLabel=node('label','radio-field');
    countryLabel.append(node('span','','Country'));
    const countrySelect=node('select','radio-select');countrySelect.id='radioCountrySelect';countrySelect.setAttribute('aria-label','Find stations by country');
    optionCountry(countrySelect);
    countrySelect.addEventListener('change',()=>{country=countrySelect.value;search='';const q=$('#radioSearchInput');if(q)q.value='';load(country?'country':'top')});
    countryLabel.append(countrySelect);
    const searchLabel=node('label','radio-field radio-search-field');searchLabel.append(node('span','','Station name'));
    const input=node('input','radio-input');input.id='radioSearchInput';input.type='search';input.maxLength=75;
    input.placeholder='Search worldwide stations';input.value=search;
    input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();search=input.value.trim();load(search?'search':'top')}});
    searchLabel.append(input);
    const actions=node('div','radio-filter-actions');
    actions.append(
      radioButton('Search','primary',()=>{search=input.value.trim();load(search?'search':'top')}),
      radioButton('Top stations','secondary',()=>{search='';country='';input.value='';countrySelect.value='';load('top')}),
      radioButton('★ Favorites','secondary',()=>load('favorites'))
    );
    toolbar.append(countryLabel,searchLabel,actions);host.append(toolbar);

    const now=node('section','radio-current-card');now.setAttribute('aria-label','Current station');
    const currentInfo=node('div','radio-current-info');currentInfo.append(node('span','radio-current-icon','♫'));
    const currentText=node('div');currentText.append(node('span','radio-eyebrow','NOW PLAYING'));
    const currentName=node('strong','','No station selected');currentName.id='radioCurrentName';currentText.append(currentName);
    const currentStatus=node('small','','Select a station to listen');currentStatus.id='radioPageStatus';currentText.append(currentStatus);
    currentInfo.append(currentText);
    const buttons=node('div','radio-current-controls');
    const fav=radioButton('☆','radio-control',()=>current&&toggleFavorite(current),{'aria-label':'Add station to favorites'});
    fav.id='radioPageFav';buttons.append(fav);
    const play=radioButton('▶','radio-control radio-control-play',togglePlayback,{'aria-label':'Play radio'});play.id='radioPagePlay';buttons.append(play);
    const vlabel=node('label','radio-volume-label');vlabel.append(node('span','','Volume'));
    const range=node('input');range.type='range';range.id='radioPageVolume';range.min='0';range.max='100';range.step='1';range.value=String(volume);
    range.setAttribute('aria-label','Radio volume');range.addEventListener('input',e=>setVolume(e.target.value));vlabel.append(range);buttons.append(vlabel);
    now.append(currentInfo,buttons);host.append(now);
    const messages=node('p','radio-result-status');messages.id='radioResultsMessage';messages.setAttribute('role','status');messages.setAttribute('aria-live','polite');
    host.append(messages);
    const list=node('div','radio-station-grid');list.id='radioStationGrid';host.append(list);
    syncControls();
    if(!loading&&!stations.length&&!error&&!message){load('top');}
    else draw();
    if(!countriesLoaded)loadCountries();
  }
  function draw(){
    const list=$('#radioStationGrid');if(!list)return;
    list.replaceChildren();
    const label=$('#radioResultsMessage');
    if(label)label.textContent=loading?'Searching current stations…':error||message||(view==='favorites'?'Your Android-synced favorite stations':'Choose a station to start playback.');
    if(loading)return;
    if(error){
      list.append(radioButton('Try again','secondary',()=>load(view)));
      return;
    }
    if(!stations.length){
      list.append(node('div','empty','No stations to show for this selection.'));
      return;
    }
    for(const station of stations){
      const item=node('article','radio-station');
      if(current?.id===station.id)item.classList.add('selected');
      const icon=node('div','radio-station-icon','♫');icon.setAttribute('aria-hidden','true');
      const info=node('div','radio-station-info');
      const title=node('strong','',station.name);title.title=station.name;
      const subtitle=node('small','',[station.country||station.countrycode,station.codec].filter(Boolean).join(' · ')||'Worldwide radio');
      info.append(title,subtitle);
      const actions=node('div','radio-station-actions');
      const isFav=isFavorite(station.id);
      const favorite=radioButton(isFav?'★':'☆','radio-control',()=>toggleFavorite(station),
        {'aria-label':isFav?'Remove favorite '+station.name:'Favorite '+station.name,'aria-pressed':String(isFav)});
      favorite.disabled=busyFavorites.has(station.id)||!signedIn();
      const play=radioButton(current?.id===station.id&&playing?'Ⅱ':'▶','radio-control radio-control-play',
        ()=>current?.id===station.id?togglePlayback():playStation(station),
        {'aria-label':'Play '+station.name});
      if(!station.stream){
        play.disabled=true;
        play.title='HTTPS stream unavailable. Browser cannot play this station.';
        item.classList.add('stream-unavailable');
      }
      actions.append(favorite,play);item.append(icon,info,actions);list.append(item);
    }
  }
  function widget(){
    if(!signedIn()||!content.classList.contains('dashboard-view'))return;
    const grid=$('.dash-grid',content);if(!grid||$('#radioWidget',grid))return;
    const section=node('section','card span-12 ldp-radio-widget');section.id='radioWidget';
    const head=node('div','card-head');
    const label=node('div');label.append(node('p','eyebrow','WORLD RADIO'),node('h3','','Listen while you organize'));
    const open=radioButton('Browse stations →','text-btn',openRadio);
    head.append(label,open);
    const box=node('div','radio-widget-content');
    box.append(node('span','radio-widget-icon','♫'));
    const summary=node('div','radio-widget-summary');
    const name=node('strong','','No station selected');name.id='radioWidgetName';
    const status=node('small','','Discover stations worldwide');status.id='radioWidgetStatus';
    summary.append(name,status);
    const btn=radioButton('▶','radio-control radio-control-play',()=>current?togglePlayback():openRadio,{'aria-label':'Play radio'});
    btn.id='radioWidgetPlay';box.append(summary,btn);
    section.append(head,box);grid.append(section);
    syncControls();
  }
  function openRadio(){
    const nav=$('#nav [data-page="radio"]');
    if(nav)nav.click();
  }
  function onContent(){
    if(!signedIn()){stop();return}
    const host=$('#worldRadioPage',content);
    if(host&&!host.dataset.radioReady)mountPage(host);
    widget();
    syncControls();
  }
  $('#radioDockPlay')?.addEventListener('click',togglePlayback);
  $('#radioDockFav')?.addEventListener('click',()=>current&&toggleFavorite(current));
  $('#radioDockOpen')?.addEventListener('click',openRadio);
  $('#radioDockClose')?.addEventListener('click',()=>stop());
  volDock?.addEventListener('input',e=>setVolume(e.target.value));
  new MutationObserver(onContent).observe(content,{childList:true});
  new MutationObserver(()=>{
    if(app.classList.contains('hidden')){
      ++requestSeq;stations=[];view='top';country='';search='';message='';error='';stop();
    }else onContent();
  }).observe(app,{attributes:true,attributeFilter:['class']});
  onContent();
})();
