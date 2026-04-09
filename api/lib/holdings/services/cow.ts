import { decodeEventLog, type Hex, parseAbiItem } from 'viem'
import { config } from '../config'
import type { VaultMetadata } from '../types'
import { debugError, debugLog } from './debug'
import { lowerCaseAddress, toVaultKey, ZERO, ZERO_ADDRESS } from './pnlShared'
import type { TRawPnlEvent } from './pnlTypes'
import { fetchMultipleVaultsMetadata } from './vaults'

const MAINNET_CHAIN_ID = 1
const GPV2_SETTLEMENT_ADDRESS = '0x9008d19f58aabd9ed0d60971565aa8510560ab41'
const DEFAULT_TIMEOUT_MS = 4_000
const DEFAULT_MAX_RETRIES = 1
const TRANSFER_EVENT = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')
const TRADE_EVENT = parseAbiItem(
  'event Trade(address indexed owner, address sellToken, address buyToken, uint256 sellAmount, uint256 buyAmount, uint256 feeAmount, bytes orderUid)'
)

type TFetchMetadataFn = typeof fetchMultipleVaultsMetadata
type TFetchReceiptFn = (transactionHash: string) => Promise<RpcTransactionReceipt | null>

type TCowTradeCandidate = {
  chainId: number
  familyVaultAddress: string
  transactionHash: string
  transactionFrom: string
  blockNumber: number
  blockTimestamp: number
  transferInShares: bigint
}

type TDecodedTransferLog = {
  address: string
  from: string
  to: string
  value: bigint
}

type TDecodedTradeLog = {
  owner: string
  sellToken: string
  buyToken: string
  sellAmount: bigint
  buyAmount: bigint
  logIndex: number
}

export interface RpcReceiptLog {
  address: string
  data: string
  topics: string[]
  logIndex: string | null
}

export interface RpcTransactionReceipt {
  logs: RpcReceiptLog[] | null
}

function compareRawEvents(a: TRawPnlEvent, b: TRawPnlEvent): number {
  return (
    a.blockTimestamp - b.blockTimestamp ||
    a.blockNumber - b.blockNumber ||
    a.logIndex - b.logIndex ||
    a.id.localeCompare(b.id)
  )
}

function groupEventsByTransaction(events: TRawPnlEvent[]): TRawPnlEvent[][] {
  return Array.from(
    events.reduce<Map<string, TRawPnlEvent[]>>((groups, event) => {
      const transactionKey = `${event.chainId}:${event.transactionHash}`
      const nextEvents = [...(groups.get(transactionKey) ?? []), event]
      groups.set(transactionKey, nextEvents)
      return groups
    }, new Map<string, TRawPnlEvent[]>())
  ).map(([_key, txEvents]) => [...txEvents].sort(compareRawEvents))
}

function groupTransactionEventsByFamily(txEvents: TRawPnlEvent[]): TRawPnlEvent[][] {
  return Array.from(
    txEvents.reduce<Map<string, TRawPnlEvent[]>>((groups, event) => {
      const familyKey = toVaultKey(event.chainId, event.familyVaultAddress)
      const nextEvents = [...(groups.get(familyKey) ?? []), event]
      groups.set(familyKey, nextEvents)
      return groups
    }, new Map<string, TRawPnlEvent[]>())
  ).map(([_key, familyEvents]) => [...familyEvents].sort(compareRawEvents))
}

function sumValues(values: bigint[]): bigint {
  return values.reduce((total, value) => total + value, ZERO)
}

function parseHexInteger(value: string | null): number {
  return value === null ? 0 : Number.parseInt(value, 16)
}

function decodeTransferLog(log: RpcReceiptLog): TDecodedTransferLog | null {
  try {
    const decoded = decodeEventLog({
      abi: [TRANSFER_EVENT],
      data: log.data as Hex,
      topics: log.topics as Hex[]
    })
    const args = decoded.args as {
      from: string
      to: string
      value: bigint
    }

    return {
      address: lowerCaseAddress(log.address),
      from: lowerCaseAddress(args.from),
      to: lowerCaseAddress(args.to),
      value: args.value
    }
  } catch {
    return null
  }
}

function decodeTradeLog(log: RpcReceiptLog): TDecodedTradeLog | null {
  try {
    const decoded = decodeEventLog({
      abi: [TRADE_EVENT],
      data: log.data as Hex,
      topics: log.topics as Hex[]
    })
    const args = decoded.args as {
      owner: string
      sellToken: string
      buyToken: string
      sellAmount: bigint
      buyAmount: bigint
    }

    return {
      owner: lowerCaseAddress(args.owner),
      sellToken: lowerCaseAddress(args.sellToken),
      buyToken: lowerCaseAddress(args.buyToken),
      sellAmount: args.sellAmount,
      buyAmount: args.buyAmount,
      logIndex: parseHexInteger(log.logIndex)
    }
  } catch {
    return null
  }
}

