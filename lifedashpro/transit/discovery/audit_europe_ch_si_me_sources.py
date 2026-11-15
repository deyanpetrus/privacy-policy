#!/usr/bin/env python3
"""LifeDashPro NEXT Europe: read-only OFFICIAL GTFS source verification.
NO database writes, NO APK modifications, NO redistribution of raw feed archives.
Country CH/SI/ME source validation is a gate, not a claim of Android coverage.
"""
from __future__ import annotations
import argparse,csv,io,json,math,os,sys,urllib.request,urllib.parse,zipfile
from collections import Counter
from datetime import datetime,timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from zoneinfo import ZoneInfo
SOURCES={
 'CH':{'name':'Switzerland SKI Swiss national timetable','license':'Official SKI usage terms: needs commercial/redistribution review',
    'portal':'https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020',
    'dynamic':'ckan','limit_bytes':255*1048576,
    'centers':{'Zürich':(47.3769,8.5417),'Bern':(46.9480,7.4474),'Geneva':(46.2044,6.1432),'Basel':(47.5596,7.5886),'Lausanne':(46.5197,6.6323)}},
 'SI':{'name':'Slovenia DUJPP IJPP national GTFS','license':'CC BY-SA 4.0 per official NAP; review share-alike compliance before serving',
    'portal':'https://www.nap.si/sl/datasets_details?id=8db7cc40-3770-d834-5e15-81a0a7763f58',
    'url':'https://dujpp.si/gtfs/dujpp-ijpp.zip','limit_bytes':120*1048576,
    'centers':{'Ljubljana':(46.0569,14.5058),'Maribor':(46.5547,15.6459),'Koper':(45.5481,13.7302),'Celje':(46.2389,15.2677)}},
 'ME':{'name':'Podgorica municipal open-data bus GTFS','license':'Official Podgorica open data; explicit downstream license requires review',
    'portal':'https://podgorica.me/otvoreni-podaci/',
    'url':'https://podgorica.me/wp-content/uploads/2026/04/GTFS-v1.zip','limit_bytes':6*1048576,
    'centers':{'Podgorica':(42.4304,19.2594),'Bar':(42.0939,19.1003),'Nikšić':(42.7731,18.9445)}}
}
MAX_EXPANDED=8*1024*1048576
def demand(cond,why):
 if not cond:raise RuntimeError(why)
def rows(archive,name):
 with archive.open(name) as h:
  yield from csv.DictReader(io.TextIOWrapper(h,encoding='utf-8-sig',newline=''))
def parse_date(s):
 try:return datetime.strptime(s or '', '%Y%m%d').date()
 except ValueError:return None
def near(a,b,c,d):
 r=math.pi/180
 h=math.sin((a-c)*r/2)**2+math.cos(a*r)*math.cos(c*r)*math.sin((b-d)*r/2)**2
 return 12742.016*math.asin(math.sqrt(max(0,min(1,h))))
def swiss_url():
 year=datetime.now(ZoneInfo('Europe/Zurich')).year
 if datetime.now(ZoneInfo('Europe/Zurich')).month==12 and datetime.now(ZoneInfo('Europe/Zurich')).day>=14:year+=1
 api='https://data.opentransportdata.swiss/api/3/action/package_show?id=timetable-'+str(year)+'-gtfs2020'
 with urllib.request.urlopen(urllib.request.Request(api,headers={'User-Agent':'LifeDashPro-NEXT-CountryCoverageAudit/1.0','Accept':'application/json'}),timeout=30) as f:
  j=json.load(f)
 demand(j.get('success') is True,'Swiss CKAN package listing invalid')
 choices=[r for r in j['result'].get('resources',[]) if str(r.get('name','')).lower().endswith('.zip') and str(r.get('format','ZIP')).upper()=='ZIP']
 demand(bool(choices),'Swiss CKAN timetable ZIP missing')
 choices.sort(key=lambda r: str(r.get('name','')),reverse=True)
 url=choices[0].get('url','')
 demand(url.startswith('https://data.opentransportdata.swiss/') and '/download/' in url,'Swiss CKAN resource URL outside official host')
 return url
def download(url,dest,max_bytes):
 request=urllib.request.Request(url,headers={'User-Agent':'LifeDashPro-NEXT-CountryCoverageAudit/1.0 (+https://mkdigital.app/)','Accept':'application/zip'})
 with urllib.request.urlopen(request,timeout=90) as r,open(dest,'wb') as f:
  clen=int(r.headers.get('content-length','0') or 0)
  demand(clen<=max_bytes,'ZIP exceeds per-country compressed cap (header)')
  copied=0
  while True:
   part=r.read(1048576)
   if not part:break
   copied+=len(part)
   demand(copied<=max_bytes,'ZIP exceeds per-country compressed cap (stream)')
   f.write(part)
  demand(copied>=1000,'ZIP too small or empty')
 return copied
