/* LifeDashPro Web v1.39 — shared Journey v2 itinerary, NOT Navigator.
  Coordinates are verified by explicit Photon search selections, never guessed. */
(()=>{'use strict';
const tr=k=>window.LifeDashParityI18nV138?.tr?.(k)||k;
const bridge=()=>window.LifeDashMobilityBridge;
const element=(tag,cls,text)=>{
 const e=document.createElement(tag);if(cls)e.className=cls;
 if(text!==undefined)e.textContent=String(text);return e;
};
const dkey=()=>{
 const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
};
const uuid=()=>crypto.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2,8);
let modal=null,busy=false;
function field(label,type,value,opts={}){
 const l=element('label','mob139-field'),caption=element('span','',tr(label)),input=element(type==='textarea'?'textarea':'input');
 if(type!=='textarea')input.type=type;
 input.value=value??'';input.maxLength=opts.maxLength||220;
 if(opts.required)input.required=true;
 if(type==='textarea')input.rows=2;
 l.append(caption,input);return {label:l,input};
}
function placeValid(p){
 const lat=Number(p?.latitude),lon=Number(p?.longitude);
 return !!p&&Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180&&!(lat===0&&lon===0);
}
function labelPlace(p){return String(p?.displayName||p?.name||p?.address||'').slice(0,180)}
function parsedFeature(feature){
 const props=feature?.properties||{},coordinates=feature?.geometry?.coordinates||[];
 const lon=Number(coordinates[0]),lat=Number(coordinates[1]);
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||(lat===0&&lon===0))return null;
 const name=[props.name||[props.street,props.housenumber].filter(Boolean).join(' '),props.city||props.locality,props.state,props.country].filter(Boolean).join(', ').slice(0,180);
 if(!name)return null;
 const id='photon-'+(props.osm_type||'place')+'-'+(props.osm_id||lat.toFixed(5)+'-'+lon.toFixed(5));
 return {schemaVersion:2,id,canonicalId:id,name:String(props.name||props.street||props.city||name).slice(0,150),
  displayName:name,city:String(props.city||props.locality||'').slice(0,100),
  country:String(props.country||'').slice(0,100),countryCode:String(props.countrycode||'').toUpperCase().slice(0,2),
  address:name,latitude:lat,longitude:lon,provider:'photon',kind:props.type==='city'?'city':'place',
  confidence:'selected'};
}
function open(plan){
 if(!bridge()?.ready?.()||typeof bridge()?.saveJourney!=='function')return;
 if(modal?.open)modal.close();
 const original=plan||{},root=element('dialog','mob139-dialog');
 modal=root;
 const box=element('form','mob139-form');
 const head=element('div','mob139-heading');
 head.append(element('h2','',tr(plan?'Edit itinerary':'Plan journey')));
 const close=element('button','mob138-close','×');close.type='button';close.onclick=()=>root.close();
 head.append(close);box.append(head);
 box.append(element('p','mob111-muted',tr('Journey editor explanation')));
 const basics=element('div','mob139-basic');
 const title=field('Trip name','text',original.title||'',{required:true,maxLength:180});
 const date=field('Departure date','date',original.startDate||dkey(),{required:true});
 const time=field('Departure time','time',original.startTime||'08:00');
 basics.append(title.label,date.label,time.label);box.append(basics);
 const stopsHead=element('div','mob139-heading'),stopTitle=element('h3','',tr('Route stops'));
 const add=element('button','secondary mob139-button','＋ '+tr('Add stop'));add.type='button';
 stopsHead.append(stopTitle,add);box.append(stopsHead);
 const list=element('div','mob139-stops');box.append(list);
 const hint=element('p','mob111-muted',tr('Select locations on map search'));box.append(hint);
 const status=element('p','mob139-status','');status.setAttribute('role','status');box.append(status);
 const footer=element('div','mob138-footer');
 const cancel=element('button','secondary',tr('Cancel'));cancel.type='button';cancel.onclick=()=>root.close();
 const save=element('button','primary',tr('Save itinerary'));save.type='submit';
 footer.append(cancel,save);box.append(footer);root.append(box);
 const rows=()=>[...list.querySelectorAll('.mob139-stop')];
 function renumber(){rows().forEach((row,i)=>row.querySelector('.mob139-order').textContent=tr('Stop')+' '+(i+1))}
 function addStop(source){
  if(rows().length>=15){status.textContent=tr('Maximum 15 stops');return}
  const row=element('section','mob139-stop');row.__source=source||{};
  row.__selected=placeValid(source?.place)?{...source.place}:null;
  const label=element('div','mob139-stop-head'),number=element('strong','mob139-order','');
  const up=element('button','secondary mob139-move','↑'),down=element('button','secondary mob139-move','↓');
  const remove=element('button','secondary mob139-move','×');
  [up,down,remove].forEach(b=>b.type='button');
  up.title=tr('Move up');down.title=tr('Move down');remove.title=tr('Remove stop');
  up.onclick=()=>{if(row.previousElementSibling)list.insertBefore(row,row.previousElementSibling);renumber()};
  down.onclick=()=>{if(row.nextElementSibling)list.insertBefore(row.nextElementSibling,row);renumber()};
  remove.onclick=()=>{if(rows().length<=2){status.textContent=tr('At least two stops required');return}row.remove();renumber()};
  label.append(number,up,down,remove);row.append(label);
  const placeArea=element('div','mob139-place-area'),search=field('Search address or city','search',labelPlace(source?.place),{maxLength:180});
  const look=element('button','secondary mob139-button',tr('Find place'));look.type='button';
  const suggestions=element('div','mob139-results');search.input.placeholder=tr('City, address, street number');
  search.input.oninput=()=>{row.__selected=null;suggestions.replaceChildren();row.classList.remove('mob139-verified')};
  if(row.__selected)row.classList.add('mob139-verified');
  const lookup=async()=>{
   const query=search.input.value.trim();
   if(query.length<3){status.textContent=tr('Enter at least 3 characters');return}
   const seq=row.__seq=(row.__seq||0)+1;
   suggestions.replaceChildren(element('p','mob111-muted',tr('Searching')));
   look.disabled=true;
   try{
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);
    let response;
    try{response=await fetch('https://photon.komoot.io/api/?'+new URLSearchParams({q:query,limit:'6',lang:'en'}),{signal:controller.signal})}
    finally{clearTimeout(timeout)}
    if(!response.ok)throw Error(tr('Place search unavailable'));
    const payload=await response.json();if(seq!==row.__seq||!row.isConnected)return;
    suggestions.replaceChildren();
    const results=(Array.isArray(payload.features)?payload.features:[]).map(parsedFeature).filter(Boolean);
    if(!results.length){suggestions.append(element('p','mob111-muted',tr('No matches')));return}
    for(const place of results){
     const b=element('button','mob139-result',labelPlace(place));b.type='button';
     b.onclick=()=>{row.__selected=place;search.input.value=labelPlace(place);
      row.classList.add('mob139-verified');suggestions.replaceChildren();
      status.textContent=tr('Location verified')+': '+place.displayName};
     suggestions.append(b);
    }
   }catch(error){if(seq===row.__seq){suggestions.replaceChildren();status.textContent=String(error?.message||'Search failed').slice(0,130)}}
   finally{look.disabled=false}
  };
  look.onclick=lookup;search.input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();void lookup()}});
  placeArea.append(search.label,look);row.append(placeArea,suggestions);
  const extra=element('div','mob139-stop-fields');
  const day=field('Date','date',source?.date||original.startDate||date.input.value||dkey());
  const arrival=field('Arrival','time',source?.arrivalTime||'');
  const departure=field('Departure','time',source?.departureTime||'');
  const note=field('Notes','textarea',source?.note||'',{maxLength:500});
  const mode=element('label','mob139-field');mode.append(element('span','',tr('Transport mode')));
  const select=element('select');for(const value of ['car','walk','bus','train','taxi']){
   const option=element('option','',tr(value));option.value=value;option.selected=(source?.transportMode||'car')===value;select.append(option)}
  mode.append(select);extra.append(day.label,arrival.label,departure.label,mode,note.label);row.append(extra);
  row.__controls={day,arrival,departure,note,mode:select};
  list.append(row);renumber();
 }
 add.onclick=()=>addStop(null);
 const saved=Array.isArray(original.stops)?original.stops:[];
 if(saved.length>=2) saved.slice(0,15).forEach(x=>addStop(x));
 else{addStop(null);addStop(null)}
 box.addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;
  const candidates=rows();if(candidates.length<2)return;
  if(candidates.some(x=>!placeValid(x.__selected))){
   status.textContent=tr('Select a search result for each stop');return
  }
  const stops=candidates.map((row,i)=>{
   const base=row.__source||{},c=row.__controls;
   return {...base,schemaVersion:2,id:base.id||'web-stop-'+uuid(),
    kind:base.kind||'place',place:{...row.__selected},
    date:c.day.input.value,arrivalTime:c.arrival.input.value||undefined,
    departureTime:c.departure.input.value||undefined,
    note:c.note.input.value.slice(0,500),transportMode:c.mode.value,
    status:base.status||'planned',nights:base.nights||0,
    attachments:Array.isArray(base.attachments)?base.attachments:[],
    documents:Array.isArray(base.documents)?base.documents:[],
    reminders:Array.isArray(base.reminders)?base.reminders:[]};
  });
  busy=true;save.disabled=true;status.textContent=tr('Saving');
  try{
   const result=await bridge().saveJourney({id:original.id,title:title.input.value.trim(),
    startDate:date.input.value,startTime:time.input.value,stops});
   root.close();document.dispatchEvent(new CustomEvent('lifedash:journey-saved',{detail:{id:result?.id}}));
  }catch(error){status.textContent=String(error?.message||'Save failed').slice(0,220)}
  finally{busy=false;save.disabled=false}
 });
 root.addEventListener('close',()=>{root.remove();if(modal===root)modal=null},{once:true});
 document.body.append(root);root.showModal();
}
window.LifeDashJourneyEditorV139=Object.freeze({open});
})();
