import type { TArchiveAllocationHistoryRecord } from '../../../src/components/shared/utils/schemas/archiveAllocationHistorySchema'
import { fetchVaultOnChainStateAtBlock, getArchiveRpcEndpoints, jsonRpcBatchCall, jsonRpcCall } from './rpc'

const DEBT_UPDATED_TOPIC = '0x5e2b8821ad6e0e26207e0cb4d242d07eeb1cbb1cfd853e645bdcd27cc5484f95'
const TOTAL_BPS = 10000
const NORMALIZATION_TOLERANCE_BPS = 5
const HISTORICAL_STATE_BATCH_SIZE = 6

const IGNORED_INPUT_SELECTORS = new Set([
  '',
  '0x00000000',
  '0x6e553f65', // deposit(uint256,address)
  '0x94bf804d', // mint(uint256,address)
  '0xb460af94', // withdraw(uint256,address,address)
  '0xba087652', // redeem(uint256,address,address)
  '0x22bee494' // known DOA executor wrapper
])

type TJsonRpcLog = {
  blockNumber: `0x${string}`
  transactionHash: `0x${string}`
  logIndex: `0x${string}`
  topics: string[]
}

type TJsonRpcTransaction = {
  from: `0x${string}`
  to: `0x${string}` | null
  input: `0x${string}`
}

type TJsonRpcBlock = {
  number: `0x${string}`
  timestamp: `0x${string}`
}

type TDebtUpdateGroup = {
  txHash: `0x${string}`
  blockNumber: bigint
  maxLogIndex: number
  strategyAddresses: Set<`0x${string}`>
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push([...values.slice(index, index + size)])
  }
  return chunks
}

