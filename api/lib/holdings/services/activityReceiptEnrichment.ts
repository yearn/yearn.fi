import {
  decodeEventLog,
  decodeFunctionResult,
  encodeFunctionData,
  erc20Abi,
  type Hex,
  hexToString,
  parseAbiItem
} from 'viem'
import { debugError } from './debug'
import { formatAmount, lowerCaseAddress, ZERO } from './pnlShared'

const TRANSFER_EVENT = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')
const DEFAULT_TIMEOUT_MS = 4_000
const DEFAULT_MAX_RETRIES = 1

type TRpcReceiptLog = {
  address: string
  data: string
  topics: string[]
}

type TRpcTransactionReceipt = {
  logs: TRpcReceiptLog[] | null
}

type TDecodedTransfer = {
  tokenAddress: string
  from: string
  to: string
  value: bigint
}

type TTokenMetadata = {
  symbol: string | null
  decimals: number | null
}

export type TActivityInputAsset = {
  tokenAddress: string
  tokenSymbol: string | null
  amount: string
  amountFormatted: number | null
}

const receiptInputCache = new Map<string, Promise<TActivityInputAsset | null>>()
const tokenMetadataCache = new Map<string, Promise<TTokenMetadata>>()

function getChainRpcUrl(chainId: number): string | null {
  const rpcUrl = process.env[`VITE_RPC_URI_FOR_${chainId}`]?.trim()
  return rpcUrl && rpcUrl.length > 0 ? rpcUrl : null
}

async function fetchRpc<T>(chainId: number, method: string, params: unknown[], attempt = 0): Promise<T | null> {
  const rpcUrl = getChainRpcUrl(chainId)

  if (!rpcUrl) {
    return null
  }

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params
      }),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
    })

    if (!response.ok) {
      throw new Error(`RPC request failed: ${response.status}`)
    }

    const payload = (await response.json()) as {
      result: T | null
      error?: {
        message?: string
      }
    }

    if (payload.error) {
      throw new Error(payload.error.message ?? 'RPC request returned an error')
    }

    return payload.result
  } catch (error) {
    if (attempt >= DEFAULT_MAX_RETRIES) {
      debugError('activity', 'failed activity receipt enrichment RPC request', error, { chainId, method })
      return null
    }

    return fetchRpc(chainId, method, params, attempt + 1)
  }
}

function decodeTransferLog(log: TRpcReceiptLog): TDecodedTransfer | null {
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
      tokenAddress: lowerCaseAddress(log.address),
      from: lowerCaseAddress(args.from),
      to: lowerCaseAddress(args.to),
      value: args.value
    }
  } catch {
    return null
  }
}

function decodeBytes32Symbol(data: string): string | null {
  try {
    const decoded = hexToString(data as Hex)
      .replace(/\0+$/g, '')
      .trim()
    return decoded.length > 0 ? decoded : null
  } catch {
    return null
  }
}

async function fetchTokenMetadata(chainId: number, tokenAddress: string): Promise<TTokenMetadata> {
  const cacheKey = `${chainId}:${lowerCaseAddress(tokenAddress)}`
  const existing = tokenMetadataCache.get(cacheKey)

  if (existing) {
    return existing
  }

  const request = (async () => {
    const [symbolResult, decimalsResult] = await Promise.all([
      fetchRpc<string>(chainId, 'eth_call', [
        {
          to: tokenAddress,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'symbol'
          })
        },
        'latest'
      ]),
      fetchRpc<string>(chainId, 'eth_call', [
        {
          to: tokenAddress,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'decimals'
          })
        },
        'latest'
      ])
    ])

    const symbol =
      symbolResult === null
        ? null
        : (() => {
            try {
              return decodeFunctionResult({
                abi: erc20Abi,
                functionName: 'symbol',
                data: symbolResult as Hex
              }) as string
            } catch {
              return decodeBytes32Symbol(symbolResult)
            }
          })()
    const decimals =
      decimalsResult === null
        ? null
        : (() => {
            try {
              return Number(
                decodeFunctionResult({
                  abi: erc20Abi,
                  functionName: 'decimals',
                  data: decimalsResult as Hex
                })
              )
            } catch {
              return null
            }
          })()

    return {
      symbol,
      decimals: Number.isFinite(decimals) ? decimals : null
    }
  })()

  tokenMetadataCache.set(cacheKey, request)
  return request
}

function selectSingleUserInputTransfer(args: {
  receipt: TRpcTransactionReceipt
  userAddress: string
  excludedTokenAddresses: Set<string>
}): { tokenAddress: string; value: bigint } | null {
  const normalizedUserAddress = lowerCaseAddress(args.userAddress)
  const groupedTransfers = (args.receipt.logs ?? [])
    .map(decodeTransferLog)
    .filter(
      (transfer): transfer is TDecodedTransfer =>
        transfer !== null &&
        transfer.value > ZERO &&
        transfer.from === normalizedUserAddress &&
        !args.excludedTokenAddresses.has(transfer.tokenAddress)
    )
    .reduce<Map<string, bigint>>((grouped, transfer) => {
      grouped.set(transfer.tokenAddress, (grouped.get(transfer.tokenAddress) ?? ZERO) + transfer.value)
      return grouped
    }, new Map())

  if (groupedTransfers.size !== 1) {
    return null
  }

  const [entry] = groupedTransfers.entries()
  if (!entry) {
    return null
  }

  const [tokenAddress, value] = entry
  return { tokenAddress, value }
}

export async function fetchRouterInputAssetForActivity(args: {
  chainId: number
  transactionHash: string
  userAddress: string
  excludedTokenAddresses?: string[]
}): Promise<TActivityInputAsset | null> {
  const cacheKey = [
    args.chainId,
    lowerCaseAddress(args.transactionHash),
    lowerCaseAddress(args.userAddress),
    [...(args.excludedTokenAddresses ?? [])].map(lowerCaseAddress).sort().join(',')
  ].join(':')
  const existing = receiptInputCache.get(cacheKey)

  if (existing) {
    return existing
  }

  const request = (async () => {
    const receipt = await fetchRpc<TRpcTransactionReceipt>(args.chainId, 'eth_getTransactionReceipt', [
      args.transactionHash
    ])

    if (!receipt) {
      return null
    }

    const inputTransfer = selectSingleUserInputTransfer({
      receipt,
      userAddress: args.userAddress,
      excludedTokenAddresses: new Set((args.excludedTokenAddresses ?? []).map(lowerCaseAddress))
    })

    if (!inputTransfer) {
      return null
    }

    const metadata = await fetchTokenMetadata(args.chainId, inputTransfer.tokenAddress)

    return {
      tokenAddress: inputTransfer.tokenAddress,
      tokenSymbol: metadata.symbol,
      amount: inputTransfer.value.toString(),
      amountFormatted: metadata.decimals === null ? null : formatAmount(inputTransfer.value, metadata.decimals)
    }
  })()

  receiptInputCache.set(cacheKey, request)
  return request
}
