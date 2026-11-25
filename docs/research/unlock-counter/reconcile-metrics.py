"""Explain published metrics vs pilot without changing either accounting result."""
import collections
from datetime import datetime, timezone
import html
import json
from pathlib import Path

base = Path(__file__).parent
read = lambda path: json.loads(Path(path).read_text())
pilot = read(base / 'pre-curation-pilot.json')
summary = read('/tmp/unlock-current-metrics-tvl.json')
graph = read('/tmp/unlock-current-metrics-graph.json')
inventory = read('/tmp/unlock-inventory.json')
assert summary['datasetId'] == graph['datasetId']
assert summary['asOfTimestamp'] == graph['asOfTimestamp']
assert abs(summary['totalTvl'] - graph['totalTvlUsd']) < 0.00001
identity = lambda row: f"{row['chainId']}:{row['address'].lower()}"
pilot_rows = {identity(row): row for row in pilot['entries']}
metadata = {identity(row): row for row in inventory}
metrics_rows = {row['id']: row for row in graph['nodes'] if row['nodeType'] == 'vault'}
assert abs(sum(row['externalTvlUsd'] for row in metrics_rows.values() if row['externalTvlUsd'] is not None) - summary['totalTvl']) < 0.00001
buckets = collections.defaultdict(list)
for key, row in metrics_rows.items():
    value = row['externalTvlUsd']
    if key in pilot_rows or value is None:
        continue
    meta = metadata.get(key)
    category = ('Curation excluded by pilot' if row['category'] == 'curation' else
                'V1 excluded by pilot' if row['category'] == 'v1' else
                'Retired V3 excluded by pilot' if row['category'] == 'v3' and row['isRetired'] else
                'Hidden vaults excluded by pilot' if meta and meta.get('isHidden') else
                'Absent from retained Kong inventory' if not meta else
                'Listed below $10k cutoff' if (meta.get('tvl') or 0) < 10000 else
                'Other type or inclusion exclusions')
    buckets[category].append(dict(row))
missing_price = []
pilot_only = []
shared = []
for key, entry in pilot_rows.items():
    row = metrics_rows.get(key)
    if entry['status'] != 'valued':
        if row and row['externalTvlUsd'] is not None:
            missing_price.append(dict(row))
        continue
    if not row or row['externalTvlUsd'] is None:
        pilot_only.append({**entry, 'metricsReason': 'Absent from graph' if not row else 'Metrics adjusted value unavailable'})
        continue
    shared.append({'chainId':entry['chainId'], 'address':entry['address'], 'name':entry['name'],
                   'metricsRawUsd':row['rawTvlUsd'], 'pilotHolderBeforeOverlapUsd':entry['unadjustedHolderValueUsd'],
                   'metricsOverlapUsd':row['upstreamOwnedTvlUsd'], 'pilotOverlapUsd':entry['observedOverlapUsd'],
                   'metricsExternalUsd':row['externalTvlUsd'], 'pilotExternalUsd':entry['adjustedHolderValueUsd'],
                   'deltaUsd':row['externalTvlUsd']-entry['adjustedHolderValueUsd']})
