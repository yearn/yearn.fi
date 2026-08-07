export interface RpcConfig {
  primary: string
  fallbacks: string[]
}

const RPC_CONFIG: Record<number, RpcConfig> = {
  1: {
    primary: 'https://ethereum-rpc.publicnode.com',
    fallbacks: [
      'https://1rpc.io/eth',
      'https://rpc.ankr.com/eth',
      'https://eth-mainnet.nodereal.io/v1/1659dfb40aa24bbb8153a677b98064d7'
    ]
  },
  10: {
    primary: 'https://optimism.public.blockpi.network/v1/rpc/public',
    fallbacks: [
      'https://1rpc.io/op',
      'https://optimism-public.nodies.app',
      'https://optimism-mainnet.public.blastapi.io'
    ]
  },
  137: {
    primary: 'https://polygon-bor-rpc.publicnode.com',
    fallbacks: ['https://rpc.ankr.com/polygon', 'https://1rpc.io/matic', 'https://polygon-public.nodies.app']
  },
  42161: {
    primary: 'https://arbitrum-one.public.blastapi.io',
    fallbacks: ['https://1rpc.io/arb', 'https://arbitrum-one-public.nodies.app', 'https://rpc.ankr.com/arbitrum']
  },
  8453: {
    primary: 'https://base-mainnet.public.blastapi.io',
    fallbacks: [
      'https://1rpc.io/base',
      'https://base-public.nodies.app',
      'https://base.public.blockpi.network/v1/rpc/public'
    ]
  },
  250: {
    primary: 'https://fantom-rpc.publicnode.com',
    fallbacks: ['https://1rpc.io/ftm', 'https://fantom-public.nodies.app', 'https://fantom-mainnet.public.blastapi.io']
  }
}

export function getRpcConfig(chainId: number): RpcConfig | undefined {
  return RPC_CONFIG[chainId]
}

export function getAllRpcEndpoints(chainId: number): string[] {
  const config = RPC_CONFIG[chainId]
  const configuredArchiveEndpoint = process.env[`OPTIMIZATION_ARCHIVE_RPC_URL_${chainId}`]
  if (!config) return configuredArchiveEndpoint ? [configuredArchiveEndpoint] : []
  return [...(configuredArchiveEndpoint ? [configuredArchiveEndpoint] : []), config.primary, ...config.fallbacks]
}

export function getRandomRpcEndpoint(chainId: number): string | undefined {
  const endpoints = getAllRpcEndpoints(chainId)
  if (endpoints.length === 0) return undefined
  return endpoints[Math.floor(Math.random() * endpoints.length)]
}

const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11'

const VAULT_SELECTORS = {
  totalAssets: '0x01e1d114',
  strategies: '0x39ebf823'
}

function encodeAddressParam(addr: string): string {
  return addr.toLowerCase().replace('0x', '').padStart(64, '0')
}

function encodeMulticallAggregate(calls: Array<{ target: string; callData: string }>): string {
  const selector = '252dba42'
  const numCalls = calls.length

  const arrayOffset = '0000000000000000000000000000000000000000000000000000000000000020'
  const arrayLength = numCalls.toString(16).padStart(64, '0')

  let tupleOffsets = ''
  let tupleData = ''

  let currentOffset = 32 * numCalls

  for (const call of calls) {
    tupleOffsets += currentOffset.toString(16).padStart(64, '0')

    const target = call.target.toLowerCase().replace('0x', '').padStart(64, '0')
    const callData = call.callData.replace(/^0x/, '')
    const callDataLen = callData.length / 2
    const paddedLen = Math.ceil(callDataLen / 32) * 32
    const paddedData = callData.padEnd(paddedLen * 2, '0')

    const bytesOffset = '0000000000000000000000000000000000000000000000000000000000000040'
    const lengthHex = callDataLen.toString(16).padStart(64, '0')

    tupleData += target + bytesOffset + lengthHex + paddedData

    currentOffset += 64 + 32 + paddedLen
  }

  return '0x' + selector + arrayOffset + arrayLength + tupleOffsets + tupleData
}