async function fetchTransactionReceipt(transactionHash: string, attempt = 0): Promise<RpcTransactionReceipt | null> {
  try {
    const response = await fetch(config.ethereumRpcUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [transactionHash]
      }),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
    })

    if (!response.ok) {
      throw new Error(`RPC receipt request failed: ${response.status}`)
    }

    const payload = (await response.json()) as {
      result: RpcTransactionReceipt | null
      error?: {
        message?: string
      }
    }

    if (payload.error) {
      throw new Error(payload.error.message ?? 'RPC receipt request returned an error')
    }

    return payload.result
  } catch (error) {
    if (attempt >= DEFAULT_MAX_RETRIES) {
      debugError('cow', 'failed to fetch CoW settlement receipt', error, { transactionHash, attempt: attempt + 1 })
      return null
    }

    debugError('cow', 'retrying CoW settlement receipt fetch', error, {
      transactionHash,
      nextAttempt: attempt + 2
    })
    return fetchTransactionReceipt(transactionHash, attempt + 1)
  }
}

function getCowTradeCandidates(rawEvents: TRawPnlEvent[], userAddress: string): TCowTradeCandidate[] {
  return groupEventsByTransaction(rawEvents).flatMap((txEvents) =>
    groupTransactionEventsByFamily(txEvents).flatMap((familyEvents) => {
      const familyVaultAddress = familyEvents[0]?.familyVaultAddress
      const chainId = familyEvents[0]?.chainId
      const transactionHash = familyEvents[0]?.transactionHash
      const transactionFrom = familyEvents[0]?.transactionFrom
      const blockNumber = familyEvents[0]?.blockNumber ?? 0
      const blockTimestamp = familyEvents[0]?.blockTimestamp ?? 0
      const hasDirectFamilyDeposit = familyEvents.some(
        (event) => event.kind === 'deposit' && event.vaultAddress === familyVaultAddress
      )
      const settlementTransfersIn = familyEvents.filter(
        (event): event is Extract<TRawPnlEvent, { kind: 'transfer' }> =>
          event.kind === 'transfer' &&
          event.scopes.address &&
          event.vaultAddress === familyVaultAddress &&
          event.sender === GPV2_SETTLEMENT_ADDRESS &&
          event.receiver === userAddress
      )

      if (
        chainId !== MAINNET_CHAIN_ID ||
        !familyVaultAddress ||
        !transactionHash ||
        !transactionFrom ||
        hasDirectFamilyDeposit ||
        settlementTransfersIn.length === 0
      ) {
        return []
      }

      return [
        {
          chainId,
          familyVaultAddress,
          transactionHash,
          transactionFrom,
          blockNumber,
          blockTimestamp,
          transferInShares: sumValues(settlementTransfersIn.map((event) => event.shares))
        }
      ]
    })
  )
}

function buildSyntheticCowTradeDeposit(
  candidate: TCowTradeCandidate,
  metadata: VaultMetadata,
  receipt: RpcTransactionReceipt,
  userAddress: string
): Extract<TRawPnlEvent, { kind: 'deposit' }> | null {
  const decodedTrades = (receipt.logs ?? [])
    .filter((log) => lowerCaseAddress(log.address) === GPV2_SETTLEMENT_ADDRESS)
    .map(decodeTradeLog)
    .filter(
      (trade): trade is TDecodedTradeLog =>
        trade !== null && trade.owner === userAddress && trade.buyToken === candidate.familyVaultAddress
    )

  const boughtShares = sumValues(decodedTrades.map((trade) => trade.buyAmount))

  if (boughtShares === ZERO || boughtShares !== candidate.transferInShares) {
    return null
  }

  const decodedTransfers = (receipt.logs ?? [])
    .map(decodeTransferLog)
    .filter((log): log is TDecodedTransferLog => log !== null)
  const mintedShares = sumValues(
    decodedTransfers
      .filter(
        (log) =>
          log.address === candidate.familyVaultAddress &&
          log.from === ZERO_ADDRESS &&
          log.to === GPV2_SETTLEMENT_ADDRESS
      )
      .map((log) => log.value)
  )
  const depositedAssets = sumValues(
    decodedTransfers
      .filter(
        (log) => log.address === lowerCaseAddress(metadata.token.address) && log.to === candidate.familyVaultAddress
      )
      .map((log) => log.value)
  )

  if (mintedShares === ZERO || depositedAssets === ZERO || boughtShares > mintedShares) {
    return null
  }

  const assets = (depositedAssets * boughtShares) / mintedShares

  if (assets === ZERO) {
    return null
  }

  const sellAmount = sumValues(decodedTrades.map((trade) => trade.sellAmount))
  const logIndex = decodedTrades.reduce(
    (minimum, trade) => (trade.logIndex < minimum ? trade.logIndex : minimum),
    decodedTrades[0]?.logIndex ?? 0
  )

  debugLog('cow', 'synthesized CoW settlement acquisition', {
    transactionHash: candidate.transactionHash,
    familyVaultAddress: candidate.familyVaultAddress,
    owner: userAddress,
    sellToken: decodedTrades[0]?.sellToken ?? null,
    sellAmount: sellAmount.toString(),
    boughtShares: boughtShares.toString(),
    syntheticAssets: assets.toString(),
    totalMintedShares: mintedShares.toString(),
    totalDepositedAssets: depositedAssets.toString()
  })

  return {
    kind: 'deposit',
    id: `cow-trade:${candidate.chainId}:${candidate.transactionHash}:${candidate.familyVaultAddress}:${userAddress}`,
    chainId: candidate.chainId,
    vaultAddress: candidate.familyVaultAddress,
    familyVaultAddress: candidate.familyVaultAddress,
    isStakingVault: false,
    blockNumber: candidate.blockNumber,
    blockTimestamp: candidate.blockTimestamp,
    logIndex,
    transactionHash: candidate.transactionHash,
    transactionFrom: candidate.transactionFrom,
    owner: userAddress,
    sender: GPV2_SETTLEMENT_ADDRESS,
    shares: boughtShares,
    assets,
    scopes: {
      address: false,
      tx: true
    }
  }
}

