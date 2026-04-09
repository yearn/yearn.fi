import { encodeAbiParameters, encodeEventTopics, parseAbiItem } from 'viem'
import { describe, expect, it } from 'vitest'
import type { TransferEvent, VaultMetadata } from '../types'
import { enrichRawPnlEventsWithCowTradeAcquisitions, type RpcTransactionReceipt } from './cow'
import { buildRawPnlEvents, processRawPnlEvents } from './pnl'

const USER = '0x96a489a533ba0913dd8e507e6d985a45bc783566'
const SOLVER = '0x6bf97afe2d2c790999cded2a8523009eb8a0823f'
const GPV2_SETTLEMENT = '0x9008d19f58aabd9ed0d60971565aa8510560ab41'
const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f'
const COW_VAULT = '0x27b5739e22ad9033bcbf192059122d163b60349d'
const ASSET_TOKEN = '0xfcc5c47be19d06bf83eb04298b026f81069ff65b'
const FAMILY_KEY = `1:${COW_VAULT}`
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const TRANSFER_EVENT = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')
const TRADE_EVENT = parseAbiItem(
  'event Trade(address indexed owner, address sellToken, address buyToken, uint256 sellAmount, uint256 buyAmount, uint256 feeAmount, bytes orderUid)'
)

function createTransferEvent(overrides: Partial<TransferEvent>): TransferEvent {
  return {
    id: 'transfer',
    vaultAddress: COW_VAULT,
    chainId: 1,
    blockNumber: 1,
    blockTimestamp: 100,
    logIndex: 1,
    transactionHash: '0xcow',
    transactionFrom: SOLVER,
    sender: GPV2_SETTLEMENT,
    receiver: USER,
    value: '500',
    ...overrides
  }
}

function createMetadataMap(): Map<string, VaultMetadata> {
  return new Map([
    [
      FAMILY_KEY,
      {
        address: COW_VAULT,
        chainId: 1,
        token: {
          address: ASSET_TOKEN,
          symbol: 'yCRV',
          decimals: 18
        },
        decimals: 18
      }
    ]
  ])
}

function createTransferLog(
  address: string,
  from: string,
  to: string,
  value: bigint,
  logIndex: number
): RpcTransactionReceipt['logs'][number] {
  return {
    address,
    topics: encodeEventTopics({
      abi: [TRANSFER_EVENT],
      eventName: 'Transfer',
      args: { from, to }
    }) as string[],
    data: encodeAbiParameters([{ type: 'uint256' }], [value]),
    logIndex: `0x${logIndex.toString(16)}`
  }
}

function createTradeLog(buyAmount: bigint): RpcTransactionReceipt['logs'][number] {
  return {
    address: GPV2_SETTLEMENT,
    topics: encodeEventTopics({
      abi: [TRADE_EVENT],
      eventName: 'Trade',
      args: { owner: USER }
    }) as string[],
    data: encodeAbiParameters(
      [
        { type: 'address', name: 'sellToken' },
        { type: 'address', name: 'buyToken' },
        { type: 'uint256', name: 'sellAmount' },
        { type: 'uint256', name: 'buyAmount' },
        { type: 'uint256', name: 'feeAmount' },
        { type: 'bytes', name: 'orderUid' }
      ],
      [DAI, COW_VAULT, 250n, buyAmount, 0n, '0x1234']
    ),
    logIndex: '0x0'
  }
}

function createReceipt(buyAmount: bigint): RpcTransactionReceipt {
  return {
    logs: [
      createTradeLog(buyAmount),
      createTransferLog(ASSET_TOKEN, GPV2_SETTLEMENT, COW_VAULT, 800n, 1),
      createTransferLog(COW_VAULT, ZERO_ADDRESS, GPV2_SETTLEMENT, 1000n, 2),
      createTransferLog(COW_VAULT, GPV2_SETTLEMENT, USER, buyAmount, 3)
    ]
  }
}

function createRawCowTransferEvents() {
  const transferIn = createTransferEvent({
    id: 'cow-transfer-in',
    blockNumber: 2,
    blockTimestamp: 200,
    logIndex: 3,
    transactionHash: '0xcow',
    value: '500'
  })
  const txMint = createTransferEvent({
    id: 'cow-mint',
    sender: ZERO_ADDRESS,
    receiver: GPV2_SETTLEMENT,
    blockNumber: 2,
    blockTimestamp: 200,
    logIndex: 2,
    transactionHash: '0xcow',
    value: '1000'
  })

  return buildRawPnlEvents({
    addressEvents: {
      deposits: [],
      withdrawals: [],
      transfersIn: [transferIn],
      transfersOut: []
    },
    transactionEvents: {
      deposits: [],
      withdrawals: [],
      transfers: [txMint, transferIn]
    }
  })
}

describe('enrichRawPnlEventsWithCowTradeAcquisitions', () => {
  it('adds a tx-scoped synthetic deposit that turns a CoW settlement transfer-in into known basis', async () => {
    const enrichedEvents = await enrichRawPnlEventsWithCowTradeAcquisitions(createRawCowTransferEvents(), USER, {
      fetchMetadata: async () => createMetadataMap(),
      fetchReceipt: async () => createReceipt(500n)
    })

    expect(
      enrichedEvents.some(
        (event) =>
          event.kind === 'deposit' &&
          event.id.startsWith('cow-trade:') &&
          event.scopes.address === false &&
          event.scopes.tx === true &&
          event.assets === 400n &&
          event.shares === 500n
      )
    ).toBe(true)

    const ledger = processRawPnlEvents(enrichedEvents, USER).get(FAMILY_KEY)

    expect(ledger?.vaultLots).toEqual([{ shares: 500n, costBasis: 400n, acquiredAt: 200 }])
    expect(ledger?.unknownCostBasisTransferInCount).toBe(0)
    expect(ledger?.totalDepositedAssets).toBe(400n)
    expect(ledger?.eventCounts.underlyingDeposits).toBe(1)
  })

  it('skips enrichment when the CoW trade buy amount does not match the received share transfer', async () => {
    const enrichedEvents = await enrichRawPnlEventsWithCowTradeAcquisitions(createRawCowTransferEvents(), USER, {
      fetchMetadata: async () => createMetadataMap(),
      fetchReceipt: async () => createReceipt(400n)
    })

    expect(enrichedEvents.some((event) => event.kind === 'deposit' && event.id.startsWith('cow-trade:'))).toBe(false)

    const ledger = processRawPnlEvents(enrichedEvents, USER).get(FAMILY_KEY)

    expect(ledger?.vaultLots).toEqual([{ shares: 500n, costBasis: null, acquiredAt: 200 }])
    expect(ledger?.unknownCostBasisTransferInCount).toBe(1)
    expect(ledger?.unknownCostBasisTransferInShares).toBe(500n)
  })
})
