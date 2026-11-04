import json,urllib.request,concurrent.futures,datetime
from pathlib import Path
out=Path(__file__).resolve().parent
vs=json.load(open(out/'kong-vaults.json'))
candidates=[v for v in vs if v.get('isHidden') and (v.get('tvl') or 0)>0]
def collect(v):
 try:
  url=f"https://kong.yearn.fi/api/rest/snapshot/{v['chainId']}/{v['address']}"
  d=json.load(urllib.request.urlopen(url,timeout=30))
  return {'chainId':v['chainId'],'address':v['address'],'name':v['name'],'grossUsd':v['tvl'],'yearn':d.get('yearn'),'apiVersion':d.get('apiVersion'),'origin':v.get('origin'),'inclusion':v.get('inclusion'),'valuationTime':d.get('tvl',{}).get('blockTime'),'stateTime':d.get('blockTime'),'debts':d.get('debts',[]),'asset':d.get('asset'),'totalAssets':d.get('totalAssets')}
 except Exception as e:return {'address':v['address'],'error':str(e)}
rows=list(concurrent.futures.ThreadPoolExecutor(max_workers=8).map(collect,candidates))
json.dump({'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'unreconciled','source':'https://kong.yearn.fi/api/rest/list/vaults','rows':rows},open(out/'hidden-vault-snapshots.json','w'),indent=2)
print('snapshots',len(rows),'errors',sum('error' in r for r in rows))
for r in rows:
 if r.get('grossUsd',0)>100000:print(r['name'],r['grossUsd'],r.get('yearn'),r.get('apiVersion'),[(d['strategy'],d.get('currentDebtUsd')) for d in r.get('debts',[]) if d.get('currentDebtUsd',0)>100])
