import {
  decodeEventLog,
  decodeFunctionData,
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
const ZAPPER_ZAP_IN_EVENT = parseAbiItem('event zapIn(address sender, address pool, uint256 tokensRec)')
const ZAPPER_ZAP_OUT_EVENT = parseAbiItem(
  'event zapOut(address sender, address pool, address token, uint256 tokensRec)'
)
const V2_VAULT_ACTIVITY_ABI = [
  {
    stateMutability: 'nonpayable',
    type: 'function',
    name: 'deposit',
    inputs: [{ name: '_amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    stateMutability: 'nonpayable',
    type: 'function',
    name: 'withdraw',
    inputs: [{ name: '_maxShares', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }]
  }
] as const
const YCRV_ZAP_ABI = [
  {
    stateMutability: 'nonpayable',
    type: 'function',
    name: 'zap',
    inputs: [
      { name: '_input_token', type: 'address' },
      { name: '_output_token', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    stateMutability: 'nonpayable',
    type: 'function',
    name: 'zap',
    inputs: [
      { name: '_input_token', type: 'address' },
      { name: '_output_token', type: 'address' },
      { name: '_amount_in', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    stateMutability: 'nonpayable',
    type: 'function',
    name: 'zap',
    inputs: [
      { name: '_input_token', type: 'address' },
      { name: '_output_token', type: 'address' },
      { name: '_amount_in', type: 'uint256' },
      { name: '_min_out', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    stateMutability: 'nonpayable',
    type: 'function',
    name: 'zap',
    inputs: [
      { name: '_input_token', type: 'address' },
      { name: '_output_token', type: 'address' },
      { name: '_amount_in', type: 'uint256' },
      { name: '_min_out', type: 'uint256' },
      { name: '_recipient', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  }
] as const
const KNOWN_YCRV_ZAP_CONTRACTS_BY_CHAIN = new Map([
  [
    1,
    new Set([
      lowerCaseAddress('0x78ada385b15d89a9b845d2cac0698663f0c69e3c'),
      lowerCaseAddress('0xdc899AB992fbCFbac936CE5a5bC5A86a5d35A66a')
    ])
  ]
])
const KNOWN_REWARD_DISTRIBUTOR_CONTRACTS_BY_CHAIN = new Map([
  [
    1,
    new Set([
      lowerCaseAddress('0xB226c52EB411326CdB54824a88aBaFDAAfF16D3d'),
      lowerCaseAddress('0x1d02F6A86Ed5650f93E40FCD62fa5727c32ad746')
    ])
  ]
])
const KNOWN_ZAPPER_V2_CONTRACTS_BY_CHAIN = new Map([
  [
    1,
    new Set([
      lowerCaseAddress('0x42D4e90Ff4068Abe7BC4EaB838c7dE1D2F5998A3'),
      lowerCaseAddress('0x462991D18666c578F787e9eC0A74Cd18D2971E5F'),
      lowerCaseAddress('0xB0880df8420974ef1b040111e5e0e95f05F8fee1'),
      lowerCaseAddress('0x92Be6ADB6a12Da0CA607F9d87DB2F9978cD6ec3E'),
      lowerCaseAddress('0x9c57618bfCDfaE4cE8e49226Ca22A7837DE64A2d'),
      lowerCaseAddress('0xd6b88257e91e4E4D4E990B3A858c849EF2DFdE8c')
    ])
  ]
])
const DEFAULT_TIMEOUT_MS = 4_000
const DEFAULT_MAX_RETRIES = 1

type TRpcReceiptLog = {
  address: string
  data: string
  topics: string[]
}
type TDecodeTopics = [] | [signature: Hex, ...args: Hex[]]

type TRpcTransactionReceipt = {
  logs: TRpcReceiptLog[] | null
}

type TRpcTransaction = {
  to: string | null
  input: string | null
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

export type TActivityTransferAsset = {
  tokenAddress: string
  tokenSymbol: string | null
  amount: string
  amountFormatted: number | null
}

export type TActivityInputAsset = TActivityTransferAsset

export type TActivityOutputAsset = {
  tokenAddress: string
  tokenSymbol: string | null
  amount: string | null
  amountFormatted: number | null
}

export type TActivityZapAssets = {
  inputAsset: TActivityInputAsset
  outputAsset: TActivityOutputAsset
  outputKind: 'stake' | 'token'
}

export type TDirectV2VaultAction = {
  action: 'deposit' | 'withdraw'
  assetAmount: bigint
}

export type TZapperV2Zap = {
  inputAsset: TActivityInputAsset
  assetAmount: bigint
}

export type TZapperV2ZapOut = {
  outputAsset: TActivityOutputAsset
  assetAmount: bigint
}

type TActivityTransferDirection = 'input' | 'output'

const receiptAssetCache = new Map<string, Promise<TActivityTransferAsset | null>>()
const ycrvZapInputCache = new Map<string, Promise<TActivityZapAssets | null>>()
const rewardClaimTransactionCache = new Map<string, Promise<boolean>>()
const directV2VaultActionCache = new Map<string, Promise<TDirectV2VaultAction | null>>()
const zapperV2ZapCache = new Map<string, Promise<TZapperV2Zap | null>>()
const zapperV2ZapOutCache = new Map<string, Promise<TZapperV2ZapOut | null>>()
const tokenMetadataCache = new Map<string, Promise<TTokenMetadata>>()

function toDecodeTopics(topics: string[]): TDecodeTopics {
  return topics.length === 0 ? [] : [topics[0] as Hex, ...(topics.slice(1) as Hex[])]
}

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
      topics: toDecodeTopics(log.topics)
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

function decodeZapperZapInLog(
  log: TRpcReceiptLog
): { emitter: string; sender: string; pool: string; tokensRec: bigint } | null {
  try {
    const decoded = decodeEventLog({
      abi: [ZAPPER_ZAP_IN_EVENT],
      data: log.data as Hex,
      topics: toDecodeTopics(log.topics)
    })
    const args = decoded.args as {
      sender: string
      pool: string
      tokensRec: bigint
    }

    return {
      emitter: lowerCaseAddress(log.address),
      sender: lowerCaseAddress(args.sender),
      pool: lowerCaseAddress(args.pool),
      tokensRec: args.tokensRec
    }
  } catch {
    return null
  }
}

function decodeZapperZapOutLog(
  log: TRpcReceiptLog
): { emitter: string; sender: string; pool: string; token: string; tokensRec: bigint } | null {
  try {
    const decoded = decodeEventLog({
      abi: [ZAPPER_ZAP_OUT_EVENT],
      data: log.data as Hex,
      topics: toDecodeTopics(log.topics)
    })
    const args = decoded.args as {
      sender: string
      pool: string
      token: string
      tokensRec: bigint
    }

    return {
      emitter: lowerCaseAddress(log.address),
      sender: lowerCaseAddress(args.sender),
      pool: lowerCaseAddress(args.pool),
      token: lowerCaseAddress(args.token),
      tokensRec: args.tokensRec
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

function selectSingleUserTransfer(args: {
  receipt: TRpcTransactionReceipt
  userAddress: string
  excludedTokenAddresses: Set<string>
  direction: TActivityTransferDirection
}): { tokenAddress: string; value: bigint } | null {
  const normalizedUserAddress = lowerCaseAddress(args.userAddress)
  const groupedTransfers = (args.receipt.logs ?? [])
    .map(decodeTransferLog)
    .filter(
      (transfer): transfer is TDecodedTransfer =>
        transfer !== null &&
        transfer.value > ZERO &&
        (args.direction === 'input'
          ? transfer.from === normalizedUserAddress
          : transfer.to === normalizedUserAddress) &&
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

function selectSingleTokenTransfer(args: {
  receipt: TRpcTransactionReceipt
  from: string
  to: string
  excludedTokenAddresses: Set<string>
}): { tokenAddress: string; value: bigint } | null {
  const normalizedFrom = lowerCaseAddress(args.from)
  const normalizedTo = lowerCaseAddress(args.to)
  const groupedTransfers = (args.receipt.logs ?? [])
    .map(decodeTransferLog)
    .filter(
      (transfer): transfer is TDecodedTransfer =>
        transfer !== null &&
        transfer.value > ZERO &&
        transfer.from === normalizedFrom &&
        transfer.to === normalizedTo &&
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

function decodeDirectV2VaultAction(args: {
  transaction: TRpcTransaction
  vaultAddress: string
  transferDirection: 'in' | 'out'
}): { action: 'deposit'; assetAmount: bigint } | { action: 'withdraw' } | null {
  const transactionTo = args.transaction.to ? lowerCaseAddress(args.transaction.to) : null
  const input = args.transaction.input

  if (!transactionTo || transactionTo !== lowerCaseAddress(args.vaultAddress) || !input) {
    return null
  }

  try {
    const decoded = decodeFunctionData({
      abi: V2_VAULT_ACTIVITY_ABI,
      data: input as Hex
    })

    if (decoded.functionName === 'deposit' && args.transferDirection === 'in') {
      const [assetAmount] = decoded.args
      return assetAmount > ZERO ? { action: 'deposit', assetAmount } : null
    }

    return decoded.functionName === 'withdraw' && args.transferDirection === 'out' ? { action: 'withdraw' } : null
  } catch {
    return null
  }
}

function getKnownYcrvZapOutputSymbol(chainId: number, tokenAddress: string): string | null {
  if (chainId !== 1) {
    return null
  }

  const normalizedTokenAddress = lowerCaseAddress(tokenAddress)

  if (normalizedTokenAddress === lowerCaseAddress('0xe9a115b77a1057c918f997c32663fdce24fb873f')) {
    return 'yCRV Boosted Staker'
  }

  return null
}

function getKnownYcrvZapOutputKind(chainId: number, tokenAddress: string): TActivityZapAssets['outputKind'] {
  if (
    chainId === 1 &&
    lowerCaseAddress(tokenAddress) === lowerCaseAddress('0xe9a115b77a1057c918f997c32663fdce24fb873f')
  ) {
    return 'stake'
  }

  return 'token'
}

function decodeKnownYcrvZapInput(args: { chainId: number; transaction: TRpcTransaction }): {
  inputTokenAddress: string
  outputTokenAddress: string
  inputAmount: bigint | null
} | null {
  const knownContracts = KNOWN_YCRV_ZAP_CONTRACTS_BY_CHAIN.get(args.chainId)
  const transactionTo = args.transaction.to ? lowerCaseAddress(args.transaction.to) : null
  const input = args.transaction.input

  if (!knownContracts || !transactionTo || !input || !knownContracts.has(transactionTo)) {
    return null
  }

  try {
    const decoded = decodeFunctionData({
      abi: YCRV_ZAP_ABI,
      data: input as Hex
    })

    if (decoded.functionName !== 'zap') {
      return null
    }

    const [inputToken, outputToken, amountIn] = decoded.args

    return {
      inputTokenAddress: lowerCaseAddress(inputToken),
      outputTokenAddress: lowerCaseAddress(outputToken),
      inputAmount: typeof amountIn === 'bigint' && amountIn > ZERO ? amountIn : null
    }
  } catch {
    return null
  }
}

function isKnownRewardDistributorTransaction(args: { chainId: number; transaction: TRpcTransaction }): boolean {
  const knownContracts = KNOWN_REWARD_DISTRIBUTOR_CONTRACTS_BY_CHAIN.get(args.chainId)
  const transactionTo = args.transaction.to ? lowerCaseAddress(args.transaction.to) : null

  return Boolean(knownContracts && transactionTo && knownContracts.has(transactionTo))
}

function getKnownZapperV2Contract(args: { chainId: number; transaction: TRpcTransaction }): string | null {
  const knownContracts = KNOWN_ZAPPER_V2_CONTRACTS_BY_CHAIN.get(args.chainId)
  const transactionTo = args.transaction.to ? lowerCaseAddress(args.transaction.to) : null

  return knownContracts && transactionTo && knownContracts.has(transactionTo) ? transactionTo : null
}

function hasMatchingZapperZapIn(args: {
  receipt: TRpcTransactionReceipt
  zapperContract: string
  userAddress: string
  vaultAddress: string
  shareAmount: bigint
}): boolean {
  const normalizedUserAddress = lowerCaseAddress(args.userAddress)
  const normalizedVaultAddress = lowerCaseAddress(args.vaultAddress)
  const normalizedZapperContract = lowerCaseAddress(args.zapperContract)

  return (args.receipt.logs ?? [])
    .map(decodeZapperZapInLog)
    .some(
      (event) =>
        event !== null &&
        event.emitter === normalizedZapperContract &&
        event.sender === normalizedUserAddress &&
        event.pool === normalizedVaultAddress &&
        event.tokensRec === args.shareAmount
    )
}

function getMatchingZapperZapOut(args: {
  receipt: TRpcTransactionReceipt
  zapperContract: string
  userAddress: string
  vaultAddress: string
}): { token: string; tokensRec: bigint } | null {
  const normalizedUserAddress = lowerCaseAddress(args.userAddress)
  const normalizedVaultAddress = lowerCaseAddress(args.vaultAddress)
  const normalizedZapperContract = lowerCaseAddress(args.zapperContract)

  return (
    (args.receipt.logs ?? [])
      .map(decodeZapperZapOutLog)
      .find(
        (event) =>
          event !== null &&
          event.emitter === normalizedZapperContract &&
          event.sender === normalizedUserAddress &&
          event.pool === normalizedVaultAddress &&
          event.tokensRec > ZERO
      ) ?? null
  )
}

function hasMatchingTokenTransfer(args: {
  receipt: TRpcTransactionReceipt
  tokenAddress: string
  from: string
  to: string
  value: bigint
}): boolean {
  const normalizedTokenAddress = lowerCaseAddress(args.tokenAddress)
  const normalizedFrom = lowerCaseAddress(args.from)
  const normalizedTo = lowerCaseAddress(args.to)

  return (args.receipt.logs ?? [])
    .map(decodeTransferLog)
    .some(
      (transfer) =>
        transfer !== null &&
        transfer.tokenAddress === normalizedTokenAddress &&
        transfer.from === normalizedFrom &&
        transfer.to === normalizedTo &&
        transfer.value === args.value
    )
}

async function fetchRouterAssetForActivity(args: {
  chainId: number
  transactionHash: string
  userAddress: string
  excludedTokenAddresses?: string[]
  direction: TActivityTransferDirection
}): Promise<TActivityTransferAsset | null> {
  const cacheKey = [
    args.direction,
    args.chainId,
    lowerCaseAddress(args.transactionHash),
    lowerCaseAddress(args.userAddress),
    [...(args.excludedTokenAddresses ?? [])].map(lowerCaseAddress).sort().join(',')
  ].join(':')
  const existing = receiptAssetCache.get(cacheKey)

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

    const transfer = selectSingleUserTransfer({
      receipt,
      userAddress: args.userAddress,
      excludedTokenAddresses: new Set((args.excludedTokenAddresses ?? []).map(lowerCaseAddress)),
      direction: args.direction
    })

    if (!transfer) {
      return null
    }

    const metadata = await fetchTokenMetadata(args.chainId, transfer.tokenAddress)

    return {
      tokenAddress: transfer.tokenAddress,
      tokenSymbol: metadata.symbol,
      amount: transfer.value.toString(),
      amountFormatted: metadata.decimals === null ? null : formatAmount(transfer.value, metadata.decimals)
    }
  })()

  receiptAssetCache.set(cacheKey, request)
  return request
}

export async function fetchRouterInputAssetForActivity(args: {
  chainId: number
  transactionHash: string
  userAddress: string
  excludedTokenAddresses?: string[]
}): Promise<TActivityTransferAsset | null> {
  return fetchRouterAssetForActivity({ ...args, direction: 'input' })
}

export async function fetchRouterOutputAssetForActivity(args: {
  chainId: number
  transactionHash: string
  userAddress: string
  excludedTokenAddresses?: string[]
}): Promise<TActivityTransferAsset | null> {
  return fetchRouterAssetForActivity({ ...args, direction: 'output' })
}

export async function fetchYcrvZapInputAssetForActivity(args: {
  chainId: number
  transactionHash: string
  userAddress: string
  excludedTokenAddresses?: string[]
}): Promise<TActivityZapAssets | null> {
  const cacheKey = [
    args.chainId,
    lowerCaseAddress(args.transactionHash),
    lowerCaseAddress(args.userAddress),
    [...(args.excludedTokenAddresses ?? [])].map(lowerCaseAddress).sort().join(',')
  ].join(':')
  const existing = ycrvZapInputCache.get(cacheKey)

  if (existing) {
    return existing
  }

  const request = (async () => {
    const transaction = await fetchRpc<TRpcTransaction>(args.chainId, 'eth_getTransactionByHash', [
      args.transactionHash
    ])
    const decodedZap = transaction ? decodeKnownYcrvZapInput({ chainId: args.chainId, transaction }) : null

    if (!decodedZap) {
      return null
    }

    const receiptInput =
      decodedZap.inputAmount === null
        ? await (async () => {
            const receipt = await fetchRpc<TRpcTransactionReceipt>(args.chainId, 'eth_getTransactionReceipt', [
              args.transactionHash
            ])

            return receipt
              ? selectSingleUserTransfer({
                  receipt,
                  userAddress: args.userAddress,
                  excludedTokenAddresses: new Set((args.excludedTokenAddresses ?? []).map(lowerCaseAddress)),
                  direction: 'input'
                })
              : null
          })()
        : null
    const tokenAddress = receiptInput?.tokenAddress ?? decodedZap.inputTokenAddress
    const amount = receiptInput?.value ?? decodedZap.inputAmount

    if (amount === null || amount <= ZERO) {
      return null
    }

    const [inputMetadata, outputMetadata] = await Promise.all([
      fetchTokenMetadata(args.chainId, tokenAddress),
      fetchTokenMetadata(args.chainId, decodedZap.outputTokenAddress)
    ])

    return {
      inputAsset: {
        tokenAddress,
        tokenSymbol: inputMetadata.symbol,
        amount: amount.toString(),
        amountFormatted: inputMetadata.decimals === null ? null : formatAmount(amount, inputMetadata.decimals)
      },
      outputAsset: {
        tokenAddress: decodedZap.outputTokenAddress,
        tokenSymbol: getKnownYcrvZapOutputSymbol(args.chainId, decodedZap.outputTokenAddress) ?? outputMetadata.symbol,
        amount: null,
        amountFormatted: null
      },
      outputKind: getKnownYcrvZapOutputKind(args.chainId, decodedZap.outputTokenAddress)
    }
  })()

  ycrvZapInputCache.set(cacheKey, request)
  return request
}

export async function fetchIsRewardClaimForActivity(args: {
  chainId: number
  transactionHash: string
}): Promise<boolean> {
  const cacheKey = `${args.chainId}:${lowerCaseAddress(args.transactionHash)}`
  const existing = rewardClaimTransactionCache.get(cacheKey)

  if (existing) {
    return existing
  }

  const request = (async () => {
    const transaction = await fetchRpc<TRpcTransaction>(args.chainId, 'eth_getTransactionByHash', [
      args.transactionHash
    ])

    return transaction ? isKnownRewardDistributorTransaction({ chainId: args.chainId, transaction }) : false
  })()

  rewardClaimTransactionCache.set(cacheKey, request)
  return request
}

export async function fetchDirectV2VaultActionForActivity(args: {
  chainId: number
  transactionHash: string
  userAddress: string
  vaultAddress: string
  transferDirection: 'in' | 'out'
}): Promise<TDirectV2VaultAction | null> {
  const cacheKey = [
    args.chainId,
    lowerCaseAddress(args.transactionHash),
    lowerCaseAddress(args.userAddress),
    lowerCaseAddress(args.vaultAddress),
    args.transferDirection
  ].join(':')
  const existing = directV2VaultActionCache.get(cacheKey)

  if (existing) {
    return existing
  }

  const request = (async () => {
    const transaction = await fetchRpc<TRpcTransaction>(args.chainId, 'eth_getTransactionByHash', [
      args.transactionHash
    ])
    const directAction = transaction
      ? decodeDirectV2VaultAction({
          transaction,
          vaultAddress: args.vaultAddress,
          transferDirection: args.transferDirection
        })
      : null

    if (!directAction) {
      return null
    }

    if (directAction.action === 'deposit') {
      return directAction
    }

    const receipt = await fetchRpc<TRpcTransactionReceipt>(args.chainId, 'eth_getTransactionReceipt', [
      args.transactionHash
    ])
    const outputTransfer = receipt
      ? selectSingleTokenTransfer({
          receipt,
          from: args.vaultAddress,
          to: args.userAddress,
          excludedTokenAddresses: new Set([lowerCaseAddress(args.vaultAddress)])
        })
      : null

    return outputTransfer ? ({ action: 'withdraw', assetAmount: outputTransfer.value } as const) : null
  })()

  directV2VaultActionCache.set(cacheKey, request)
  return request
}

export async function fetchZapperV2ZapForActivity(args: {
  chainId: number
  transactionHash: string
  userAddress: string
  vaultAddress: string
  shareAmount: bigint
  excludedTokenAddresses?: string[]
}): Promise<TZapperV2Zap | null> {
  const cacheKey = [
    args.chainId,
    lowerCaseAddress(args.transactionHash),
    lowerCaseAddress(args.userAddress),
    lowerCaseAddress(args.vaultAddress),
    args.shareAmount.toString(),
    [...(args.excludedTokenAddresses ?? [])].map(lowerCaseAddress).sort().join(',')
  ].join(':')
  const existing = zapperV2ZapCache.get(cacheKey)

  if (existing) {
    return existing
  }

  const request = (async () => {
    const transaction = await fetchRpc<TRpcTransaction>(args.chainId, 'eth_getTransactionByHash', [
      args.transactionHash
    ])
    const zapperContract = transaction ? getKnownZapperV2Contract({ chainId: args.chainId, transaction }) : null

    if (!zapperContract) {
      return null
    }

    const receipt = await fetchRpc<TRpcTransactionReceipt>(args.chainId, 'eth_getTransactionReceipt', [
      args.transactionHash
    ])

    if (
      !receipt ||
      !hasMatchingZapperZapIn({
        receipt,
        zapperContract,
        userAddress: args.userAddress,
        vaultAddress: args.vaultAddress,
        shareAmount: args.shareAmount
      })
    ) {
      return null
    }

    const inputTransfer = selectSingleTokenTransfer({
      receipt,
      from: args.userAddress,
      to: zapperContract,
      excludedTokenAddresses: new Set([
        lowerCaseAddress(args.vaultAddress),
        ...(args.excludedTokenAddresses ?? []).map(lowerCaseAddress)
      ])
    })

    if (!inputTransfer) {
      return null
    }

    const metadata = await fetchTokenMetadata(args.chainId, inputTransfer.tokenAddress)
    const inputAsset = {
      tokenAddress: inputTransfer.tokenAddress,
      tokenSymbol: metadata.symbol,
      amount: inputTransfer.value.toString(),
      amountFormatted: metadata.decimals === null ? null : formatAmount(inputTransfer.value, metadata.decimals)
    }

    return {
      inputAsset,
      assetAmount: inputTransfer.value
    }
  })()

  zapperV2ZapCache.set(cacheKey, request)
  return request
}

export async function fetchZapperV2ZapOutForActivity(args: {
  chainId: number
  transactionHash: string
  userAddress: string
  vaultAddress: string
  shareAmount: bigint
}): Promise<TZapperV2ZapOut | null> {
  const cacheKey = [
    args.chainId,
    lowerCaseAddress(args.transactionHash),
    lowerCaseAddress(args.userAddress),
    lowerCaseAddress(args.vaultAddress),
    args.shareAmount.toString()
  ].join(':')
  const existing = zapperV2ZapOutCache.get(cacheKey)

  if (existing) {
    return existing
  }

  const request = (async () => {
    const transaction = await fetchRpc<TRpcTransaction>(args.chainId, 'eth_getTransactionByHash', [
      args.transactionHash
    ])
    const zapperContract = transaction ? getKnownZapperV2Contract({ chainId: args.chainId, transaction }) : null

    if (!zapperContract) {
      return null
    }

    const receipt = await fetchRpc<TRpcTransactionReceipt>(args.chainId, 'eth_getTransactionReceipt', [
      args.transactionHash
    ])
    const zapOut = receipt
      ? getMatchingZapperZapOut({
          receipt,
          zapperContract,
          userAddress: args.userAddress,
          vaultAddress: args.vaultAddress
        })
      : null

    if (
      !receipt ||
      !zapOut ||
      !hasMatchingTokenTransfer({
        receipt,
        tokenAddress: args.vaultAddress,
        from: args.userAddress,
        to: zapperContract,
        value: args.shareAmount
      }) ||
      !hasMatchingTokenTransfer({
        receipt,
        tokenAddress: zapOut.token,
        from: zapperContract,
        to: args.userAddress,
        value: zapOut.tokensRec
      })
    ) {
      return null
    }

    const metadata = await fetchTokenMetadata(args.chainId, zapOut.token)

    return {
      outputAsset: {
        tokenAddress: zapOut.token,
        tokenSymbol: metadata.symbol,
        amount: zapOut.tokensRec.toString(),
        amountFormatted: metadata.decimals === null ? null : formatAmount(zapOut.tokensRec, metadata.decimals)
      },
      assetAmount: zapOut.tokensRec
    }
  })()

  zapperV2ZapOutCache.set(cacheKey, request)
  return request
}
