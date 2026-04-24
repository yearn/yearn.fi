import type { TDoaOptimizationRecord } from '@shared/utils/schemas/doaOptimizationSchema'
import { describe, expect, it } from 'vitest'
import { buildReallocationPanels, buildStateTransitionSankeyGraph, type TCurrentAllocationInput } from './reallocations'

function makeOptimizationRecord({
  currentApr = 250,
  explain = 'Mock explain',
  key,
  latestMatchedTimestampUtc = null,
  proposedApr = 300,
  strategies,
  timestampUtc = null,
  vault = '0x1111111111111111111111111111111111111111'
}: {
  currentApr?: number
  explain?: string
  key: string
  latestMatchedTimestampUtc?: string | null
  proposedApr?: number
  strategies: TDoaOptimizationRecord['strategyDebtRatios']
  timestampUtc?: string | null
  vault?: `0x${string}`
}): TDoaOptimizationRecord {
  return {
    vault,
    strategyDebtRatios: strategies,
    currentApr,
    proposedApr,
    explain,
    source: {
      key,
      chainId: 1,
      revision: key.split(':').at(-1) ?? 'latest',
      isLatestAlias: key.endsWith(':latest'),
      timestampUtc,
      latestMatchedTimestampUtc
    }
  }
}

describe('buildReallocationPanels', () => {
  it('replaces the proposal tail with a live current panel when kong matches the latest redis snapshot', () => {
    const latestTimestamp = '2026-04-22 10:00:00 UTC'
    const currentTimestamp = '2026-04-23T14:30:00.000Z'
    const optimization = makeOptimizationRecord({
      key: 'doa:optimizations:1:latest',
      latestMatchedTimestampUtc: latestTimestamp,
      strategies: [
        {
          strategy: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          name: 'Alpha',
          currentRatio: 6000,
          targetRatio: 4500,
          currentApr: 220,
          targetApr: 260
        },
        {
          strategy: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          name: 'Beta',
          currentRatio: 4000,
          targetRatio: 5500,
          currentApr: 180,
          targetApr: 240
        }
      ]
    })
    const currentAllocation: TCurrentAllocationInput = {
      timestampUtc: currentTimestamp,
      strategies: [
        {
          strategyAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          name: 'Alpha',
          allocationPct: 60
        },
        {
          strategyAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          name: 'Beta',
          allocationPct: 40
        }
      ]
    }

    const panels = buildReallocationPanels([optimization], {}, currentAllocation)

    expect(panels).toHaveLength(1)
    expect(panels[0]?.kind).toBe('current')
    expect(panels[0]?.beforeTimestampUtc).toBe(latestTimestamp)
    expect(panels[0]?.afterTimestampUtc).toBe(currentTimestamp)
    expect(panels[0]?.beforeState.strategies.map((strategy) => strategy.allocationPct)).toEqual([60, 40])
    expect(panels[0]?.afterState.strategies.map((strategy) => strategy.allocationPct)).toEqual([60, 40])
  })

  it('adds a live final panel from the latest redis snapshot to the current kong allocation when they diverge', () => {
    const latestTimestamp = '2026-04-22 10:00:00 UTC'
    const currentTimestamp = '2026-04-23T14:30:00.000Z'
    const optimization = makeOptimizationRecord({
      key: 'doa:optimizations:1:latest',
      latestMatchedTimestampUtc: latestTimestamp,
      strategies: [
        {
          strategy: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          name: 'Alpha',
          currentRatio: 6000,
          targetRatio: 4500,
          currentApr: 220,
          targetApr: 260
        },
        {
          strategy: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          name: 'Beta',
          currentRatio: 4000,
          targetRatio: 5500,
          currentApr: 180,
          targetApr: 240
        }
      ]
    })
    const currentAllocation: TCurrentAllocationInput = {
      timestampUtc: currentTimestamp,
      strategies: [
        {
          strategyAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          name: 'Alpha',
          allocationPct: 45
        },
        {
          strategyAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          name: 'Beta',
          allocationPct: 55
        }
      ]
    }

    const panels = buildReallocationPanels([optimization], {}, currentAllocation)

    expect(panels).toHaveLength(1)
    expect(panels[0]?.kind).toBe('current')
    expect(panels[0]?.beforeState.strategies.map((strategy) => strategy.allocationPct)).toEqual([60, 40])
    expect(panels[0]?.afterState.strategies.map((strategy) => strategy.allocationPct)).toEqual([45, 55])

    const graph = buildStateTransitionSankeyGraph(panels[0]!.beforeState.strategies, panels[0]!.afterState.strategies)
    expect(graph.links.map((link) => link.value)).toEqual([45, 40, 15])
  })

  it('updates the latest historical panel timestamp instead of appending a no-op current panel when kong matches', () => {
    const olderTimestamp = '2026-04-20 08:30:00 UTC'
    const latestTimestamp = '2026-04-22 10:00:00 UTC'
    const currentTimestamp = '2026-04-23T14:30:00.000Z'
    const olderSnapshot = makeOptimizationRecord({
      key: 'doa:optimizations:1:1771317000',
      timestampUtc: olderTimestamp,
      strategies: [
        {
          strategy: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          name: 'Alpha',
          currentRatio: 7000,
          targetRatio: 7000,
          currentApr: 220,
          targetApr: 220
        },
        {
          strategy: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          name: 'Beta',
          currentRatio: 3000,
          targetRatio: 3000,
          currentApr: 180,
          targetApr: 180
        }
      ]
    })
    const latestSnapshot = makeOptimizationRecord({
      key: 'doa:optimizations:1:latest',
      latestMatchedTimestampUtc: latestTimestamp,
      strategies: [
        {
          strategy: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          name: 'Alpha',
          currentRatio: 6000,
          targetRatio: 4500,
          currentApr: 220,
          targetApr: 260
        },
        {
          strategy: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          name: 'Beta',
          currentRatio: 4000,
          targetRatio: 5500,
          currentApr: 180,
          targetApr: 240
        }
      ]
    })
    const currentAllocation: TCurrentAllocationInput = {
      timestampUtc: currentTimestamp,
      strategies: [
        {
          strategyAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          name: 'Alpha',
          allocationPct: 60
        },
        {
          strategyAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          name: 'Beta',
          allocationPct: 40
        }
      ]
    }

    const panels = buildReallocationPanels([latestSnapshot, olderSnapshot], {}, currentAllocation)

    expect(panels).toHaveLength(1)
    expect(panels[0]?.kind).toBe('historical')
    expect(panels[0]?.beforeTimestampUtc).toBe(olderTimestamp)
    expect(panels[0]?.afterTimestampUtc).toBe(currentTimestamp)
    expect(panels[0]?.afterState.strategies.map((strategy) => strategy.allocationPct)).toEqual([60, 40])
  })

  it('builds a proposal panel for a single optimizer snapshot and applies strategy name overrides', () => {
    const optimization = makeOptimizationRecord({
      key: 'doa:optimizations:1:latest',
      latestMatchedTimestampUtc: '2026-04-22 10:00:00 UTC',
      strategies: [
        {
          strategy: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          name: 'Strategy 1',
          currentRatio: 7000,
          targetRatio: 4500,
          currentApr: 220,
          targetApr: 260
        },
        {
          strategy: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          name: 'Strategy 2',
          currentRatio: 3000,
          targetRatio: 5500,
          currentApr: 180,
          targetApr: 240
        }
      ]
    })

    const panels = buildReallocationPanels([optimization], {
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa': 'Lender Alpha',
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb': 'Lender Beta'
    })

    expect(panels).toHaveLength(1)
    expect(panels[0]?.kind).toBe('proposal')
    expect(panels[0]?.beforeState.strategies.map((strategy) => strategy.name)).toEqual(['Lender Alpha', 'Lender Beta'])
    expect(panels[0]?.afterState.strategies.map((strategy) => strategy.allocationPct)).toEqual([45, 55])
  })

  it('dedupes latest aliases and produces both historical and proposal panels', () => {
    const latestTimestamp = '2026-04-22 10:00:00 UTC'
    const olderTimestamp = '2026-04-20 08:30:00 UTC'
    const duplicatedLatest = makeOptimizationRecord({
      key: 'doa:optimizations:1:latest',
      latestMatchedTimestampUtc: latestTimestamp,
      strategies: [
        {
          strategy: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          name: 'Alpha',
          currentRatio: 6000,
          targetRatio: 5000,
          currentApr: 220,
          targetApr: 260
        },
        {
          strategy: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          name: 'Beta',
          currentRatio: 4000,
          targetRatio: 5000,
          currentApr: 180,
          targetApr: 240
        }
      ]
    })
    const timestampedDuplicate = makeOptimizationRecord({
      key: 'doa:optimizations:1:1771489543',
      timestampUtc: latestTimestamp,
      strategies: duplicatedLatest.strategyDebtRatios
    })
    const olderSnapshot = makeOptimizationRecord({
      key: 'doa:optimizations:1:1771317000',
      timestampUtc: olderTimestamp,
      strategies: [
        {
          strategy: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          name: 'Alpha',
          currentRatio: 8000,
          targetRatio: 6000,
          currentApr: 210,
          targetApr: 220
        },
        {
          strategy: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          name: 'Beta',
          currentRatio: 2000,
          targetRatio: 4000,
          currentApr: 170,
          targetApr: 180
        }
      ]
    })

    const panels = buildReallocationPanels([duplicatedLatest, timestampedDuplicate, olderSnapshot])

    expect(panels).toHaveLength(2)
    expect(panels.map((panel) => panel.kind)).toEqual(['historical', 'proposal'])
    expect(panels[0]?.beforeTimestampUtc).toBe(olderTimestamp)
    expect(panels[0]?.afterTimestampUtc).toBe(latestTimestamp)

    const graph = buildStateTransitionSankeyGraph(panels[1]!.beforeState.strategies, panels[1]!.afterState.strategies)
    expect(graph.nodes.map((node) => node.id)).toEqual([
      'before:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'before:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      'after:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'after:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    ])
    expect(graph.links.map((link) => link.value)).toEqual([50, 40, 10])
  })

  it('keeps a shared snapshot ordered consistently across adjacent panels', () => {
    const latestTimestamp = '2026-04-22 10:00:00 UTC'
    const olderTimestamp = '2026-04-20 08:30:00 UTC'
    const olderSnapshot = makeOptimizationRecord({
      key: 'doa:optimizations:1:1771317000',
      timestampUtc: olderTimestamp,
      strategies: [
        {
          strategy: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          name: 'Alpha',
          currentRatio: 5000,
          targetRatio: 5000,
          currentApr: 210,
          targetApr: 220
        },
        {
          strategy: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          name: 'Beta',
          currentRatio: 3000,
          targetRatio: 3000,
          currentApr: 170,
          targetApr: 180
        },
        {
          strategy: '0xcccccccccccccccccccccccccccccccccccccccc',
          name: 'Gamma',
          currentRatio: 2000,
          targetRatio: 2000,
          currentApr: 160,
          targetApr: 165
        }
      ]
    })
    const latestSnapshot = makeOptimizationRecord({
      key: 'doa:optimizations:1:latest',
      latestMatchedTimestampUtc: latestTimestamp,
      strategies: [
        {
          strategy: '0xcccccccccccccccccccccccccccccccccccccccc',
          name: 'Gamma',
          currentRatio: 2500,
          targetRatio: 2000,
          currentApr: 160,
          targetApr: 170
        },
        {
          strategy: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          name: 'Alpha',
          currentRatio: 5500,
          targetRatio: 5000,
          currentApr: 210,
          targetApr: 225
        },
        {
          strategy: '0xdddddddddddddddddddddddddddddddddddddddd',
          name: 'Delta',
          currentRatio: 2000,
          targetRatio: 3000,
          currentApr: 190,
          targetApr: 240
        }
      ]
    })

    const panels = buildReallocationPanels([latestSnapshot, olderSnapshot])

    expect(panels).toHaveLength(2)
    expect(panels[0]?.afterState.strategies.map((strategy) => strategy.name)).toEqual(['Alpha', 'Gamma', 'Delta'])
    expect(panels[1]?.beforeState.strategies.map((strategy) => strategy.name)).toEqual(['Alpha', 'Gamma', 'Delta'])

    const historicalGraph = buildStateTransitionSankeyGraph(
      panels[0]!.beforeState.strategies,
      panels[0]!.afterState.strategies
    )
    const proposalGraph = buildStateTransitionSankeyGraph(
      panels[1]!.beforeState.strategies,
      panels[1]!.afterState.strategies
    )

    expect(historicalGraph.nodes.filter((node) => node.side === 'after').map((node) => node.displayName)).toEqual([
      'Alpha',
      'Gamma',
      'Delta'
    ])
    expect(proposalGraph.nodes.filter((node) => node.side === 'before').map((node) => node.displayName)).toEqual([
      'Alpha',
      'Gamma',
      'Delta'
    ])
  })
})
