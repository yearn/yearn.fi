import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { convertSharesAt, projectedAssets } from './model.mjs'

const directory = new URL('./', import.meta.url)
const prefix = process.env.PILOT_PREFIX || ''
const read = (file) => JSON.parse(fs.readFileSync(new URL(file, directory)))
const snapshot = read(`${prefix}snapshot.json`)
const trace = read(`${prefix}overlap-trace.json`)
const holdings = read(`${prefix}internal-holdings.json`)
if (holdings.positions.some((position) => position.status !== 'success'))
  throw new Error('Resolve unavailable holder reads before generating the pilot')
const roots = new Map(snapshot.rows.map((row) => [row.address.toLowerCase(), row]))
const t0 = Number(snapshot.targetTimestamp || snapshot.timestamp)
const chainId = snapshot.chainId || 1
const expiryOffsets = snapshot.rows
  .map((row) => Number(row.reads.fullProfitUnlockDate) - t0)
  .filter((offset) => offset > 0 && offset <= 3600)
const offsets = [
  ...new Set([
    0,
    1,
    ...Array.from({ length: 60 }, (_, i) => (i + 1) * 60),
    ...expiryOffsets.flatMap((n) => [n - 1, n, n + 1]),
    86400
  ])
].toSorted((a, b) => a - b)
const priceAt = (row, timestamp, seen = new Set()) => {
  const address = row.address.toLowerCase()
  if (seen.has(address)) throw new Error('Cyclic share-token pricing')
  const child = roots.get(row.reads.asset.toLowerCase())
  if (child) {
    const childPrice = priceAt(child, timestamp, new Set([...seen, address]))
    if (childPrice === null) return null
    const shareUnit = 10n ** BigInt(row.assetMetadata.decimals)
    const converted = convertSharesAt(child, shareUnit, t0, timestamp)
    return (Number(converted) / 10 ** child.assetMetadata.decimals) * childPrice
  }
  return Number.isFinite(row.price?.price) && row.price.price > 0 ? row.price.price : null
}
const usdValueAt = (row, units, timestamp) => {
  const price = priceAt(row, timestamp)
  return price === null ? null : (Number(units) / 10 ** row.assetMetadata.decimals) * price
}
const matchingEdge = (parent, child) =>
  trace.edges.find((edge) => edge.parent.toLowerCase() === parent && edge.child.toLowerCase() === child)
const descriptors = holdings.positions.flatMap((holding) => {
  if (holding.status !== 'success') return []
  const directParent = roots.get(holding.holder)
  if (directParent) {
    const edge = matchingEdge(holding.holder, holding.child)
    const isAsset = directParent.reads.asset.toLowerCase() === holding.child
    return [
      {
        parent: holding.holder,
        holder: holding.holder,
        child: holding.child,
        shares: isAsset ? directParent.reads.totalAssets : holding.shares,
        method: isAsset
          ? 'vault-asset'
          : edge?.recordedDebt !== null && edge?.recordedDebt !== undefined
            ? 'direct-strategy'
            : 'vault-held-shares',
        debtRaw: isAsset ? null : (edge?.recordedDebt ?? null),
        source: isAsset
          ? 'asset-token dependency, totalAssets in child shares'
          : edge
            ? 'pinned direct strategy/holder observation'
            : 'pinned unregistered direct token holding'
      }
    ]
  }
  return trace.edges
    .filter((edge) => edge.child.toLowerCase() === holding.holder && edge.recordedDebt !== null)
    .map((edge) => ({
      parent: edge.parent.toLowerCase(),
      holder: holding.holder,
      child: holding.child,
      shares: holding.shares,
      method: 'strategy-held-shares',
      debtRaw: edge.recordedDebt,
      source: 'pinned strategy debt plus same-block child balance'
    }))
})
const attributionRows = snapshot.rows.map((row) => ({
  chain_id: chainId,
  vault: row.address.toLowerCase(),
  name: row.name,
  version: row.version || 'v3',
  category: row.version || 'v3',
  timestamp: t0,
  block_number: Number(snapshot.blockNumber),
  tvl_usd: usdValueAt(row, BigInt(row.reads.totalAssets), t0)?.toString() ?? null
}))
const positions = descriptors
  .filter((edge) => edge.parent !== edge.child)
  .map((edge) => {
    const parent = roots.get(edge.parent)
    const child = roots.get(edge.child)
    const owned = usdValueAt(child, convertSharesAt(child, edge.shares, t0, t0), t0)
    const debt = edge.method === 'vault-asset' || edge.debtRaw === null ? owned : usdValueAt(parent, edge.debtRaw, t0)
    return {
      chain_id: chainId,
      parent: edge.parent,
      strategy: edge.holder,
      child: edge.child,
      timestamp: t0,
      block_number: Number(snapshot.blockNumber),
      child_block_number: Number(snapshot.blockNumber),
      method: edge.method,
      debt_usd: debt?.toString() ?? null,
      owned_usd: owned?.toString() ?? null,
      status: debt === null || owned === null ? 'unavailable' : 'ok',
      source: edge.source,
      balance_raw: edge.shares
    }
  })
