import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { createGlobalModel, nodeKey } from './global-model.mjs'

const directory = new URL('./', import.meta.url)
const read = (name) => JSON.parse(fs.readFileSync(new URL(name, directory)))
const write = (name, value) => fs.writeFileSync(new URL(name, directory), JSON.stringify(value, null, 2) + '\n')
const previous = read('multichain-chain-local-pilot.json')
const routes = read('db-ownership-routes.json')
const graph = read('db-ownership-graph.json')
assert.equal(routes.ownershipDatasetId, graph.datasetId)
assert.equal(routes.asOfTimestamp, previous.asOfTimestamp)
assert.equal(routes.coverage.unavailableRoutes, 0, 'Resolve unavailable route reads first')
const t0 = previous.asOfTimestamp
const rows = previous.chains.flatMap((chain) => {
  const snapshot = read(chain.artifacts.snapshot)
  return snapshot.rows.map((row) => ({
    ...row,
    version: row.version || 'v3',
    chainId: chain.chainId,
    chainName: chain.name,
    snapshotTimestamp: Number(snapshot.timestamp),
    blockNumber: snapshot.blockNumber
  }))
})
const { roots, priceAt, usdValueAt, shareValueAt } = createGlobalModel(rows, t0)
const attributionRows = rows.map((row) => ({
  chain_id: row.chainId,
  vault: row.address.toLowerCase(),
  name: row.name,
  version: row.version,
  category: row.version,
  timestamp: t0,
  block_number: Number(row.blockNumber),
  tvl_usd: usdValueAt(row, row.reads.totalAssets)?.toString() ?? null
}))
const positions = routes.positions.map((route) => {
  const parent = roots.get(nodeKey(route.parentChainId, route.parent))
  const child = roots.get(nodeKey(route.childChainId, route.child))
  const owned = shareValueAt(child, route.sharesRaw)
  const debt = route.debtRaw === null ? owned : usdValueAt(parent, route.debtRaw)
  return {
    chain_id: route.parentChainId,
    child_chain_id: route.childChainId,
    parent: route.parent,
    strategy: route.strategy,
    remote_holder: route.holder,
    child: route.child,
    timestamp: t0,
    block_number: Number(route.sourceBlock.number),
    child_block_number: Number(route.childBlock.number),
    method: route.method,
    debt_usd: debt?.toString() ?? null,
    owned_usd: owned?.toString() ?? null,
    status: owned === null || debt === null ? 'unavailable' : 'ok',
    balance_raw: route.sharesRaw,
    source: route.source,
    graph_edge_id: route.graphEdgeId ?? null,
    direct: route.direct
  }
})
assert(process.env.METRICS_SOURCE, 'Set METRICS_SOURCE to the canonical Yearn Data engine checkout')
const input = { timestamp: t0, rows: attributionRows, positions }
const result = spawnSync(
  process.env.METRICS_PYTHON || 'python3',
  [new URL('apply-ledger.py', directory).pathname, '--metrics-source', process.env.METRICS_SOURCE],
  { input: JSON.stringify([input]), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 20000 }
)
if (result.status !== 0) throw new Error(`Canonical ledger failed: ${result.stderr || result.error?.message}`)
const audit = JSON.parse(result.stdout)
const allocations = audit.frames[0].positions.map((position) => {
  const child = roots.get(nodeKey(position.child_chain_id, position.child))
  const shares = position.direct ? position.balance_raw : position.allocated_shares_raw
  return {
    chainId: position.chain_id,
    parentChainId: position.chain_id,
    childChainId: position.child_chain_id,
    chainName: previous.chains.find((chain) => chain.chainId === position.chain_id).name,
    parent: position.parent,
    holder: position.remote_holder,
    strategy: position.strategy,
    child: position.child,
    method: position.direct ? 'exact-direct-share-ownership' : 'canonical-shared-holder-budget',
    observedSharesRaw: position.balance_raw,
    canonicalAllocatedSharesRaw: position.allocated_shares_raw,
    attributedSharesRaw: shares,
    canonicalOverlapUsd: position.overlap_usd,
    attributedHolderValueUsd: shares === null ? null : shareValueAt(child, shares),
    source: position.source,
    graphEdgeId: position.graph_edge_id,
    reason: position.reason ?? null
  }
})
const incoming = (row) =>
  allocations
    .filter((position) => nodeKey(position.childChainId, position.child) === nodeKey(row.chainId, row.address))
    .reduce((sum, position) => sum + BigInt(position.attributedSharesRaw ?? '0'), 0n)
