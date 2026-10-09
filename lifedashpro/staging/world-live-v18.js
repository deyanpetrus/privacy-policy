/* LifeDashPro Web v1.8 · World Live (read-only).
   Weather: Open-Meteo; earthquakes: USGS; satellite thermal detections: authenticated FIRMS edge.
   Bounded per-city cache, manual refresh, no polling/DB writes, no location permissions. */
(()=>{
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const element=(tag,cls,text)=>{
    const e=document.createElement(tag);
    if(cls)e.className=cls;
    if(text!==undefined)e.textContent=text;
    return e;
  };
  const CITIES=[
    ['regensburg','Regensburg, Germany',49.0134,12.1016],
    ['munich','Munich, Germany',48.1374,11.5755],
    ['nuremberg','Nuremberg, Germany',49.4521,11.0767],
    ['berlin','Berlin, Germany',52.5200,13.4050],
    ['hamburg','Hamburg, Germany',53.5511,9.9937],
    ['frankfurt','Frankfurt, Germany',50.1109,8.6821],
    ['vienna','Vienna, Austria',48.2082,16.3738],
    ['skopje','Skopje, North Macedonia',41.9981,21.4254],
    ['ohrid','Ohrid, North Macedonia',41.1231,20.8016],
    ['belgrade','Belgrade, Serbia',44.7866,20.4489],
    ['sofia','Sofia, Bulgaria',42.6977,23.3219],
    ['zagreb','Zagreb, Croatia',45.8150,15.9819],
    ['ljubljana','Ljubljana, Slovenia',46.0569,14.5058],
    ['thessaloniki','Thessaloniki, Greece',40.6401,22.9444],
    ['paris','Paris, France',48.8566,2.3522],
    ['london','London, UK',51.5072,-0.1276]
  ];
  const TYPES=['weather','quakes','fires'];
  const TITLE={weather:'Weather',quakes:'Earthquakes',fires:'Wildfires & thermal detections'};
  const ICON={weather:'☁',quakes:'◈',fires:'♨'};
  const WINDOW={weather:15*60*1000,quakes:15*60*1000,fires:30*60*1000};
  const MIN_RETRY=60*1000;
  const PREFERENCE='lifedash_web_live_city_v18';
  const MY_CITIES='lifedash_web_live_saved_cities_v181';
  let openedDetails=null;
  let detailMap=null,detailMapKey='',detailMapLoadingKey='',leafletPromise=null;
  const RADIUS_KM=250;
  const page=$('#content'),app=$('#appView');
  if(!page||!app)return;
  const bridge=()=>window.LifeDashWorldBridge;
  const cache=new Map(),pending=new Map(),attempt=new Map();
  let activeCity=null,identity='',generation=0,busyPage=false;
  function authenticated(){return !app.classList.contains('hidden')&&Boolean(bridge()?.authenticated())}
  function getCity(id){return CITIES.find(x=>x[0]===id)||CITIES[0]}
  function cityLabel(){return activeCity?.[1]||CITIES[0][1]}
  function preference(){try{return localStorage.getItem(PREFERENCE)||''}catch(_){return ''}}
  function chooseDefault(){
    const saved=preference();
    if(CITIES.some(c=>c[0]===saved))return getCity(saved);
    const cityName=String(bridge()?.profileCity()||'').toLocaleLowerCase().trim();
    return CITIES.find(x=>cityName&&x[1].toLocaleLowerCase().startsWith(cityName))||CITIES[0];
  }
  function stamp(time){
    if(!Number.isFinite(time))return 'Not checked';
    return new Intl.DateTimeFormat(undefined,{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(time));
  }
  function haversine(lat1,lon1,lat2,lon2){
    const r=Math.PI/180,dlat=(lat2-lat1)*r,dlon=(lon2-lon1)*r;
    const a=Math.sin(dlat/2)**2+Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin(dlon/2)**2;
    return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }
  function weatherDescription(code){
    if(code===0)return 'Clear sky';
    if([1,2].includes(code))return 'Mostly clear / partly cloudy';
    if(code===3)return 'Overcast';
    if([45,48].includes(code))return 'Fog';
    if([51,53,55,56,57].includes(code))return 'Drizzle';
    if([61,63,65,66,67,80,81,82].includes(code))return 'Rain';
    if([71,73,75,77,85,86].includes(code))return 'Snow';
    if([95,96,99].includes(code))return 'Thunderstorm';
    return 'Conditions available';
  }
  const round=(x,n=0)=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x).toFixed(n):'—';
  async function json(url,timeoutMs=12000){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error('HTTP '+response.status);
      return await response.json();
    }finally{clearTimeout(timeout)}
  }
  function moonInfo(day){
    // Local-calendar-day approximation, not lunar rise/set ephemerides.
    const noon=Date.parse(String(day).slice(0,10)+'T12:00:00Z');
    if(!Number.isFinite(noon))return 'Moon phase unavailable';
    const lunarDays=29.530588853;
    const fraction=((noon-Date.UTC(2000,0,6,18,14))/(86400000*lunarDays)%1+1)%1;
    const labels=['New Moon','Waxing Crescent','First Quarter','Waxing Gibbous',
      'Full Moon','Waning Gibbous','Last Quarter','Waning Crescent'];
    const index=Math.floor((fraction*8+.5)%8);
    const illuminated=Math.round((1-Math.cos(fraction*2*Math.PI))*50);
    return labels[index]+' · ~'+illuminated+'% illuminated (estimate)';
  }
  async function getWeather(city){
    const [,,lat,lon]=city;
    const q=new URLSearchParams({latitude:String(lat),longitude:String(lon),
      current:'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
      hourly:'temperature_2m,precipitation_probability,weather_code',
      daily:'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset',
      forecast_days:'6',timezone:'auto'});
    const data=await json('https://api.open-meteo.com/v1/forecast?'+q,12000);
    if(data?.current?.temperature_2m==null||!Number.isFinite(Number(data.current.temperature_2m)))
      throw new Error('Incomplete weather response');
    const currentHour=String(data.current.time||'').slice(0,13);
    const hourly=Array.isArray(data.hourly?.time)?data.hourly.time:[];
    const nextHours=hourly.map((time,i)=>({
      time:String(time),temp:data.hourly?.temperature_2m?.[i],
      rain:data.hourly?.precipitation_probability?.[i],
      code:data.hourly?.weather_code?.[i]
    })).filter(x=>x.time.slice(0,13)>=currentHour).slice(0,24);
    const days=Array.isArray(data.daily?.time)?data.daily.time.slice(0,5).map((day,i)=>({
      date:String(day),code:data.daily.weather_code?.[i],
      high:data.daily.temperature_2m_max?.[i],low:data.daily.temperature_2m_min?.[i],
      sunrise:String(data.daily.sunrise?.[i]||''),sunset:String(data.daily.sunset?.[i]||'')
    })):[];
    let pollen=null;
    try{
      const p=new URLSearchParams({latitude:String(lat),longitude:String(lon),
        current:'alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen',
        timezone:'auto'});
      const air=await json('https://air-quality-api.open-meteo.com/v1/air-quality?'+p,9000);
      const fields=[['Grass','grass_pollen'],['Birch','birch_pollen'],['Alder','alder_pollen'],
        ['Olive','olive_pollen'],['Mugwort','mugwort_pollen'],['Ragweed','ragweed_pollen']];
      pollen=fields.map(([name,key])=>({name,value:air?.current?.[key]}))
        .filter(x=>x.value!==null&&x.value!==undefined&&Number.isFinite(Number(x.value)))
        .map(x=>({name:x.name,value:Number(x.value)}));
      if(!pollen.length)pollen=null;
    }catch(_){ /* Region/season may not offer pollen; show unavailable, never a false zero. */ }
    return {temp:Number(data.current.temperature_2m),
      humidity:data.current.relative_humidity_2m,
      wind:data.current.wind_speed_10m,
      code:Number(data.current.weather_code),
      high:data.daily?.temperature_2m_max?.[0],low:data.daily?.temperature_2m_min?.[0],
      observed:String(data.current.time||''),hours:nextHours,days,
      moon:moonInfo(data.current.time||new Date().toISOString()),pollen};
  }
  async function getQuakes(city){
    const [, ,lat,lon]=city;
    const since=new Date(Date.now()-7*86400000).toISOString();
    const q=new URLSearchParams({format:'geojson',starttime:since,latitude:String(lat),longitude:String(lon),
      maxradiuskm:String(RADIUS_KM),minmagnitude:'2',orderby:'time',limit:'120'});
    const data=await json('https://earthquake.usgs.gov/fdsnws/event/1/query?'+q,14000);
    if(!Array.isArray(data?.features))throw new Error('Incomplete earthquake response');
    return data.features.filter(f=>Number.isFinite(f?.properties?.time)&&Number.isFinite(f?.properties?.mag))
      .map(f=>({id:String(f.id||''),mag:Number(f.properties.mag),place:String(f.properties.place||'Nearby'),
        time:f.properties.time,depth:f.geometry?.coordinates?.[2]??null,
        sourceUrl:String(f.properties.url||''),lat:Number(f.geometry?.coordinates?.[1]),
        lon:Number(f.geometry?.coordinates?.[0])}))
      .map(x=>({...x,distance:Number.isFinite(x.lat)&&Number.isFinite(x.lon)?
        Math.round(haversine(lat,lon,x.lat,x.lon)):null}))
      .slice(0,120);
  }
  async function getFires(city){
    const [, ,lat,lon]=city;
    const dlat=RADIUS_KM/111,dlon=RADIUS_KM/(111*Math.max(.2,Math.cos(lat*Math.PI/180)));
    const body={minLat:Math.max(-89.999,lat-dlat),maxLat:Math.min(89.999,lat+dlat),
      minLon:Math.max(-179.999,lon-dlon),maxLon:Math.min(179.999,lon+dlon)};
    let watchdog;
    let rows;
    try{
      rows=await Promise.race([
        bridge().fires(body),
        new Promise((_,reject)=>{watchdog=setTimeout(()=>reject(new Error('FIRMS request timed out')),28000)})
      ]);
    }finally{clearTimeout(watchdog)}
    if(!Array.isArray(rows))throw new Error('Incomplete FIRMS response');
    const valid=rows.map(x=>({lat:Number(x.lat),lon:Number(x.lon),observedAt:String(x.observedAt||''),
      satellite:String(x.satellite||''),confidence:String(x.confidence||'')}))
      .filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon))
      .map(x=>({...x,distance:Math.round(haversine(lat,lon,x.lat,x.lon))}))
      .filter(x=>x.distance<=RADIUS_KM)
      .sort((a,b)=>a.distance-b.distance);
    return {total:valid.length,nearest:valid.slice(0,30),points:valid.slice(0,500)};
  }
  const fetchers={weather:getWeather,quakes:getQuakes,fires:getFires};
  function key(city,type){return city[0]+'|'+type}
  function entry(type){
    const k=key(activeCity,type);
    return cache.get(k)||null;
  }
  function isFresh(type,entry){
    return Boolean(entry?.checkedAt&&Date.now()-entry.checkedAt<WINDOW[type]&&!entry.error);
  }
  function setCity(id){
    const next=getCity(id);
    if(activeCity?.[0]===next[0])return;
    activeCity=next;generation++;openedDetails=null;
    disposeDetailMap();
    document.dispatchEvent(new CustomEvent('lifedash:world-city-change',{detail:{id:next[0]}}));
    try{localStorage.setItem(PREFERENCE,next[0])}catch(_){}
    updateView();
    refresh(false);
  }
  function loadOne(type,force=false){
    if(!activeCity||!authenticated())return Promise.resolve();
    const city=activeCity.slice(),k=key(city,type),old=cache.get(k);
    if(!force&&isFresh(type,old))return Promise.resolve();
    if(pending.has(k))return pending.get(k);
    const last=attempt.get(k)||0;
    if(last&&Date.now()-last<MIN_RETRY)return Promise.resolve();
    attempt.set(k,Date.now());
    const epoch=generation,session=identity;
    const promise=(async()=>{
      try{
        const value=await fetchers[type](city);
        if(epoch!==generation||session!==identity||!authenticated())return;
        cache.set(k,{data:value,checkedAt:Date.now(),error:''});
      }catch(e){
        if(epoch!==generation||session!==identity||!authenticated())return;
        cache.set(k,{data:old?.data||null,checkedAt:old?.checkedAt||null,
          error:(e?.name==='AbortError'?'Request timed out':String(e?.message||'Source unavailable')).slice(0,140)});
      }finally{
        if(pending.get(k)===promise)pending.delete(k);
        if(epoch===generation&&session===identity)updateView();
      }
    })();
    pending.set(k,promise);
    updateView();
    return promise;
  }
  function refresh(force=false){
    if(!authenticated()||!activeCity)return;
    // One request per source and city; no polling. Even manual refresh is rate-limited to 1/min.
    TYPES.forEach(type=>void loadOne(type,force));
  }
  function detail(type,result){
    if(!result)return {main:'—',subtitle:'Awaiting source',rows:[]};
    if(type==='weather')return {
      main:round(result.temp)+'°C',
      subtitle:weatherDescription(result.code),
      rows:[
        'Today: '+round(result.low)+'° to '+round(result.high)+'°C',
        'Wind '+round(result.wind)+' km/h · Humidity '+round(result.humidity)+'%'
      ]
    };
    if(type==='quakes')return {
      main:String(result.length)+' events',
      subtitle:'M 2.0+ · past 7 days · within 250 km',
      rows:result.length?result.slice(0,3).map(x=>'M '+round(x.mag,1)+' · '+x.place+
        (Number.isFinite(x.distance)?' · '+x.distance+' km':'')):
        ['No matching earthquakes reported in the last 7 days']
    };
    return {
      main:String(result.total)+' detections',
      subtitle:'Satellite thermal detections · past 24h · 250 km',
      rows:result.total?result.nearest.slice(0,3).map(x=>x.distance+' km away · '+(x.satellite||'Satellite')+
        (x.observedAt?' · '+stamp(Date.parse(x.observedAt)) :'')):
        ['No satellite thermal detections returned in this area']
    };
  }

  function pinnedCities(){
    try{
      const raw=JSON.parse(localStorage.getItem(MY_CITIES)||'[]');
      if(Array.isArray(raw))return [...new Set(raw.filter(id=>CITIES.some(c=>c[0]===id)))].slice(0,8);
    }catch(_){}
    return [];
  }
  function updatePinned(){
    const row=$('#worldMyCities');
    if(!row||!activeCity)return;
    row.replaceChildren();
    const label=element('strong','world-my-cities-caption','My cities');row.append(label);
    const saved=pinnedCities();
    const star=element('button','secondary world-city-save',saved.includes(activeCity[0])?'★ Saved':'☆ Save city');
    star.type='button';star.setAttribute('aria-label',saved.includes(activeCity[0])?'Remove current city from My cities':'Save current city to My cities');
    star.addEventListener('click',()=>{
      const cur=pinnedCities();
      let next=cur.includes(activeCity[0])?cur.filter(id=>id!==activeCity[0]):[...cur,activeCity[0]].slice(-8);
      try{localStorage.setItem(MY_CITIES,JSON.stringify(next))}catch(_){}
      updatePinned();
    });
    row.append(star);
    for(const id of saved){
      const c=getCity(id);
      const b=element('button','world-city-chip',c[1].split(',')[0]);
      b.type='button';b.setAttribute('aria-label','Switch World Live to '+c[1]);
      if(c[0]===activeCity[0])b.classList.add('selected');
      b.addEventListener('click',()=>setCity(id));
      row.append(b);
    }
    const note=element('small','world-city-local','Saved on this browser');
    row.append(note);
  }
  function addInfoRow(parent,label,value){
    const item=element('div','world-extra-tile');
    item.append(element('span','',label),element('strong','',value));
    parent.append(item);
  }
  function updateWeatherExtra(){
    const holder=$('#worldWeatherExtra');
    if(!holder)return;
    const info=entry('weather'),weather=info?.data;
    const hourly=$('#worldHourly'),days=$('#worldFiveDay'),sun=$('#worldSunMoon'),pollen=$('#worldPollen');
    if(!hourly||!days||!sun||!pollen)return;
    hourly.replaceChildren();days.replaceChildren();sun.replaceChildren();pollen.replaceChildren();
    if(!weather){
      const text=info?.error?'Weather forecast unavailable: '+info.error:'Waiting for weather forecast…';
      hourly.append(element('p','world-extra-placeholder',text));
      days.append(element('p','world-extra-placeholder',text));
      sun.append(element('p','world-extra-placeholder',text));
      pollen.append(element('p','world-extra-placeholder',text));
      return;
    }
    for(const h of weather.hours||[]){
      const tile=element('div','world-hour-tile');
      addInfoRow(tile,'Time',h.time.slice(11,16));
      addInfoRow(tile,'Temperature',round(h.temp)+'°C');
      addInfoRow(tile,'Rain chance',round(h.rain)+'%');
      hourly.append(tile);
    }
    if(!(weather.hours||[]).length)hourly.append(element('p','world-extra-placeholder','Hourly forecast is not available.'));
    for(const d of weather.days||[]){
      const tile=element('div','world-day-tile');
      const when=new Date(d.date+'T12:00:00Z');
      const dayLabel=Number.isFinite(when.getTime())?
        new Intl.DateTimeFormat(undefined,{weekday:'short',day:'2-digit',month:'short',timeZone:'UTC'}).format(when):d.date;
      addInfoRow(tile,dayLabel,round(d.low)+'° / '+round(d.high)+'°');
      tile.append(element('small','',weatherDescription(Number(d.code))));
      days.append(tile);
    }
    if(!(weather.days||[]).length)days.append(element('p','world-extra-placeholder','Daily forecast is not available.'));
    const first=weather.days?.[0];
    const localTime=str=>str&&str.includes('T')?str.slice(11,16):'—';
    addInfoRow(sun,'Sunrise',localTime(first?.sunrise));
    addInfoRow(sun,'Sunset',localTime(first?.sunset));
    addInfoRow(sun,'Moon phase',weather.moon||'Unavailable');
    if(Array.isArray(weather.pollen)&&weather.pollen.length){
      for(const x of weather.pollen) addInfoRow(pollen,x.name,round(x.value,1)+' grains/m³');
    }else pollen.append(element('p','world-extra-placeholder','Pollen data unavailable for this region or season.'));
    const stale=$('#worldForecastStale');
    if(stale)stale.textContent=info?.error?'Last available forecast (refresh failed) · '+stamp(info.checkedAt):
      'Open-Meteo · Checked '+stamp(info?.checkedAt);
  }
  function mapLink(lat,lon){
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return null;
    const y=lat.toFixed(5),x=lon.toFixed(5);
    const link=element('a','world-map-link','View on map ↗');
    link.href='https://www.openstreetmap.org/?mlat='+encodeURIComponent(y)+'&mlon='+encodeURIComponent(x)+'#map=9/'+encodeURIComponent(y)+'/'+encodeURIComponent(x);
    link.target='_blank';link.rel='noopener noreferrer';
    return link;
  }

  function disposeDetailMap(){
    if(detailMap){try{detailMap.remove()}catch(_){}}
    detailMap=null;detailMapKey='';detailMapLoadingKey='';
  }
  async function ensureLeaflet(){
    if(window.L?.map&&window.L?.tileLayer)return window.L;
    if(leafletPromise)return leafletPromise;
    leafletPromise=new Promise((resolve,reject)=>{
      const done=()=>window.L?.map?resolve(window.L):reject(new Error('Map library could not be loaded'));
      if(!document.querySelector('link[data-world-leaflet]')){
        const link=document.createElement('link');
        link.rel='stylesheet';link.dataset.worldLeaflet='true';
        link.href='https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
        document.head.append(link);
      }
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
      script.async=true;script.dataset.worldLeaflet='true';
      const timeout=setTimeout(()=>reject(new Error('Map library timed out')),12000);
      script.onload=()=>{clearTimeout(timeout);done()};
      script.onerror=()=>{clearTimeout(timeout);reject(new Error('Map library unavailable'))};
      document.head.append(script);
    }).catch(err=>{leafletPromise=null;throw err});
    return leafletPromise;
  }
  async function renderDetailMap(type,result){
    const holder=$('#worldDetailMap'),status=$('#worldDetailMapStatus');
    if(!holder||!status||!activeCity)return;
    const points=(type==='quakes'?(result?.data||[]):(result?.data?.points||[]))
      .filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon)&&Math.abs(x.lat)<=90&&Math.abs(x.lon)<=180);
    const mapId=type+'|'+activeCity[0]+'|'+String(result?.checkedAt||'')+'|'+points.length+'|'+String(result?.error||'');
    if(detailMap&&detailMapKey===mapId)return;
    if(detailMapLoadingKey===mapId)return;
    if(detailMap)disposeDetailMap();
    // Map stays available as a geographic reference even when the FIRMS
    // service is unavailable. Never paint invented points or claim zero fires.
    status.textContent='Loading map · '+(points.length?points.length+' verified markers':
      'waiting for verified event coordinates')+'…';
    detailMapLoadingKey=mapId;
    try{
      const L=await ensureLeaflet();
      if(!holder.isConnected||detailMapLoadingKey!==mapId||openedDetails!==type||!activeCity||mapId!==type+'|'+activeCity[0]+'|'+String(entry(type)?.checkedAt||'')+'|'+
        (type==='quakes'?(entry(type)?.data||[]).length:(entry(type)?.data?.points||[]).length)+'|'+String(entry(type)?.error||''))return;
      const center=[activeCity[2],activeCity[3]];
      const m=L.map(holder,{scrollWheelZoom:false,zoomControl:true,preferCanvas:true}).setView(center,7);
      detailMap=m;detailMapKey=mapId;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
        maxZoom:18,attribution:'© OpenStreetMap contributors',crossOrigin:true
      }).addTo(m);
      const locations=[];
      for(const x of points){
        const color=type==='quakes'?'#367de8':'#e9624a';
        const marker=L.circleMarker([x.lat,x.lon],{radius:type==='quakes'?6:4,
          color:'#ffffff',weight:1.3,fillColor:color,fillOpacity:.91}).addTo(m);
        // No HTML injection from external quake/FIRMS payloads.
        const popup=document.createElement('div');
        const strong=document.createElement('strong');
        strong.textContent=type==='quakes'?'M '+round(x.mag,1)+' · '+x.place:'Thermal detection';
        const small=document.createElement('div');
        small.textContent=(x.distance==null?'':x.distance+' km · ')+
          (type==='quakes'?'Observed '+stamp(x.time):(x.satellite||'Satellite')+' · '+(x.observedAt||''));
        popup.append(strong,small);marker.bindPopup(popup);
        locations.push([x.lat,x.lon]);
      }
      if(locations.length===1)m.setView(locations[0],10);
      else if(locations.length>1)m.fitBounds(locations,{padding:[22,22],maxZoom:10});
      status.textContent=points.length?
        points.length+' verified markers · '+(type==='quakes'?'USGS earthquakes':'FIRMS thermal detections')+
          ' · select a point for details.':
        result?.error?'Source unavailable: '+result.error+' · No markers can be plotted until data arrives.':
        result?.data?'No detections returned for this area. Map centered on selected city.':
          'Awaiting verified data · no markers plotted.';
      requestAnimationFrame(()=>{if(m===detailMap)m.invalidateSize()});
    }catch(error){
      if(detailMapLoadingKey===mapId){
        status.textContent='Interactive map unavailable ('+String(error?.message||'loading error')+
          '). Event list and coordinates remain available.';
        disposeDetailMap();
      }
    }finally{
      if(detailMapLoadingKey===mapId)detailMapLoadingKey='';
    }
  }
  function updateEventDetails(){
    const panel=$('#worldEventDetails');if(!panel)return;
    panel.hidden=!openedDetails;
    if(!openedDetails){disposeDetailMap();return}
    const e=entry(openedDetails);
    const heading=$('#worldEventDetailsTitle'),list=$('#worldEventDetailsList'),notice=$('#worldEventDetailsNote');
    if(!list||!heading)return;
    heading.textContent=openedDetails==='quakes'?'Earthquake details & map':'Thermal detection details & map';
    list.replaceChildren();
    // Render the in-page map with the city center whether or not the provider works.
    renderDetailMap(openedDetails,e);
    if(!e?.data){
      list.append(element('p','world-extra-placeholder',e?.error?
        'Source unavailable: '+e.error+' · No verified markers are available.':
        'Waiting for verified events…'));
      if(notice)notice.textContent='Map is centered on the selected city. No detections are assumed when the source fails.';
      return;
    }
    const events=openedDetails==='quakes'?e.data.slice(0,30):e.data.nearest;
    if(notice)notice.textContent=openedDetails==='quakes'?
      'USGS events within 250 km in the last 7 days. List: latest 30; map: up to 120 events.':
      'Nearest '+events.length+' of '+e.data.total+' thermal detections in the list. Map: all '+(e.data.points?.length||0)+' returned points (not confirmed fires).';
    if(!events.length){list.append(element('p','world-extra-placeholder','No matching records for this city and time window.'));return;}
    for(const x of events){
      const item=element('article','world-event-item');
      const details=element('div','world-event-copy');
      if(openedDetails==='quakes'){
        details.append(element('strong','','M '+round(x.mag,1)+' · '+x.place));
        details.append(element('small','','Reported '+stamp(x.time)+
          (x.distance!=null?' · '+x.distance+' km away':'')+
          (x.depth!==null&&Number.isFinite(Number(x.depth))?' · depth '+round(x.depth,1)+' km':'')));
      }else{
        details.append(element('strong','','Thermal detection · '+x.distance+' km away'));
        details.append(element('small','',x.satellite+(x.observedAt?' · observed '+stamp(Date.parse(x.observedAt)):'')+
          (x.confidence?' · confidence '+x.confidence:'')));
      }
      item.append(details);
      const map=mapLink(x.lat,x.lon);
      if(map)item.append(map);
      if(openedDetails==='quakes'&&/^https:\/\/earthquake\.usgs\.gov\//.test(x.sourceUrl||'')){
        const source=element('a','world-map-link','USGS report ↗');
        source.href=x.sourceUrl;source.target='_blank';source.rel='noopener noreferrer';item.append(source);
      }
      list.append(item);
    }
  }
  function renderInto(kind,type,container){
    if(!container)return;
    const e=entry(type);
    const info=detail(type,e?.data);
    const isLoading=pending.has(key(activeCity,type));
    const main=$('[data-live-main]',container);
    const sub=$('[data-live-subtitle]',container);
    const rows=$('[data-live-rows]',container);
    const status=$('[data-live-checked]',container);
    if(main)main.textContent=info.main;
    if(sub)sub.textContent=info.subtitle;
    if(rows){
      rows.replaceChildren();
      for(const line of (kind==='dashboard'?info.rows.slice(0,1):info.rows)){
        const item=element('div','world-live-row',line);
        rows.appendChild(item);
      }
    }
    if(status)status.textContent=isLoading?'Checking source…':e?.error?
      (e.data?'Refresh failed; last successful '+stamp(e.checkedAt):'Unavailable · '+e.error):
      e?.checkedAt?'Checked '+stamp(e.checkedAt):'Not checked';
    container.classList.toggle('world-live-error',Boolean(e?.error));
    container.classList.toggle('world-live-loading',isLoading);
  }
  function makeCard(type,kind){
    const card=element('section','card world-live-card span-4');
    card.dataset.liveType=type;
    const head=element('div','world-live-card-head');
    const name=element('div','world-live-heading');
    const icon=element('span','world-live-icon',ICON[type]);
    icon.setAttribute('aria-hidden','true');
    const title=element('strong','',TITLE[type]);
    name.append(icon,title);
    head.append(name);
    card.append(head);
    const main=element('strong','world-live-main','—');main.dataset.liveMain='';
    const subtitle=element('p','world-live-subtitle','');subtitle.dataset.liveSubtitle='';
    const rows=element('div','world-live-rows');rows.dataset.liveRows='';
    const checked=element('small','world-live-checked','Not checked');
    checked.dataset.liveChecked='';
    checked.setAttribute('role','status');
    card.append(main,subtitle,rows,checked);
    if(kind==='page'&&type!=='weather'){
      const more=element('button','secondary world-details-button','View details & map ↗');
      more.type='button';
      more.addEventListener('click',()=>{
        openedDetails=openedDetails===type?null:type;
        updateEventDetails();
        if(openedDetails)$('#worldEventDetails')?.scrollIntoView({block:'nearest'});
      });
      card.append(more);
    }
    if(kind==='dashboard'){
      const open=element('button','text-btn world-live-open','Open World Live →');
      open.type='button';
      open.addEventListener('click',()=>$('#nav [data-page="world"]')?.click());
      card.append(open);
    }
    renderInto(kind,type,card);
    return card;
  }
  function initPage(host){
    host.dataset.worldReady='true';host.replaceChildren();
    const heading=element('div','world-live-page-head');
    const h=element('div');h.append(element('p','eyebrow','WORLD INTELLIGENCE'),
      element('h2','','World Live'),
      element('p','world-live-note','Weather, nearby earthquakes and satellite thermal detections. Read-only, time-stamped information.'));
    const controls=element('div','world-live-controls');
    const label=element('label','world-live-city-label');
    label.append(element('span','','City'));
    const select=element('select','world-live-city-select');
    select.id='worldLiveCity';select.setAttribute('aria-label','Select World Live city');
    CITIES.forEach(c=>{const option=element('option','',c[1]);option.value=c[0];select.append(option)});
    select.value=activeCity[0];
    select.addEventListener('change',()=>setCity(select.value));
    label.append(select);
    const button=element('button','secondary world-live-refresh','↻ Refresh');
    button.type='button';button.id='worldLiveRefresh';
    button.addEventListener('click',()=>refresh(true));
    controls.append(label,button);heading.append(h,controls);host.append(heading);
    const grid=element('div','world-live-grid');
    TYPES.forEach(type=>grid.append(makeCard(type,'page')));
    host.append(grid);
    const cities=element('div','world-my-cities');cities.id='worldMyCities';host.insertBefore(cities,grid);
    const forecast=element('section','world-forecast-section');forecast.id='worldWeatherExtra';
    forecast.append(element('h3','','24-hour forecast'));
    const hourly=element('div','world-hour-list');hourly.id='worldHourly';forecast.append(hourly);
    forecast.append(element('h3','','5-day forecast'));
    const days=element('div','world-days-grid');days.id='worldFiveDay';forecast.append(days);
    const extras=element('div','world-astro-pollen-grid');
    const sunBox=element('section','world-extra-card');
    sunBox.append(element('h4','','Sun & Moon'),element('div','world-extra-list'));
    sunBox.querySelector('.world-extra-list').id='worldSunMoon';
    const pollenBox=element('section','world-extra-card');
    pollenBox.append(element('h4','','Pollen · current concentrations'),element('div','world-extra-list'));
    pollenBox.querySelector('.world-extra-list').id='worldPollen';
    extras.append(sunBox,pollenBox);
    forecast.append(extras);
    const note=element('small','world-forecast-stale','');note.id='worldForecastStale';
    forecast.append(note);
    host.append(forecast);
    const details=element('section','world-event-details');details.id='worldEventDetails';details.hidden=true;
    const dh=element('div','world-event-detail-head');
    const title=element('h3','','Event details');title.id='worldEventDetailsTitle';
    const close=element('button','secondary','Close');close.type='button';
    close.addEventListener('click',()=>{openedDetails=null;updateEventDetails()});
    dh.append(title,close);details.append(dh);
    const notice=element('p','world-event-note');notice.id='worldEventDetailsNote';
    details.append(notice);
    const mapShell=element('section','world-detail-map-shell');
    mapShell.setAttribute('aria-label','Interactive map of World Live events');
    const mapHeading=element('div','world-detail-map-heading');
    mapHeading.append(element('strong','','Event map · all available markers'),
      element('small','','Map tiles © OpenStreetMap contributors'));
    mapShell.append(mapHeading);
    const mapStatus=element('p','world-map-status','Open details to load the map');
    mapStatus.id='worldDetailMapStatus';mapStatus.setAttribute('role','status');
    mapShell.append(mapStatus);
    const map=element('div','world-detail-map');
    map.id='worldDetailMap';map.setAttribute('aria-label','Map of events near selected city');
    mapShell.append(map);details.append(mapShell);
    const items=element('div','world-event-list');items.id='worldEventDetailsList';
    details.append(items);host.append(details);
    updatePinned();
    updateWeatherExtra();
    updateEventDetails();
    const source=element('p','world-live-sources',
      'Sources: Open-Meteo · USGS (past 7 days, magnitude 2+) · NASA FIRMS via LifeDashPro (past 24h). FIRMS observations are not confirmed wildfires or emergency warnings. Refresh checks are rate-limited to once per minute per source.');
    host.append(source);
  }
  function dashboard(){
    if(!page.classList.contains('dashboard-view'))return;
    const grid=$('.dash-grid',page);if(!grid)return;
    if($('#worldLiveDashboard',grid))return;
    const shell=element('section','world-live-dashboard-section');
    shell.id='worldLiveDashboard';
    shell.setAttribute('aria-label','World Live quick widgets');
    const header=element('div','world-live-dashboard-title');
    header.append(element('strong','','World Live · '+cityLabel()));
    const open=element('button','text-btn','View all →');open.type='button';
    open.addEventListener('click',()=>$('#nav [data-page="world"]')?.click());
    header.append(open);shell.append(header);
    const tiles=element('div','world-live-dashboard-grid');
    TYPES.forEach(type=>tiles.append(makeCard(type,'dashboard')));
    shell.append(tiles);
    grid.append(shell);
  }
  function updateView(){
    if(!activeCity)return;
    const sel=$('#worldLiveCity');
    if(sel&&sel.value!==activeCity[0])sel.value=activeCity[0];
    updatePinned();
    const title=$('#worldLiveDashboard .world-live-dashboard-title strong');
    if(title)title.textContent='World Live · '+cityLabel();
    for(const type of TYPES){
      const pageCard=$('#worldLivePage [data-live-type="'+type+'"]');
      const dashCard=$('#worldLiveDashboard [data-live-type="'+type+'"]');
      renderInto('page',type,pageCard);
      renderInto('dashboard',type,dashCard);
    }
    updateWeatherExtra();
    updateEventDetails();
    const refreshButton=$('#worldLiveRefresh');
    if(refreshButton){
      const pendingAny=TYPES.some(type=>pending.has(key(activeCity,type)));
      refreshButton.disabled=pendingAny;
      refreshButton.textContent=pendingAny?'Checking…':'↻ Refresh';
    }
  }
  function syncIdentity(){
    const id=authenticated()?String(bridge()?.identity()||''):'';
    if(id===identity)return;
    disposeDetailMap();
    identity=id;
    generation++;
    cache.clear();pending.clear();attempt.clear();
    if(!id){activeCity=null;return}
    activeCity=chooseDefault();
  }
  function onContent(){
    syncIdentity();
    if(!authenticated())return;
    if(!activeCity)activeCity=chooseDefault();
    const host=$('#worldLivePage',page);
    if(host&&!host.dataset.worldReady){disposeDetailMap();initPage(host)}
    if(!host&&detailMap)disposeDetailMap();
    dashboard();
    if(host||$('#worldLiveDashboard',page)){
      updateView();
      refresh(false);
    }
  }
  new MutationObserver(onContent).observe(page,{childList:true});
  new MutationObserver(()=>{
    if(app.classList.contains('hidden')){
      generation++;identity='';cache.clear();pending.clear();attempt.clear();activeCity=null;
    }else onContent();
  }).observe(app,{attributes:true,attributeFilter:['class']});
  onContent();
})();
