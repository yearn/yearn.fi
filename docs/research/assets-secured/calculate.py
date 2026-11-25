"""Reproduce the dated, coverage-qualified assets-secured estimate from saved evidence."""
import json
from pathlib import Path
from collections import defaultdict
D=Path(__file__).resolve().parent
def load(name): return json.loads((D/name).read_text())
graph=load('baseline-graph.json')
dated=load('dated-candidates.json')
baseline_nodes={n['id']:n for n in graph['nodes'] if n['nodeType']=='vault' and n['category']!='curation'}
baseline=sum(n['externalTvlUsd'] for n in baseline_nodes.values())
positions={r['holder'].lower():r for r in load('candidate-overlaps.json')['records']}
migrated={r['address'].lower() for r in load('katana-live-claims.json')['rows'] if r['grossUsd']>1000000}
incoming=load('incoming-holdings.json')['results']
lp=load('lp-overlaps.json')['rows']
used=defaultdict(float)
ledger=[]
for r in dated['rows']:
 a=r['address'].lower()
 if '1:'+a in baseline_nodes:
  ledger.append(dict(name=r['name'],address=a,grossUsd=r['grossUsd'],netAdditionUsd=0,reason='already in baseline'));continue
 if a in migrated:
  ledger.append(dict(name=r['name'],address=a,grossUsd=r['grossUsd'],netAdditionUsd=0,reason='bridged out; depositor asset and vault-share balances zero; residual accounting excluded'));continue
 if r['grossUsd'] is None:
  ledger.append(dict(name=r['name'],address=a,netAdditionUsd=None,reason='unavailable'));continue
 deduction=0
 details=[]
 for holder in [a]+[x.lower() for x in (r['queue'] or [])]:
  for p in positions.get(holder,{}).get('positions',[]):
   if p['ownedUsd'] is None or p['ownedUsd']<=0:continue
   target=p['target'].lower()
   ceiling=baseline_nodes.get('1:'+target,{}).get('rawTvlUsd')
   if ceiling is None: ceiling=next((x['grossUsd'] for x in dated['rows'] if x['address'].lower()==target),None)
   if ceiling is None:continue
   amount=min(p['ownedUsd'],max(0,ceiling-used[target]),max(0,r['grossUsd']-deduction))
   used[target]+=amount;deduction+=amount
   details.append(dict(kind='outgoing shares',holder=holder,target=target,usd=amount))
 for target in incoming:
  if target['target'].lower()!=a:continue
  for p in target['positions']:
   if p['kind']=='baseline-node':
    amount=min(p['ownedUsd'],max(0,r['grossUsd']-deduction))
    deduction+=amount;details.append(dict(kind='incoming direct shares',holder=p['holder'],usd=amount))
 for p in lp:
  if p['target'].lower()==a and 'Curve ' in p['name'] and 'scrvUSD' in p['name'] and p['ownedUsd'] is not None:
   amount=min(p['ownedUsd'],max(0,r['grossUsd']-deduction))
   deduction+=amount;details.append(dict(kind='incoming LP exposure',holder=p['vault'],usd=amount))
 ledger.append(dict(name=r['name'],address=a,grossUsd=r['grossUsd'],deductionUsd=deduction,netAdditionUsd=max(0,r['grossUsd']-deduction),details=details))
added=sum(r['netAdditionUsd'] or 0 for r in ledger)
result=dict(status='estimate-incomplete-coverage',asOfTimestamp=dated['asOfTimestamp'],ethereumBlock=dated['blockNumber'],baselineExcludingCurationUsd=baseline,netCandidateAdditionUsd=added,estimatedAssetsSecuredUsd=baseline+added,ledger=ledger,limitations=['Baseline reports incomplete pricing and known-candidate mapping scope.','17 non-Ethereum hidden vaults were revalued at the same close ($12,915.50 gross); their overlaps remain unresolved so they are excluded here. One further vault is already in baseline.','Octant scope covers three official mainnet factories; independently deployed Solidity multi-strategy vault coverage is not certified.','Strategy getter discovery is bounded; collateral and indirect exposure beyond mapped direct and Curve LP holdings may remain.','Baseline prices and independently fetched candidate prices share a close but use different providers.','User permits mainnet backing and active L2 representations to both count. Pre-deposit attribution/current valuation remains unresolved; the old nominal balance is not verified current backing.'])
nominal=sum(r['grossUsd'] for r in ledger if r.get('reason','').startswith('bridged out'))
result['metricPolicy']='Contract-layer exposure: mainnet backing and active L2 representations may both count; ordinary vault/strategy duplicates still reconciled.'
result['katanaRecordedBalanceScenario']={'status':'unverified-not-for-publication','recordedPredepositUsd':nominal,'combinedRecordedValueUsd':baseline+added+nominal,'reason':'Scenario only: current backing attributable to pre-deposits has not been reconciled.'}
(D/'calculation.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ['ledger','limitations']},indent=2))
print('Octant gross',sum(r['grossUsd'] for r in dated['rows'] if r.get('octant')))
print('Octant net',sum(l['netAdditionUsd'] for l in ledger if any(r.get('octant') and r['address'].lower()==l['address'] for r in dated['rows'])))