function decodeMulticallAggregateResult(hex: string): { blockNumber: bigint; results: string[] } {
  const clean = hex.replace(/^0x/, '')

  const blockNumber = BigInt('0x' + clean.slice(0, 64))

  const returnDataOffset = Number(BigInt('0x' + clean.slice(64, 128)))
  const returnDataStart = returnDataOffset * 2
  const arrayLength = Number(BigInt('0x' + clean.slice(returnDataStart, returnDataStart + 64)))

  const results: string[] = []

  for (let i = 0; i < arrayLength; i++) {
    const offsetPos = returnDataStart + 64 + i * 64
    const elementOffset = Number(BigInt('0x' + clean.slice(offsetPos, offsetPos + 64)))
    // bytes[] offsets are relative to the array body, immediately after the length slot.
    const elementStart = returnDataStart + 64 + elementOffset * 2

    const bytesLength = Number(BigInt('0x' + clean.slice(elementStart, elementStart + 64)))
    const bytesData = clean.slice(elementStart + 64, elementStart + 64 + bytesLength * 2)
    results.push('0x' + bytesData)
  }

  return { blockNumber, results }
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: string
  id: number
  result?: T
  error?: { code: number; message: string }
}

async function jsonRpcCall<T>(endpoint: string, method: string, params: unknown[], attempt = 0): Promise<T> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  })

  if ((response.status === 429 || response.status === 503) && attempt < 3) {
    await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** attempt))
    return jsonRpcCall(endpoint, method, params, attempt + 1)
  }
  if (!response.ok) {
    throw new Error(`RPC HTTP ${response.status}`)
  }

  const data = (await response.json()) as JsonRpcResponse<T>
  if (data.error) {
    throw new Error(`RPC error ${data.error.code}: ${data.error.message}`)
  }

  if (data.result === undefined) {
    throw new Error('RPC returned undefined result')
  }

  return data.result
}

async function jsonRpcBatchCall<T>(
  endpoint: string,
  calls: Array<{ method: string; params: unknown[] }>,
  attempt = 0
): Promise<T[]> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      calls.map((call, index) => ({
        jsonrpc: '2.0',
        id: index + 1,
        method: call.method,
        params: call.params
      }))
    )
  })
  if ((response.status === 429 || response.status === 503) && attempt < 3) {
    await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** attempt))
    return jsonRpcBatchCall(endpoint, calls, attempt + 1)
  }
  if (!response.ok) {
    throw new Error(`RPC HTTP ${response.status}`)
  }

  const payload = (await response.json()) as JsonRpcResponse<T>[]
  if (!Array.isArray(payload)) {
    throw new Error('RPC batch returned a non-array response')
  }
  const responseById = new Map(payload.map((item) => [item.id, item]))

  return calls.map((_call, index) => {
    const item = responseById.get(index + 1)
    if (!item) {
      throw new Error(`RPC batch response missing id ${index + 1}`)
    }
    if (item.error) {
      throw new Error(`RPC error ${item.error.code}: ${item.error.message}`)
    }
    if (item.result === undefined) {
      throw new Error(`RPC batch response ${index + 1} returned undefined result`)
    }
    return item.result
  })
}

function decodeUint256(hex: string): bigint {
  return BigInt(hex)
}

function extractCurrentDebtFromStrategiesResult(hex: string): bigint {
  const clean = hex.replace(/^0x/, '')
  const currentDebtHex = '0x' + clean.slice(128, 192)
  return decodeUint256(currentDebtHex)
}

