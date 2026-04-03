import { describe, expect, it } from 'vitest'
import type { DepositEvent, TransferEvent, WithdrawEvent } from '../types'
import {
  buildRawPnlEvents,
  filterDirectInteractionLedgers,
  filterRelevantHoldingsLedgers,
  processRawPnlEvents
} from './pnl'

const USER = '0x96a489a533ba0913dd8e507e6d985a45bc783566'
const ROUTER = '0x1111111111111111111111111111111111111111'
const MIGRATOR = '0x9327e2fdc57c7d70782f29ab46f6385afaf4503c'
const YEARN_4626_ROUTER = '0x1112dbcf805682e828606f74ab717abf4b4fd8de'
const ENSO_EXECUTOR = '0x4fe93ebc4ce6ae4f81601cc7ce7139023919e003'
const STAKING_VAULT = '0x622fa41799406b120f9a40da843d358b7b2cfee3'
const UNDERLYING_VAULT = '0xbe53a109b494e5c9f97b9cd39fe969be68bf6204'
const REWARD_DISTRIBUTOR = '0xb226c52eb411326cdb54824a88abafdaaff16d3d'
const REWARD_VAULT = '0xbf319ddc2edc1eb6fdf9910e39b37be221c8805f'
const KATANA_REWARD_DISTRIBUTOR = '0xa03e39cdeac8c2823a6edc80956207294807c20d'
const KATANA_REWARD_VAULT = '0x80c34bd3a3569e126e7055831036aa7b212cb159'
const KATANA_MULTISIG_REWARD_DISTRIBUTORS = [
  '0x67c912ff560951526bffdff66dfbd4df8ae23756',
  '0x5480f3152748809495bd56c14eab4a622aa3a19b'
] as const
const KATANA_MULTISIG_REWARD_VAULTS = [
  '0x80c34bd3a3569e126e7055831036aa7b212cb159',
  '0xe007ca01894c863d7898045ed5a3b4abf0b18f37',
  '0xaa0362ecc584b985056e47812931270b99c91f9d',
  '0x9a6bd7b6fd5c4f87eb66356441502fc7dcdd185b'
] as const
const SOURCE_MIGRATION_VAULT = '0x1635b506a88fbf428465ad65d00e8d6b6e5846c3'
const DESTINATION_MIGRATION_VAULT = '0x75a291f0232add37d72dd1dcff55b715755ecdee'
const ENDO_STEP_VAULT = '0xc56413869c6cdf96496f2b1ef801fedbdfa7ddb0'
const FAMILY_KEY = `1:${UNDERLYING_VAULT}`
const REWARD_FAMILY_KEY = `1:${REWARD_VAULT}`
const KATANA_REWARD_FAMILY_KEY = `747474:${KATANA_REWARD_VAULT}`
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

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
  it('moves a family lot from vault shares to staked shares on a direct stake', () => {
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
    expect(ledger?.vaultLots).toEqual([])
    expect(ledger?.stakedLots).toEqual([{ shares: 100n, costBasis: 1000n, acquiredAt: 100 }])
    expect(ledger?.realizedEntries).toEqual([])
    expect(ledger?.totalDepositedAssets).toBe(1000n)
    expect(ledger?.eventCounts.underlyingDeposits).toBe(1)
    expect(ledger?.eventCounts.stakes).toBe(1)
  })

  it('moves a family lot from staked shares back to vault shares on unstake without realizing pnl', () => {
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
    expect(ledger?.vaultLots).toEqual([{ shares: 100n, costBasis: 1000n, acquiredAt: 100 }])
    expect(ledger?.stakedLots).toEqual([])
    expect(ledger?.realizedEntries).toEqual([])
    expect(ledger?.eventCounts.stakes).toBe(1)
    expect(ledger?.eventCounts.unstakes).toBe(1)
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
    expect(ledger?.vaultLots).toEqual([])
    expect(ledger?.stakedLots).toEqual([{ shares: 900n, costBasis: 1000n, acquiredAt: 200 }])
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
    expect(ledger?.vaultLots).toEqual([{ shares: 900n, costBasis: 1000n, acquiredAt: 100 }])
    expect(ledger?.stakedLots).toEqual([])
    expect(ledger?.totalDepositedAssets).toBe(1000n)
    expect(ledger?.eventCounts.underlyingDeposits).toBe(1)
  })

  it('classifies known reward distributor receipts as zero-basis rewards instead of unknown transfer-ins', () => {
    const rewardTransferIn = createTransferEvent({
      id: 'reward-transfer-in',
      transactionHash: '0xreward',
      vaultAddress: REWARD_VAULT,
      sender: REWARD_DISTRIBUTOR,
      receiver: USER,
      value: '100'
    })

    const ledger = processRawPnlEvents(
      buildRawPnlEvents({
        addressEvents: {
          deposits: [],
          withdrawals: [],
          transfersIn: [rewardTransferIn],
          transfersOut: []
        },
        transactionEvents: {
          deposits: [],
          withdrawals: [],
          transfers: [rewardTransferIn]
        }
      }),
      USER
    ).get(REWARD_FAMILY_KEY)

    expect(ledger).toBeDefined()
    expect(ledger?.vaultLots).toEqual([{ shares: 100n, costBasis: 0n, acquiredAt: 100 }])
    expect(ledger?.stakedLots).toEqual([])
    expect(ledger?.unknownCostBasisTransferInCount).toBe(0)
    expect(ledger?.unknownTransferInEntries).toEqual([])
    expect(ledger?.rewardTransferInEntries).toEqual([
      {
        timestamp: 100,
        shares: 100n,
        location: 'vault',
        distributor: REWARD_DISTRIBUTOR
      }
    ])
    expect(ledger?.eventCounts.rewardTransfersIn).toBe(1)
    expect(ledger?.eventCounts.externalTransfersIn).toBe(0)
    expect(ledger?.debugJournal.at(-1)?.view).toBe('reward_in_vault')
  })

  it('classifies known Katana reward distributor receipts as zero-basis rewards instead of unknown transfer-ins', () => {
    const rewardTransferIn = createTransferEvent({
      id: 'katana-reward-transfer-in',
      chainId: 747474,
      transactionHash: '0xkatana-reward',
      vaultAddress: KATANA_REWARD_VAULT,
      sender: KATANA_REWARD_DISTRIBUTOR,
      receiver: USER,
      value: '8523506'
    })

    const ledger = processRawPnlEvents(
      buildRawPnlEvents({
        addressEvents: {
          deposits: [],
          withdrawals: [],
          transfersIn: [rewardTransferIn],
          transfersOut: []
        },
        transactionEvents: {
          deposits: [],
          withdrawals: [],
          transfers: [rewardTransferIn]
        }
      }),
      USER
    ).get(KATANA_REWARD_FAMILY_KEY)

    expect(ledger).toBeDefined()
    expect(ledger?.vaultLots).toEqual([{ shares: 8523506n, costBasis: 0n, acquiredAt: 100 }])
    expect(ledger?.unknownCostBasisTransferInCount).toBe(0)
    expect(ledger?.unknownTransferInEntries).toEqual([])
    expect(ledger?.rewardTransferInEntries).toEqual([
      {
        timestamp: 100,
        shares: 8523506n,
        location: 'vault',
        distributor: KATANA_REWARD_DISTRIBUTOR
      }
    ])
    expect(ledger?.eventCounts.rewardTransfersIn).toBe(1)
    expect(ledger?.eventCounts.externalTransfersIn).toBe(0)
    expect(ledger?.debugJournal.at(-1)?.view).toBe('reward_in_vault')
  })

  it.each(
    KATANA_MULTISIG_REWARD_DISTRIBUTORS.flatMap((distributor) =>
      KATANA_MULTISIG_REWARD_VAULTS.map((vaultAddress) => [distributor, vaultAddress] as const)
    )
  )('classifies Katana multisig reward receipts from %s for %s as zero-basis rewards instead of unknown transfer-ins', (distributor, vaultAddress) => {
    const rewardTransferIn = createTransferEvent({
      id: `katana-multisig-reward-transfer-in-${distributor}-${vaultAddress}`,
      chainId: 747474,
      transactionHash: '0xkatana-multisig-reward',
      vaultAddress,
      sender: distributor,
      receiver: USER,
      value: '100'
    })

    const ledger = processRawPnlEvents(
      buildRawPnlEvents({
        addressEvents: {
          deposits: [],
          withdrawals: [],
          transfersIn: [rewardTransferIn],
          transfersOut: []
        },
        transactionEvents: {
          deposits: [],
          withdrawals: [],
          transfers: [rewardTransferIn]
        }
      }),
      USER
    ).get(`747474:${vaultAddress}`)

    expect(ledger).toBeDefined()
    expect(ledger?.vaultLots).toEqual([{ shares: 100n, costBasis: 0n, acquiredAt: 100 }])
    expect(ledger?.unknownCostBasisTransferInCount).toBe(0)
    expect(ledger?.unknownTransferInEntries).toEqual([])
    expect(ledger?.rewardTransferInEntries).toEqual([
      {
        timestamp: 100,
        shares: 100n,
        location: 'vault',
        distributor
      }
    ])
    expect(ledger?.eventCounts.rewardTransfersIn).toBe(1)
    expect(ledger?.eventCounts.externalTransfersIn).toBe(0)
    expect(ledger?.debugJournal.at(-1)?.view).toBe('reward_in_vault')
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
    expect(ledger?.vaultLots).toEqual([])
    expect(ledger?.stakedLots).toEqual([])
    expect(ledger?.realizedEntries).toEqual([
      {
        timestamp: 300,
        proceedsAssets: 1100n,
        basisAssets: 1000n,
        pnlAssets: 100n,
        consumedLots: [{ shares: 900n, costBasis: 1000n, acquiredAt: 200 }]
      }
    ])
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

  it('keeps transfer-only families with current shares in the holdings ledger set', () => {
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

    const filteredLedgers = filterRelevantHoldingsLedgers(transferOnlyLedger)

    expect(transferOnlyLedger.get(FAMILY_KEY)).toBeDefined()
    expect(filteredLedgers.get(FAMILY_KEY)).toBeDefined()
  })

  it('treats same-vault withdraw and redeposit in the same tx as a basis rollover', () => {
    const initialDeposit = createDepositEvent({
      id: 'initial-deposit',
      transactionHash: '0xinitial',
      assets: '1000',
      shares: '100'
    })
    const rolloverTransferOut = createTransferEvent({
      id: 'rollover-transfer-out',
      transactionHash: '0xrollover',
      blockNumber: 2,
      blockTimestamp: 200,
      logIndex: 1,
      sender: USER,
      receiver: '0x0000000000000000000000000000000000000000',
      value: '100'
    })
    const rolloverWithdraw = createWithdrawEvent({
      id: 'rollover-withdraw',
      transactionHash: '0xrollover',
      blockNumber: 2,
      blockTimestamp: 200,
      logIndex: 2,
      owner: USER,
      assets: '1100',
      shares: '100'
    })
    const rolloverTransferIn = createTransferEvent({
      id: 'rollover-transfer-in',
      transactionHash: '0xrollover',
      blockNumber: 2,
      blockTimestamp: 200,
      logIndex: 3,
      sender: '0x0000000000000000000000000000000000000000',
      receiver: USER,
      value: '99'
    })
    const rolloverDeposit = createDepositEvent({
      id: 'rollover-deposit',
      transactionHash: '0xrollover',
      blockNumber: 2,
      blockTimestamp: 200,
      logIndex: 4,
      owner: USER,
      sender: ROUTER,
      assets: '1100',
      shares: '99'
    })

    const ledger = processRawPnlEvents(
      buildRawPnlEvents({
        addressEvents: {
          deposits: [initialDeposit, rolloverDeposit],
          withdrawals: [rolloverWithdraw],
          transfersIn: [rolloverTransferIn],
          transfersOut: [rolloverTransferOut]
        },
        transactionEvents: {
          deposits: [initialDeposit, rolloverDeposit],
          withdrawals: [rolloverWithdraw],
          transfers: [rolloverTransferOut, rolloverTransferIn]
        }
      }),
      USER
    ).get(FAMILY_KEY)

    expect(ledger).toBeDefined()
    expect(ledger?.vaultLots).toEqual([{ shares: 99n, costBasis: 1000n, acquiredAt: 100 }])
    expect(ledger?.stakedLots).toEqual([])
    expect(ledger?.realizedEntries).toEqual([])
    expect(ledger?.unknownCostBasisTransferInCount).toBe(0)
    expect(ledger?.withdrawalsWithUnknownCostBasis).toBe(0)
    expect(ledger?.totalDepositedAssets).toBe(1000n)
    expect(ledger?.totalWithdrawnAssets).toBe(0n)
    expect(ledger?.eventCounts.underlyingDeposits).toBe(1)
    expect(ledger?.eventCounts.underlyingWithdrawals).toBe(0)
    expect(ledger?.debugJournal.at(-1)?.view).toBe('same_vault_rollover->vault')
  })

  it('rolls known source basis into the destination vault on a known migrator tx', () => {
    const sourceFamilyKey = `1:${SOURCE_MIGRATION_VAULT}`
    const destinationFamilyKey = `1:${DESTINATION_MIGRATION_VAULT}`
    const sourceDeposit = createDepositEvent({
      id: 'source-deposit',
      transactionHash: '0xsource-deposit',
      vaultAddress: SOURCE_MIGRATION_VAULT,
      assets: '1000',
      shares: '100'
    })
    const migrateOut = createTransferEvent({
      id: 'migrate-out',
      transactionHash: '0xmigrate',
      blockNumber: 2,
      blockTimestamp: 200,
      logIndex: 1,
      vaultAddress: SOURCE_MIGRATION_VAULT,
      sender: USER,
      receiver: MIGRATOR,
      value: '100'
    })
    const migrateBurn = createTransferEvent({
      id: 'migrate-burn',
      transactionHash: '0xmigrate',
      blockNumber: 2,
      blockTimestamp: 200,
      logIndex: 2,
      vaultAddress: SOURCE_MIGRATION_VAULT,
      sender: MIGRATOR,
      receiver: ZERO_ADDRESS,
      value: '100'
    })
    const destinationMint = createTransferEvent({
      id: 'destination-mint',
      transactionHash: '0xmigrate',
      blockNumber: 2,
      blockTimestamp: 200,
      logIndex: 3,
      vaultAddress: DESTINATION_MIGRATION_VAULT,
      sender: ZERO_ADDRESS,
      receiver: USER,
      value: '80'
    })
    const destinationDeposit = createDepositEvent({
      id: 'destination-deposit',
      transactionHash: '0xmigrate',
      blockNumber: 2,
      blockTimestamp: 200,
      logIndex: 4,
      vaultAddress: DESTINATION_MIGRATION_VAULT,
      owner: USER,
      sender: USER,
      assets: '1100',
      shares: '80'
    })

    const ledgers = processRawPnlEvents(
      buildRawPnlEvents({
        addressEvents: {
          deposits: [sourceDeposit, destinationDeposit],
          withdrawals: [],
          transfersIn: [destinationMint],
          transfersOut: [migrateOut]
        },
        transactionEvents: {
          deposits: [sourceDeposit, destinationDeposit],
          withdrawals: [],
          transfers: [migrateOut, migrateBurn, destinationMint]
        }
      }),
      USER
    )
    const filteredLedgers = filterDirectInteractionLedgers(ledgers)
    const sourceLedger = ledgers.get(sourceFamilyKey)
    const destinationLedger = ledgers.get(destinationFamilyKey)

    expect(sourceLedger?.vaultLots).toEqual([])
    expect(sourceLedger?.realizedEntries).toEqual([])
    expect(sourceLedger?.eventCounts.migrationsOut).toBe(1)
    expect(destinationLedger?.vaultLots).toEqual([{ shares: 80n, costBasis: 1000n, acquiredAt: 100 }])
    expect(destinationLedger?.totalDepositedAssets).toBe(0n)
    expect(destinationLedger?.realizedEntries).toEqual([])
    expect(destinationLedger?.eventCounts.migrationsIn).toBe(1)
    expect(destinationLedger?.debugJournal.at(-1)?.view).toBe('migrate_in->vault')
    expect(filteredLedgers.get(destinationFamilyKey)).toBeDefined()
  })

  it('marks migrated destination shares as unknown when the source vault only had a mint transfer', () => {
    const sourceFamilyKey = `1:${SOURCE_MIGRATION_VAULT}`
    const destinationFamilyKey = `1:${DESTINATION_MIGRATION_VAULT}`
    const sourceMint = createTransferEvent({
      id: 'source-mint',
      transactionHash: '0xsource-mint',
      vaultAddress: SOURCE_MIGRATION_VAULT,
      sender: ZERO_ADDRESS,
      receiver: USER,
      value: '158'
    })
    const migrateOut = createTransferEvent({
      id: 'migrate-out',
      transactionHash: '0xmigrate-unknown',
      blockNumber: 2,
      blockTimestamp: 200,
      logIndex: 1,
      vaultAddress: SOURCE_MIGRATION_VAULT,
      sender: USER,
      receiver: MIGRATOR,
      value: '158'
    })
    const migrateBurn = createTransferEvent({
      id: 'migrate-burn',
      transactionHash: '0xmigrate-unknown',
      blockNumber: 2,
      blockTimestamp: 200,
      logIndex: 2,
      vaultAddress: SOURCE_MIGRATION_VAULT,
      sender: MIGRATOR,
      receiver: ZERO_ADDRESS,
      value: '158'
    })
    const destinationMint = createTransferEvent({
      id: 'destination-mint',
      transactionHash: '0xmigrate-unknown',
      blockNumber: 2,
      blockTimestamp: 200,
      logIndex: 3,
      vaultAddress: DESTINATION_MIGRATION_VAULT,
      sender: ZERO_ADDRESS,
      receiver: USER,
      value: '175'
    })
    const destinationDeposit = createDepositEvent({
      id: 'destination-deposit',
      transactionHash: '0xmigrate-unknown',
      blockNumber: 2,
      blockTimestamp: 200,
      logIndex: 4,
      vaultAddress: DESTINATION_MIGRATION_VAULT,
      owner: USER,
      sender: USER,
      assets: '304',
      shares: '175'
    })

    const ledgers = processRawPnlEvents(
      buildRawPnlEvents({
        addressEvents: {
          deposits: [destinationDeposit],
          withdrawals: [],
          transfersIn: [sourceMint, destinationMint],
          transfersOut: [migrateOut]
        },
        transactionEvents: {
          deposits: [destinationDeposit],
          withdrawals: [],
          transfers: [sourceMint, migrateOut, migrateBurn, destinationMint]
        }
      }),
      USER
    )
    const filteredLedgers = filterDirectInteractionLedgers(ledgers)
    const sourceLedger = ledgers.get(sourceFamilyKey)
    const destinationLedger = ledgers.get(destinationFamilyKey)

    expect(sourceLedger?.unmatchedTransferOutShares).toBe(158n)
    expect(destinationLedger?.vaultLots).toEqual([{ shares: 175n, costBasis: null, acquiredAt: 200 }])
    expect(destinationLedger?.unknownCostBasisTransferInCount).toBe(1)
    expect(destinationLedger?.unknownCostBasisTransferInShares).toBe(175n)
    expect(destinationLedger?.totalDepositedAssets).toBe(0n)
    expect(destinationLedger?.eventCounts.migrationsIn).toBe(1)
    expect(filteredLedgers.get(sourceFamilyKey)).toBeUndefined()
    expect(filteredLedgers.get(destinationFamilyKey)).toBeDefined()
  })

  it('treats the Yearn 4626 router as a valid migration router', () => {
    const destinationFamilyKey = `1:${DESTINATION_MIGRATION_VAULT}`
    const sourceDeposit = createDepositEvent({
      id: 'source-deposit-router',
      transactionHash: '0xsource-deposit-router',
      vaultAddress: SOURCE_MIGRATION_VAULT,
      assets: '1000',
      shares: '100'
    })
    const migrateOut = createTransferEvent({
      id: 'migrate-out-router',
      transactionHash: '0xmigrate-router',
      blockNumber: 2,
      blockTimestamp: 200,
      logIndex: 1,
      vaultAddress: SOURCE_MIGRATION_VAULT,
      sender: USER,
      receiver: YEARN_4626_ROUTER,
      value: '100'
    })
    const migrateBurn = createTransferEvent({
      id: 'migrate-burn-router',
      transactionHash: '0xmigrate-router',
      blockNumber: 2,
      blockTimestamp: 200,
      logIndex: 2,
      vaultAddress: SOURCE_MIGRATION_VAULT,
      sender: YEARN_4626_ROUTER,
      receiver: ZERO_ADDRESS,
      value: '100'
    })
    const destinationMint = createTransferEvent({
      id: 'destination-mint-router',
      transactionHash: '0xmigrate-router',
      blockNumber: 2,
      blockTimestamp: 200,
      logIndex: 3,
      vaultAddress: DESTINATION_MIGRATION_VAULT,
      sender: ZERO_ADDRESS,
      receiver: USER,
      value: '80'
    })
    const destinationDeposit = createDepositEvent({
      id: 'destination-deposit-router',
      transactionHash: '0xmigrate-router',
      blockNumber: 2,
      blockTimestamp: 200,
      logIndex: 4,
      vaultAddress: DESTINATION_MIGRATION_VAULT,
      owner: USER,
      sender: USER,
      assets: '1100',
      shares: '80'
    })

    const ledgers = processRawPnlEvents(
      buildRawPnlEvents({
        addressEvents: {
          deposits: [sourceDeposit, destinationDeposit],
          withdrawals: [],
          transfersIn: [destinationMint],
          transfersOut: [migrateOut]
        },
        transactionEvents: {
          deposits: [sourceDeposit, destinationDeposit],
          withdrawals: [],
          transfers: [migrateOut, migrateBurn, destinationMint]
        }
      }),
      USER
    )

    expect(ledgers.get(destinationFamilyKey)?.vaultLots).toEqual([{ shares: 80n, costBasis: 1000n, acquiredAt: 100 }])
    expect(ledgers.get(destinationFamilyKey)?.eventCounts.migrationsIn).toBe(1)
  })

  it('rolls basis through Enso-mediated cross-family vault rollovers', () => {
    const sourceFamilyKey = `1:${SOURCE_MIGRATION_VAULT}`
    const destinationFamilyKey = `1:${DESTINATION_MIGRATION_VAULT}`
    const sourceDeposit = createDepositEvent({
      id: 'source-deposit-enso',
      transactionHash: '0xsource-deposit-enso',
      vaultAddress: SOURCE_MIGRATION_VAULT,
      assets: '1000',
      shares: '100'
    })
    const migrateOut = createTransferEvent({
      id: 'migrate-out-enso',
      transactionHash: '0xenso-rollover',
      blockNumber: 2,
      blockTimestamp: 200,
      logIndex: 1,
      vaultAddress: SOURCE_MIGRATION_VAULT,
      sender: USER,
      receiver: ENSO_EXECUTOR,
      value: '100'
    })
    const migrateBurn = createTransferEvent({
      id: 'migrate-burn-enso',
      transactionHash: '0xenso-rollover',
      blockNumber: 2,
      blockTimestamp: 200,
      logIndex: 2,
      vaultAddress: SOURCE_MIGRATION_VAULT,
      sender: ENSO_EXECUTOR,
      receiver: ZERO_ADDRESS,
      value: '100'
    })
    const sourceWithdraw = createWithdrawEvent({
      id: 'source-withdraw-enso',
      transactionHash: '0xenso-rollover',
      blockNumber: 2,
      blockTimestamp: 200,
      logIndex: 3,
      vaultAddress: SOURCE_MIGRATION_VAULT,
      owner: ENSO_EXECUTOR,
      assets: '1100',
      shares: '100'
    })
    const ensoStepBurn = createTransferEvent({
      id: 'enso-step-burn',
      transactionHash: '0xenso-rollover',
      blockNumber: 2,
      blockTimestamp: 200,
      logIndex: 3,
      vaultAddress: ENDO_STEP_VAULT,
      sender: DESTINATION_MIGRATION_VAULT,
      receiver: ZERO_ADDRESS,
      value: '103'
    })
    const ensoStepWithdraw = createWithdrawEvent({
      id: 'enso-step-withdraw',
      transactionHash: '0xenso-rollover',
      blockNumber: 2,
      blockTimestamp: 200,
      logIndex: 4,
      vaultAddress: ENDO_STEP_VAULT,
      owner: DESTINATION_MIGRATION_VAULT,
      assets: '1100',
      shares: '103'
    })
    const destinationMint = createTransferEvent({
      id: 'destination-mint-enso',
      transactionHash: '0xenso-rollover',
      blockNumber: 2,
      blockTimestamp: 200,
      logIndex: 5,
      vaultAddress: DESTINATION_MIGRATION_VAULT,
      sender: ZERO_ADDRESS,
      receiver: USER,
      value: '81'
    })
    const destinationDeposit = createDepositEvent({
      id: 'destination-deposit-enso',
      transactionHash: '0xenso-rollover',
      blockNumber: 2,
      blockTimestamp: 200,
      logIndex: 6,
      vaultAddress: DESTINATION_MIGRATION_VAULT,
      owner: USER,
      sender: ENSO_EXECUTOR,
      assets: '1100',
      shares: '80'
    })

    const ledgers = processRawPnlEvents(
      buildRawPnlEvents({
        addressEvents: {
          deposits: [sourceDeposit, destinationDeposit],
          withdrawals: [],
          transfersIn: [destinationMint],
          transfersOut: [migrateOut]
        },
        transactionEvents: {
          deposits: [sourceDeposit, destinationDeposit],
          withdrawals: [sourceWithdraw, ensoStepWithdraw],
          transfers: [migrateOut, migrateBurn, ensoStepBurn, destinationMint]
        }
      }),
      USER
    )

    expect(ledgers.get(sourceFamilyKey)?.vaultLots).toEqual([])
    expect(ledgers.get(sourceFamilyKey)?.eventCounts.migrationsOut).toBe(1)
    expect(ledgers.get(destinationFamilyKey)?.vaultLots).toEqual([{ shares: 81n, costBasis: 1000n, acquiredAt: 100 }])
    expect(ledgers.get(destinationFamilyKey)?.unknownTransferInEntries).toEqual([])
    expect(ledgers.get(destinationFamilyKey)?.eventCounts.migrationsIn).toBe(1)
    expect(ledgers.get(destinationFamilyKey)?.debugJournal.at(-1)?.view).toBe('migrate_in->vault')
  })
})
