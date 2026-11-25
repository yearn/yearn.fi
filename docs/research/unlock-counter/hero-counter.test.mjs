import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { counterValueAt } from '../../../apps/yearn/public/concepts/lifetime/counter-model.mjs'

const data = JSON.parse(
  fs.readFileSync(new URL('../../../apps/yearn/public/concepts/lifetime/hero-tvl.json', import.meta.url))
)
test('TVL estimate starts at published metrics TVL at the shared capture anchor', () => {
  assert.equal(counterValueAt(data, data.anchor.timestamp), data.metrics.totalTvlUsd)
  assert.equal(counterValueAt(data, data.anchor.timestamp - 86400), data.metrics.totalTvlUsd)
  assert.equal(
    counterValueAt(data, data.anchor.timestamp + 60),
    data.anchor.valueUsd + data.growth.estimatedUsdPerSecond * 60
  )
  assert(data.anchor.timestamp > data.metrics.asOfTimestamp)
})
test('identical wall-clock timestamps replay the same estimate without accumulated frame time', () => {
  const time = data.anchor.timestamp + 3690.5
  const expected = counterValueAt(data, time)
  assert.equal(counterValueAt(JSON.parse(JSON.stringify(data)), time), expected)
  assert.equal(counterValueAt(data, time), expected)
  assert.equal(counterValueAt(data, time + 100) - expected > 23, true)
})
test('growth components reconcile and invalid values never turn into zeros', () => {
  assert(
    Math.abs(
      data.growth.estimatedUsdPerSecond -
        data.growth.yearnScheduledUnlockUsdPerSecond -
        data.growth.morphoProjectedNetAccrualUsdPerSecond
    ) < 1e-8
  )
  assert.throws(() => counterValueAt({ ...data, anchor: { ...data.anchor, valueUsd: null } }, data.anchor.timestamp))
  assert.throws(() => counterValueAt({ ...data, growth: {} }, data.anchor.timestamp))
  assert.throws(() => counterValueAt(data, NaN))
  const declining = { anchor: { timestamp: 100, valueUsd: 1000 }, growth: { estimatedUsdPerSecond: -0.1 } }
  assert.equal(counterValueAt(declining, 200), 990)
})