export async function enrichRawPnlEventsWithCowTradeAcquisitions(
  rawEvents: TRawPnlEvent[],
  userAddress: string,
  dependencies?: {
    fetchMetadata?: TFetchMetadataFn
    fetchReceipt?: TFetchReceiptFn
  }
): Promise<TRawPnlEvent[]> {
  const userAddressLower = lowerCaseAddress(userAddress)
  const candidates = getCowTradeCandidates(rawEvents, userAddressLower)

  if (candidates.length === 0) {
    return rawEvents
  }

  try {
    const fetchMetadata = dependencies?.fetchMetadata ?? fetchMultipleVaultsMetadata
    const metadataRequests = Array.from(
      candidates.reduce<Map<string, { chainId: number; vaultAddress: string }>>((requests, candidate) => {
        requests.set(toVaultKey(candidate.chainId, candidate.familyVaultAddress), {
          chainId: candidate.chainId,
          vaultAddress: candidate.familyVaultAddress
        })
        return requests
      }, new Map<string, { chainId: number; vaultAddress: string }>())
    ).map(([_key, request]) => request)
    const metadataByVaultKey = await fetchMetadata(metadataRequests)
    const candidatesWithMetadata = candidates.flatMap((candidate) => {
      const metadata = metadataByVaultKey.get(toVaultKey(candidate.chainId, candidate.familyVaultAddress))
      return metadata ? [{ ...candidate, metadata }] : []
    })

    if (candidatesWithMetadata.length === 0) {
      return rawEvents
    }

    const fetchReceipt = dependencies?.fetchReceipt ?? fetchTransactionReceipt
    const receiptEntries = await Promise.all(
      Array.from(new Set(candidatesWithMetadata.map((candidate) => candidate.transactionHash.toLowerCase()))).map(
        async (transactionHash) => [transactionHash, await fetchReceipt(transactionHash)] as const
      )
    )
    const receiptsByTransactionHash = receiptEntries.reduce<Map<string, RpcTransactionReceipt>>((receipts, entry) => {
      const [transactionHash, receipt] = entry

      if (receipt !== null) {
        receipts.set(transactionHash, receipt)
      }

      return receipts
    }, new Map<string, RpcTransactionReceipt>())
    const syntheticDeposits = candidatesWithMetadata.flatMap((candidate) => {
      const receipt = receiptsByTransactionHash.get(candidate.transactionHash.toLowerCase())

      if (!receipt) {
        return []
      }

      const syntheticDeposit = buildSyntheticCowTradeDeposit(candidate, candidate.metadata, receipt, userAddressLower)

      return syntheticDeposit ? [syntheticDeposit] : []
    })

    if (syntheticDeposits.length === 0) {
      return rawEvents
    }

    debugLog('cow', 'completed CoW settlement enrichment', {
      candidates: candidatesWithMetadata.length,
      synthesizedDeposits: syntheticDeposits.length
    })

    return [...rawEvents, ...syntheticDeposits].sort(compareRawEvents)
  } catch (error) {
    debugError('cow', 'failed CoW settlement enrichment, continuing with raw events', error, {
      candidateCount: candidates.length
    })
    return rawEvents
  }
}
