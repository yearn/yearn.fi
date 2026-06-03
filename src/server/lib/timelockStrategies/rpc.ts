import { type Chain, createPublicClient, http, isAddressEqual } from 'viem'
import { arbitrum, base, mainnet, optimism, polygon } from 'viem/chains'
import { strategyMetadataAbi, timelockControllerAbi } from './abi'
import { getTimelockStrategyController } from './config'
import { decodePendingTimelockStrategies, type TTimelockOperationStatus, type TTimelockScheduledCall } from './decode'
import type { TPendingTimelockStrategy } from './types'

const MAX_LOG_RANGE_BLOCKS = 45_000n
const CACHE_TTL_MS = 60_000

type TTimelockPublicClient = {
  getBlockNumber: () => Promise<bigint>
  getBlock: (params: { blockNumber: bigint }) => Promise<{ timestamp: bigint }>
  getLogs: (params: {
    address: `0x${string}`
    event: unknown
    fromBlock: bigint
    toBlock: bigint
  }) => Promise<TTimelockLog[]>
  readContract: (params: {
    address: `0x${string}`
    abi: unknown
    functionName: string
    args?: readonly unknown[]
  }) => Promise<unknown>
}

type TCacheEntry = {
  expiresAt: number
  items: TPendingTimelockStrategy[]
}

type TTimelockLogArgs = {
  id?: `0x${string}`
  index?: bigint
  target?: `0x${string}`
  data?: `0x${string}`
  delay?: bigint
}

type TTimelockLog = {
  args?: TTimelockLogArgs
  blockNumber?: bigint | null
  logIndex?: number | null
  transactionHash?: `0x${string}` | null
}

type TFetchPendingTimelockStrategiesParams = {
  chainId: number
  vaultAddress: `0x${string}`
  nowSeconds?: number
  client?: TTimelockPublicClient
}

const cache = new Map<string, TCacheEntry>()

const KATANA_CHAIN = {
  id: 747474,
  name: 'Katana',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: { default: { http: [''] } }
} as const satisfies Chain

const CHAINS_BY_ID = new Map<number, Chain>([
  [1, mainnet],
  [10, optimism],
  [137, polygon],
  [8453, base],
  [42161, arbitrum],
  [747474, KATANA_CHAIN]
])

const CALL_SCHEDULED_EVENT = timelockControllerAbi[0]
const CALL_EXECUTED_EVENT = timelockControllerAbi[1]
const CANCELLED_EVENT = timelockControllerAbi[2]

const resolveRpcUrl = (chainId: number): string | undefined =>
  (process.env[`RPC_URI_FOR_${chainId}`] || process.env[`NEXT_PUBLIC_RPC_URI_FOR_${chainId}`])?.trim()

function createTimelockClient(chainId: number, rpcUrl: string): TTimelockPublicClient {
  return createPublicClient({
    chain: CHAINS_BY_ID.get(chainId),
    transport: http(rpcUrl)
  }) as TTimelockPublicClient
}

function buildBlockRanges(fromBlock: bigint, toBlock: bigint): Array<{ fromBlock: bigint; toBlock: bigint }> {
  const rangeSize = toBlock >= fromBlock ? toBlock - fromBlock + 1n : 0n
  const chunkCount = Number((rangeSize + MAX_LOG_RANGE_BLOCKS - 1n) / MAX_LOG_RANGE_BLOCKS)

  return Array.from({ length: chunkCount }, (_value, index) => {
    const rangeStart = fromBlock + BigInt(index) * MAX_LOG_RANGE_BLOCKS
    const rangeEndCandidate = rangeStart + MAX_LOG_RANGE_BLOCKS - 1n

    return {
      fromBlock: rangeStart,
      toBlock: rangeEndCandidate < toBlock ? rangeEndCandidate : toBlock
    }
  })
}

const logSortKey = (log: TTimelockLog): string => `${log.blockNumber ?? 0n}:${log.logIndex ?? 0}`

