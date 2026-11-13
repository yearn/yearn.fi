import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { projectedAssets } from './model.mjs'

const read = (name) => JSON.parse(fs.readFileSync(new URL(name, import.meta.url)))
const snapshot = read('./expanded-snapshot.json')
const pilot = read('./expanded-pilot-depositor-value.json')
const verification = read('./v2-verification.json')
const near = (a, b) => assert(Math.abs(a - b) < 0.00001)
test('expanded scope retains funded V2 and factory roots and explicit pricing gaps', () => {
  const v2 = snapshot.rows.filter((row) => row.version === 'v2')
  assert.equal(snapshot.rows.length, 120)
  assert.equal(v2.length, 95)
  assert.equal(v2.filter((row) => row.isFactory).length, 38)
  assert.equal(v2.filter((row) => row.isRetired).length, 48)
  assert.equal(pilot.scope.valuedRootCount, 107)
  assert.equal(pilot.coverage.unavailableRoots.length, 13)
  assert.equal(pilot.coverage.cutoffUnknownCandidates.length, 69)
  assert.equal(pilot.aggregate.completeValueUsd, null)
})
test('all V2 conversions agree with captured state and future contract checks', () => {
  assert.equal(verification.passed, 380)
  assert.equal(verification.failed, 0)
  snapshot.rows
    .filter((row) => row.version === 'v2')
    .forEach((row) => {
      assert.equal(projectedAssets(row, pilot.asOfTimestamp, pilot.asOfTimestamp), BigInt(row.holderAssets))
    })
  for (const frame of verification.frames) {
    for (const check of frame.checks) assert(check.matched)
  }
})
test('expanded aggregate reconciles and internal attribution conserves shares', () => {
  const valued = pilot.entries.filter((entry) => entry.status === 'valued')
  near(
    valued.reduce((sum, entry) => sum + entry.adjustedHolderValueUsd, 0),
    pilot.aggregate.knownSubtotalUsd
  )
  near(
    valued.reduce((sum, entry) => sum + entry.averageNextMinuteUsdPerSecond, 0),
    pilot.aggregate.averageNextMinuteUsdPerSecond
  )
  near(
    pilot.aggregate.unadjustedKnownSubtotalUsd - pilot.aggregate.observedOverlapUsd,
    pilot.aggregate.knownSubtotalUsd
  )
  pilot.entries.forEach((entry) => {
    assert.equal(
      BigInt(entry.attributedExternalSharesRaw) + BigInt(entry.attributedInternalSharesRaw),
      BigInt(entry.nonSelfHolderSharesRaw)
    )
    assert(BigInt(entry.attributedExternalSharesRaw) >= 0n)
  })
  const groups = Map.groupBy(pilot.allocations, (item) => `${item.holder}:${item.child}`)
  groups.forEach((items) => {
    assert(
      items.reduce((sum, item) => sum + BigInt(item.attributedSharesRaw ?? '0'), 0n) <=
        BigInt(items[0].observedSharesRaw)
    )
  })
  const v2Addresses = new Set(
    snapshot.rows.filter((row) => row.version === 'v2').map((row) => row.address.toLowerCase())
  )
  assert(
    pilot.allocations.some(
      (item) => v2Addresses.has(item.parent.toLowerCase()) && item.attributedHolderValueUsd > 1_000_000
    )
  )
})
