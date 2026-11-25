import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { projectedAssets, toUsd } from './model.mjs'

const snapshot = JSON.parse(fs.readFileSync(new URL('./snapshot.json', import.meta.url)))
const t = BigInt(snapshot.timestamp)
test('all 25 holder projections match captured contract conversions', () => {
  assert.equal(snapshot.rows.length, 25)
  snapshot.rows.forEach((row) => {
    assert.equal(projectedAssets(row, t, t), BigInt(row.holderAssets))
  })
})
test('scheduled values never decrease, exceed total assets, or grow after expiry', () => {
  snapshot.rows.forEach((row) => {
    const now = projectedAssets(row, t, t)
    const tomorrow = projectedAssets(row, t, t + 86400n)
    const after = projectedAssets(row, t, t + 366n * 86400n)
    assert(tomorrow >= now && tomorrow <= after)
    assert(after <= BigInt(row.reads.totalAssets))
    assert.equal(after, projectedAssets(row, t, t + 367n * 86400n))
  })
})
test('short Staked yBOLD schedule caps before an hour', () => {
  const row = snapshot.rows.find((r) => r.name === 'Staked yBOLD')
  assert.equal(projectedAssets(row, t, t + 3600n), projectedAssets(row, t, t + 86400n))
})
test('missing prices remain unavailable and unsupported accounting is rejected', () => {
  const row = snapshot.rows.find((r) => !r.price)
  assert(row)
  assert.equal(toUsd(row, BigInt(row.holderAssets)), null)
  assert.throws(() => projectedAssets({ ...row, validated: false }, t, t))
})
test('future-clock projection never rewinds before snapshot and zero schedules stay fixed', () => {
  snapshot.rows.forEach((row) => {
    assert.equal(projectedAssets(row, t, t - 3600n), BigInt(row.holderAssets))
    if (BigInt(row.lockedRemaining) === 0n) assert.equal(projectedAssets(row, t, t + 86400n), BigInt(row.holderAssets))
  })
})