const unresolved = new Set(
  allocations
    .filter((position) => position.attributedSharesRaw === null)
    .map((position) => nodeKey(position.childChainId, position.child))
)
const entries = rows.map((row) => {
  const key = nodeKey(row.chainId, row.address)
  const internal = incoming(row)
  const held = BigInt(row.holderShares)
  assert(internal <= held, `Incoming attributed shares exceed holder supply: ${key}`)
  const external = held - internal
  const priced = priceAt(row, t0) !== null
  const available = priced && !unresolved.has(key)
  const baseline = available ? shareValueAt(row, external) : null
  const raw = available ? shareValueAt(row, held) : null
  return {
    chainId: row.chainId,
    chainName: row.chainName,
    address: row.address.toLowerCase(),
    name: row.name,
    version: row.version,
    isFactory: Boolean(row.isFactory),
    isRetired: Boolean(row.isRetired),
    status: available ? 'valued' : 'unavailable',
    reason: !priced ? 'missing USD asset price' : unresolved.has(key) ? 'unresolved ownership allocation' : null,
    nonSelfHolderSharesRaw: String(held),
    attributedInternalSharesRaw: String(internal),
    attributedExternalSharesRaw: String(external),
    unadjustedHolderValueUsd: raw,
    adjustedHolderValueUsd: baseline,
    observedOverlapUsd: available ? raw - baseline : null,
    averageNextMinuteUsdPerSecond: available ? (shareValueAt(row, external, t0 + 60) - baseline) / 60 : null
  }
})
const offsets = [
  ...new Set([
    0,
    1,
    ...Array.from({ length: 60 }, (_, i) => (i + 1) * 60),
    ...rows
      .map((row) => Number(row.reads.fullProfitUnlockDate) - t0)
      .filter((value) => value > 0 && value <= 3600)
      .flatMap((value) => [value - 1, value, value + 1]),
    86400
  ])
].toSorted((a, b) => a - b)
const frame = (subset, time) =>
  subset
    .filter((entry) => entry.status === 'valued')
    .reduce(
      (sum, entry) =>
        sum + shareValueAt(roots.get(nodeKey(entry.chainId, entry.address)), entry.attributedExternalSharesRaw, time),
      0
    )
const aggregate = (subset) => {
  const baseline = frame(subset, t0)
  return {
    completeValueUsd: null,
    knownSubtotalUsd: baseline,
    unadjustedKnownSubtotalUsd: subset.reduce((sum, entry) => sum + (entry.unadjustedHolderValueUsd ?? 0), 0),
    observedOverlapUsd: subset.reduce((sum, entry) => sum + (entry.observedOverlapUsd ?? 0), 0),
    averageNextMinuteUsdPerSecond: (frame(subset, t0 + 60) - baseline) / 60,
    unadjustedAverageNextMinuteUsdPerSecond: subset
      .filter((entry) => entry.status === 'valued')
      .reduce((sum, entry) => {
        const row = roots.get(nodeKey(entry.chainId, entry.address))
        return sum + (shareValueAt(row, entry.nonSelfHolderSharesRaw, t0 + 60) - entry.unadjustedHolderValueUsd) / 60
      }, 0),
    nextHourIncreaseUsd: frame(subset, t0 + 3600) - baseline,
    next24HoursIncreaseUsd: frame(subset, t0 + 86400) - baseline
  }
}
const projection = (subset) => ({
  fromTimestamp: t0,
  validUntilTimestamp: t0 + 3600,
  interpolation:
    'Linear between published timestamps; values are recomputed from frozen external share positions, with base prices and contract state fixed.',
  points: offsets
    .filter((offset) => offset <= 3600)
    .map((offset) => ({ timestamp: t0 + offset, knownSubtotalUsd: frame(subset, t0 + offset) })),
  comparisonAfter24Hours: { timestamp: t0 + 86400, knownSubtotalUsd: frame(subset, t0 + 86400) }
})
const changed = entries
  .map((entry) => {
    const old = previous.entries.find((item) => item.chainId === entry.chainId && item.address === entry.address)
    return {
      chainId: entry.chainId,
      address: entry.address,
      name: entry.name,
      previousValueUsd: old.adjustedHolderValueUsd,
      valueUsd: entry.adjustedHolderValueUsd,
      valueChangeUsd:
        old.adjustedHolderValueUsd === null || entry.adjustedHolderValueUsd === null
          ? null
          : entry.adjustedHolderValueUsd - old.adjustedHolderValueUsd,
      previousRateUsdPerSecond: old.averageNextMinuteUsdPerSecond,
      rateUsdPerSecond: entry.averageNextMinuteUsdPerSecond
    }
  })
  .filter((entry) => entry.valueChangeUsd !== 0 && entry.valueChangeUsd !== null)
  .toSorted((a, b) => Math.abs(b.valueChangeUsd) - Math.abs(a.valueChangeUsd))