async function fetchVaultStateViaMulticall(
  endpoint: string,
  vaultAddress: string,
  strategyAddresses: string[],
  blockTag = 'latest'
): Promise<{ totalAssets: bigint; strategyDebts: Map<string, bigint> }> {
  const calls = [
    { target: vaultAddress, callData: VAULT_SELECTORS.totalAssets },
    ...strategyAddresses.map((addr) => ({
      target: vaultAddress,
      callData: VAULT_SELECTORS.strategies + encodeAddressParam(addr)
    }))
  ]

  const calldata = encodeMulticallAggregate(calls)
  const result = await jsonRpcCall<string>(endpoint, 'eth_call', [{ to: MULTICALL3_ADDRESS, data: calldata }, blockTag])

  const decoded = decodeMulticallAggregateResult(result)

  if (decoded.results.length !== calls.length) {
    throw new Error(`Multicall returned ${decoded.results.length} results, expected ${calls.length}`)
  }

  const totalAssets = decodeUint256(decoded.results[0])
  const strategyDebts = new Map<string, bigint>()

  for (let i = 0; i < strategyAddresses.length; i++) {
    const debt = extractCurrentDebtFromStrategiesResult(decoded.results[i + 1])
    strategyDebts.set(strategyAddresses[i].toLowerCase(), debt)
  }

  return { totalAssets, strategyDebts }
}

async function fetchVaultStateSequential(
  endpoint: string,
  vaultAddress: string,
  strategyAddresses: string[]
): Promise<{ totalAssets: bigint; strategyDebts: Map<string, bigint> }> {
  const totalAssetsResult = await jsonRpcCall<string>(endpoint, 'eth_call', [
    { to: vaultAddress, data: VAULT_SELECTORS.totalAssets },
    'latest'
  ])
  const totalAssets = decodeUint256(totalAssetsResult)

  const strategyDebts = new Map<string, bigint>()
  for (const strategy of strategyAddresses) {
    const data = VAULT_SELECTORS.strategies + encodeAddressParam(strategy)
    const result = await jsonRpcCall<string>(endpoint, 'eth_call', [{ to: vaultAddress, data }, 'latest'])
    strategyDebts.set(strategy.toLowerCase(), extractCurrentDebtFromStrategiesResult(result))
  }

  return { totalAssets, strategyDebts }
}

export async function fetchVaultOnChainState(
  chainId: number,
  vaultAddress: string,
  strategyAddresses: string[]
): Promise<{
  totalAssets: bigint
  strategyDebts: Map<string, bigint>
  unallocatedBps: number
}> {
  const endpoints = getAllRpcEndpoints(chainId)
  if (endpoints.length === 0) {
    throw new Error(`No RPC endpoints configured for chain ${chainId}`)
  }

  let lastError: Error | undefined

  for (const endpoint of endpoints) {
    try {
      const { totalAssets, strategyDebts } = await fetchVaultStateViaMulticall(
        endpoint,
        vaultAddress,
        strategyAddresses
      )
      return computeUnallocated(totalAssets, strategyDebts)
    } catch {
      try {
        const { totalAssets, strategyDebts } = await fetchVaultStateSequential(
          endpoint,
          vaultAddress,
          strategyAddresses
        )
        return computeUnallocated(totalAssets, strategyDebts)
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
      }
    }
  }

  throw lastError ?? new Error('All RPC endpoints failed')
}

interface RpcBlock {
  number: string
  timestamp: string
}

export interface HistoricalVaultState {
  blockNumber: number
  blockTimestamp: number
  totalAssets: bigint
  strategyDebts: Map<string, bigint>
  unallocatedBps: number
}

export interface HistoricalVaultStateRequest {
  timestamp: number
  strategyAddresses: string[]
}

function toBlockTag(blockNumber: number): string {
  return `0x${blockNumber.toString(16)}`
}

interface BlockSearch {
  timestamp: number
  lowBlock: number
  highBlock: number
}

function chunkItems<T>(items: readonly T[], chunkSize: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / chunkSize) }, (_value, index) =>
    items.slice(index * chunkSize, index * chunkSize + chunkSize)
  )
}

