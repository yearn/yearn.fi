import { describe, expect, it } from 'vitest'
import type { UserEvents } from '../types'
import { buildPnlEvents, processPnlEvents } from './pnl'

function getEmptyEvents(): UserEvents {
  return {
    deposits: [],
    withdrawals: [],
    transfersIn: [],
    transfersOut: []
  }
}

describe('processPnlEvents', () => {
  it('matches a transfer-in against a withdrawal source that appears later in the same transaction', () => {
    const events = getEmptyEvents()

    events.deposits.push({
      id: 'deposit-old',
      vaultAddress: '0xold',
      chainId: 1,
      blockNumber: 1,
      blockTimestamp: 100,
      logIndex: 1,
      transactionHash: '0xdeposit',
      owner: '0xuser',
      sender: '0xuser',
      assets: '100',
      shares: '100'
    })

    events.transfersIn.push({
      id: 'transfer-new',
      vaultAddress: '0xnew',
      chainId: 1,
      blockNumber: 2,
      blockTimestamp: 200,
      logIndex: 1,
      transactionHash: '0xmigrate',
      sender: '0xold',
      receiver: '0xuser',
      value: '100'
    })

    events.withdrawals.push({
      id: 'withdraw-old',
      vaultAddress: '0xold',
      chainId: 1,
      blockNumber: 2,
      blockTimestamp: 200,
      logIndex: 2,
      transactionHash: '0xmigrate',
      owner: '0xuser',
      assets: '110',
      shares: '100'
    })

    events.withdrawals.push({
      id: 'withdraw-new',
      vaultAddress: '0xnew',
      chainId: 1,
      blockNumber: 3,
      blockTimestamp: 300,
      logIndex: 1,
      transactionHash: '0xexit',
      owner: '0xuser',
      assets: '110',
      shares: '100'
    })

    const ledgers = processPnlEvents(buildPnlEvents(events))
    const migratedVault = ledgers.get('1:0xnew')

    expect(migratedVault).toBeDefined()
    expect(migratedVault?.unmatchedTransferInCount).toBe(0)
    expect(migratedVault?.withdrawalsWithUnknownCostBasis).toBe(0)
    expect(migratedVault?.realizedEntries).toHaveLength(1)
    expect(migratedVault?.realizedEntries[0]?.pnlAssets.toString()).toBe('0')
  })

  it('tracks unmatched transfers as unknown-basis lots', () => {
    const events = getEmptyEvents()

    events.transfersIn.push({
      id: 'transfer-only',
      vaultAddress: '0xvault',
      chainId: 1,
      blockNumber: 1,
      blockTimestamp: 100,
      logIndex: 1,
      transactionHash: '0xtransfer',
      sender: '0xexternal',
      receiver: '0xuser',
      value: '250'
    })

    const ledgers = processPnlEvents(buildPnlEvents(events))
    const vault = ledgers.get('1:0xvault')

    expect(vault).toBeDefined()
    expect(vault?.unmatchedTransferInCount).toBe(1)
    expect(vault?.unmatchedTransferInShares.toString()).toBe('250')
    expect(vault?.lots).toEqual([{ shares: 250n, costBasis: null }])
  })
})