const payload = {
  ...previous,
  schemaVersion: 'depositor-value-multichain-pilot-2',
  modelVersion: 'global-fixed-share-attribution-db-graph-v3',
  generatedAt: new Date().toISOString(),
  scope: {
    ...previous.scope,
    label: 'Same 157 selected V2/V3 roots; unified ownership graph including verified cross-chain routes',
    valuedRootCount: entries.filter((entry) => entry.status === 'valued').length,
    ownershipBoundary:
      'Selected roots across all screened chains in one canonical ledger. Updated DB mapping identities plus pinned queue/direct observations; cross-chain remote holders verified at destination block.',
    excludedFromScope: previous.scope.excludedFromScope
      .filter((value) => !value.includes('cross-chain'))
      .concat('Unobserved historical routes/adapters; parents and children outside the selected roots')
  },
  aggregate: aggregate(entries),
  coverage: {
    ...previous.coverage,
    unavailableRoots: entries
      .filter((entry) => entry.status !== 'valued')
      .map((entry) => ({
        chainId: entry.chainId,
        chainName: entry.chainName,
        address: entry.address,
        name: entry.name,
        reason: entry.reason
      })),
    appliedPositionCount: allocations.filter((position) => BigInt(position.attributedSharesRaw ?? '0') > 0n).length,
    verifiedOwnershipRoutes: routes.positions.length,
    crossChainRoutes: allocations.filter((position) => position.parentChainId !== position.childChainId).length,
    limitations: previous.coverage.limitations
      .filter((value) => !value.includes('Cross-chain bridges'))
      .concat(
        'Known DB cross-chain mappings were revalidated at the pilot blocks; unobserved routes and out-of-scope endpoints still leave this a scoped incomplete pilot.'
      )
  },
  projection: projection(entries),
  ownershipGraph: {
    datasetId: graph.datasetId,
    mappingTimestamp: graph.asOfTimestamp,
    pilotTimestamp: t0,
    mappingUse: 'Identity discovery only; no historical dollar allocation or ownership ratio copied into the pilot',
    routeReads: 'db-ownership-routes.json',
    graph: 'db-ownership-graph.json',
    ledgerInputs: 'global-pilot-ledger-inputs.json',
    ledgerAudit: 'global-pilot-ledger-audit.json'
  },
  engines: [audit.engine],
  allocations,
  entries,
  comparisonWithChainLocal: {
    previousAggregate: previous.aggregate,
    valueChangeUsd: aggregate(entries).knownSubtotalUsd - previous.aggregate.knownSubtotalUsd,
    rateChangeUsdPerSecond:
      aggregate(entries).averageNextMinuteUsdPerSecond - previous.aggregate.averageNextMinuteUsdPerSecond,
    changedRoots: changed
  }
}
payload.chains = previous.chains.map((chain) => {
  const selected = entries.filter((entry) => entry.chainId === chain.chainId)
  const missing = payload.coverage.unavailableRoots.filter((entry) => entry.chainId === chain.chainId)
  const chainPayload = {
    sourceBlock: { chainId: chain.chainId, ...chain.sourceBlock },
    schemaVersion: payload.schemaVersion,
    modelVersion: payload.modelVersion,
    asOfTimestamp: t0,
    scope: {
      ...chain.scope,
      valuedRootCount: selected.filter((entry) => entry.status === 'valued').length,
      ownershipBoundary: payload.scope.ownershipBoundary
    },
    aggregate: aggregate(selected),
    coverage: {
      unavailableRoots: missing,
      cutoffUnknownCandidates: previous.coverage.cutoffUnknownCandidates.filter(
        (entry) => entry.chainId === chain.chainId
      )
    },
    projection: projection(selected),
    entries: selected,
    ownershipGraph: payload.ownershipGraph
  }
  const artifact = `global-chain-${chain.chainId}-pilot.json`
  write(artifact, chainPayload)
  return {
    ...chain,
    scope: chainPayload.scope,
    aggregate: chainPayload.aggregate,
    coverage: {
      ...chain.coverage,
      priced: chainPayload.scope.valuedRootCount,
      unavailable: missing.length,
      appliedPositions: allocations.filter(
        (position) => position.childChainId === chain.chainId && BigInt(position.attributedSharesRaw ?? '0') > 0n
      ).length
    },
    artifacts: {
      ...chain.artifacts,
      pilot: artifact,
      ledger: 'global-pilot-ledger-audit.json',
      holdings: 'db-ownership-routes.json'
    }
  }
})
write('global-pilot-ledger-inputs.json', input)
write('global-pilot-ledger-audit.json', audit)
write('pre-curation-pilot.json', payload)
console.log(
  JSON.stringify(
    {
      aggregate: payload.aggregate,
      coverage: {
        valued: payload.scope.valuedRootCount,
        unavailable: payload.coverage.unavailableRoots.length,
        routes: routes.positions.length,
        applied: payload.coverage.appliedPositionCount,
        crossChain: payload.coverage.crossChainRoutes
      },
      changes: changed
    },
    null,
    2
  )
)