outside = sum(row['externalTvlUsd'] for rows in buckets.values() for row in rows)
priced_only_in_metrics = sum(row['externalTvlUsd'] for row in missing_price)
valued_only_in_pilot = sum(row['adjustedHolderValueUsd'] for row in pilot_only)
shared_delta = sum(row['deltaUsd'] for row in shared)
raw_delta = sum(row['metricsRawUsd']-row['pilotHolderBeforeOverlapUsd'] for row in shared)
overlap_delta = sum(row['pilotOverlapUsd']-row['metricsOverlapUsd'] for row in shared)
gap = summary['totalTvl']-pilot['aggregate']['knownSubtotalUsd']
assert abs(outside+priced_only_in_metrics-valued_only_in_pilot+shared_delta-gap) < 0.00001
assert abs(raw_delta+overlap_delta-shared_delta) < 0.00001
waterfall = [{'label':name, 'deltaUsd':sum(row['externalTvlUsd'] for row in rows)} for name, rows in buckets.items()]
waterfall += [
    {'label':'Selected pilot roots missing a price, valued in metrics', 'deltaUsd':priced_only_in_metrics},
    {'label':'Pilot-valued roots missing or unavailable in metrics', 'deltaUsd':-valued_only_in_pilot},
    {'label':'Shared valued roots: raw baseline / price / timestamp / share-value difference', 'deltaUsd':raw_delta},
    {'label':'Shared valued roots: net ownership deduction difference', 'deltaUsd':overlap_delta}
]
result = {'capturedAt':datetime.now(timezone.utc).isoformat(), 'metricsSource':'https://yearn-data-api-preview.vercel.app/api/tvl',
          'metricsDatasetId':summary['datasetId'], 'metricsTimestamp':summary['asOfTimestamp'], 'pilotTimestamp':pilot['asOfTimestamp'],
          'metricsKnownTotalUsd':summary['totalTvl'], 'pilotKnownSubtotalUsd':pilot['aggregate']['knownSubtotalUsd'],
          'gapUsd':gap, 'waterfall':waterfall, 'metricsOnlyBuckets':dict(buckets),
          'pilotUnpricedMetricsValued':missing_price, 'pilotValuedMetricsUnavailable':pilot_only,
          'sharedValuedDeltas':sorted(shared,key=lambda row:-abs(row['deltaUsd'])),
          'limitations':['Different timestamps: metrics November 3 close, pilot November 4 14:33:59 UTC.',
                         'Metrics uses gross asset valuation before ownership deductions; pilot uses holder share-conversion value.',
                         'Both known totals are incomplete; this comparison explains reported subtotals, not missing-value truth.',
                         'Omitted wrappers can already be represented through their underlying vault; adding them requires redoing ownership deductions.']}
(base/'metrics-reconciliation.json').write_text(json.dumps(result,indent=2)+'\n')
(base/'reconciliation-metrics-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
(base/'reconciliation-metrics-graph.json').write_text(json.dumps(graph,indent=2)+'\n')
format_usd = lambda value: f'${value:,.2f}'
escape = lambda value: html.escape(str(value))
def table(headers, rows):
    return '<div class="table-wrap"><table><thead><tr>'+''.join('<th>'+escape(x)+'</th>' for x in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+escape(x)+'</td>' for x in row)+'</tr>' for row in rows)+'</tbody></table></div>'