if (!process.env.METRICS_SOURCE)
  throw new Error('Set METRICS_SOURCE to the yearn-data checkout containing the canonical account engine')
const inputs = [{ timestamp: t0, rows: attributionRows, positions }]
const result = spawnSync(
  process.env.METRICS_PYTHON || 'python3',
  [new URL('./apply-ledger.py', import.meta.url).pathname, '--metrics-source', process.env.METRICS_SOURCE],
  { input: JSON.stringify(inputs), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 20000 }
)
if (result.status !== 0) throw new Error(`Canonical ledger failed: ${result.stderr || result.error?.message}`)
const audit = JSON.parse(result.stdout)
const allocations = audit.frames[0].positions.map((position) => {
  const direct = position.strategy === position.parent
  return {
    parent: position.parent,
    holder: position.strategy,
    child: position.child,
    method: direct ? 'exact-direct-share-ownership' : 'canonical-shared-holder-budget',
    observedSharesRaw: position.balance_raw,
    canonicalAllocatedSharesRaw: position.allocated_shares_raw,
    attributedSharesRaw: direct ? position.balance_raw : position.allocated_shares_raw,
    canonicalOverlapUsd: position.overlap_usd,
    reason: direct
      ? 'Direct internal ownership excludes the actual shares even when parent recorded debt or locking makes its conversion value smaller'
      : 'Frozen at snapshot using the canonical metrics debt budget, shared-holder splitting and caps'
  }
})
allocations.forEach((position) => {
  const child = roots.get(position.child)
  position.attributedHolderValueUsd =
    position.attributedSharesRaw === null
      ? null
      : usdValueAt(child, convertSharesAt(child, position.attributedSharesRaw, t0, t0), t0)
})
const incoming = (address) =>
  allocations
    .filter((position) => position.child === address)
    .reduce((sum, position) => sum + BigInt(position.attributedSharesRaw ?? '0'), 0n)
const unresolvedChildren = new Set(
  allocations.filter((position) => position.attributedSharesRaw === null).map((position) => position.child)
)
const entries = snapshot.rows.map((row) => {
  const address = row.address.toLowerCase()
  const internal = incoming(address)
  const holders = BigInt(row.holderShares)
  if (internal > holders) throw new Error(`Attributed shares exceed non-self holder supply: ${row.name}`)
  const price = priceAt(row, t0)
  const available = price !== null && !unresolvedChildren.has(address)
  const external = holders - internal
  const valueAt = (timestamp) =>
    available ? usdValueAt(row, convertSharesAt(row, external, t0, timestamp), timestamp) : null
  const baseline = valueAt(t0)
  return {
    chainId,
    address,
    name: row.name,
    version: row.version || 'v3',
    isFactory: Boolean(row.isFactory),
    isRetired: Boolean(row.isRetired),
    status: available ? 'valued' : 'unavailable',
    reason:
      price === null
        ? 'missing USD asset price'
        : unresolvedChildren.has(address)
          ? 'unresolved ownership allocation'
          : null,
    nonSelfHolderSharesRaw: String(holders),
    attributedInternalSharesRaw: String(internal),
    attributedExternalSharesRaw: String(external),
    unadjustedHolderValueUsd: available ? usdValueAt(row, projectedAssets(row, t0, t0), t0) : null,
    adjustedHolderValueUsd: baseline,
    observedOverlapUsd: available ? usdValueAt(row, projectedAssets(row, t0, t0), t0) - baseline : null,
    averageNextMinuteUsdPerSecond: available ? (valueAt(t0 + 60) - baseline) / 60 : null
  }
})
const frameAt = (timestamp) =>
  entries.reduce(
    (frame, entry) => {
      if (entry.status !== 'valued') return frame
      const row = roots.get(entry.address)
      const unadjusted = usdValueAt(row, projectedAssets(row, t0, timestamp), timestamp)
      const adjusted = usdValueAt(
        row,
        convertSharesAt(row, entry.attributedExternalSharesRaw, t0, timestamp),
        timestamp
      )
      return {
        timestamp,
        observedUnadjustedUsd: frame.observedUnadjustedUsd + unadjusted,
        observedOverlapUsd: frame.observedOverlapUsd + unadjusted - adjusted,
        knownSubtotalUsd: frame.knownSubtotalUsd + adjusted
      }
    },
    { timestamp, observedUnadjustedUsd: 0, observedOverlapUsd: 0, knownSubtotalUsd: 0 }
  )