async function fetchBlockHeaders(endpoint: string, blockNumbers: readonly number[]): Promise<Map<number, RpcBlock>> {
  const uniqueBlockNumbers = Array.from(new Set(blockNumbers))
  const chunks = chunkItems(uniqueBlockNumbers, 100)
  const chunkResults = await chunks.reduce<Promise<Array<readonly [number, RpcBlock]>>>(
    async (allResultsPromise, chunk) => {
      const allResults = await allResultsPromise
      const blocks = await jsonRpcBatchCall<RpcBlock>(
        endpoint,
        chunk.map((blockNumber) => ({
          method: 'eth_getBlockByNumber',
          params: [toBlockTag(blockNumber), false]
        }))
      )
      return [...allResults, ...blocks.map((block, index) => [chunk[index], block] as const)]
    },
    Promise.resolve([])
  )
  return new Map(chunkResults)
}

async function resolveBlockSearches(endpoint: string, searches: readonly BlockSearch[]): Promise<BlockSearch[]> {
  const unresolvedSearches = searches.filter((search) => search.lowBlock < search.highBlock)
  if (unresolvedSearches.length === 0) {
    return [...searches]
  }

  const midpoints = unresolvedSearches.map((search) => Math.ceil((search.lowBlock + search.highBlock) / 2))
  const blocksByNumber = await fetchBlockHeaders(endpoint, midpoints)
  const nextSearches = searches.map((search) => {
    if (search.lowBlock >= search.highBlock) {
      return search
    }

    const midpoint = Math.ceil((search.lowBlock + search.highBlock) / 2)
    const block = blocksByNumber.get(midpoint)
    if (!block) {
      throw new Error(`Missing block header for ${midpoint}`)
    }

    return Number(BigInt(block.timestamp)) <= search.timestamp
      ? { ...search, lowBlock: midpoint }
      : { ...search, highBlock: midpoint - 1 }
  })
  return resolveBlockSearches(endpoint, nextSearches)
}

async function fetchHistoricalStatesFromEndpoint(
  endpoint: string,
  chainId: number,
  vaultAddress: string,
  requests: readonly HistoricalVaultStateRequest[]
): Promise<HistoricalVaultState[]> {
  const latestBlock = await jsonRpcCall<RpcBlock>(endpoint, 'eth_getBlockByNumber', ['latest', false])
  const latestBlockNumber = Number(BigInt(latestBlock.number))
  const latestTimestamp = Number(BigInt(latestBlock.timestamp))
  const estimatedBlockNumbers =
    chainId === 1
      ? requests.map((request) =>
          Math.max(0, latestBlockNumber - Math.floor(Math.max(0, latestTimestamp - request.timestamp) / 12))
        )
      : []
  const estimatedBlocks =
    estimatedBlockNumbers.length > 0 ? await fetchBlockHeaders(endpoint, estimatedBlockNumbers) : new Map()
  const searches = requests.map((request, index) => {
    if (request.timestamp >= latestTimestamp) {
      return {
        timestamp: request.timestamp,
        lowBlock: latestBlockNumber,
        highBlock: latestBlockNumber
      }
    }

    const estimatedBlockNumber = estimatedBlockNumbers[index]
    const estimatedBlock = estimatedBlocks.get(estimatedBlockNumber)
    if (!estimatedBlock) {
      return {
        timestamp: request.timestamp,
        lowBlock: 0,
        highBlock: latestBlockNumber
      }
    }

    const estimatedTimestamp = Number(BigInt(estimatedBlock.timestamp))
    const estimatedDistance = Math.ceil(Math.abs(request.timestamp - estimatedTimestamp) / 12) + 8
    return estimatedTimestamp <= request.timestamp
      ? {
          timestamp: request.timestamp,
          lowBlock: estimatedBlockNumber,
          highBlock: Math.min(latestBlockNumber, estimatedBlockNumber + estimatedDistance)
        }
      : {
          timestamp: request.timestamp,
          lowBlock: Math.max(0, estimatedBlockNumber - estimatedDistance),
          highBlock: estimatedBlockNumber - 1
        }
  })
  const resolvedSearches = await resolveBlockSearches(endpoint, searches)
  const resolvedBlocks = await fetchBlockHeaders(
    endpoint,
    resolvedSearches.map((search) => search.lowBlock)
  )
  const ethCallChunks = chunkItems(
    requests.map((request, index) => {
      const blockNumber = resolvedSearches[index].lowBlock
      const calls = [
        { target: vaultAddress, callData: VAULT_SELECTORS.totalAssets },
        ...request.strategyAddresses.map((address) => ({
          target: vaultAddress,
          callData: VAULT_SELECTORS.strategies + encodeAddressParam(address)
        }))
      ]
      return {
        blockNumber,
        request,
        call: {
          method: 'eth_call',
          params: [{ to: MULTICALL3_ADDRESS, data: encodeMulticallAggregate(calls) }, toBlockTag(blockNumber)]
        }
      }
    }),
    5
  )
  const states = await ethCallChunks.reduce<Promise<HistoricalVaultState[]>>(async (allStatesPromise, chunk) => {
    const allStates = await allStatesPromise
    const results = await jsonRpcBatchCall<string>(
      endpoint,
      chunk.map((item) => item.call)
    )
    const states = chunk.map((item, index) => {
      const decoded = decodeMulticallAggregateResult(results[index])
      if (decoded.results.length !== item.request.strategyAddresses.length + 1) {
        throw new Error('Historical multicall returned an unexpected result count')
      }

      const strategyDebts = new Map(
        item.request.strategyAddresses.map((address, strategyIndex) => [
          address.toLowerCase(),
          extractCurrentDebtFromStrategiesResult(decoded.results[strategyIndex + 1])
        ])
      )
      const block = resolvedBlocks.get(item.blockNumber)
      if (!block) {
        throw new Error(`Missing resolved block ${item.blockNumber}`)
      }

      return {
        blockNumber: item.blockNumber,
        blockTimestamp: Number(BigInt(block.timestamp)),
        ...computeUnallocated(decodeUint256(decoded.results[0]), strategyDebts)
      }
    })
    return [...allStates, ...states]
  }, Promise.resolve([]))
  return states
}

