(()=>{
'use strict';
const TIMEOUT_MS=18000;
const $id=id=>document.getElementById(id);
function authHost(){return document.querySelector('#authView .auth-card')}
function clearState(){document.querySelectorAll('.web-auth-loading,.web-auth-recovery').forEach(x=>x.remove())}
function loading(message='Loading your secure workspace…'){
 clearState();const host=authHost();if(!host)return;const el=document.createElement('div');el.className='web-auth-loading';el.innerHTML=`<i></i><span>${String(message).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</span>`;host.appendChild(el)
}
function recovery(error){
 clearState();const host=authHost();if(!host)return;const msg=String(error?.message||'The first cloud sync could not finish.');const el=document.createElement('div');el.className='web-auth-recovery';el.innerHTML=`<b>LifeDashPro could not finish loading</b><span>${msg.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</span><div class="page-actions"><button type="button" class="primary" data-web-retry>Retry</button><button type="button" class="quiet" data-web-signout>Sign out</button></div>`;host.appendChild(el)
}
const timeout=(promise,label)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(`${label} timed out. Check the connection and try again.`)),TIMEOUT_MS))]);
function isCanonical(){return location.pathname.replace(/\/+$/,'/').endsWith('/lifedashpro/')}
function desktopReady(){return window.__LIFEDASH_DESKTOP_BOOTSTRAPPED__===true||new URLSearchParams(location.search).get('workspace')==='desktop'}
function bootstrapDesktop(){
 const u=new URL(location.href);
 u.searchParams.set('workspace','desktop');
 u.searchParams.set('desktopBootstrap','1');
 u.searchParams.set('v','3721102');
 location.replace(u.pathname+'?'+u.searchParams.toString()+u.hash);
}
async function ensureFirstRun(){
 if(!window.LifeDashData?.session?.user)return;
 const D=window.LifeDashData,uid=D.session.user.id,meta=D.session.user.user_metadata||{};
 let prefs=[];try{prefs=await timeout(D.list('app_preferences'),'Account preferences')}catch{}
 if(!prefs.length){
  const now=new Date().toISOString();
  await timeout(D.upsert('app_preferences',{id:'main',onboardingCompleted:false,onboardingVersion:1,onboardingOwnerId:uid,onboardingTourCompleted:false,homeCity:'',country:String(meta.country||''),language:String(meta.language||'en'),locationMode:'profile',unitSystem:'metric',temperatureUnit:'c',defaultWorldScope:'nearby',notificationsEnabled:true,criticalOnly:true,earthquakeEnabled:true,earthquakeMinMagnitude:3.5,earthquakeRadiusKm:100,fireEnabled:true,fireRadiusKm:100,floodEnabled:true,severeWeatherEnabled:true,newsNotificationsEnabled:false,updatedAt:now}),'Creating account preferences');
 }
 try{
  const p=await timeout(D.getProfile(),'Profile');
  if(!p?.updated_at&&(meta.name||meta.country||meta.language))await timeout(D.saveProfile({name:meta.name||'',city:p?.city||'',country:meta.country||p?.country||'',language:meta.language||p?.language||'en'}),'Creating profile');
 }catch{}
}
async function safeEnterApp(){
 // The public /lifedashpro/ route must remain a normal login page while
 // signed out. Only a valid session is allowed to bootstrap the Desktop UI.
 if(isCanonical()&&!desktopReady()){
  bootstrapDesktop();
  return;
 }
 const auth=$id('authView'),app=$id('appView'),boot=$id('boot');
 if(boot)boot.classList.add('hidden');
 if(auth)auth.classList.remove('hidden');
 if(app)app.classList.add('hidden');
 loading('Syncing your LifeDashPro account…');
 try{
  await ensureFirstRun();
  await timeout(loadAll(),'Secure cloud sync');
  clearState();
  if(auth)auth.classList.add('hidden');
  if(app)app.classList.remove('hidden');
  const r=location.hash.slice(1)||'dashboard';state.route=ROUTES[r]?r:'dashboard';setRoute(state.route);scheduleDueNotifications();
 }catch(err){
  console.error('LifeDashPro first-run recovery',err);
  if(app)app.classList.add('hidden');
  if(auth){auth.classList.remove('hidden');$id('authForms')?.classList.remove('hidden')}
  recovery(err);
  try{toast(err?.message||'Could not load LifeDashPro',true)}catch{}
  throw err;
 }
}
try{enterApp=safeEnterApp}catch{}
document.addEventListener('click',e=>{
 const retry=e.target.closest('[data-web-retry]');if(retry){e.preventDefault();void safeEnterApp().catch(()=>{});return}
 const out=e.target.closest('[data-web-signout]');if(out){e.preventDefault();void window.LifeDashData?.logout?.().finally(()=>location.replace('/lifedashpro/'))}
},true);
})();