const frames = offsets.map((offset) => frameAt(t0 + offset))
const baseline = frames[0]
const minute = frames.find((frame) => frame.timestamp === t0 + 60)
const hour = frames.find((frame) => frame.timestamp === t0 + 3600)
const day = frames.find((frame) => frame.timestamp === t0 + 86400)
const payload = {
  schemaVersion: 'depositor-value-pilot-1',
  modelVersion: prefix ? 'fixed-share-attribution-v2-v3-unlock-v2' : 'fixed-share-attribution-unlock-v1',
  status: 'incomplete-pilot',
  generatedAt: new Date().toISOString(),
  asOfTimestamp: t0,
  sourceBlock: {
    chainId,
    number: snapshot.blockNumber,
    hash: snapshot.blockHash,
    timestamp: Number(snapshot.timestamp)
  },
  scope: {
    label:
      snapshot.selection?.pilotLabel ||
      (prefix
        ? 'Closed Ethereum V2/V3 pilot, including factory vaults and funded retired V2 allocators, $10k cutoff'
        : 'Closed Ethereum V3 pilot, $10k listed-TVL cutoff'),
    selectedRootCount: snapshot.rows.length,
    valuedRootCount: entries.filter((row) => row.status === 'valued').length,
    definition:
      'Non-self holder share-conversion value minus attributed internal share positions. Exact direct ownership; canonical metrics budgets and caps allocate routed positions once at the snapshot. Not a complete holder census or immediately withdrawable liquidity.',
    excludedFromScope: [
      'Other chains (combined separately using chain-scoped positions)',
      prefix ? 'V1 and curation-only roots' : 'V1/V2 and curation-only roots',
      prefix ? 'Hidden and sub-cutoff roots; retired V3 roots' : 'Hidden, retired and sub-cutoff roots'
    ],
    dependencies: 'Observed queue strategies are included for routing even when not selected roots'
  },
  aggregate: {
    completeValueUsd: null,
    knownSubtotalUsd: baseline.knownSubtotalUsd,
    unadjustedKnownSubtotalUsd: baseline.observedUnadjustedUsd,
    observedOverlapUsd: baseline.observedOverlapUsd,
    averageNextMinuteUsdPerSecond: (minute.knownSubtotalUsd - baseline.knownSubtotalUsd) / 60,
    unadjustedAverageNextMinuteUsdPerSecond: (minute.observedUnadjustedUsd - baseline.observedUnadjustedUsd) / 60,
    nextHourIncreaseUsd: hour.knownSubtotalUsd - baseline.knownSubtotalUsd,
    next24HoursIncreaseUsd: day.knownSubtotalUsd - baseline.knownSubtotalUsd
  },
  coverage: {
    status: 'incomplete',
    unavailableRoots: entries
      .filter((row) => row.status === 'unavailable')
      .map((row) => ({ chainId, address: row.address, name: row.name, reason: row.reason })),
    checkedHolderPairs: holdings.checkedPairs,
    cutoffUnknownCandidates: snapshot.selection?.v2CutoffUnknown ?? [],
    observedPositiveHoldings: holdings.positions.length,
    appliedPositionCount: allocations.filter((position) => BigInt(position.attributedSharesRaw ?? '0') > 0n).length,
    limitations: [
      'Ownership discovery covers observed queues/direct holders, not all historical allocations, adapters or cross-chain routes',
      'Internal ownership is relative to selected pilot roots, not all Yearn contracts',
      'Routed attribution uses recorded-debt caps; residual unreported strategy-owned appreciation is not proof of external wallet ownership',
      'Base asset prices are frozen historical quotes; selected share-token underlying is repriced through the child conversion',
      'No future reports, deposits, withdrawals, losses, configuration changes or new accrual beyond scheduled unlocking are assumed'
    ]
  },
  projection: {
    fromTimestamp: t0,
    validUntilTimestamp: t0 + 3600,
    validUntilMeaning: 'End of this historical pilot projection, not an assertion the snapshot remains live',
    interpolation: 'linear between supplied timestamps; stop at validUntilTimestamp and request a refreshed snapshot',
    points: frames
      .filter((frame) => frame.timestamp <= t0 + 3600)
      .map((frame) => ({ timestamp: frame.timestamp, knownSubtotalUsd: frame.knownSubtotalUsd })),
    comparisonAfter24Hours: day
  },
  engine: {
    ...audit.engine,
    use: 'Snapshot ownership budgets for routed positions; exact balances for direct internal holdings; no repeated future-dollar deductions'
  },
  allocations,
  entries
}
fs.writeFileSync(new URL(`${prefix}pilot-depositor-value.json`, directory), JSON.stringify(payload, null, 2) + '\n')
fs.writeFileSync(new URL(`${prefix}pilot-ledger-inputs.json`, directory), JSON.stringify(inputs[0], null, 2) + '\n')
fs.writeFileSync(
  new URL(`${prefix}pilot-ledger-audit.json`, directory),
  JSON.stringify({ engine: audit.engine, baseline: audit.frames[0] }, null, 2) + '\n'
)
console.log(JSON.stringify({ aggregate: payload.aggregate, coverage: payload.coverage }, null, 2))