def inspect(country,path):
 src=SOURCES[country]
 with zipfile.ZipFile(path) as z:
  names=set(z.namelist())
  needed={'stops.txt','routes.txt','trips.txt','stop_times.txt'}
  demand(needed.issubset(names),'GTFS required files missing: '+str(sorted(needed-names)))
  demand(sum(m.file_size for m in z.infolist())<=MAX_EXPANDED,'Excessive uncompressed ZIP volume')
  centers=src['centers']
  close=Counter();total_stops=0;platform_codes=0
  for s in rows(z,'stops.txt'):
   total_stops+=1
   if total_stops>1_500_000:raise RuntimeError('Excessive stops count')
   try:a=float(s.get('stop_lat',''));b=float(s.get('stop_lon',''))
   except (ValueError,TypeError):continue
   if not math.isfinite(a) or not math.isfinite(b):continue
   if str(s.get('platform_code','')).strip():platform_codes+=1
   for city,(clat,clon) in centers.items():
    if abs(a-clat)<0.115 and abs(b-clon)<0.18 and near(a,b,clat,clon)<=6:close[city]+=1
  modes=Counter();routes_count=0
  for rt in rows(z,'routes.txt'):
   routes_count+=1
   try:t=int(rt.get('route_type',''))
   except (ValueError,TypeError):t=-1
   mode=('bus' if t==3 or 700<=t<800 else
         'train' if t==2 or 100<=t<200 else
         'tram' if t==0 or 900<=t<1000 else
         'metro' if t==1 or 400<=t<500 else
         'ferry' if t==4 else 'other')
   modes[mode]+=1
  today=datetime.now(ZoneInfo('UTC')).date()
  days={today+timedelta(days=i) for i in range(0,8)}
  active=set()
  if 'calendar.txt' in names:
   for r in rows(z,'calendar.txt'):
    first,last=parse_date(r.get('start_date')),parse_date(r.get('end_date'))
    if not first or not last:continue
    if any(first<=day<=last and r.get(('monday','tuesday','wednesday','thursday','friday','saturday','sunday')[day.weekday()])=='1' for day in days):active.add(r.get('service_id'))
  if 'calendar_dates.txt' in names:
   for r in rows(z,'calendar_dates.txt'):
    day=parse_date(r.get('date'))
    if day not in days:continue
    if r.get('exception_type')=='1':active.add(r.get('service_id'))
    elif r.get('exception_type')=='2':active.discard(r.get('service_id'))
  has_calendar=('calendar.txt' in names or 'calendar_dates.txt' in names)
  active_trips=0;sample_routes=Counter()
  for tr in rows(z,'trips.txt'):
   if tr.get('service_id') in active:
    active_trips+=1
    if active_trips>3_000_000:raise RuntimeError('Active trips exceed safe audit memory/row cap')
  return {'gtfs_schema_valid':True,'has_calendar':has_calendar,'active_service_ids_next_7d':len(active),
    'active_trips_next_7d':active_trips,'stop_records':total_stops,'stops_with_platform_code':platform_codes,
    'stops_within_6km_of_city':{k:int(close[k]) for k in centers},
    'route_records':routes_count,'route_types':dict(modes),
    'schedule_usable_today':has_calendar and bool(active) and active_trips>0}
def main():
 p=argparse.ArgumentParser();p.add_argument('--country',choices=sorted(SOURCES),required=True)
 p.add_argument('--output-dir',default='coverage-out');a=p.parse_args()
 country=a.country;src=SOURCES[country];d=Path(a.output_dir);d.mkdir(parents=True,exist_ok=True)
 report={'country':country,'source_name':src['name'],'portal':src['portal'],'license_note':src['license'],
   'generated_at':datetime.now(ZoneInfo('UTC')).isoformat(),'writes_to_supabase':False,
   'note':'Discovery ONLY. Not imported into LifeDashPro NEXT; no Android availability claim.'}
 try:
  url=swiss_url() if country=='CH' else src['url']
  report['download_url']=url
  with TemporaryDirectory(prefix='ldp-next-eu-audit-') as tmp:
   f=Path(tmp)/'official.zip'
   report['zip_bytes']=download(url,f,src['limit_bytes'])
   report.update(inspect(country,f))
  report['audit_status']='validated' if report['schedule_usable_today'] else 'stale_timetable'
 except Exception as exc:
  report['audit_status']='source_error'
  report['safe_error']=str(exc)[:250] if isinstance(exc,RuntimeError) else type(exc).__name__
 (d/f'{country}_official_gtfs_source_audit.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
 print('EUROPE_COUNTRY_GTFS_AUDIT '+json.dumps(report,ensure_ascii=False),flush=True)
 # Treat a stale/unavailable feed as an audit result; do not quietly promote it to runtime.
if __name__=='__main__':main()