async function tryHistoricalBatchEndpoints(
  endpoints: readonly string[],
  chainId: number,
  vaultAddress: string,
  requests: readonly HistoricalVaultStateRequest[],
  lastError?: Error
): Promise<HistoricalVaultState[]> {
  const [endpoint, ...remainingEndpoints] = endpoints
  if (!endpoint) {
    throw lastError ?? new Error('All RPC endpoints failed')
  }

  try {
    return await fetchHistoricalStatesFromEndpoint(endpoint, chainId, vaultAddress, requests)
  } catch (error) {
    return tryHistoricalBatchEndpoints(
      remainingEndpoints,
      chainId,
      vaultAddress,
      requests,
      error instanceof Error ? error : new Error(String(error))
    )
  }
}

export async function fetchVaultOnChainStatesAtTimestamps(
  chainId: number,
  vaultAddress: string,
  requests: readonly HistoricalVaultStateRequest[]
): Promise<HistoricalVaultState[]> {
  if (requests.length === 0) {
    return []
  }

  const endpoints = getAllRpcEndpoints(chainId)
  if (endpoints.length === 0) {
    throw new Error(`No RPC endpoints configured for chain ${chainId}`)
  }

  return tryHistoricalBatchEndpoints(endpoints, chainId, vaultAddress, requests)
}

function computeUnallocated(
  totalAssets: bigint,
  strategyDebts: Map<string, bigint>
): { totalAssets: bigint; strategyDebts: Map<string, bigint>; unallocatedBps: number } {
  const totalAllocated = Array.from(strategyDebts.values()).reduce((sum, debt) => sum + debt, BigInt(0))

  let unallocatedBps: number
  if (totalAssets > BigInt(0)) {
    const unallocated = totalAssets > totalAllocated ? totalAssets - totalAllocated : 0n
    unallocatedBps = Number((unallocated * BigInt(10000)) / totalAssets)
  } else {
    unallocatedBps = 10000
  }

  return { totalAssets, strategyDebts, unallocatedBps }
}
