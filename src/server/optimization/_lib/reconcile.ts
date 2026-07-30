import type { HistoricalAllocationSnapshot } from './historicalAllocation'
import {
  getHistoricalAllocationRequestKey,
  getHistoricalAllocationSnapshot,
  getHistoricalAllocationSnapshots,
  type HistoricalAllocationRequest
} from './historicalAllocation'
import type { VaultOptimizationRecord } from './redis'
import type { StrategyNameSource } from './strategyMetadata'

export type OptimizerScope = 'optimized' | 'outside-optimizer-scope' | 'unknown'
export type AllocationTargetSource = 'optimizer' | 'unchanged-outside-scope' | 'unavailable'

export interface ReconciledAllocationStrategy {
  address: string
  name: string | null
  nameSource: StrategyNameSource | null
  currentBps: number
  targetBps: number | null
  optimizerScope: OptimizerScope
  targetSource: AllocationTargetSource
}

export interface ReconciledAllocationSnapshot {
  timestampUtc: string | null
  blockNumber: number | null
  blockTimestampUtc: string | null
  source: 'archive-rpc' | null
  strategyUniverseSource: 'envio-strategy-changed' | null
  complete: boolean
  strategies: ReconciledAllocationStrategy[]
  unallocatedBps: number | null
  unallocatedSource: 'same-timestamp-onchain' | null
}

export type ReconciledVaultOptimizationRecord = VaultOptimizationRecord & {
  allocationSnapshot: ReconciledAllocationSnapshot
}

function fallbackSnapshot(record: VaultOptimizationRecord): ReconciledAllocationSnapshot {
  return {
    timestampUtc: record.freshness.optimizationTimestampUtc,
    blockNumber: null,
    blockTimestampUtc: null,
    source: null,
    strategyUniverseSource: null,
    complete: false,
    strategies: [],
    unallocatedBps: null,
    unallocatedSource: null
  }
}

export function reconcileOptimizationRecord(
  record: VaultOptimizationRecord,
  historicalSnapshot: HistoricalAllocationSnapshot | null,
  explicitOutsideScopeAddresses: readonly string[] = []
): ReconciledVaultOptimizationRecord {
  if (!historicalSnapshot) {
    return {
      ...record,
      allocationSnapshot: fallbackSnapshot(record)
    }
  }

  const optimizerStrategies = record.strategyDebtRatios.reduce((strategies, strategy) => {
    const address = strategy.strategy.toLowerCase()
    const existing = strategies.get(address)
    strategies.set(address, {
      targetBps: (existing?.targetBps ?? 0) + strategy.targetRatio,
      name: existing?.name ?? strategy.name?.trim() ?? null
    })
    return strategies
  }, new Map<string, { targetBps: number; name: string | null }>())
  const outsideScopeAddresses = new Set(explicitOutsideScopeAddresses.map((address) => address.toLowerCase()))
  const historicalStrategies = historicalSnapshot.strategies.reduce((strategies, strategy) => {
    const address = strategy.address.toLowerCase()
    const existing = strategies.get(address)
    strategies.set(address, {
      ...strategy,
      address: existing?.address ?? strategy.address,
      currentBps: (existing?.currentBps ?? 0) + strategy.currentBps,
      name: existing?.name ?? strategy.name,
      nameSource: existing?.nameSource ?? strategy.nameSource
    })
    return strategies
  }, new Map<string, HistoricalAllocationSnapshot['strategies'][number]>())
  const allAddresses = Array.from(new Set([...historicalStrategies.keys(), ...optimizerStrategies.keys()]))
  const strategies = allAddresses.map((address) => {
    const historical = historicalStrategies.get(address)
    const optimizer = optimizerStrategies.get(address)
    const optimizerScope: OptimizerScope = optimizer
      ? 'optimized'
      : outsideScopeAddresses.has(address)
        ? 'outside-optimizer-scope'
        : 'unknown'
    const currentBps = historical?.currentBps ?? 0

    return {
      address: historical?.address ?? address,
      name: optimizer?.name ?? historical?.name ?? null,
      nameSource: optimizer?.name ? ('optimizer' as const) : (historical?.nameSource ?? null),
      currentBps,
      targetBps:
        optimizerScope === 'optimized'
          ? (optimizer?.targetBps ?? null)
          : optimizerScope === 'outside-optimizer-scope'
            ? currentBps
            : null,
      optimizerScope,
      targetSource:
        optimizerScope === 'optimized'
          ? ('optimizer' as const)
          : optimizerScope === 'outside-optimizer-scope'
            ? ('unchanged-outside-scope' as const)
            : ('unavailable' as const)
    }
  })

  return {
    ...record,
    allocationCoverage: {
      ...record.allocationCoverage,
      unallocatedBps: historicalSnapshot.unallocatedBps,
      unallocatedSource: historicalSnapshot.unallocatedSource
    },
    allocationSnapshot: {
      timestampUtc: historicalSnapshot.timestampUtc,
      blockNumber: historicalSnapshot.blockNumber,
      blockTimestampUtc: historicalSnapshot.blockTimestampUtc,
      source: historicalSnapshot.source,
      strategyUniverseSource: historicalSnapshot.strategyUniverseSource,
      complete: historicalSnapshot.complete,
      strategies,
      unallocatedBps: historicalSnapshot.unallocatedBps,
      unallocatedSource: historicalSnapshot.unallocatedSource
    }
  }
}

export async function enrichOptimizationRecord(
  record: VaultOptimizationRecord
): Promise<ReconciledVaultOptimizationRecord> {
  const timestampUtc = record.freshness.optimizationTimestampUtc
  const chainId = record.source.chainId
  if (!timestampUtc || chainId === null) {
    return reconcileOptimizationRecord(record, null)
  }

  const snapshot = await getHistoricalAllocationSnapshot({
    chainId,
    vault: record.vault,
    timestampUtc,
    optimizerStrategies: record.strategyDebtRatios
  })
  return reconcileOptimizationRecord(record, snapshot)
}

export async function enrichOptimizationRecords(
  records: readonly VaultOptimizationRecord[]
): Promise<ReconciledVaultOptimizationRecord[]> {
  const requestsByRecord = records.map((record): HistoricalAllocationRequest | null => {
    const timestampUtc = record.freshness.optimizationTimestampUtc
    const chainId = record.source.chainId
    return timestampUtc && chainId !== null
      ? {
          chainId,
          vault: record.vault,
          timestampUtc,
          optimizerStrategies: record.strategyDebtRatios
        }
      : null
  })
  const snapshots = await getHistoricalAllocationSnapshots(
    requestsByRecord.filter((request): request is HistoricalAllocationRequest => request !== null)
  )

  return records.map((record, index) => {
    const request = requestsByRecord[index]
    const snapshot = request ? (snapshots.get(getHistoricalAllocationRequestKey(request)) ?? null) : null
    return reconcileOptimizationRecord(record, snapshot)
  })
}

export function addFallbackAllocationSnapshots(
  records: readonly VaultOptimizationRecord[]
): ReconciledVaultOptimizationRecord[] {
  return records.map((record) => reconcileOptimizationRecord(record, null))
}
