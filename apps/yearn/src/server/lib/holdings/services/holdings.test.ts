import { describe, expect, it } from 'vitest'
import type { DepositEvent, TransferEvent } from '../types'
import { buildPositionTimeline, getShareBalanceAtTimestamp, getUniqueVaults } from './holdings'

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