async function fetchLogsByEvent({
  address,
  client,
  event,
  ranges
}: {
  address: `0x${string}`
  client: TTimelockPublicClient
  event: unknown
  ranges: Array<{ fromBlock: bigint; toBlock: bigint }>
}): Promise<TTimelockLog[]> {
  const logsByRange = await Promise.all(
    ranges.map((range) =>
      client.getLogs({
        address,
        event,
        fromBlock: range.fromBlock,
        toBlock: range.toBlock
      })
    )
  )

  return logsByRange.flat()
}

async function resolveBlockTimestamps(
  client: TTimelockPublicClient,
  logs: TTimelockLog[]
): Promise<Map<bigint, number>> {
  const uniqueBlocks = [...new Set(logs.map((log) => log.blockNumber).filter((block): block is bigint => !!block))]
  const blockEntries = await Promise.all(
    uniqueBlocks.map(async (blockNumber) => {
      const block = await client.getBlock({ blockNumber })
      return [blockNumber, Number(block.timestamp)] as const
    })
  )

  return new Map(blockEntries)
}

function normalizeScheduledLogs(logs: TTimelockLog[], blockTimestamps: Map<bigint, number>): TTimelockScheduledCall[] {
  return logs.flatMap((log) => {
    const args = log.args

    if (
      !args?.id ||
      args.index === undefined ||
      !args.target ||
      !args.data ||
      args.delay === undefined ||
      !log.transactionHash
    ) {
      return []
    }

    return [
      {
        operationId: args.id,
        index: Number(args.index),
        target: args.target,
        data: args.data,
        delay: Number(args.delay),
        blockTimestamp: log.blockNumber ? (blockTimestamps.get(log.blockNumber) ?? 0) : 0,
        transactionHash: log.transactionHash
      }
    ]
  })
}

const operationIdsFromLogs = (logs: TTimelockLog[]): Set<`0x${string}`> =>
  new Set(logs.map((log) => log.args?.id).filter((id): id is `0x${string}` => Boolean(id)))

async function fetchOperationStatuses(
  client: TTimelockPublicClient,
  timelockAddress: `0x${string}`,
  operationIds: `0x${string}`[]
): Promise<Map<`0x${string}`, TTimelockOperationStatus>> {
  const entries = await Promise.all(
    operationIds.map(async (id) => {
      const [isPending, isReady, isDone, timestamp] = await Promise.all([
        client.readContract({
          address: timelockAddress,
          abi: timelockControllerAbi,
          functionName: 'isOperationPending',
          args: [id]
        }),
        client.readContract({
          address: timelockAddress,
          abi: timelockControllerAbi,
          functionName: 'isOperationReady',
          args: [id]
        }),
        client.readContract({
          address: timelockAddress,
          abi: timelockControllerAbi,
          functionName: 'isOperationDone',
          args: [id]
        }),
        client.readContract({
          address: timelockAddress,
          abi: timelockControllerAbi,
          functionName: 'getTimestamp',
          args: [id]
        })
      ])

      return [
        id,
        {
          isPending: Boolean(isPending),
          isReady: Boolean(isReady),
          isDone: Boolean(isDone),
          timestamp: Number(timestamp)
        }
      ] as const
    })
  )

  return new Map(entries)
}

async function readStringContractValue({
  address,
  client,
  functionName
}: {
  address: `0x${string}`
  client: TTimelockPublicClient
  functionName: 'name' | 'symbol'
}): Promise<string | undefined> {
  try {
    const value = await client.readContract({
      address,
      abi: strategyMetadataAbi,
      functionName
    })

    return typeof value === 'string' && value.trim() ? value : undefined
  } catch {
    return undefined
  }
}

