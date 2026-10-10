/**
 * LifeDashPro Web v1.16 - authenticated, read-only RSS News gateway.
 * Same country-first / worldwide-fallback principle as Android's News widget.
 * No database writes, service_role, user-provided URLs, or automatic polling.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { XMLParser } from "npm:fast-xml-parser@4.5.3";

type Category = "top" | "world" | "business" | "technology" | "sports" | "science" | "health";
type Article = {id:string;title:string;source:string;publishedAt:string;summary:string;url:string};
type FeedResult = {items:Article[];feed:string};
const CATEGORIES = new Set<Category>(["top","world","business","technology","sports","science","health"]);
const TOPIC:Record<Exclude<Category,"top">,string> = {
  world:"WORLD",business:"BUSINESS",technology:"TECHNOLOGY",
  sports:"SPORTS",science:"SCIENCE",health:"HEALTH"
};
const EDITIONS:Record<string,string> = {
  US:"en",GB:"en",IE:"en",CA:"en",AU:"en",NZ:"en",IN:"en",ZA:"en",
  DE:"de",AT:"de",CH:"de",FR:"fr",BE:"fr",NL:"nl",IT:"it",ES:"es",
  PT:"pt-PT",BR:"pt-419",PL:"pl",CZ:"cs",SK:"sk",HU:"hu",GR:"el",
  TR:"tr",RO:"ro",IL:"he",UA:"uk",JP:"ja",KR:"ko",TW:"zh-Hant"
};
// Countries with no tested Google News local edition use explicit country search,
// not an unsupported ceid guessed from the ISO country code.
const LOCAL_QUERIES:Record<string,string> = {
  MK:"(Македонија OR Скопје)",RS:"(Србија OR Srbija)",
  BA:"(Bosna OR Hercegovina)",ME:"(Crna Gora OR Montenegro)",
  AL:"(Shqipëria OR Tirana)",XK:"(Kosovo OR Косово)",
  BG:"(България OR София)",HR:"(Hrvatska OR Zagreb)",
  SI:"(Slovenija OR Ljubljana)"
};
const SEARCH_TOPICS:Record<Category,string> = {
  top:"",world:"international OR свет",business:"economy OR економија",
  technology:"technology OR технологија",sports:"sport OR спорт",
  science:"science OR наука",health:"health OR здравје"
};
const TTL_MS=10*60*1000, MAX_CACHE=80, MAX_XML=1600000;
const FEED_TIMEOUT_MS=4900;
// Fixed, publisher-owned RSS feed URLs; never constructed from user input.
const LOCAL_FEEDS:Record<string,string[]> = {
 DE:["https://www.tagesschau.de/xml/rss2","https://rss.dw.com/rdf/rss-de-all"],
 AT:["https://rss.dw.com/rdf/rss-de-all"],
 CH:["https://rss.dw.com/rdf/rss-de-all"],
 MK:["https://meta.mk/feed/","https://www.slobodenpecat.mk/feed/"],
 RS:["https://www.danas.rs/feed/","https://n1info.rs/feed/"],
 BA:["https://n1info.ba/feed/","https://www.klix.ba/rss"],
 HR:["https://www.index.hr/rss/"],
 SI:["https://www.rtvslo.si/feeds/01.xml"],
 BG:["https://www.dnevnik.bg/rss/"],
 AL:["https://shqiptarja.com/rss"],
 GB:["https://feeds.bbci.co.uk/news/rss.xml"]
};
const WORLD_FEEDS:Record<Category,string[]> = {
 top:["https://feeds.bbci.co.uk/news/rss.xml","https://www.euronews.com/rss"],
 world:["https://feeds.bbci.co.uk/news/world/rss.xml","https://www.euronews.com/rss"],
 business:["https://feeds.bbci.co.uk/news/business/rss.xml"],
 technology:["https://feeds.bbci.co.uk/news/technology/rss.xml"],
 sports:["https://feeds.bbci.co.uk/sport/rss.xml"],
 science:["https://feeds.bbci.co.uk/news/science_and_environment/rss.xml"],
 health:["https://feeds.bbci.co.uk/news/health/rss.xml"]
};
const PINNED_HOSTS=new Set([
 "news.google.com","www.tagesschau.de","rss.dw.com","meta.mk",
 "www.slobodenpecat.mk","www.danas.rs","n1info.rs","n1info.ba",
 "www.klix.ba","www.index.hr","www.rtvslo.si","www.dnevnik.bg",
 "shqiptarja.com","feeds.bbci.co.uk","www.euronews.com"
]);
const cache=new Map<string,{at:number;value:{items:Article[];fallbackUsed:boolean;feed:string}}>();
const pending=new Map<string,Promise<{items:Article[];fallbackUsed:boolean;feed:string}>>();
const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Vary":"Origin"
};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{
  status,headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"private, no-store"}
});
function countryName(country:string):string {
  if(country==="BALKANS")return "Balkans";
  if(country==="GLOBAL")return "World";
  try{return new Intl.DisplayNames(["en"],{type:"region"}).of(country)||country}
  catch{return country}
}
function feedUrl(country:string,category:Category,forcedSearch=false):string {
  const edition=EDITIONS[country];
  const hasEdition=!!edition&&!forcedSearch;
  const locale=hasEdition?edition:"en",region=hasEdition?country:"US";
  const params=new URLSearchParams({
    hl:locale==="en"?"en-"+region:locale,gl:region,ceid:region+":"+locale
  });
  let path="https://news.google.com/rss";
  if(country==="GLOBAL") {
    if(category!=="top")path+="/headlines/section/topic/"+TOPIC[category];
  }else if(hasEdition) {
    if(category!=="top")path+="/headlines/section/topic/"+TOPIC[category];
  }else{
    path+="/search";
    const base=country==="BALKANS"?"(Balkans OR Balkan OR Балкан)":
      LOCAL_QUERIES[country]||countryName(country);
    const topic=SEARCH_TOPICS[category];
    const q=topic?"("+base+") ("+topic+") when:7d":"("+base+") when:7d";
    params.set("q",q);
  }
  return path+"?"+params.toString();
}
const parser=new XMLParser({
  ignoreAttributes:false,attributeNamePrefix:"@",textNodeName:"#text",
  trimValues:true,parseTagValue:false,parseAttributeValue:false,
  processEntities:true,ignoreDeclaration:true,removeNSPrefix:true
});
function plain(value:unknown,max=340):string {
  const s=String(value||"");
  return s.replace(/<[^>]*>/g," ").replace(/&nbsp;/gi," ")
    .replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">")
    .replace(/&#(x[0-9a-f]+|\d+);/gi,(_m,code:string)=>{
       const n=code.toLowerCase().startsWith("x")?parseInt(code.slice(1),16):parseInt(code,10);
       return n>0&&n<=0x10ffff?String.fromCodePoint(n):" ";
    })
    .replace(/\s+/g," ").trim().slice(0,max);
}
function normalizedLink(value:unknown):string {
  const src=typeof value==="string"?value:"";
  if(src.length>3000)return "";
  try{const u=new URL(src);return u.protocol==="https:"?u.toString():""}catch{return ""}
}
function parseFeed(xml:string):Article[] {
 if(xml.length>MAX_XML||/<!DOCTYPE/i.test(xml)||!/<(?:rss|rdf:RDF|feed)[\\s>]/i.test(xml))
   throw new Error("Invalid or oversized RSS feed");
 const parsed=parser.parse(xml);
 const channel=parsed?.rss?.channel||parsed?.RDF?.channel||parsed?.feed||{};
 const raw=parsed?.rss?.channel?.item??parsed?.RDF?.item??parsed?.feed?.entry??[];
 const entries=Array.isArray(raw)?raw:raw?[raw]:[];
 const feedTitle=plain(channel.title,90)||"News publisher";
 const result:Article[]=[],seen=new Set<string>();
 for(const row of entries.slice(0,75)){
   if(!row||typeof row!=="object")continue;
   const link=Array.isArray(row.link)?row.link.find((x:unknown)=>typeof x==="object"&&x!==null&&(x as Record<string,string>)["@rel"]!=="self"):row.link;
   const url=normalizedLink(typeof link==="object"&&link!==null?link["@href"]||link["#text"]:link);
   if(!url)continue;
   const origin=typeof row.source==="object"?row.source["#text"]:row.source;
   const source=plain(origin,90)||feedTitle;
   let title=plain(row.title?.["#text"]||row.title,230);
   if(source&&title.endsWith(" - "+source))title=title.slice(0,-source.length-3);
   if(!title||seen.has(title.toLowerCase()))continue;
   seen.add(title.toLowerCase());
   const date=new Date(String(row.pubDate||row.published||row.updated||row.date||""));
   const description=String(row.description?.["#text"]||row.description||row.summary?.["#text"]||row.summary||"");
   const summary=/<(?:ol|li|table)\\b/i.test(description)?"":plain(description,320);
   const id=plain(row.guid?.["#text"]||row.guid||row.id||url,150);
   result.push({id,title,source,publishedAt:Number.isFinite(date.getTime())?date.toISOString():"",summary:summary===title?"":summary,url});
   if(result.length>=24)break;
 }
 return result;
}
async function fetchFeed(url:string):Promise<FeedResult> {
 const target=new URL(url);
 if(target.protocol!=="https:"||!PINNED_HOSTS.has(target.hostname))throw new Error("RSS host rejected");
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),FEED_TIMEOUT_MS);
 try{
   const response=await fetch(url,{
     signal:controller.signal,redirect:"follow",headers:{
       "Accept":"application/rss+xml, application/xml;q=0.9, text/xml;q=0.8",
       "User-Agent":"LifeDashPro-NewsReader/1.16.1 (RSS; read-only)"
     }
   });
   if(!response.ok)throw new Error("RSS HTTP "+response.status);
   const redirected=new URL(response.url);
   if(redirected.protocol!=="https:"||!PINNED_HOSTS.has(redirected.hostname))throw new Error("RSS redirect rejected");
   const len=Number(response.headers.get("content-length")||"0");
   if(len>MAX_XML)throw new Error("RSS feed size exceeded");
   const xml=await response.text();
   if(xml.length>MAX_XML)throw new Error("RSS feed size exceeded");
   const items=parseFeed(xml);
   if(!items.length)throw new Error("No RSS headlines");
   return {items,feed:url};
 }finally{clearTimeout(timer)}
}
async function firstAvailable(urls:string[]):Promise<FeedResult> {
 if(!urls.length)throw new Error("No publishers configured");
 // Race each stage, instead of serially waiting on unreachable Google feeds.
 return await Promise.any(urls.map(url=>fetchFeed(url)));
}
async function resolve(country:string,category:Category) {
 const regional:string[]=[];
 if(category==="top"){
   if(country==="BALKANS"){
     for(const code of ["MK","RS","BA","HR"])regional.push(...(LOCAL_FEEDS[code]||[]).slice(0,1));
   }else regional.push(...(LOCAL_FEEDS[country]||[]));
 }
 if(country!=="GLOBAL")regional.push(feedUrl(country,category));
 else regional.push(...WORLD_FEEDS[category],feedUrl(country,category));
 try{
   const found=await firstAvailable([...new Set(regional)]);
   return {...found,fallbackUsed:false};
 }catch(_){}
 if(country!=="GLOBAL"){
   try{
     const found=await firstAvailable(WORLD_FEEDS[category]);
     return {...found,fallbackUsed:true};
   }catch(_){}
 }
 throw new Error("News publishers unavailable");
}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return reply({ok:false,error:"Method not allowed"},405);
  try{
    const h=req.headers.get("authorization")||"";
    const token=h.match(/^Bearer\s+(.+)$/i)?.[1]||"";
    if(!token||token.length>6000)return reply({ok:false,error:"Sign in required"},401);
    const url=Deno.env.get("SUPABASE_URL")||"";
    const anon=Deno.env.get("SUPABASE_ANON_KEY")||"";
    if(!url||!anon)return reply({ok:false,error:"Server authentication unavailable"},503);
    const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error}=await auth.auth.getUser(token);
    if(error||!data?.user)return reply({ok:false,error:"Sign in required"},401);
    const json=await req.json().catch(()=>({}));
    if(!json||typeof json!=="object"||JSON.stringify(json).length>1200)
      return reply({ok:false,error:"Invalid request"},400);
    const country=String(json.country||"DE").toUpperCase().trim();
    const category=String(json.category||"top").toLowerCase() as Category;
    if(!/^[A-Z]{2}$/.test(country)&&country!=="BALKANS"&&country!=="GLOBAL")
      return reply({ok:false,error:"Choose a valid country"},400);
    if(!CATEGORIES.has(category))return reply({ok:false,error:"Unsupported news category"},400);
    const key=country+"|"+category;
    const cached=cache.get(key);
    if(cached&&Date.now()-cached.at<TTL_MS)return reply({
      ok:true,country,category,source:"News RSS",...cached.value,
      cached:true,updatedAt:new Date(cached.at).toISOString()
    });
    if(!pending.has(key))pending.set(key,resolve(country,category));
    let value;
    try{value=await pending.get(key)!}finally{pending.delete(key)}
    cache.set(key,{at:Date.now(),value});
    if(cache.size>MAX_CACHE)cache.delete(cache.keys().next().value!);
    return reply({
      ok:true,country,category,source:"News RSS",...value,
      cached:false,updatedAt:new Date().toISOString()
    });
  }catch(e){
    console.warn("[news-rss] Public feed unavailable",e instanceof Error?e.message:"unknown");
    return reply({ok:false,error:"News feed temporarily unavailable. Please retry later."},503);
  }
});