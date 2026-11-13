import assert from 'node:assert/strict'
import test from 'node:test'
import { baseRows, read, t0 } from './curation-common.mjs'
import { createGlobalModel, nodeKey } from './global-model.mjs'

const data = read('curation-pilot-depositor-value.json')
const snapshot = read('curation-snapshot.json')
const original = read('pre-curation-pilot.json')
const routes = read('curation-ownership-routes.json')
const receipt = read('curation-projection-verification.json')
const rows = [...baseRows, ...snapshot.selected]
const { shareValueAt } = createGlobalModel(rows, t0)
const lookup = new Map(rows.map((row) => [nodeKey(row.chainId, row.address), row]))
const near = (actual, expected) => assert(Math.abs(actual - expected) < 0.00001, `${actual} != ${expected}`)
test('curation is limited to the DB selection and the original snapshot cutoff', () => {
  assert.equal(snapshot.rows.length, 53)
  assert.equal(snapshot.selected.length, 21)
  assert.equal(snapshot.selected.filter((row) => row.version === 'morpho-v1').length, 11)
  assert.equal(snapshot.selected.filter((row) => row.version === 'morpho-v2').length, 10)
  assert.equal(data.scope.selectedRootCount, 178)
  assert.equal(data.scope.valuedRootCount, 145)
  assert.equal(new Set(data.entries.map((entry) => nodeKey(entry.chainId, entry.address))).size, 178)
  assert.equal(snapshot.excludedCatalogueDeployments.length, 6)
  snapshot.selected.forEach((row) => {
    assert(row.validated)
    assert(row.grossUsd >= 10000 || row.inventoryTvlUsd >= 10000)
  })
})
test('every displayed Morpho projection is backed by an exact-share contract read', () => {
  assert.equal(receipt.failed, 0)
  assert.equal(receipt.passed, 4620)
  data.entries
    .filter((entry) => entry.version.startsWith('morpho-'))
    .forEach((entry) => {
      const row = lookup.get(nodeKey(entry.chainId, entry.address))
      data.projection.points.forEach((point) => {
        const quote = row.conversions[entry.attributedExternalSharesRaw][point.timestamp]
        assert.notEqual(quote, null)
        assert.notEqual(quote, undefined)
      })
      if (entry.status === 'valued') {
        near(entry.adjustedHolderValueUsd, shareValueAt(row, entry.attributedExternalSharesRaw, t0))
        near(
          entry.averageNextMinuteUsdPerSecond,
          (shareValueAt(row, entry.attributedExternalSharesRaw, t0 + 60) - entry.adjustedHolderValueUsd) / 60
        )
      }
    })
  assert.throws(() => shareValueAt(snapshot.selected[0], '1', t0 + 2), /Missing authoritative Morpho conversion/)
})
test('combined value, growth components and curves reconcile without adding gross curation twice', () => {
  const valued = data.entries.filter((entry) => entry.status === 'valued')
  near(
    data.aggregate.knownSubtotalUsd,
    valued.reduce((sum, entry) => sum + entry.adjustedHolderValueUsd, 0)
  )
  near(data.aggregate.knownSubtotalUsd, data.aggregate.unadjustedKnownSubtotalUsd - data.aggregate.observedOverlapUsd)
  near(
    data.aggregate.averageNextMinuteUsdPerSecond,
    data.growthComponents.yearnScheduledUnlockUsdPerSecond + data.growthComponents.morphoProjectedNetAccrualUsdPerSecond
  )
  near(data.growthComponents.yearnScheduledUnlockUsdPerSecond, original.aggregate.averageNextMinuteUsdPerSecond)
  near(
    data.aggregate.knownSubtotalUsd,
    data.families.reduce((sum, family) => sum + family.aggregate.knownSubtotalUsd, 0)
  )
  near(
    data.projection.points.at(-1).knownSubtotalUsd - data.projection.points[0].knownSubtotalUsd,
    data.aggregate.nextHourIncreaseUsd
  )
  const curation = data.entries.filter((entry) => entry.version.startsWith('morpho-'))
  assert(curation.reduce((sum, entry) => sum + (entry.observedOverlapUsd ?? 0), 0) > 39_000_000)
  const oldRoots = data.entries.filter((entry) => !entry.version.startsWith('morpho-'))
  near(
    oldRoots.reduce((sum, entry) => sum + (entry.adjustedHolderValueUsd ?? 0), 0),
    original.aggregate.knownSubtotalUsd
  )
})
test('attributed shares respect root inventories and shared-holder budgets across chains', () => {
  assert.equal(routes.coverage.unavailableRoutes, 0)
  assert(data.allocations.some((entry) => entry.parentChainId !== entry.childChainId))
  data.entries.forEach((entry) => {
    assert.equal(
      BigInt(entry.attributedExternalSharesRaw) + BigInt(entry.attributedInternalSharesRaw),
      BigInt(entry.nonSelfHolderSharesRaw)
    )
    assert(BigInt(entry.attributedExternalSharesRaw) >= 0n)
  })
  const groups = Map.groupBy(data.allocations, (entry) => `${entry.childChainId}:${entry.holder}:${entry.child}`)
  groups.forEach((entries) => {
    assert(
      entries.reduce((sum, entry) => sum + BigInt(entry.attributedSharesRaw ?? 0), 0n) <=
        BigInt(entries[0].observedSharesRaw)
    )
  })
  const nested = data.entries.find((entry) => entry.chainId === 1 && entry.name === 'OUSD Vault V1')
  const wrapper = data.entries.find((entry) => entry.chainId === 1 && entry.name === 'OUSD Vault V2')
  assert(nested.adjustedHolderValueUsd < 1000)
  assert(wrapper.adjustedHolderValueUsd > 4_400_000)
})
test('a supported conversion without a USD quote remains unavailable, never zero-valued', () => {
  const missing = data.entries.find((entry) => entry.chainId === 4663)
  assert.equal(missing.status, 'unavailable')
  assert.equal(missing.adjustedHolderValueUsd, null)
  assert.equal(missing.averageNextMinuteUsdPerSecond, null)
  assert.equal(data.aggregate.completeValueUsd, null)
  assert.equal(data.coverage.unavailableRoots.length, 33)
  assert.equal(data.coverage.cutoffUnknownCandidates.length, 153)
})