style = (base/'report.html').read_text().split('<style>')[1].split('</style>')[0]
content = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Yearn | Metrics reconciliation</title><style>'+style+'</style></head><body><main><header><a class="brand" href="multichain.html">yearn</a><span class="status">Research · Yearn-only TVL reconciliation</span></header><p class="eyebrow">Coverage and ownership</p><h1>Where does the '+format_usd(gap)+' gap come from?</h1><p>The live published metrics API confirms '+format_usd(summary['totalTvl'])+'. The static depositor-value pilot reports '+format_usd(pilot['aggregate']['knownSubtotalUsd'])+'. Their difference is '+format_usd(gap)+'.</p><p>This is mainly a scope and ownership-boundary difference. Curation alone contributes $19.63m of net metrics value outside the pilot. Hidden yETH Recovery adds $5.60m, V1 $2.38m and retired V3 $0.91m. Offsetting differences mean these amounts cannot simply be added to the pilot.</p><p class="note">Metrics timestamp: November 3, 2026 23:59:59 UTC. Pilot timestamp: November 4, 2026 14:33:59 UTC. These are not matched-time values, and both sources report incomplete coverage. The deductions below use published per-vault external values, not sums of graph flow edges.</p><h2>Exact reconciliation of reported values</h2>'
content += table(['Adjustment from pilot to metrics','USD'],[[row['label'],format_usd(row['deltaUsd'])] for row in waterfall]+[['Net difference',format_usd(gap)]])
vb = next(row for row in shared if row['chainId'] == 747474 and row['address'] == '0x80c34bd3a3569e126e7055831036aa7b212cb159')
vb_edges = [edge for edge in graph['edges'] if edge['targetNodeId'] == '747474:0x80c34bd3a3569e126e7055831036aa7b212cb159']
result['vbUsdcComparison'] = {**vb, 'metricsIncomingEdges': vb_edges}
(base/'metrics-reconciliation.json').write_text(json.dumps(result,indent=2)+'\n')
content += '<h2>Updated vbUSDC accounting</h2><p>The repaired metrics dataset values vbUSDC at '+format_usd(vb['metricsExternalUsd'])+', compared with '+format_usd(vb['pilotExternalUsd'])+' in the static pilot. The remaining difference is '+format_usd(abs(vb['deltaUsd']))+'. Metrics now deducts '+format_usd(vb['metricsOverlapUsd'])+' of ownership, compared with '+format_usd(vb['pilotOverlapUsd'])+' deducted by the static pilot. The small remaining raw-baseline difference is '+format_usd(vb['metricsRawUsd']-vb['pilotHolderBeforeOverlapUsd'])+'.</p><p>The regenerated pilot includes the DB-mapped route from Ethereum USD yVault through its Ethereum strategy and a remote Katana holder into vbUSDC, rechecked at the original pilot blocks. It also retains verified local share holdings that the DB headline graph does not deduct here. Residual differences reflect ownership scope, valuation times and price/share-value policy; the two headline values are not identical metrics.</p>'
content += '<h2>Other important offsets</h2><p>Locked yvUSD is absent because Kong gives it type “None”, which fails the pilot’s type filter. Metrics counts $4.59m there, but also deducts that same $4.59m from the underlying USD yVault. The pilot already holds that value at the underlying level. Adding the wrapper without changing ownership would double count it.</p><p>The pilot also values an $18.7k xETH factory position absent from the metrics graph.</p><h2>Largest changes among shared valued vaults</h2>'
content += table(['Vault','Metrics adjusted','Pilot adjusted','Metrics minus pilot'],[[row['name'],format_usd(row['metricsExternalUsd']),format_usd(row['pilotExternalUsd']),format_usd(row['deltaUsd'])] for row in result['sharedValuedDeltas'][:12]])
content += '<p class="note">Across shared valued roots, metrics is '+format_usd(abs(raw_delta))+' lower before deductions and takes '+format_usd(abs(overlap_delta))+' more net ownership deductions. This does not prove every individual difference is an error: the graphs, snapshot times, price policies and holder-value definitions differ. USD yVault’s wrapper deduction is the largest component. WETH roots and Curve stETH factory also need matched-block ownership comparisons.</p>'
for name, rows in sorted(buckets.items(),key=lambda item:-sum(row['externalTvlUsd'] for row in item[1])):
    content += '<details><summary>'+escape(name)+' · '+format_usd(sum(row['externalTvlUsd'] for row in rows))+'</summary>'+table(['Vault','Chain','Metrics external value'],[[row['name'],row['chainId'],format_usd(row['externalTvlUsd'])] for row in sorted(rows,key=lambda row:-row['externalTvlUsd']) if row['externalTvlUsd']>0])+'</details>'
content += '<h2>Pilot price gaps that metrics can value</h2>'+table(['Vault','Chain','Metrics external value'],[[row['name'],row['chainId'],format_usd(row['externalTvlUsd'])] for row in sorted(missing_price,key=lambda row:-row['externalTvlUsd'])])
content += '<p>Only about $0.26m of net metrics value is classified as below the pilot’s listed $10k cutoff. Lowering that cutoff is not the main fix. First agree the headline scope, use the complete ownership graph for its baseline, then apply the unlock schedules to the corresponding external share positions.</p><p><a href="metrics-reconciliation.json">Full reconciliation JSON</a> · <a href="reconciliation-metrics-summary.json">Captured metrics summary</a> · <a href="reconciliation-metrics-graph.json">Captured metrics graph</a> · <a href="multichain.html">Back to pilot</a></p></main></body></html>'
(base/'reconciliation.html').write_text(content)
print(json.dumps({'metrics':summary['totalTvl'],'pilot':pilot['aggregate']['knownSubtotalUsd'],'gap':gap,'waterfall':waterfall},indent=2))
