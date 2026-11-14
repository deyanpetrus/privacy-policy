#!/usr/bin/env python3
"""Read-only Mobility Database API auth smoke test. Never prints credentials."""
import json,os,sys
from urllib.request import Request,urlopen
from urllib.parse import urlencode
from urllib.error import HTTPError,URLError
BASE="https://api.mobilitydatabase.org/v1"
def req(path,method="GET",body=None,token=None):
    headers={"accept":"application/json","user-agent":"LifeDashPro-Transit-Mobility-Discovery/1.0"}
    if body is not None:headers["content-type"]="application/json"
    if token:headers["authorization"]="Bearer "+token
    request=Request(BASE+path,method=method,headers=headers,data=None if body is None else json.dumps(body).encode())
    try:
        with urlopen(request,timeout=20) as response:
            return json.load(response)
    except HTTPError as e:
        raise RuntimeError("API_HTTP_"+str(e.code)) from None
    except (URLError,TimeoutError,ValueError) as e:
        raise RuntimeError("API_REQUEST_ERROR_"+type(e).__name__) from None
def main():
    secret=os.environ.get("MOBILITY_DATABASE_REFRESH_TOKEN","").strip()
    if not secret:raise RuntimeError("MISSING_GITHUB_SECRET_MOBILITY_DATABASE_REFRESH_TOKEN")
    login=req("/tokens","POST",{"refresh_token":secret})
    token=login.get("access_token") if isinstance(login,dict) else None
    if not isinstance(token,str) or len(token)<25:raise RuntimeError("ACCESS_TOKEN_NOT_RETURNED")
    print("MOBILITY_API_AUTH_OK")
    metadata=req("/metadata",token=token)
    if not isinstance(metadata,dict):raise RuntimeError("METADATA_RESPONSE_UNEXPECTED")
    print("MOBILITY_METADATA_OK")
    for country in ("DE","MK","RS"):
        rows=req("/gtfs_feeds?"+urlencode({"country_code":country,"limit":5,"offset":0}),token=token)
        if not isinstance(rows,list):raise RuntimeError("GTFS_FEEDS_RESPONSE_NOT_ARRAY_"+country)
        print("MOBILITY_COUNTRY_OK "+country+" samples="+str(len(rows))+" sample_ids="+",".join(str(x.get("id",""))[:40] for x in rows if isinstance(x,dict)))
    print("MOBILITY_API_SECRET_AND_FEED_ACCESS_PASS")
if __name__=="__main__":
    try:main()
    except Exception as e:
        print("MOBILITY_PROBE_FAILED "+(str(e) if isinstance(e,RuntimeError) else type(e).__name__),file=sys.stderr)
        sys.exit(1)