function normalizeTimestampUtc(timestampUtc: string): number {
  const parsed = new Date(timestampUtc.replace(' UTC', 'Z').replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid fromTimestamp value: ${timestampUtc}`)
  }
  return Math.floor(parsed.getTime() / 1000)
}

function normalizeAddress(address: string): `0x${string}` {
  return address.toLowerCase() as `0x${string}`
}

function toHexQuantity(value: bigint): `0x${string}` {
  return `0x${value.toString(16)}` as const
}

function getStrategyAddressFromTopic(topic: string | undefined): `0x${string}` | null {
  if (!topic || topic.length < 42) {
    return null
  }

  return normalizeAddress(`0x${topic.slice(-40)}`)
}

function getInputSelector(tx: TJsonRpcTransaction | null | undefined): string {
  if (!tx?.input) {
    return ''
  }

  return tx.input.slice(0, 10).toLowerCase()
}

function shouldIgnoreTransaction(selector: string): boolean {
  return IGNORED_INPUT_SELECTORS.has(selector.toLowerCase())
}

function buildAllocationStrategies(
  strategyAddresses: readonly `0x${string}`[],
  totalAssets: bigint,
  strategyDebts: Map<string, bigint>
): TArchiveAllocationHistoryRecord['strategies'] {
  if (totalAssets <= 0n) {
    return []
  }

  return strategyAddresses.flatMap((strategyAddress) => {
    const currentDebt = strategyDebts.get(strategyAddress.toLowerCase()) ?? 0n
    if (currentDebt <= 0n) {
      return []
    }

    return [
      {
        strategyAddress,
        allocationPct: Number((currentDebt * BigInt(TOTAL_BPS)) / totalAssets) / 100
      }
    ]
  })
}

function statesMatch(
  leftStrategies: TArchiveAllocationHistoryRecord['strategies'],
  rightStrategies: TArchiveAllocationHistoryRecord['strategies']
): boolean {
  const leftByStrategy = new Map(
    leftStrategies.map((strategy) => [strategy.strategyAddress.toLowerCase(), strategy.allocationPct])
  )
  const rightByStrategy = new Map(
    rightStrategies.map((strategy) => [strategy.strategyAddress.toLowerCase(), strategy.allocationPct])
  )
  const allStrategyAddresses = new Set([...leftByStrategy.keys(), ...rightByStrategy.keys()])

  return [...allStrategyAddresses].every((strategyAddress) => {
    const leftBps = Math.round((leftByStrategy.get(strategyAddress) ?? 0) * 100)
    const rightBps = Math.round((rightByStrategy.get(strategyAddress) ?? 0) * 100)
    return Math.abs(leftBps - rightBps) <= NORMALIZATION_TOLERANCE_BPS
  })
}

async function jsonRpcCallWithFallbacks<T>(
  endpoints: readonly string[],
  method: string,
  params: unknown[]
): Promise<T> {
  let lastError: Error | undefined

  for (const endpoint of endpoints) {
    try {
      return await jsonRpcCall<T>(endpoint, method, params)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }

  throw lastError ?? new Error('All archive RPC endpoints failed')
}

async function jsonRpcBatchCallWithFallbacks<T>(
  endpoints: readonly string[],
  calls: Array<{ method: string; params: unknown[] }>
): Promise<T[]> {
  let lastError: Error | undefined

  for (const endpoint of endpoints) {
    try {
      return await jsonRpcBatchCall<T>(endpoint, calls)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }

  throw lastError ?? new Error('All archive RPC endpoints failed')
}

async function findFirstBlockAtOrAfterTimestamp(endpoints: readonly string[], timestampSec: number): Promise<bigint> {
  let lower = 0n
  let upper = BigInt(await jsonRpcCallWithFallbacks<string>(endpoints, 'eth_blockNumber', []))

  while (lower < upper) {
    const mid = (lower + upper) / 2n
    const block = await jsonRpcCallWithFallbacks<TJsonRpcBlock>(endpoints, 'eth_getBlockByNumber', [
      toHexQuantity(mid),
      false
    ])
    const blockTimestamp = Number(BigInt(block.timestamp))

    if (blockTimestamp < timestampSec) {
      lower = mid + 1n
    } else {
      upper = mid
    }
  }

  return lower
}

async function fetchTransactionsByHash(
  endpoints: readonly string[],
  txHashes: readonly `0x${string}`[]
): Promise<Map<string, TJsonRpcTransaction>> {
  const txByHash = new Map<string, TJsonRpcTransaction>()

  for (const txHashChunk of chunk(txHashes, 50)) {
    const transactions = await jsonRpcBatchCallWithFallbacks<TJsonRpcTransaction | null>(
      endpoints,
      txHashChunk.map((txHash) => ({
        method: 'eth_getTransactionByHash',
        params: [txHash]
      }))
    )

    transactions.forEach((tx, index) => {
      if (!tx) {
        return
      }

      txByHash.set(txHashChunk[index].toLowerCase(), tx)
    })
  }

  return txByHash
}

async function fetchBlocksByNumber(
  endpoints: readonly string[],
  blockNumbers: readonly bigint[]
): Promise<Map<string, TJsonRpcBlock>> {
  const blockByNumber = new Map<string, TJsonRpcBlock>()

  for (const blockChunk of chunk(blockNumbers, 50)) {
    const blocks = await jsonRpcBatchCallWithFallbacks<TJsonRpcBlock | null>(
      endpoints,
      blockChunk.map((blockNumber) => ({
        method: 'eth_getBlockByNumber',
        params: [toHexQuantity(blockNumber), false]
      }))
    )

    blocks.forEach((block, index) => {
      if (!block) {
        return
      }

      blockByNumber.set(blockChunk[index].toString(), block)
    })
  }

  return blockByNumber
}

export async function fetchArchiveAllocationHistory(params: {
  chainId: number
  vaultAddress: `0x${string}`
  strategyAddresses: readonly `0x${string}`[]
  fromTimestampUtc: string
  env?: NodeJS.ProcessEnv
}): Promise<TArchiveAllocationHistoryRecord[]> {
  const { chainId, env = process.env, fromTimestampUtc, vaultAddress } = params
  const endpoints = getArchiveRpcEndpoints(chainId, env)
  if (endpoints.length === 0) {
    throw new Error(`No archive RPC endpoints configured for chain ${chainId}`)
  }

  const normalizedStrategyAddresses = [...new Set(params.strategyAddresses.map(normalizeAddress))]
  const fromTimestampSec = normalizeTimestampUtc(fromTimestampUtc)
  const fromBlock = await findFirstBlockAtOrAfterTimestamp(endpoints, fromTimestampSec)
  const logs = await jsonRpcCallWithFallbacks<TJsonRpcLog[]>(endpoints, 'eth_getLogs', [
    {
      address: vaultAddress,
      fromBlock: toHexQuantity(fromBlock),
      toBlock: 'latest',
      topics: [DEBT_UPDATED_TOPIC]
    }
  ])

  if (logs.length === 0) {
    return []
  }

  const groupedDebtUpdates = logs.reduce((groups, log) => {
    const txHash = log.transactionHash.toLowerCase() as `0x${string}`
    const strategyAddress = getStrategyAddressFromTopic(log.topics[1])
    const existing = groups.get(txHash) ?? {
      txHash,
      blockNumber: BigInt(log.blockNumber),
      maxLogIndex: Number(BigInt(log.logIndex)),
      strategyAddresses: new Set<`0x${string}`>()
    }

    if (strategyAddress) {
      existing.strategyAddresses.add(strategyAddress)
    }

    existing.maxLogIndex = Math.max(existing.maxLogIndex, Number(BigInt(log.logIndex)))
    groups.set(txHash, existing)
    return groups
  }, new Map<`0x${string}`, TDebtUpdateGroup>())

  const txHashes = [...groupedDebtUpdates.keys()]
  const txByHash = await fetchTransactionsByHash(endpoints, txHashes)

  const candidateGroups = txHashes
    .flatMap((txHash) => {
      const tx = txByHash.get(txHash.toLowerCase())
      const inputSelector = getInputSelector(tx)
      if (shouldIgnoreTransaction(inputSelector)) {
        return []
      }

      const group = groupedDebtUpdates.get(txHash)
      return group ? [{ ...group, inputSelector }] : []
    })
    .sort((left, right) => {
      if (left.blockNumber === right.blockNumber) {
        return left.maxLogIndex - right.maxLogIndex
      }

      return left.blockNumber < right.blockNumber ? -1 : 1
    })

  if (candidateGroups.length === 0) {
    return []
  }

  const strategyUniverse = [
    ...new Set([...normalizedStrategyAddresses, ...candidateGroups.flatMap((group) => [...group.strategyAddresses])])
  ]
  const blockByNumber = await fetchBlocksByNumber(
    endpoints,
    [...new Set(candidateGroups.map((group) => group.blockNumber.toString()))].map((value) => BigInt(value))
  )

  const stateByBlockNumber = new Map<string, Awaited<ReturnType<typeof fetchVaultOnChainStateAtBlock>>>()
  const uniqueCandidateBlocks = [...new Set(candidateGroups.map((group) => group.blockNumber.toString()))].map(
    (value) => BigInt(value)
  )

  for (const blockChunk of chunk(uniqueCandidateBlocks, HISTORICAL_STATE_BATCH_SIZE)) {
    const states = await Promise.all(
      blockChunk.map((blockNumber) =>
        fetchVaultOnChainStateAtBlock(chainId, vaultAddress, strategyUniverse, toHexQuantity(blockNumber), env).then(
          (state) => [blockNumber.toString(), state] as const
        )
      )
    )

    states.forEach(([blockKey, state]) => {
      stateByBlockNumber.set(blockKey, state)
    })
  }

  const records: TArchiveAllocationHistoryRecord[] = []

  for (const group of candidateGroups) {
    const blockKey = group.blockNumber.toString()
    const block = blockByNumber.get(blockKey)
    const state = stateByBlockNumber.get(blockKey)
    if (!block || !state) {
      continue
    }

    records.push({
      id: `archive:${group.txHash}`,
      timestampUtc: new Date(Number(BigInt(block.timestamp)) * 1000).toISOString(),
      blockNumber: Number(group.blockNumber),
      txHash: group.txHash,
      inputSelector: group.inputSelector,
      strategies: buildAllocationStrategies(strategyUniverse, state.totalAssets, state.strategyDebts)
    })
  }

  return records.reduce((dedupedRecords, record) => {
    const previousRecord = dedupedRecords[dedupedRecords.length - 1]
    if (previousRecord && statesMatch(previousRecord.strategies, record.strategies)) {
      return dedupedRecords
    }

    dedupedRecords.push(record)
    return dedupedRecords
  }, [] as TArchiveAllocationHistoryRecord[])
}
