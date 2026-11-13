import assert from 'node:assert/strict'
import fs from 'node:fs'

const directory = new URL('./', import.meta.url)
const read = (name) => JSON.parse(fs.readFileSync(new URL(name, directory)))
const chainDefinitions = [
  [1, 'Ethereum', 'expanded-'],
  [10, 'Optimism', 'chain-10-'],
  [137, 'Polygon', 'chain-137-'],
  [250, 'Fantom', 'chain-250-'],
  [8453, 'Base', 'chain-8453-'],
  [42161, 'Arbitrum', 'chain-42161-'],
  [747474, 'Katana', 'chain-747474-']
]
const chains = chainDefinitions.map(([chainId, name, prefix]) => {
  const pilot = read(`${prefix}pilot-depositor-value.json`)
  const snapshot = read(`${prefix}snapshot.json`)
  const verification =
    chainId === 1
      ? {
          passed:
            read('verification.json')
              .results.flatMap((row) => row.checks ?? [])
              .filter((check) => check.status === 'matched').length + read('v2-verification.json').passed,
          failed: read('v2-verification.json').failed,
          method: '100 V3 and 380 V2 pinned-state timestamp-override contract comparisons'
        }
      : read(`${prefix}verification.json`)
  assert.equal(verification.failed, 0)
  assert.equal(pilot.scope.selectedRootCount, snapshot.rows.length)
  assert(Number(snapshot.timestamp) <= pilot.asOfTimestamp)
  assert(pilot.asOfTimestamp - Number(snapshot.timestamp) <= 300)
  return { chainId, name, prefix, pilot, snapshot, verification }
})
const t0 = chains[0].pilot.asOfTimestamp
chains.forEach(({ pilot }) => {
  assert.equal(pilot.asOfTimestamp, t0)
})
const sum = (getter) => chains.reduce((total, chain) => total + getter(chain.pilot), 0)
const field = (key) => sum((pilot) => pilot.aggregate[key])
const valueAt = (pilot, timestamp) => {
  const points = pilot.projection.points
  const next = points.findIndex((point) => point.timestamp >= timestamp)
  assert(next >= 0, 'Combined projection exceeds a chain validity window')
  const right = points[next]
  const left = points[Math.max(0, next - 1)]
  const fraction =
    right.timestamp === left.timestamp ? 0 : (timestamp - left.timestamp) / (right.timestamp - left.timestamp)
  return left.knownSubtotalUsd + fraction * (right.knownSubtotalUsd - left.knownSubtotalUsd)
}
const timestamps = [
  ...new Set(chains.flatMap(({ pilot }) => pilot.projection.points.map((point) => point.timestamp)))
].toSorted((a, b) => a - b)
const entries = chains.flatMap(({ chainId, name, pilot }) =>
  pilot.entries.map((entry) => ({ ...entry, chainId, chainName: name }))
)
const identities = entries.map((entry) => `${entry.chainId}:${entry.address.toLowerCase()}`)
assert.equal(new Set(identities).size, identities.length, 'Duplicate chain/address root')
const payload = {
  schemaVersion: 'depositor-value-multichain-pilot-1',
  modelVersion: 'fixed-share-attribution-v2-v3-unlock-v2',
  status: 'incomplete-pilot',
  generatedAt: new Date().toISOString(),
  asOfTimestamp: t0,
  scope: {
    label: 'Visible Yearn V2/V3 roots across seven screened chains, $10k cutoff',
    selectedRootCount: entries.length,
    valuedRootCount: entries.filter((entry) => entry.status === 'valued').length,
    definition: chains[0].pilot.scope.definition,
    excludedFromScope: [
      'V1, hidden roots, retired V3 roots, curation-only and partner-only roots',
      'Priced roots below $10k; unpriced funded candidates have unknown cutoff eligibility',
      'Unobserved historical/adapted/cross-chain ownership routes'
    ],
    ownershipBoundary:
      'Chain-scoped observed direct and routed share holdings. No bridge/migration equivalence is inferred; combined subtotal is not certified global unique capital.'
  },
  aggregate: {
    completeValueUsd: null,
    knownSubtotalUsd: field('knownSubtotalUsd'),
    unadjustedKnownSubtotalUsd: field('unadjustedKnownSubtotalUsd'),
    observedOverlapUsd: field('observedOverlapUsd'),
    averageNextMinuteUsdPerSecond: field('averageNextMinuteUsdPerSecond'),
    unadjustedAverageNextMinuteUsdPerSecond: field('unadjustedAverageNextMinuteUsdPerSecond'),
    nextHourIncreaseUsd: field('nextHourIncreaseUsd'),
    next24HoursIncreaseUsd: field('next24HoursIncreaseUsd')
  },
  chains: chains.map(({ chainId, name, prefix, pilot, snapshot, verification }) => ({
    chainId,
    name,
    sourceBlock: {
      number: snapshot.blockNumber,
      hash: snapshot.blockHash,
      timestamp: Number(snapshot.timestamp),
      secondsBeforeCommonTimestamp: t0 - Number(snapshot.timestamp)
    },
    scope: pilot.scope,
    aggregate: pilot.aggregate,
    coverage: {
      priced: pilot.scope.valuedRootCount,
      selected: pilot.scope.selectedRootCount,
      unavailable: pilot.coverage.unavailableRoots.length,
      cutoffUnknown: pilot.coverage.cutoffUnknownCandidates.length,
      checkedHolderPairs: pilot.coverage.checkedHolderPairs,
      positiveHoldings: pilot.coverage.observedPositiveHoldings,
      appliedPositions: pilot.coverage.appliedPositionCount
    },
    validation: {
      passed: verification.passed,
      failed: verification.failed,
      method: verification.method,
      futureValidation: verification.futureValidation ?? { mode: 'contract-timestamp-overrides' }
    },
    artifacts: {
      snapshot: `${prefix}snapshot.json`,
      pilot: `${prefix}pilot-depositor-value.json`,
      holdings: `${prefix}internal-holdings.json`,
      ledger: `${prefix}pilot-ledger-audit.json`,
      verification: chainId === 1 ? 'v2-verification.json' : `${prefix}verification.json`
    }
  })),
  coverage: {
    status: 'incomplete',
    unavailableRoots: chains.flatMap(({ chainId, name, pilot }) =>
      pilot.coverage.unavailableRoots.map((entry) => ({ ...entry, chainId, chainName: name }))
    ),
    cutoffUnknownCandidates: chains.flatMap(({ chainId, name, pilot }) =>
      pilot.coverage.cutoffUnknownCandidates.map((entry) => ({ ...entry, chainId, chainName: name }))
    ),
    checkedHolderPairs: sum((pilot) => pilot.coverage.checkedHolderPairs),
    appliedPositionCount: sum((pilot) => pilot.coverage.appliedPositionCount),
    limitations: [
      ...chains[0].pilot.coverage.limitations,
      'Seven chains screened at blocks no more than 14 seconds before the common timestamp. This is historical research, not a live endpoint.',
      'New-chain price policy requires positive historical quote, confidence >=0.9 and timestamp within 24 hours; missing/rejected prices remain unavailable. Mainnet retains original pilot quotes.',
      'Cross-chain bridges and migrations are not automatically resolved by chain-local share scans; known subtotal is not certified unique global capital.',
      'Fantom RPC timestamp overrides unavailable; current conversions checked, all selected schedules exhausted and future model constant.'
    ]
  },
  projection: {
    fromTimestamp: t0,
    validUntilTimestamp: t0 + 3600,
    interpolation:
      'Linear between supplied timestamps; combined curve is the sum of each chain’s published curve at common timestamps.',
    points: timestamps.map((timestamp) => ({ timestamp, knownSubtotalUsd: sum((pilot) => valueAt(pilot, timestamp)) }))
  },
  engines: chains.map(({ chainId, pilot }) => ({ chainId, ...pilot.engine })),
  allocations: chains.flatMap(({ chainId, name, pilot }) =>
    pilot.allocations.map((entry) => ({ ...entry, chainId, chainName: name }))
  ),
  entries
}
fs.writeFileSync(new URL('multichain-chain-local-pilot.json', directory), JSON.stringify(payload, null, 2) + '\n')
console.log(
  JSON.stringify(
    {
      aggregate: payload.aggregate,
      selected: entries.length,
      priced: payload.scope.valuedRootCount,
      unavailable: payload.coverage.unavailableRoots.length,
      unknownCutoff: payload.coverage.cutoffUnknownCandidates.length,
      checkedHolderPairs: payload.coverage.checkedHolderPairs,
      positions: payload.coverage.appliedPositionCount
    },
    null,
    2
  )
)
