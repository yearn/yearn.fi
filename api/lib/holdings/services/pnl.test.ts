import { describe, expect, it } from 'vitest'
import type { DepositEvent, TransferEvent, WithdrawEvent } from '../types'
import { buildRawPnlEvents, filterDirectInteractionLedgers, processRawPnlEvents } from './pnl'

const USER = '0x96a489a533ba0913dd8e507e6d985a45bc783566'
const ROUTER = '0x1111111111111111111111111111111111111111'
const STAKING_VAULT = '0x622fa41799406b120f9a40da843d358b7b2cfee3'
const UNDERLYING_VAULT = '0xbe53a109b494e5c9f97b9cd39fe969be68bf6204'
const FAMILY_KEY = `1:${UNDERLYING_VAULT}`

function createDepositEvent(overrides: Partial<DepositEvent>): DepositEvent {
  return {
    id: 'deposit',
    vaultAddress: UNDERLYING_VAULT,
    chainId: 1,
    blockNumber: 1,
    blockTimestamp: 100,
    logIndex: 1,
    transactionHash: '0xdeposit',
    transactionFrom: USER,
    owner: USER,
    sender: USER,
    assets: '1000',
    shares: '100',
    ...overrides
  }
}

function createWithdrawEvent(overrides: Partial<WithdrawEvent>): WithdrawEvent {
  return {
    id: 'withdraw',
    vaultAddress: UNDERLYING_VAULT,
    chainId: 1,
    blockNumber: 1,
    blockTimestamp: 100,
    logIndex: 1,
    transactionHash: '0xwithdraw',
    transactionFrom: USER,
    owner: USER,
    assets: '1000',
    shares: '100',
    ...overrides
  }
}

function createTransferEvent(overrides: Partial<TransferEvent>): TransferEvent {
  return {
    id: 'transfer',
    vaultAddress: UNDERLYING_VAULT,
    chainId: 1,
    blockNumber: 1,
    blockTimestamp: 100,
    logIndex: 1,
    transactionHash: '0xtransfer',
    transactionFrom: USER,
    sender: ROUTER,
    receiver: USER,
    value: '100',
    ...overrides
  }
}

