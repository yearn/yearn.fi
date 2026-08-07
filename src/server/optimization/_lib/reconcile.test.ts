import { describe, expect, it } from 'vitest'
import { calculateAllocationCoverage } from './allocationCoverage'
import type { HistoricalAllocationSnapshot } from './historicalAllocation'
import { reconcileOptimizationRecord } from './reconcile'
import type { VaultOptimizationRecord } from './redis'

const VAULT = '0xc56413869c6CDf96496f2b1eF801fEDBdFA7dDB0'
const OPTIMIZED = '0x1111111111111111111111111111111111111111'
const OMITTED = '0x2222222222222222222222222222222222222222'

function record(
  strategies: VaultOptimizationRecord['strategyDebtRatios'] = [
    {
      strategy: OPTIMIZED,
      name: 'Optimizer strategy',
      currentRatio: 4157,
      targetRatio: 4157
    }
  ]
): VaultOptimizationRecord {
  return {
    vault: VAULT,
    strategyDebtRatios: strategies,
    currentApr: 250,
    proposedApr: 275,
    explain: 'optimizer recommendation',
    source: {
      key: 'doa:optimizations:1:latest',
      chainId: 1,
      revision: 'latest',
      isLatestAlias: true,
      timestampUtc: null,
      latestMatchedTimestampUtc: '2026-07-25 00:15:29 UTC'
    },
    allocationCoverage: calculateAllocationCoverage(strategies),
    freshness: {
      optimizationTimestampUtc: '2026-07-25 00:15:29 UTC',
      latestAvailableTimestampUtc: '2026-07-25 00:15:29 UTC'
    }
  }
}

function snapshot(
  strategies: HistoricalAllocationSnapshot['strategies'] = [
    {
      address: OPTIMIZED,
      name: 'Historical optimized strategy',
      nameSource: 'current-metadata-catalog',
      currentBps: 4157
    },
    {
      address: OMITTED,
      name: 'Omitted strategy',
      nameSource: 'current-metadata-catalog',
      currentBps: 5343
    }
  ],
  unallocatedBps = 500
): HistoricalAllocationSnapshot {
  return {
    timestampUtc: '2026-07-25 00:15:29 UTC',
    blockNumber: 25_603_774,
    blockTimestampUtc: '2026-07-25 00:15:23 UTC',
    source: 'archive-rpc',
    strategyUniverseSource: 'envio-strategy-changed',
    complete: true,
    strategies,
    unallocatedBps,
    unallocatedSource: 'same-timestamp-onchain'
  }
}

describe('reconcileOptimizationRecord', () => {
  it('keeps full optimizer coverage complete with optimizer targets', () => {
    const completeRecord = record([
      { strategy: OPTIMIZED, currentRatio: 6000, targetRatio: 5500 },
      { strategy: OMITTED, currentRatio: 4000, targetRatio: 4500 }
    ])
    const reconciled = reconcileOptimizationRecord(
      completeRecord,
      snapshot([
        { address: OPTIMIZED, name: null, nameSource: null, currentBps: 6000 },
        { address: OMITTED, name: null, nameSource: null, currentBps: 4000 }
      ])
    )

    expect(reconciled.allocationCoverage.classification).toBe('complete')
    expect(reconciled.allocationSnapshot.strategies).toMatchObject([
      { address: OPTIMIZED, currentBps: 6000, targetBps: 5500, optimizerScope: 'optimized' },
      { address: OMITTED, currentBps: 4000, targetBps: 4500, optimizerScope: 'optimized' }
    ])
  })

  it('adds omitted historical strategies without inventing targets or scope', () => {
    const reconciled = reconcileOptimizationRecord(record(), snapshot())

    expect(reconciled.strategyDebtRatios).toHaveLength(1)
    expect(reconciled.allocationSnapshot.complete).toBe(true)
    expect(reconciled.allocationSnapshot.strategies).toEqual([
      {
        address: OPTIMIZED,
        name: 'Optimizer strategy',
        nameSource: 'optimizer',
        currentBps: 4157,
        targetBps: 4157,
        optimizerScope: 'optimized',
        targetSource: 'optimizer'
      },
      {
        address: OMITTED,
        name: 'Omitted strategy',
        nameSource: 'current-metadata-catalog',
        currentBps: 5343,
        targetBps: null,
        optimizerScope: 'unknown',
        targetSource: 'unavailable'
      }
    ])
  })

  it('only copies current allocation to target for authoritatively outside-scope strategies', () => {
    const reconciled = reconcileOptimizationRecord(record(), snapshot(), [OMITTED])

    expect(reconciled.allocationSnapshot.strategies[1]).toMatchObject({
      currentBps: 5343,
      targetBps: 5343,
      optimizerScope: 'outside-optimizer-scope',
      targetSource: 'unchanged-outside-scope'
    })
  })

  it('returns an explicit fallback when a historical snapshot is unavailable', () => {
    const sourceRecord = record()
    const reconciled = reconcileOptimizationRecord(sourceRecord, null)

    expect(reconciled.allocationCoverage).toEqual(sourceRecord.allocationCoverage)
    expect(reconciled.allocationSnapshot).toEqual({
      timestampUtc: '2026-07-25 00:15:29 UTC',
      blockNumber: null,
      blockTimestampUtc: null,
      source: null,
      strategyUniverseSource: null,
      complete: false,
      strategies: [],
      unallocatedBps: null,
      unallocatedSource: null
    })
  })

  it('uses historical allocation instead of optimizer or current-catalog allocation values', () => {
    const reconciled = reconcileOptimizationRecord(
      record([{ strategy: OPTIMIZED, currentRatio: 7000, targetRatio: 5000 }]),
      snapshot([
        { address: OPTIMIZED, name: 'Current catalog name', nameSource: 'current-metadata-catalog', currentBps: 3000 }
      ])
    )

    expect(reconciled.allocationSnapshot.strategies[0]).toMatchObject({
      currentBps: 3000,
      targetBps: 5000
    })
  })

  it('exposes same-timestamp unallocated capital separately from optimizer residual', () => {
    const reconciled = reconcileOptimizationRecord(record(), snapshot(undefined, 500))

    expect(reconciled.allocationCoverage.currentResidualBps).toBe(5843)
    expect(reconciled.allocationCoverage.unallocatedBps).toBe(500)
    expect(reconciled.allocationCoverage.unallocatedSource).toBe('same-timestamp-onchain')
    expect(reconciled.allocationSnapshot.unallocatedBps).toBe(500)
  })

  it('deduplicates addresses case-insensitively and preserves missing names', () => {
    const reconciled = reconcileOptimizationRecord(
      record([
        { strategy: OPTIMIZED, currentRatio: 2000, targetRatio: 2100 },
        { strategy: OPTIMIZED.toUpperCase(), currentRatio: 2157, targetRatio: 2057 }
      ]),
      snapshot([
        { address: OPTIMIZED, name: null, nameSource: null, currentBps: 2000 },
        { address: OPTIMIZED.toUpperCase(), name: null, nameSource: null, currentBps: 2157 }
      ])
    )

    expect(reconciled.allocationSnapshot.strategies).toEqual([
      {
        address: OPTIMIZED,
        name: null,
        nameSource: null,
        currentBps: 4157,
        targetBps: 4157,
        optimizerScope: 'optimized',
        targetSource: 'optimizer'
      }
    ])
  })
})