async function fetchStrategyMetadata(
  client: TTimelockPublicClient,
  strategies: `0x${string}`[]
): Promise<Map<`0x${string}`, { name?: string; symbol?: string }>> {
  const uniqueStrategies = [...new Map(strategies.map((strategy) => [strategy.toLowerCase(), strategy])).values()]
  const entries = await Promise.all(
    uniqueStrategies.map(async (address) => {
      const [name, symbol] = await Promise.all([
        readStringContractValue({ address, client, functionName: 'name' }),
        readStringContractValue({ address, client, functionName: 'symbol' })
      ])

      return [address, { name, symbol }] as const
    })
  )

  return new Map(entries)
}

const getCacheKey = (chainId: number, vaultAddress: `0x${string}`): string => `${chainId}:${vaultAddress.toLowerCase()}`

export function clearTimelockStrategiesCache(): void {
  cache.clear()
}

export async function fetchPendingTimelockStrategies({
  chainId,
  vaultAddress,
  nowSeconds = Math.floor(Date.now() / 1000),
  client
}: TFetchPendingTimelockStrategiesParams): Promise<TPendingTimelockStrategy[]> {
  const controller = getTimelockStrategyController(chainId)
  if (!controller) {
    return []
  }

  const rpcUrl = resolveRpcUrl(chainId)
  if (!rpcUrl && !client) {
    console.warn(
      `Missing RPC_URI_FOR_${chainId} or NEXT_PUBLIC_RPC_URI_FOR_${chainId}; pending timelock strategy lookup skipped.`
    )
    return []
  }

  const cacheKey = getCacheKey(chainId, vaultAddress)
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > nowSeconds * 1000) {
    return cached.items
  }

  const publicClient = client ?? createTimelockClient(chainId, rpcUrl!)
  const currentBlock = await publicClient.getBlockNumber()
  const fromBlock =
    currentBlock > controller.defaultLookbackBlocks ? currentBlock - controller.defaultLookbackBlocks : 0n
  const ranges = buildBlockRanges(fromBlock, currentBlock)
  const [scheduledLogs, executedLogs, cancelledLogs] = await Promise.all([
    fetchLogsByEvent({
      address: controller.timelockAddress,
      client: publicClient,
      event: CALL_SCHEDULED_EVENT,
      ranges
    }),
    fetchLogsByEvent({ address: controller.timelockAddress, client: publicClient, event: CALL_EXECUTED_EVENT, ranges }),
    fetchLogsByEvent({ address: controller.timelockAddress, client: publicClient, event: CANCELLED_EVENT, ranges })
  ])
  const sortedScheduledLogs = [...scheduledLogs].sort((a, b) => logSortKey(a).localeCompare(logSortKey(b)))
  const blockTimestamps = await resolveBlockTimestamps(publicClient, sortedScheduledLogs)
  const scheduledCalls = normalizeScheduledLogs(sortedScheduledLogs, blockTimestamps).filter((call) =>
    isAddressEqual(call.target, vaultAddress)
  )
  const operationIds = [...new Set(scheduledCalls.map((call) => call.operationId))]
  const operationStatuses = await fetchOperationStatuses(publicClient, controller.timelockAddress, operationIds)
  const provisionalItems = decodePendingTimelockStrategies({
    controller,
    vaultAddress,
    scheduledCalls,
    executedOperationIds: operationIdsFromLogs(executedLogs),
    cancelledOperationIds: operationIdsFromLogs(cancelledLogs),
    operationStatuses
  })
  const strategyMetadata = await fetchStrategyMetadata(
    publicClient,
    provisionalItems.map((item) => item.strategyAddress)
  )
  const items = decodePendingTimelockStrategies({
    controller,
    vaultAddress,
    scheduledCalls,
    executedOperationIds: operationIdsFromLogs(executedLogs),
    cancelledOperationIds: operationIdsFromLogs(cancelledLogs),
    operationStatuses,
    strategyMetadata
  })

  cache.set(cacheKey, {
    expiresAt: nowSeconds * 1000 + CACHE_TTL_MS,
    items
  })

  return items
}
