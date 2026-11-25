import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { convertSharesAt } from './model.mjs'

const read = (name) => JSON.parse(fs.readFileSync(new URL(name, import.meta.url)))
const data = read('./pre-curation-pilot.json')
const near = (a, b) => assert(Math.abs(a - b) < 0.00001, `${a} != ${b}`)
const chains = data.chains.map((chain) => ({
  ...chain,
  pilot: read(chain.artifacts.pilot),
  snapshot: read(chain.artifacts.snapshot)
}))
test('seven chains are screened; identical addresses remain separate by chain', () => {
  assert.deepEqual(
    data.chains.map((chain) => chain.chainId),
    [1, 10, 137, 250, 8453, 42161, 747474]
  )
  assert.equal(data.entries.length, 157)
  assert.equal(data.scope.valuedRootCount, 125)
  assert.equal(new Set(data.entries.map((entry) => `${entry.chainId}:${entry.address}`)).size, 157)
  assert.equal(chains.find((chain) => chain.chainId === 137).snapshot.rows.length, 0)
  chains.forEach(({ chainId, snapshot, pilot }) => {
    assert.equal(pilot.sourceBlock.chainId, chainId)
    assert.equal(pilot.asOfTimestamp, data.asOfTimestamp)
    assert(data.asOfTimestamp - Number(snapshot.timestamp) >= 0)
    assert(data.asOfTimestamp - Number(snapshot.timestamp) <= 14)
    const ledger = read(`./${chainId === 1 ? 'expanded-' : `chain-${chainId}-`}pilot-ledger-inputs.json`)
    ledger.rows.forEach((row) => {
      assert.equal(row.chain_id, chainId)
    })
    ledger.positions.forEach((row) => {
      assert.equal(row.chain_id, chainId)
    })
  })
})
test('combined dollars, rates and projection reconcile to chain and root values', () => {
  Object.keys(data.aggregate)
    .filter((key) => key !== 'completeValueUsd')
    .forEach((key) => {
      near(
        data.aggregate[key],
        chains.reduce((sum, chain) => sum + chain.pilot.aggregate[key], 0)
      )
    })
  near(
    data.aggregate.knownSubtotalUsd,
    data.entries.reduce((sum, entry) => sum + (entry.adjustedHolderValueUsd ?? 0), 0)
  )
  near(data.aggregate.unadjustedKnownSubtotalUsd - data.aggregate.observedOverlapUsd, data.aggregate.knownSubtotalUsd)
  near(data.projection.points[0].knownSubtotalUsd, data.aggregate.knownSubtotalUsd)
  near(
    data.projection.points.at(-1).knownSubtotalUsd - data.projection.points[0].knownSubtotalUsd,
    data.aggregate.nextHourIncreaseUsd
  )
  const minute = data.projection.points.find((point) => point.timestamp === data.asOfTimestamp + 60)
  near((minute.knownSubtotalUsd - data.aggregate.knownSubtotalUsd) / 60, data.aggregate.averageNextMinuteUsdPerSecond)
  data.projection.points.slice(1).forEach((point, index) => {
    assert(point.knownSubtotalUsd >= data.projection.points[index].knownSubtotalUsd)
  })
})
test('overlap shares conserve supply and shared-holder budgets independently on each chain', () => {
  data.entries.forEach((entry) => {
    assert.equal(
      BigInt(entry.attributedExternalSharesRaw) + BigInt(entry.attributedInternalSharesRaw),
      BigInt(entry.nonSelfHolderSharesRaw)
    )
    assert(BigInt(entry.attributedExternalSharesRaw) >= 0n)
  })
  const groups = Map.groupBy(data.allocations, (entry) => `${entry.chainId}:${entry.holder}:${entry.child}`)
  groups.forEach((items) => {
    assert(
      items.reduce((sum, item) => sum + BigInt(item.attributedSharesRaw ?? 0), 0n) <= BigInt(items[0].observedSharesRaw)
    )
  })
  assert(data.chains.find((chain) => chain.chainId === 8453).aggregate.observedOverlapUsd > 1_900_000)
  assert(data.chains.find((chain) => chain.chainId === 747474).aggregate.observedOverlapUsd > 800_000)
})
test('all new selected roots match snapshot models and contract verification records', () => {
  chains
    .filter((chain) => chain.chainId !== 1)
    .forEach(({ chainId, snapshot, artifacts }) => {
      const verification = read(artifacts.verification)
      assert.equal(verification.failed, 0)
      assert.equal(verification.passed, snapshot.rows.length * (chainId === 250 ? 1 : 4))
      verification.frames.forEach((frame) => {
        frame.checks.forEach((check) => {
          assert(check.matched)
        })
      })
      snapshot.rows.forEach((row) => {
        assert(row.validated)
        assert.equal(
          convertSharesAt(row, row.holderShares, snapshot.timestamp, snapshot.timestamp),
          BigInt(row.holderAssets)
        )
      })
      if (chainId === 250) {
        assert.equal(verification.futureValidation.mode, 'exhausted-schedule-proof')
        assert.equal(verification.futureValidation.contractTimestampOverrides, 'unavailable')
        snapshot.rows.forEach((row) => {
          assert.equal(BigInt(row.lockedRemaining), 0n)
          assert.equal(
            convertSharesAt(row, row.holderShares, snapshot.timestamp, BigInt(snapshot.timestamp) + 604800n),
            BigInt(row.holderAssets)
          )
        })
      }
    })
})
test('missing prices and unknown cutoff eligibility stay distinct from genuine zeros', () => {
  assert.equal(data.aggregate.completeValueUsd, null)
  assert.equal(data.coverage.unavailableRoots.length, 32)
  assert.equal(data.coverage.cutoffUnknownCandidates.length, 153)
  data.entries
    .filter((entry) => entry.status === 'unavailable')
    .forEach((entry) => {
      assert.equal(entry.adjustedHolderValueUsd, null)
      assert.equal(entry.averageNextMinuteUsdPerSecond, null)
    })
  const selected = new Set(data.entries.map((entry) => `${entry.chainId}:${entry.address.toLowerCase()}`))
  data.coverage.cutoffUnknownCandidates.forEach((entry) => {
    assert(!selected.has(`${entry.chainId}:${entry.address.toLowerCase()}`))
  })
})
