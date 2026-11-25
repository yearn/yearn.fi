import assert from 'node:assert/strict'
import fs from 'node:fs'

const directory = new URL('./', import.meta.url)
const target = new URL('../../../apps/yearn/public/concepts/lifetime/hero-tvl.json', import.meta.url)
const growth = JSON.parse(fs.readFileSync(new URL('curation-pilot-depositor-value.json', directory)))
const response = await fetch('https://yearn-data-api-preview.vercel.app/api/tvl', { cache: 'no-store' })
if (!response.ok) throw new Error(`Metrics snapshot unavailable: ${response.status}`)
const metrics = await response.json()
assert(
  Number.isFinite(metrics.totalTvl) && metrics.totalTvl >= 0,
  'Metrics TVL must be a reported numeric known subtotal'
)
assert(Number.isFinite(metrics.asOfTimestamp) && metrics.datasetId, 'Metrics reporting boundary missing')
assert(Number.isFinite(growth.aggregate.averageNextMinuteUsdPerSecond), 'Growth estimate unavailable')
const prior = fs.existsSync(target) ? JSON.parse(fs.readFileSync(target)) : null
const sameSources =
  prior?.metrics.datasetId === metrics.datasetId &&
  prior.growth.asOfTimestamp === growth.asOfTimestamp &&
  prior.growth.estimatedUsdPerSecond === growth.aggregate.averageNextMinuteUsdPerSecond
const capturedAt = new Date().toISOString()
const payload = {
  schemaVersion: 'landing-tvl-estimate-1',
  capturedAt,
  status: 'estimated-known-subtotal',
  anchor: sameSources ? prior.anchor : { timestamp: Math.floor(Date.now() / 1000), valueUsd: metrics.totalTvl },
  metrics: {
    source: 'https://yearn-data-api-preview.vercel.app/api/tvl',
    datasetId: metrics.datasetId,
    asOfTimestamp: metrics.asOfTimestamp,
    totalTvlUsd: metrics.totalTvl,
    completeness: metrics.completeness
  },
  growth: {
    estimatedUsdPerSecond: growth.aggregate.averageNextMinuteUsdPerSecond,
    yearnScheduledUnlockUsdPerSecond: growth.growthComponents.yearnScheduledUnlockUsdPerSecond,
    morphoProjectedNetAccrualUsdPerSecond: growth.growthComponents.morphoProjectedNetAccrualUsdPerSecond,
    asOfTimestamp: growth.asOfTimestamp,
    modelVersion: growth.modelVersion,
    valuedRoots: growth.scope.valuedRootCount,
    selectedRoots: growth.scope.selectedRootCount,
    unavailableRoots: growth.coverage.unavailableRoots.length
  },
  method:
    'Latest published metrics TVL anchored when captured, plus elapsed wall-clock seconds times the approved pilot first-minute estimated growth rate. No backfill from the older metrics reporting date.',
  limitations: [
    'Illustrative constant-rate estimate, not a live on-chain TVL reading. This does not replay the finite Yearn unlock schedules indefinitely as fact.',
    'Metrics TVL already includes locked profit; the animation is a presentation estimate, not an increase in measured totalAssets or independently reconciled net deposits.',
    'Growth extrapolates the initial pilot rate beyond its one-hour sampled curve and assumes no changes in prices, fees, rates, positions or reporting. Regenerate from refreshed evidence before production use.',
    'Metrics and growth reporting dates differ, and both retain incomplete coverage. Missing valuations are not zero.',
    'Identical source versions retain one shared anchor across regeneration; reloads and windows use the same clock-based formula. Device clock differences affect the result.'
  ]
}
fs.writeFileSync(target, JSON.stringify(payload, null, 2) + '\n')
fs.writeFileSync(
  new URL('hero-metrics-snapshot.json', directory),
  JSON.stringify(metrics, (_, value) => (value === 'Yeer' ? 'Robinhood Chain' : value), 2).replaceAll(
    '"Yeer":',
    '"Robinhood Chain":'
  ) + '\n'
)
console.log(
  JSON.stringify({
    valueUsd: payload.anchor.valueUsd,
    estimatedUsdPerSecond: payload.growth.estimatedUsdPerSecond,
    anchor: payload.anchor.timestamp,
    metricsAsOf: metrics.asOfTimestamp,
    datasetId: metrics.datasetId
  })
)
