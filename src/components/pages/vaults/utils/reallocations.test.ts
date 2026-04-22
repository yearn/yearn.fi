import type { TDoaOptimizationRecord } from '@shared/utils/schemas/doaOptimizationSchema'
import { describe, expect, it } from 'vitest'
import { buildReallocationPanels, buildStateTransitionSankeyGraph } from './reallocations'

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
})
