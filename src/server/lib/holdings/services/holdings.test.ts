import { describe, expect, it } from 'vitest'
import type { DepositEvent, TimelineEvent, TransferEvent } from '../types'
import {
  buildPositionTimeline,
  buildPositionTimelineIndex,
  getIndexedShareBalanceAtTimestamp,
  getShareBalanceAtTimestamp,
  getUniqueVaults
} from './holdings'

describe('buildPositionTimeline', () => {
  it('normalizes staking wrapper events into the underlying vault family', () => {
    const deposits: DepositEvent[] = [
      {
        id: 'deposit-underlying',
        vaultAddress: '0x182863131F9a4630fF9E27830d945B1413e347E8',
        chainId: 1,
        blockNumber: 10,
        blockTimestamp: 100,
        logIndex: 0,
        transactionHash: '0x1',
        transactionFrom: '0xuser',
        owner: '0xuser',
        sender: '0xuser',
        assets: '100',
        shares: '100'
      }
    ]
    const transfersIn: TransferEvent[] = [
      {
        id: 'transfer-staking',
        vaultAddress: '0xd57aea3686d623da2dcebc87010a4f2f38ac7b15',
        chainId: 1,
        blockNumber: 11,
        blockTimestamp: 200,
        logIndex: 0,
        transactionHash: '0x2',
        transactionFrom: '0xuser',
        sender: '0xother',
        receiver: '0xuser',
        value: '50'
      }
    ]

    const timeline = buildPositionTimeline(deposits, [], transfersIn, [])

    expect(getUniqueVaults(timeline)).toEqual([
      {
        chainId: 1,
        vaultAddress: '0x182863131f9a4630ff9e27830d945b1413e347e8'
      }
    ])
    expect(getShareBalanceAtTimestamp(timeline, '0x182863131F9a4630fF9E27830d945B1413e347E8', 1, 300)).toBe(BigInt(150))
  })
})

describe('position timeline index', () => {
  it('matches timeline scans before, between, on, and after balance changes', () => {
    const vaultAddress = '0x00000000000000000000000000000000000000AA'
    const otherVaultAddress = '0x00000000000000000000000000000000000000bb'
    const timeline: TimelineEvent[] = [
      { vaultAddress: vaultAddress.toLowerCase(), chainId: 1, blockNumber: 1, blockTimestamp: 100, sharesChange: 10n },
      { vaultAddress: otherVaultAddress, chainId: 1, blockNumber: 2, blockTimestamp: 150, sharesChange: 50n },
      { vaultAddress: vaultAddress.toLowerCase(), chainId: 1, blockNumber: 3, blockTimestamp: 200, sharesChange: -4n },
      { vaultAddress: vaultAddress.toLowerCase(), chainId: 1, blockNumber: 4, blockTimestamp: 200, sharesChange: 2n },
      { vaultAddress: vaultAddress.toLowerCase(), chainId: 1, blockNumber: 5, blockTimestamp: 300, sharesChange: -20n },
      { vaultAddress: vaultAddress.toLowerCase(), chainId: 1, blockNumber: 6, blockTimestamp: 400, sharesChange: 5n }
    ]
    const index = buildPositionTimelineIndex(timeline)
    const timestamps = [50, 100, 199, 200, 299, 300, 350, 400, 500]

    expect(timestamps.map((timestamp) => getIndexedShareBalanceAtTimestamp(index, vaultAddress, 1, timestamp))).toEqual(
      timestamps.map((timestamp) => getShareBalanceAtTimestamp(timeline, vaultAddress, 1, timestamp))
    )
    expect(index.get(`1:${vaultAddress.toLowerCase()}`)?.timestamps).toEqual([100, 200, 300, 400])
    expect(getIndexedShareBalanceAtTimestamp(index, otherVaultAddress.toUpperCase(), 1, 150)).toBe(50n)
    expect(getIndexedShareBalanceAtTimestamp(index, vaultAddress, 10, 500)).toBe(0n)
  })

  it('indexes a large event history once while preserving exact query results', () => {
    const vaults = Array.from({ length: 200 }, (_value, index) => `0x${index.toString(16).padStart(40, '0')}`)
    const timeline: TimelineEvent[] = Array.from({ length: 20_000 }, (_value, index) => ({
      vaultAddress: vaults[index % vaults.length]!,
      chainId: 1,
      blockNumber: index,
      blockTimestamp: 1_000 + index,
      sharesChange: index % 5 === 0 ? -1n : 2n
    }))
    const positionIndex = buildPositionTimelineIndex(timeline)
    const sampleQueries = [
      { vaultAddress: vaults[0]!, timestamp: 5_000 },
      { vaultAddress: vaults[17]!, timestamp: 12_345 },
      { vaultAddress: vaults[199]!, timestamp: 30_000 }
    ]

    expect(positionIndex.size).toBe(vaults.length)
    expect(
      sampleQueries.map(({ vaultAddress, timestamp }) =>
        getIndexedShareBalanceAtTimestamp(positionIndex, vaultAddress, 1, timestamp)
      )
    ).toEqual(
      sampleQueries.map(({ vaultAddress, timestamp }) =>
        getShareBalanceAtTimestamp(timeline, vaultAddress, 1, timestamp)
      )
    )
  })
})
