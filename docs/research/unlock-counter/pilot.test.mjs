import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (file) => JSON.parse(fs.readFileSync(new URL(file, import.meta.url)))
const pilot = read('./pilot-depositor-value.json')
const snapshot = read('./snapshot.json')
const near = (actual, expected, epsilon = 0.00001) =>
  assert(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`)
test('aggregate reconciles to valued entries and applied overlap', () => {
  const entries = pilot.entries.filter((row) => row.status === 'valued')
  assert.equal(entries.length, 24)
  near(
    entries.reduce((sum, row) => sum + row.adjustedHolderValueUsd, 0),
    pilot.aggregate.knownSubtotalUsd
  )
  near(
    pilot.aggregate.unadjustedKnownSubtotalUsd - pilot.aggregate.observedOverlapUsd,
    pilot.aggregate.knownSubtotalUsd
  )
  near(
    entries.reduce((sum, row) => sum + row.averageNextMinuteUsdPerSecond, 0),
    pilot.aggregate.averageNextMinuteUsdPerSecond
  )
})
test('share attribution conserves each root share inventory and holder budgets', () => {
  pilot.entries.forEach((entry) => {
    assert.equal(
      BigInt(entry.attributedExternalSharesRaw) + BigInt(entry.attributedInternalSharesRaw),
      BigInt(entry.nonSelfHolderSharesRaw)
    )
    assert(BigInt(entry.attributedExternalSharesRaw) >= 0n)
  })
  const groups = Map.groupBy(pilot.allocations, (allocation) => `${allocation.holder}:${allocation.child}`)
  groups.forEach((positions) => {
    const allocated = positions.reduce((sum, position) => sum + BigInt(position.attributedSharesRaw ?? '0'), 0n)
    assert(allocated <= BigInt(positions[0].observedSharesRaw))
  })
})
test('wrapper underlying is fully excluded from child without cancelling wrapper unlocking', () => {
  const wrapper = snapshot.rows.find((row) => row.name === 'Staked yBOLD')
  const child = pilot.entries.find((entry) => entry.name === 'Yearn BOLD')
  assert.equal(child.attributedInternalSharesRaw, wrapper.reads.totalAssets)
  assert(pilot.entries.find((entry) => entry.name === 'Staked yBOLD').averageNextMinuteUsdPerSecond > 0.026)
})
test('projection is monotonic, bounded to a refresh window, and includes schedule expiry', () => {
  const points = pilot.projection.points
  assert.equal(points[0].timestamp, pilot.asOfTimestamp)
  assert.equal(points.at(-1).timestamp, pilot.projection.validUntilTimestamp)
  points.slice(1).forEach((point, index) => {
    assert(point.timestamp > points[index].timestamp)
    assert(point.knownSubtotalUsd >= points[index].knownSubtotalUsd)
  })
  const wrapper = snapshot.rows.find((row) => row.name === 'Staked yBOLD')
  assert(points.some((point) => point.timestamp === Number(wrapper.reads.fullProfitUnlockDate)))
  near(points.at(-1).knownSubtotalUsd - points[0].knownSubtotalUsd, pilot.aggregate.nextHourIncreaseUsd)
})
test('unpriced root and incomplete aggregate are explicit rather than zero-filled', () => {
  assert.equal(pilot.aggregate.completeValueUsd, null)
  const missing = pilot.entries.find((entry) => entry.name === 'Sturdy pxETH Compounder')
  assert.equal(missing.adjustedHolderValueUsd, null)
  assert.equal(missing.averageNextMinuteUsdPerSecond, null)
  assert.equal(pilot.coverage.unavailableRoots.length, 1)
})
