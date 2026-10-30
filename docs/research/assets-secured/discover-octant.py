import subprocess
import urllib.request,json,urllib.parse
from pathlib import Path
out=Path(__file__).resolve().parent
factories=['0xbe5352d0eCdB13D9f74c244B634FdD729480Bb6F','0x052d20B0e0b141988bD32772C735085e45F357c1','0x6D8c4E4A158083E30B53ba7df3cFB885fC096fF6']
logs=[]
for factory in factories:
 url=f'https://eth.blockscout.com/api/v2/addresses/{factory}/logs'
 while url:
  d=json.loads(subprocess.check_output(["curl","-fsS",url]))
  for x in d['items']:
   if x.get('decoded',{}).get('method_id')=='c5ef13ed':
    args={p['name']:p['value'] for p in x['decoded']['parameters']}
    logs.append({'address':factory,'blockNumber':x['block_number'],'transactionHash':x['transaction_hash'],'args':args})
  params=d.get('next_page_params');url=f'https://eth.blockscout.com/api/v2/addresses/{factory}/logs?'+urllib.parse.urlencode(params) if params else None
json.dump({'source':'https://eth.blockscout.com/api/v2/addresses/{factory}/logs','factories':factories,'logs':logs},open(out/'octant-deployments.json','w'),indent=2)
print([(x['args']['vaultTokenName'],x['args']['strategyAddress']) for x in logs])