describe('processRawPnlEvents', () => {
  it('moves a family lot from wallet to staked on a direct stake wrap', () => {
    const underlyingDeposit = createDepositEvent()
    const stakeDeposit = createDepositEvent({
      id: 'stake-deposit',
      vaultAddress: STAKING_VAULT,
      blockNumber: 2,
      blockTimestamp: 200,
      logIndex: 2,
      transactionHash: '0xstake',
      assets: '100',
      shares: '100'
    })
    const underlyingTransferOut = createTransferEvent({
      id: 'underlying-transfer-out',
      blockNumber: 2,
      blockTimestamp: 200,
      logIndex: 1,
      transactionHash: '0xstake',
      vaultAddress: UNDERLYING_VAULT,
      sender: USER,
      receiver: STAKING_VAULT,
      value: '100'
    })

    const ledger = processRawPnlEvents(
      buildRawPnlEvents({
        addressEvents: {
          deposits: [underlyingDeposit, stakeDeposit],
          withdrawals: [],
          transfersIn: [],
          transfersOut: [underlyingTransferOut]
        },
        transactionEvents: {
          deposits: [underlyingDeposit, stakeDeposit],
          withdrawals: [],
          transfers: [underlyingTransferOut]
        }
      }),
      USER
    ).get(FAMILY_KEY)

    expect(ledger).toBeDefined()
    expect(ledger?.walletLots).toEqual([])
    expect(ledger?.stakedLots).toEqual([{ shares: 100n, costBasis: 1000n }])
    expect(ledger?.realizedEntries).toEqual([])
    expect(ledger?.totalDepositedAssets).toBe(1000n)
    expect(ledger?.eventCounts.underlyingDeposits).toBe(1)
    expect(ledger?.eventCounts.stakingWraps).toBe(1)
  })

  it('moves a family lot from staked back to wallet on unstake without realizing pnl', () => {
    const underlyingDeposit = createDepositEvent()
    const stakeDeposit = createDepositEvent({
      id: 'stake-deposit',
      vaultAddress: STAKING_VAULT,
      blockNumber: 2,
      blockTimestamp: 200,
      logIndex: 2,
      transactionHash: '0xstake',
      assets: '100',
      shares: '100'
    })
    const underlyingTransferOut = createTransferEvent({
      id: 'underlying-transfer-out',
      blockNumber: 2,
      blockTimestamp: 200,
      logIndex: 1,
      transactionHash: '0xstake',
      vaultAddress: UNDERLYING_VAULT,
      sender: USER,
      receiver: STAKING_VAULT,
      value: '100'
    })
    const stakeWithdraw = createWithdrawEvent({
      id: 'stake-withdraw',
      vaultAddress: STAKING_VAULT,
      blockNumber: 3,
      blockTimestamp: 300,
      logIndex: 1,
      transactionHash: '0xunstake',
      owner: USER,
      assets: '100',
      shares: '100'
    })
    const underlyingTransferIn = createTransferEvent({
      id: 'underlying-transfer-in',
      blockNumber: 3,
      blockTimestamp: 300,
      logIndex: 2,
      transactionHash: '0xunstake',
      vaultAddress: UNDERLYING_VAULT,
      sender: STAKING_VAULT,
      receiver: USER,
      value: '100'
    })

    const ledger = processRawPnlEvents(
      buildRawPnlEvents({
        addressEvents: {
          deposits: [underlyingDeposit, stakeDeposit],
          withdrawals: [stakeWithdraw],
          transfersIn: [underlyingTransferIn],
          transfersOut: [underlyingTransferOut]
        },
        transactionEvents: {
          deposits: [underlyingDeposit, stakeDeposit],
          withdrawals: [stakeWithdraw],
          transfers: [underlyingTransferOut, underlyingTransferIn]
        }
      }),
      USER
    ).get(FAMILY_KEY)

    expect(ledger).toBeDefined()
    expect(ledger?.walletLots).toEqual([{ shares: 100n, costBasis: 1000n }])
    expect(ledger?.stakedLots).toEqual([])
    expect(ledger?.realizedEntries).toEqual([])
    expect(ledger?.eventCounts.stakingWraps).toBe(1)
    expect(ledger?.eventCounts.stakingUnwraps).toBe(1)
  })

  it('uses the underlying vault deposit as cost basis for router stakes into staking vaults', () => {
    const underlyingDeposit = createDepositEvent({
      id: 'router-underlying-deposit',
      owner: ROUTER,
      sender: ROUTER,
      transactionHash: '0xrouter-stake',
      blockTimestamp: 200,
      blockNumber: 2,
      assets: '1000',
      shares: '900'
    })
    const stakingTransferIn = createTransferEvent({
      id: 'router-staking-transfer-in',
      vaultAddress: STAKING_VAULT,
      transactionHash: '0xrouter-stake',
      blockTimestamp: 200,
      blockNumber: 2,
      sender: ROUTER,
      receiver: USER,
      value: '900'
    })

    const ledger = processRawPnlEvents(
      buildRawPnlEvents({
        addressEvents: {
          deposits: [],
          withdrawals: [],
          transfersIn: [stakingTransferIn],
          transfersOut: []
        },
        transactionEvents: {
          deposits: [underlyingDeposit],
          withdrawals: [],
          transfers: [stakingTransferIn]
        }
      }),
      USER
    ).get(FAMILY_KEY)

    expect(ledger).toBeDefined()
    expect(ledger?.walletLots).toEqual([])
    expect(ledger?.stakedLots).toEqual([{ shares: 900n, costBasis: 1000n }])
    expect(ledger?.unknownCostBasisTransferInCount).toBe(0)
    expect(ledger?.eventCounts.underlyingDeposits).toBe(1)
    expect(ledger?.eventCounts.externalTransfersIn).toBe(0)
  })

  it('uses owner deposits even when the transaction sender is an external distributor', () => {
    const distributorDeposit = createDepositEvent({
      id: 'distributor-deposit',
      transactionHash: '0xdistributor',
      transactionFrom: '0x2222222222222222222222222222222222222222',
      sender: '0x3333333333333333333333333333333333333333',
      owner: USER,
      assets: '1000',
      shares: '900'
    })

    const ledger = processRawPnlEvents(
      buildRawPnlEvents({
        addressEvents: {
          deposits: [distributorDeposit],
          withdrawals: [],
          transfersIn: [],
          transfersOut: []
        },
        transactionEvents: {
          deposits: [],
          withdrawals: [],
          transfers: []
        }
      }),
      USER
    ).get(FAMILY_KEY)

    expect(ledger).toBeDefined()
    expect(ledger?.walletLots).toEqual([{ shares: 900n, costBasis: 1000n }])
    expect(ledger?.stakedLots).toEqual([])
    expect(ledger?.totalDepositedAssets).toBe(1000n)
    expect(ledger?.eventCounts.underlyingDeposits).toBe(1)
  })

  it('realizes pnl from underlying vault withdrawals when staked shares exit through a router', () => {
    const underlyingDeposit = createDepositEvent({
      id: 'router-underlying-deposit',
      owner: ROUTER,
      sender: ROUTER,
      transactionHash: '0xrouter-stake',
      blockTimestamp: 200,
      blockNumber: 2,
      assets: '1000',
      shares: '900'
    })
    const stakingTransferIn = createTransferEvent({
      id: 'router-staking-transfer-in',
      vaultAddress: STAKING_VAULT,
      transactionHash: '0xrouter-stake',
      blockTimestamp: 200,
      blockNumber: 2,
      sender: ROUTER,
      receiver: USER,
      value: '900'
    })
    const stakingTransferOut = createTransferEvent({
      id: 'router-staking-transfer-out',
      vaultAddress: STAKING_VAULT,
      transactionHash: '0xrouter-exit',
      blockTimestamp: 300,
      blockNumber: 3,
      sender: USER,
      receiver: ROUTER,
      value: '900'
    })
    const underlyingWithdraw = createWithdrawEvent({
      id: 'router-underlying-withdraw',
      owner: ROUTER,
      transactionHash: '0xrouter-exit',
      blockTimestamp: 300,
      blockNumber: 3,
      assets: '1100',
      shares: '900'
    })

    const ledger = processRawPnlEvents(
      buildRawPnlEvents({
        addressEvents: {
          deposits: [],
          withdrawals: [],
          transfersIn: [stakingTransferIn],
          transfersOut: [stakingTransferOut]
        },
        transactionEvents: {
          deposits: [underlyingDeposit],
          withdrawals: [underlyingWithdraw],
          transfers: [stakingTransferIn, stakingTransferOut]
        }
      }),
      USER
    ).get(FAMILY_KEY)

    expect(ledger).toBeDefined()
    expect(ledger?.walletLots).toEqual([])
    expect(ledger?.stakedLots).toEqual([])
    expect(ledger?.realizedEntries).toEqual([{ timestamp: 300, pnlAssets: 100n }])
    expect(ledger?.totalWithdrawnAssets).toBe(1100n)
    expect(ledger?.eventCounts.underlyingWithdrawals).toBe(1)
    expect(ledger?.withdrawalsWithUnknownCostBasis).toBe(0)
  })

  it('ignores tx-scoped family withdrawals when the user has no address-scoped activity on that family', () => {
    const internalWithdraw = createWithdrawEvent({
      id: 'internal-withdraw',
      transactionHash: '0xinternal-withdraw',
      transactionFrom: USER,
      owner: ROUTER,
      assets: '1100',
      shares: '900'
    })

    const ledgers = processRawPnlEvents(
      buildRawPnlEvents({
        addressEvents: {
          deposits: [],
          withdrawals: [],
          transfersIn: [],
          transfersOut: []
        },
        transactionEvents: {
          deposits: [],
          withdrawals: [internalWithdraw],
          transfers: []
        }
      }),
      USER
    )

    expect(ledgers.get(FAMILY_KEY)).toBeUndefined()
  })

  it('drops transfer-only families from direct-interaction pnl ledgers', () => {
    const transferOnlyLedger = processRawPnlEvents(
      buildRawPnlEvents({
        addressEvents: {
          deposits: [],
          withdrawals: [],
          transfersIn: [createTransferEvent()],
          transfersOut: []
        },
        transactionEvents: {
          deposits: [],
          withdrawals: [],
          transfers: [createTransferEvent()]
        }
      }),
      USER
    )

    const filteredLedgers = filterDirectInteractionLedgers(transferOnlyLedger)

    expect(transferOnlyLedger.get(FAMILY_KEY)).toBeDefined()
    expect(filteredLedgers.get(FAMILY_KEY)).toBeUndefined()
  })
})
