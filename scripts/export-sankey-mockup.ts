/// <reference types="node" />

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Interface } from 'ethers/lib/utils.js'
import { readLocalArchiveAllocationHistoryArtifact } from '../api/optimization/_lib/localArchiveHistory'
import {
  fetchVaultOnChainStateAtBlock,
  getArchiveRpcEndpoints,
  jsonRpcBatchCall,
  jsonRpcCall
} from '../api/optimization/_lib/rpc'
import type {
  TReallocationPanel,
  TReallocationState,
  TReallocationStateStrategy
} from '../src/components/pages/vaults/utils/reallocations'
import { SUPPORTED_ARCHIVE_ALLOCATION_HISTORY_TARGETS } from '../src/components/shared/constants/archiveAllocationHistory'
import type { TArchiveAllocationHistoryArtifact } from '../src/components/shared/utils/schemas/archiveAllocationHistorySchema'

type TParsedCliArgs = {
  flags: Record<string, string>
}

type TTxInfo = {
  from: `0x${string}` | null
  inputSelector: string
  to: `0x${string}` | null
}

type TJsonRpcLog = {
  blockNumber: `0x${string}`
  logIndex: `0x${string}`
  topics: string[]
  transactionHash: `0x${string}`
}

type TJsonRpcBlock = {
  timestamp: `0x${string}`
}

type TDebtUpdateGroup = {
  blockNumber: bigint
  maxLogIndex: number
  strategyAddresses: Set<`0x${string}`>
  txHash: `0x${string}`
}

type TClassifiedAllocationRecord = {
  badgeText: string
  badgeTone: 'automatic' | 'selector'
  blockNumber: number
  changeSource: 'automatic' | 'selector'
  createdBy: `0x${string}` | null
  inputSelector: string
  state: TReallocationState
  timestampUtc: string
  to: `0x${string}` | null
  txHash: `0x${string}`
}

type TSankeyMockupPanelMeta = {
  annotationTone: 'automatic' | 'selector'
  changeSource: 'automatic' | 'selector'
  createdBy: `0x${string}` | null
  inputSelector: string
  to: `0x${string}` | null
  topChanges: Array<{
    afterAllocationPct: number
    beforeAllocationPct: number
    deltaPct: number
    name: string
  }>
  txHash: `0x${string}`
}

type TVaultSankeyMockupFeed = {
  generatedAt: string
  panelMeta: Record<string, TSankeyMockupPanelMeta>
  panels: TReallocationPanel[]
  vaultAddress: `0x${string}`
  vaultLabel: string
}

type TSankeyNode = {
  heightRatio: number
  id: string
  localY: number
  value: number
}

type TSankeyLink = {
  source: string
  target: string
  value: number
}

const NAME_INTERFACE = new Interface(['function name() view returns (string)'])
const DEBT_UPDATED_TOPIC = '0x5e2b8821ad6e0e26207e0cb4d242d07eeb1cbb1cfd853e645bdcd27cc5484f95'
const DOA_SELECTOR = '0x22bee494'
const DOA_KEEPER = '0x283132390ea87d6ecc20255b59ba94329ee17961'
const TOTAL_BPS = 10000
const NORMALIZATION_TOLERANCE_BPS = 5
const FLOW_EPSILON = 1e-9
const DEFAULT_NODE_GAP_RATIO = 10 / 250
const UNALLOCATED_STRATEGY_ID = 'unallocated'
const UNALLOCATED_COLOR = '#9ca3af'
const PANEL_PALETTE = ['#2563eb', '#0891b2', '#0f766e', '#ca8a04', '#dc2626', '#7c3aed', '#ea580c', '#4f46e5']
const OUTPUT_DIR = join(process.cwd(), 'scratch', 'archive-allocation-history', 'sankey-mockup')

function parseCliArgs(argv: readonly string[]): TParsedCliArgs {
  return argv.reduce<TParsedCliArgs>(
    (state, token, index, allTokens) => {
      if (!token.startsWith('--')) {
        return state
      }

      const key = token.slice(2)
      const nextToken = allTokens[index + 1]
      const value = !nextToken || nextToken.startsWith('--') ? 'true' : nextToken

      return {
        flags: {
          ...state.flags,
          [key]: value
        }
      }
    },
    { flags: {} }
  )
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  return values.reduce<T[][]>((chunks, value, index) => {
    const chunkIndex = Math.floor(index / size)
    const currentChunk = chunks[chunkIndex]
    if (currentChunk) {
      currentChunk.push(value)
      return chunks
    }

    chunks.push([value])
    return chunks
  }, [])
}

function normalizeAddress(address: string | null | undefined): `0x${string}` | null {
  return address ? (address.toLowerCase() as `0x${string}`) : null
}

function toHexQuantity(value: bigint): `0x${string}` {
  return `0x${value.toString(16)}` as const
}

function normalizeTimestampUtc(timestampUtc: string): number {
  const parsed = new Date(timestampUtc.replace(' UTC', 'Z').replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid timestamp: ${timestampUtc}`)
  }

  return Math.floor(parsed.getTime() / 1000)
}

function getStrategyAddressFromTopic(topic: string | undefined): `0x${string}` | null {
  if (!topic || topic.length < 42) {
    return null
  }

  return normalizeAddress(`0x${topic.slice(-40)}`)
}

function buildVaultLabel(vaultAddress: `0x${string}`): string {
  return vaultAddress.toLowerCase() === '0xbe53a109b494e5c9f97b9cd39fe969be68bf6204'
    ? 'yvUSDC-1'
    : vaultAddress.toLowerCase() === '0xc56413869c6cdf96496f2b1ef801fedbdfa7ddb0'
      ? 'yvWETH-1'
      : vaultAddress
}

async function jsonRpcCallWithFallbacks<T>(chainId: number, method: string, params: unknown[]): Promise<T> {
  const endpoints = getArchiveRpcEndpoints(chainId)
  const tryNext = async (index: number): Promise<T> => {
    const endpoint = endpoints[index]
    if (!endpoint) {
      throw new Error(`All RPC endpoints failed for chain ${chainId}`)
    }

    try {
      return await jsonRpcCall<T>(endpoint, method, params)
    } catch (error) {
      if (index >= endpoints.length - 1) {
        throw error
      }

      return tryNext(index + 1)
    }
  }

  return tryNext(0)
}

async function jsonRpcBatchCallWithFallbacks<T>(
  chainId: number,
  calls: Array<{ method: string; params: unknown[] }>
): Promise<T[]> {
  const endpoints = getArchiveRpcEndpoints(chainId)
  const tryNext = async (index: number): Promise<T[]> => {
    const endpoint = endpoints[index]
    if (!endpoint) {
      throw new Error(`All RPC endpoints failed for chain ${chainId}`)
    }

    try {
      return await jsonRpcBatchCall<T>(endpoint, calls)
    } catch (error) {
      if (index >= endpoints.length - 1) {
        throw error
      }

      return tryNext(index + 1)
    }
  }

  return tryNext(0)
}

async function findFirstBlockAtOrAfterTimestamp(chainId: number, timestampSec: number): Promise<bigint> {
  const latestBlockNumber = await jsonRpcCallWithFallbacks<string>(chainId, 'eth_blockNumber', [])

  const search = async (lower: bigint, upper: bigint): Promise<bigint> => {
    if (lower >= upper) {
      return lower
    }

    const mid = (lower + upper) / 2n
    const block = await jsonRpcCallWithFallbacks<TJsonRpcBlock>(chainId, 'eth_getBlockByNumber', [
      toHexQuantity(mid),
      false
    ])
    const blockTimestamp = Number(BigInt(block.timestamp))

    return blockTimestamp < timestampSec ? search(mid + 1n, upper) : search(lower, mid)
  }

  return search(0n, BigInt(latestBlockNumber))
}

async function fetchTransactionsByHash(
  chainId: number,
  txHashes: readonly `0x${string}`[]
): Promise<Map<string, TTxInfo>> {
  const transactionChunks = chunk(txHashes, 50)
  const transactionResults = await Promise.all(
    transactionChunks.map(async (transactionChunk) => {
      const txs = await jsonRpcBatchCallWithFallbacks<{
        from?: string
        input?: string
        to?: string | null
      } | null>(
        chainId,
        transactionChunk.map((txHash) => ({
          method: 'eth_getTransactionByHash',
          params: [txHash]
        }))
      )

      return transactionChunk.map((txHash, index) => [txHash.toLowerCase(), txs[index]] as const)
    })
  )

  return transactionResults.flat().reduce((txByHash, [txHash, tx]) => {
    txByHash.set(txHash, {
      from: normalizeAddress(tx?.from),
      inputSelector: tx?.input?.slice(0, 10).toLowerCase() ?? '',
      to: normalizeAddress(tx?.to ?? null)
    })
    return txByHash
  }, new Map<string, TTxInfo>())
}

async function fetchBlocksByNumber(
  chainId: number,
  blockNumbers: readonly bigint[]
): Promise<Map<string, TJsonRpcBlock>> {
  const blockChunks = chunk(blockNumbers, 50)
  const blockResults = await Promise.all(
    blockChunks.map(async (blockChunk) => {
      const blocks = await jsonRpcBatchCallWithFallbacks<TJsonRpcBlock | null>(
        chainId,
        blockChunk.map((blockNumber) => ({
          method: 'eth_getBlockByNumber',
          params: [toHexQuantity(blockNumber), false]
        }))
      )

      return blockChunk.map((blockNumber, index) => [blockNumber.toString(), blocks[index]] as const)
    })
  )

  return blockResults.flat().reduce((blockByNumber, [blockNumber, block]) => {
    if (block) {
      blockByNumber.set(blockNumber, block)
    }
    return blockByNumber
  }, new Map<string, TJsonRpcBlock>())
}

async function fetchStrategyNames(
  chainId: number,
  strategyAddresses: readonly `0x${string}`[]
): Promise<Map<string, string>> {
  const strategyChunks = chunk(strategyAddresses, 50)
  const strategyResults = await Promise.all(
    strategyChunks.map(async (strategyChunk) => {
      const responses = await jsonRpcBatchCallWithFallbacks<`0x${string}`>(
        chainId,
        strategyChunk.map((strategyAddress) => ({
          method: 'eth_call',
          params: [{ to: strategyAddress, data: NAME_INTERFACE.encodeFunctionData('name') }, 'latest']
        }))
      )

      return strategyChunk.map((strategyAddress, index) => {
        const result = responses[index]
        if (!result || result === '0x') {
          return [strategyAddress.toLowerCase(), strategyAddress] as const
        }

        try {
          const [name] = NAME_INTERFACE.decodeFunctionResult('name', result)
          return [strategyAddress.toLowerCase(), String(name)] as const
        } catch {
          return [strategyAddress.toLowerCase(), strategyAddress] as const
        }
      })
    })
  )

  return strategyResults.flat().reduce((namesByAddress, [strategyAddress, name]) => {
    namesByAddress.set(strategyAddress, name)
    return namesByAddress
  }, new Map<string, string>())
}

function percentToBps(percent: number): number {
  return Math.round(percent * 100)
}

function isPositive(value: number): boolean {
  return value > FLOW_EPSILON
}

function roundFlowValue(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

function buildAllocationState(params: {
  id: string
  strategyNamesByAddress: Map<string, string>
  strategyUniverse: readonly `0x${string}`[]
  strategyDebts: Map<string, bigint>
  timestampUtc: string
  totalAssets: bigint
}): TReallocationState {
  const { id, strategyNamesByAddress, strategyUniverse, strategyDebts, timestampUtc, totalAssets } = params
  const strategies =
    totalAssets > 0n
      ? strategyUniverse.flatMap((strategyAddress) => {
          const currentDebt = strategyDebts.get(strategyAddress.toLowerCase()) ?? 0n
          if (currentDebt <= 0n) {
            return []
          }

          return [
            {
              strategyAddress,
              allocationPct: Number((currentDebt * BigInt(TOTAL_BPS)) / totalAssets) / 100,
              isUnallocated: false,
              name: strategyNamesByAddress.get(strategyAddress.toLowerCase()) ?? strategyAddress,
              strategyId: strategyAddress.toLowerCase()
            } satisfies TReallocationStateStrategy
          ]
        })
      : []

  const totalAllocationBps = strategies.reduce((sum, strategy) => sum + percentToBps(strategy.allocationPct), 0)
  const unallocatedBps = Math.max(0, TOTAL_BPS - totalAllocationBps)
  const strategiesWithUnallocated =
    unallocatedBps > NORMALIZATION_TOLERANCE_BPS
      ? [
          ...strategies,
          {
            strategyAddress: null,
            allocationPct: unallocatedBps / 100,
            isUnallocated: true,
            name: 'Unallocated',
            strategyId: UNALLOCATED_STRATEGY_ID
          } satisfies TReallocationStateStrategy
        ]
      : strategies

  return {
    id,
    origin: 'archive',
    strategies: strategiesWithUnallocated,
    timestampUtc
  }
}

function getStateStrategyIdentity(strategy: TReallocationStateStrategy): string {
  return strategy.isUnallocated ? UNALLOCATED_STRATEGY_ID : strategy.strategyId
}

function buildStateAllocationMap(state: TReallocationState): Map<string, number> {
  return state.strategies.reduce((allocationByStrategyId, strategy) => {
    const nextAllocationByStrategyId = new Map(allocationByStrategyId)
    nextAllocationByStrategyId.set(getStateStrategyIdentity(strategy), percentToBps(strategy.allocationPct))
    return nextAllocationByStrategyId
  }, new Map<string, number>())
}

function statesMatch(leftState: TReallocationState, rightState: TReallocationState): boolean {
  const leftAllocations = buildStateAllocationMap(leftState)
  const rightAllocations = buildStateAllocationMap(rightState)
  const allStrategyIds = new Set([...leftAllocations.keys(), ...rightAllocations.keys()])

  return [...allStrategyIds].every((strategyId) => {
    const leftAllocation = leftAllocations.get(strategyId) ?? 0
    const rightAllocation = rightAllocations.get(strategyId) ?? 0
    return Math.abs(leftAllocation - rightAllocation) <= NORMALIZATION_TOLERANCE_BPS
  })
}

function alignStateStrategyOrder(
  previousState: TReallocationState | undefined,
  nextState: TReallocationState
): TReallocationState {
  if (!previousState) {
    return {
      ...nextState,
      strategies: [...nextState.strategies]
    }
  }

  const nextByStrategyId = new Map(
    nextState.strategies.map((strategy) => [getStateStrategyIdentity(strategy), strategy] as const)
  )
  const carriedStrategyIds = new Set<string>()
  const carriedStrategies = previousState.strategies.flatMap((strategy) => {
    const strategyId = getStateStrategyIdentity(strategy)
    const nextStrategy = nextByStrategyId.get(strategyId)
    if (!nextStrategy || carriedStrategyIds.has(strategyId)) {
      return []
    }

    carriedStrategyIds.add(strategyId)
    return [nextStrategy]
  })

  return {
    ...nextState,
    strategies: [
      ...carriedStrategies,
      ...nextState.strategies.filter((strategy) => !carriedStrategyIds.has(getStateStrategyIdentity(strategy)))
    ]
  }
}

function classifyRecord(
  inputSelector: string,
  createdBy: `0x${string}` | null
): {
  badgeText: string
  badgeTone: 'automatic' | 'selector'
  changeSource: 'automatic' | 'selector'
} {
  return inputSelector === DOA_SELECTOR || createdBy?.toLowerCase() === DOA_KEEPER
    ? {
        badgeText: 'Automatic (DOA)',
        badgeTone: 'automatic',
        changeSource: 'automatic'
      }
    : {
        badgeText: `Selector ${inputSelector || 'unknown'}`,
        badgeTone: 'selector',
        changeSource: 'selector'
      }
}

function buildTopChanges(
  beforeState: TReallocationState,
  afterState: TReallocationState
): TSankeyMockupPanelMeta['topChanges'] {
  const beforeByStrategyId = new Map(
    beforeState.strategies.map((strategy) => [getStateStrategyIdentity(strategy), strategy] as const)
  )
  const afterByStrategyId = new Map(
    afterState.strategies.map((strategy) => [getStateStrategyIdentity(strategy), strategy] as const)
  )
  const allStrategyIds = new Set([...beforeByStrategyId.keys(), ...afterByStrategyId.keys()])

  return [...allStrategyIds]
    .map((strategyId) => {
      const beforeStrategy = beforeByStrategyId.get(strategyId)
      const afterStrategy = afterByStrategyId.get(strategyId)
      const beforeAllocationPct = beforeStrategy?.allocationPct ?? 0
      const afterAllocationPct = afterStrategy?.allocationPct ?? 0
      return {
        afterAllocationPct,
        beforeAllocationPct,
        deltaPct: afterAllocationPct - beforeAllocationPct,
        name: afterStrategy?.name ?? beforeStrategy?.name ?? strategyId
      }
    })
    .filter((change) => Math.abs(change.deltaPct) > 0.01)
    .sort((left, right) => Math.abs(right.deltaPct) - Math.abs(left.deltaPct))
    .slice(0, 4)
}

function buildOrderedNodes(
  strategies: readonly TReallocationStateStrategy[],
  side: 'before' | 'after',
  gapRatio = DEFAULT_NODE_GAP_RATIO
): TSankeyNode[] {
  const nonZeroStrategies = strategies.filter((strategy) => isPositive(strategy.allocationPct))
  const totalValue = nonZeroStrategies.reduce((sum, strategy) => sum + strategy.allocationPct, 0)
  const totalGap = Math.max(0, nonZeroStrategies.length - 1) * gapRatio
  const scale = totalValue > 0 ? Math.max(0, 1 - totalGap) / totalValue : 0

  return nonZeroStrategies.reduce(
    (state, strategy) => {
      const heightRatio = strategy.allocationPct * scale
      return {
        nodes: [
          ...state.nodes,
          {
            heightRatio,
            id: `${side}:${getStateStrategyIdentity(strategy)}`,
            localY: state.offset,
            value: strategy.allocationPct
          }
        ],
        offset: state.offset + heightRatio + gapRatio
      }
    },
    {
      nodes: [] as TSankeyNode[],
      offset: 0
    }
  ).nodes
}

function allocateRemainingFlows(
  outgoing: Array<{ remaining: number; source: string }>,
  incoming: Array<{ remaining: number; target: string }>,
  incomingIndex = 0
): TSankeyLink[] {
  const source = outgoing[0]
  if (!source) {
    return []
  }

  if (!isPositive(source.remaining)) {
    return allocateRemainingFlows(outgoing.slice(1), incoming, incomingIndex)
  }

  const target = incoming[incomingIndex]
  if (!target) {
    return allocateRemainingFlows(outgoing.slice(1), incoming, incomingIndex)
  }

  if (!isPositive(target.remaining)) {
    return allocateRemainingFlows(outgoing, incoming, incomingIndex + 1)
  }

  const transfer = roundFlowValue(Math.min(source.remaining, target.remaining))
  const nextSourceRemaining = roundFlowValue(source.remaining - transfer)
  const nextIncoming = incoming.map((item, index) => {
    return index === incomingIndex ? { ...item, remaining: roundFlowValue(item.remaining - transfer) } : item
  })
  const nextOutgoing = isPositive(nextSourceRemaining)
    ? [{ ...source, remaining: nextSourceRemaining }, ...outgoing.slice(1)]
    : outgoing.slice(1)
  const nextIncomingIndex = isPositive(nextIncoming[incomingIndex]?.remaining ?? 0) ? incomingIndex : incomingIndex + 1

  return [
    ...(isPositive(transfer)
      ? [
          {
            source: source.source,
            target: target.target,
            value: transfer
          }
        ]
      : []),
    ...allocateRemainingFlows(nextOutgoing, nextIncoming, nextIncomingIndex)
  ]
}

function buildStateTransitionSankeyGraph(
  beforeStrategies: readonly TReallocationStateStrategy[],
  afterStrategies: readonly TReallocationStateStrategy[]
): {
  links: TSankeyLink[]
  nodes: TSankeyNode[]
} {
  const nodes = [...buildOrderedNodes(beforeStrategies, 'before'), ...buildOrderedNodes(afterStrategies, 'after')]
  const indexedBeforeStrategies = beforeStrategies.filter((strategy) => isPositive(strategy.allocationPct))
  const indexedAfterStrategies = afterStrategies.filter((strategy) => isPositive(strategy.allocationPct))
  const afterValueByStrategyId = new Map(
    indexedAfterStrategies.map((strategy) => [getStateStrategyIdentity(strategy), strategy.allocationPct])
  )
  const beforeValueByStrategyId = new Map(
    indexedBeforeStrategies.map((strategy) => [getStateStrategyIdentity(strategy), strategy.allocationPct])
  )

  const directLinks = indexedBeforeStrategies
    .map((strategy) => {
      const strategyId = getStateStrategyIdentity(strategy)
      const overlap = Math.min(strategy.allocationPct, afterValueByStrategyId.get(strategyId) ?? 0)

      return isPositive(overlap)
        ? {
            source: `before:${strategyId}`,
            target: `after:${strategyId}`,
            value: roundFlowValue(overlap)
          }
        : null
    })
    .filter(Boolean) as TSankeyLink[]

  const outgoing = indexedBeforeStrategies
    .map((strategy) => {
      const strategyId = getStateStrategyIdentity(strategy)
      const overlap = Math.min(strategy.allocationPct, afterValueByStrategyId.get(strategyId) ?? 0)

      return {
        remaining: roundFlowValue(strategy.allocationPct - overlap),
        source: `before:${strategyId}`
      }
    })
    .filter(({ remaining }) => isPositive(remaining))

  const incoming = indexedAfterStrategies
    .map((strategy) => {
      const strategyId = getStateStrategyIdentity(strategy)
      const overlap = Math.min(strategy.allocationPct, beforeValueByStrategyId.get(strategyId) ?? 0)

      return {
        remaining: roundFlowValue(strategy.allocationPct - overlap),
        target: `after:${strategyId}`
      }
    })
    .filter(({ remaining }) => isPositive(remaining))

  return {
    links: [...directLinks, ...allocateRemainingFlows(outgoing, incoming)],
    nodes
  }
}

function buildColorByStrategyId(panels: readonly TReallocationPanel[]): Map<string, string> {
  return panels
    .flatMap((panel) => [panel.beforeState, panel.afterState])
    .flatMap((state) => state.strategies)
    .reduce(
      (state, strategy) => {
        if (strategy.isUnallocated) {
          const nextMap = new Map(state.map)
          nextMap.set(UNALLOCATED_STRATEGY_ID, UNALLOCATED_COLOR)
          return {
            colorIndex: state.colorIndex,
            map: nextMap
          }
        }

        if (state.map.has(strategy.strategyId)) {
          return state
        }

        const nextMap = new Map(state.map)
        nextMap.set(strategy.strategyId, PANEL_PALETTE[state.colorIndex % PANEL_PALETTE.length])
        return {
          colorIndex: state.colorIndex + 1,
          map: nextMap
        }
      },
      {
        colorIndex: 0,
        map: new Map<string, string>()
      }
    ).map
}

function buildRibbonPath(params: {
  sourceBottom: number
  sourceLeft: number
  sourceTop: number
  targetBottom: number
  targetLeft: number
  targetTop: number
}): string {
  const nodeWidth = 16
  const sourceRight = params.sourceLeft + nodeWidth
  const curveDelta = (params.targetLeft - sourceRight) * 0.42
  const sourceControlX = sourceRight + curveDelta
  const targetControlX = params.targetLeft - curveDelta

  return [
    `M ${sourceRight} ${params.sourceTop}`,
    `C ${sourceControlX} ${params.sourceTop}, ${targetControlX} ${params.targetTop}, ${params.targetLeft} ${params.targetTop}`,
    `L ${params.targetLeft} ${params.targetBottom}`,
    `C ${targetControlX} ${params.targetBottom}, ${sourceControlX} ${params.sourceBottom}, ${sourceRight} ${params.sourceBottom}`,
    'Z'
  ].join(' ')
}

function formatPanelTimestamp(timestamp: string | null): string {
  if (!timestamp) {
    return 'Unknown'
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    timeZone: 'UTC'
  })
  return `${formatter.format(new Date(timestamp))} UTC`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function renderStrategyList(strategies: readonly TReallocationStateStrategy[]): string {
  const topStrategies = strategies
    .filter((strategy) => isPositive(strategy.allocationPct))
    .sort((left, right) => right.allocationPct - left.allocationPct)
    .slice(0, 5)

  return topStrategies
    .map((strategy) => {
      const widthPct = Math.max(10, Math.round(strategy.allocationPct))
      return `
        <li class="strategy-row">
          <div class="strategy-copy">
            <span class="strategy-name">${escapeHtml(strategy.name)}</span>
            <span class="strategy-value">${strategy.allocationPct.toFixed(2)}%</span>
          </div>
          <div class="strategy-bar"><span style="width:${widthPct}%"></span></div>
        </li>
      `
    })
    .join('\n')
}

function renderTopChanges(meta: TSankeyMockupPanelMeta): string {
  return meta.topChanges
    .map((change) => {
      const deltaPrefix = change.deltaPct > 0 ? '+' : ''
      return `
        <li>
          <span>${escapeHtml(change.name)}</span>
          <strong>${deltaPrefix}${change.deltaPct.toFixed(2)}%</strong>
        </li>
      `
    })
    .join('\n')
}

function renderPanelSvg(panel: TReallocationPanel, colorByStrategyId: Map<string, string>, panelId: string): string {
  const graph = buildStateTransitionSankeyGraph(panel.beforeState.strategies, panel.afterState.strategies)
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const chartHeight = 250
  const viewBoxWidth = 720
  const viewBoxHeight = 250
  const chartTop = 12
  const chartBottom = 12
  const beforeNodeX = 28
  const afterNodeX = viewBoxWidth - beforeNodeX - 16
  const nodeWidth = 16
  const ribbons = graph.links.reduce(
    (state, link) => {
      const sourceNode = nodeById.get(link.source)
      const targetNode = nodeById.get(link.target)

      if (!sourceNode || !targetNode || sourceNode.value <= 0 || targetNode.value <= 0) {
        return state
      }

      const sourceOffsetRatio = state.sourceOffsets.get(link.source) ?? 0
      const targetOffsetRatio = state.targetOffsets.get(link.target) ?? 0
      const sourceScale = sourceNode.heightRatio / sourceNode.value
      const targetScale = targetNode.heightRatio / targetNode.value
      const sourceHeightRatio = link.value * sourceScale
      const targetHeightRatio = link.value * targetScale
      const nextSourceOffsets = new Map(state.sourceOffsets)
      const nextTargetOffsets = new Map(state.targetOffsets)
      nextSourceOffsets.set(link.source, sourceOffsetRatio + sourceHeightRatio)
      nextTargetOffsets.set(link.target, targetOffsetRatio + targetHeightRatio)
      const sourceId = link.source.replace('before:', '')

      return {
        ribbons: [
          ...state.ribbons,
          {
            color: colorByStrategyId.get(sourceId) ?? UNALLOCATED_COLOR,
            id: `${panelId}:${link.source}->${link.target}`,
            path: buildRibbonPath({
              sourceBottom:
                chartTop +
                (sourceNode.localY + sourceOffsetRatio + sourceHeightRatio) * (chartHeight - chartTop - chartBottom),
              sourceLeft: beforeNodeX,
              sourceTop: chartTop + (sourceNode.localY + sourceOffsetRatio) * (chartHeight - chartTop - chartBottom),
              targetBottom:
                chartTop +
                (targetNode.localY + targetOffsetRatio + targetHeightRatio) * (chartHeight - chartTop - chartBottom),
              targetLeft: afterNodeX,
              targetTop: chartTop + (targetNode.localY + targetOffsetRatio) * (chartHeight - chartTop - chartBottom)
            })
          }
        ],
        sourceOffsets: nextSourceOffsets,
        targetOffsets: nextTargetOffsets
      }
    },
    {
      ribbons: [] as Array<{ color: string; id: string; path: string }>,
      sourceOffsets: new Map<string, number>(),
      targetOffsets: new Map<string, number>()
    }
  ).ribbons

  const nodeRects = graph.nodes
    .map((node) => {
      const strategyId = node.id.replace(/^before:|^after:/, '')
      const x = node.id.startsWith('before:') ? beforeNodeX : afterNodeX
      const y = chartTop + node.localY * (chartHeight - chartTop - chartBottom)
      const height = node.heightRatio * (chartHeight - chartTop - chartBottom)
      const fill = colorByStrategyId.get(strategyId) ?? UNALLOCATED_COLOR

      return `<rect x="${x}" y="${y}" width="${nodeWidth}" height="${height}" rx="4" fill="${fill}" />`
    })
    .join('\n')

  const ribbonPaths = ribbons
    .map((ribbon) => {
      return `<path d="${ribbon.path}" fill="${ribbon.color}" fill-opacity="0.22" stroke="${ribbon.color}" stroke-opacity="0.34" stroke-width="1" />`
    })
    .join('\n')

  return `
    <svg viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}" class="sankey-svg" role="img" aria-label="Allocation transition">
      ${ribbonPaths}
      ${nodeRects}
    </svg>
  `
}

function renderVaultSection(feed: TVaultSankeyMockupFeed): string {
  const colorByStrategyId = buildColorByStrategyId(feed.panels)
  const visiblePanels = feed.panels.slice(-12)
  const automaticCount = Object.values(feed.panelMeta).filter((meta) => meta.changeSource === 'automatic').length
  const selectorCount = Object.values(feed.panelMeta).filter((meta) => meta.changeSource === 'selector').length

  return `
    <section class="vault-section">
      <div class="vault-header">
        <div>
          <h2>${escapeHtml(feed.vaultLabel)}</h2>
          <p>${escapeHtml(feed.vaultAddress)}</p>
        </div>
        <div class="vault-stats">
          <span class="stat-pill stat-pill-automatic">${automaticCount} automatic</span>
          <span class="stat-pill stat-pill-selector">${selectorCount} selector-tagged</span>
          <span class="stat-pill">${feed.panels.length} sankey panels</span>
        </div>
      </div>
      <div class="panel-grid">
        ${visiblePanels
          .map((panel) => {
            const meta = feed.panelMeta[panel.id]
            const badgeClass =
              meta?.annotationTone === 'automatic'
                ? 'annotation-pill annotation-pill-automatic'
                : 'annotation-pill annotation-pill-selector'

            return `
              <article class="panel-card">
                <div class="panel-card-header">
                  <div>
                    <div class="eyebrow">Before</div>
                    <div class="timestamp">${escapeHtml(formatPanelTimestamp(panel.beforeTimestampUtc))}</div>
                  </div>
                  <div class="${badgeClass}">${escapeHtml(panel.annotation ?? 'On-chain')}</div>
                  <div class="align-right">
                    <div class="eyebrow">After</div>
                    <div class="timestamp">${escapeHtml(formatPanelTimestamp(panel.afterTimestampUtc))}</div>
                  </div>
                </div>
                ${renderPanelSvg(panel, colorByStrategyId, panel.id)}
                <div class="panel-columns">
                  <div>
                    <div class="column-heading">Before</div>
                    <ul class="strategy-list">${renderStrategyList(panel.beforeState.strategies)}</ul>
                  </div>
                  <div>
                    <div class="column-heading">After</div>
                    <ul class="strategy-list">${renderStrategyList(panel.afterState.strategies)}</ul>
                  </div>
                </div>
                <div class="panel-footer">
                  <div class="meta-row">
                    <span class="meta-label">Selector</span>
                    <code>${escapeHtml(meta?.inputSelector ?? 'unknown')}</code>
                    <span class="meta-label">From</span>
                    <code>${escapeHtml(meta?.createdBy ?? 'unknown')}</code>
                  </div>
                  <div>
                    <div class="column-heading">Biggest changes</div>
                    <ul class="delta-list">${meta ? renderTopChanges(meta) : ''}</ul>
                  </div>
                </div>
              </article>
            `
          })
          .join('\n')}
      </div>
    </section>
  `
}

function buildMockupHtml(feeds: readonly TVaultSankeyMockupFeed[]): string {
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sankey Allocation Mockup</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f6f8;
        --panel: #ffffff;
        --border: #dbe3ea;
        --text: #0f172a;
        --muted: #5b6677;
        --automatic-bg: #0f3d91;
        --automatic-text: #eff6ff;
        --selector-bg: #ffffff;
        --selector-text: #334155;
        --selector-border: #94a3b8;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: linear-gradient(180deg, #eef3f7 0%, #f8fafc 100%);
        color: var(--text);
      }

      main {
        max-width: 1480px;
        margin: 0 auto;
        padding: 40px 28px 64px;
      }

      h1 {
        margin: 0 0 8px;
        font-size: 34px;
        line-height: 1.1;
      }

      .intro {
        margin: 0 0 28px;
        color: var(--muted);
        max-width: 900px;
        font-size: 15px;
        line-height: 1.5;
      }

      .vault-section + .vault-section {
        margin-top: 42px;
      }

      .vault-header {
        display: flex;
        justify-content: space-between;
        align-items: end;
        gap: 16px;
        margin-bottom: 18px;
      }

      .vault-header h2 {
        margin: 0;
        font-size: 24px;
      }

      .vault-header p {
        margin: 6px 0 0;
        color: var(--muted);
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px;
      }

      .vault-stats {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .stat-pill,
      .annotation-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 32px;
        padding: 6px 12px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: #fff;
        font-size: 12px;
        font-weight: 700;
        line-height: 1;
      }

      .stat-pill-automatic,
      .annotation-pill-automatic {
        background: var(--automatic-bg);
        border-color: var(--automatic-bg);
        color: var(--automatic-text);
      }

      .stat-pill-selector,
      .annotation-pill-selector {
        background: var(--selector-bg);
        border-color: var(--selector-border);
        color: var(--selector-text);
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }

      .panel-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
        gap: 18px;
      }

      .panel-card {
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid var(--border);
        border-radius: 24px;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
        padding: 18px;
      }

      .panel-card-header,
      .panel-columns,
      .panel-footer {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        gap: 14px;
        align-items: start;
      }

      .align-right {
        text-align: right;
      }

      .eyebrow,
      .column-heading,
      .meta-label {
        color: var(--muted);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .timestamp {
        margin-top: 4px;
        font-size: 13px;
        font-weight: 600;
      }

      .sankey-svg {
        display: block;
        width: 100%;
        height: auto;
        margin: 14px 0 10px;
      }

      .panel-columns {
        grid-template-columns: 1fr 1fr;
      }

      .strategy-list,
      .delta-list {
        list-style: none;
        margin: 8px 0 0;
        padding: 0;
      }

      .strategy-row + .strategy-row,
      .delta-list li + li {
        margin-top: 8px;
      }

      .strategy-copy {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 13px;
      }

      .strategy-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .strategy-value {
        color: var(--muted);
        font-variant-numeric: tabular-nums;
      }

      .strategy-bar {
        margin-top: 5px;
        height: 6px;
        border-radius: 999px;
        background: #e2e8f0;
        overflow: hidden;
      }

      .strategy-bar span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #2563eb, #0ea5e9);
      }

      .panel-footer {
        grid-template-columns: 1fr;
        margin-top: 14px;
        padding-top: 14px;
        border-top: 1px solid var(--border);
      }

      .meta-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }

      code {
        background: #edf2f7;
        border-radius: 8px;
        padding: 3px 6px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px;
      }

      .delta-list li {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 13px;
      }

      @media (max-width: 900px) {
        main {
          padding: 28px 18px 40px;
        }

        .panel-grid {
          grid-template-columns: 1fr;
        }

        .vault-header {
          flex-direction: column;
          align-items: start;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Sankey Allocation Mockup</h1>
      <p class="intro">
        This mockup uses on-chain <code>DebtUpdated</code> state transitions and tags each panel by the transaction that
        caused the next allocation state. DOA-triggered panels render as solid badges. Every other panel is labeled by
        the selector that drove the change.
      </p>
      ${feeds.map(renderVaultSection).join('\n')}
    </main>
  </body>
</html>
  `.trim()
}

async function buildVaultFeed(artifact: TArchiveAllocationHistoryArtifact): Promise<TVaultSankeyMockupFeed> {
  const fromBlock = await findFirstBlockAtOrAfterTimestamp(
    artifact.chainId,
    normalizeTimestampUtc(artifact.fromTimestampUtc)
  )
  const logs = await jsonRpcCallWithFallbacks<TJsonRpcLog[]>(artifact.chainId, 'eth_getLogs', [
    {
      address: artifact.vaultAddress,
      fromBlock: toHexQuantity(fromBlock),
      toBlock: 'latest',
      topics: [DEBT_UPDATED_TOPIC]
    }
  ])

  const groupedDebtUpdates = logs.reduce((groups, log) => {
    const txHash = log.transactionHash.toLowerCase() as `0x${string}`
    const existing = groups.get(txHash) ?? {
      blockNumber: BigInt(log.blockNumber),
      maxLogIndex: Number(BigInt(log.logIndex)),
      strategyAddresses: new Set<`0x${string}`>(),
      txHash
    }

    const strategyAddress = getStrategyAddressFromTopic(log.topics[1])
    if (strategyAddress) {
      existing.strategyAddresses.add(strategyAddress)
    }

    existing.maxLogIndex = Math.max(existing.maxLogIndex, Number(BigInt(log.logIndex)))
    groups.set(txHash, existing)
    return groups
  }, new Map<`0x${string}`, TDebtUpdateGroup>())

  const txHashes = [...groupedDebtUpdates.keys()]
  const txByHash = await fetchTransactionsByHash(artifact.chainId, txHashes)
  const groupedRecords = txHashes
    .flatMap((txHash) => {
      const group = groupedDebtUpdates.get(txHash)
      const tx = txByHash.get(txHash.toLowerCase())
      return group
        ? [
            {
              ...group,
              createdBy: tx?.from ?? null,
              inputSelector: tx?.inputSelector ?? '',
              to: tx?.to ?? null
            }
          ]
        : []
    })
    .sort((left, right) => {
      if (left.blockNumber === right.blockNumber) {
        return left.maxLogIndex - right.maxLogIndex
      }

      return left.blockNumber < right.blockNumber ? -1 : 1
    })

  const strategyUniverse = [
    ...new Set(
      [
        ...artifact.strategyAddresses.map((strategyAddress) => strategyAddress.toLowerCase() as `0x${string}`),
        ...artifact.records.flatMap((record) =>
          record.strategies.map((strategy) => strategy.strategyAddress.toLowerCase() as `0x${string}`)
        ),
        ...groupedRecords.flatMap((record) => [...record.strategyAddresses])
      ].filter(Boolean)
    )
  ]
  const strategyNamesByAddress = await fetchStrategyNames(artifact.chainId, strategyUniverse)
  const blockByNumber = await fetchBlocksByNumber(
    artifact.chainId,
    [...new Set(groupedRecords.map((record) => record.blockNumber.toString()))].map((blockNumber) =>
      BigInt(blockNumber)
    )
  )

  const classifiedRecords = await groupedRecords.reduce<Promise<TClassifiedAllocationRecord[]>>(
    async (promise, record) => {
      const records = await promise
      const block = blockByNumber.get(record.blockNumber.toString())
      if (!block) {
        return records
      }

      const stateSnapshot = await fetchVaultOnChainStateAtBlock(
        artifact.chainId,
        artifact.vaultAddress,
        strategyUniverse,
        toHexQuantity(record.blockNumber)
      )
      const timestampUtc = new Date(Number(BigInt(block.timestamp)) * 1000).toISOString()
      const classification = classifyRecord(record.inputSelector, record.createdBy)
      const state = buildAllocationState({
        id: `archive:${record.txHash}`,
        strategyDebts: stateSnapshot.strategyDebts,
        strategyNamesByAddress,
        strategyUniverse,
        timestampUtc,
        totalAssets: stateSnapshot.totalAssets
      })

      return [
        ...records,
        {
          badgeText: classification.badgeText,
          badgeTone: classification.badgeTone,
          blockNumber: Number(record.blockNumber),
          changeSource: classification.changeSource,
          createdBy: record.createdBy,
          inputSelector: record.inputSelector,
          state,
          timestampUtc,
          to: record.to,
          txHash: record.txHash
        }
      ]
    },
    Promise.resolve([])
  )

  const chronologicalStates = classifiedRecords.reduce(
    (state, record) => {
      const alignedState = alignStateStrategyOrder(state.states[state.states.length - 1], record.state)
      const previousState = state.states[state.states.length - 1]
      if (previousState && statesMatch(previousState, alignedState)) {
        return state
      }

      return {
        events: [...state.events, { ...record, state: alignedState }],
        states: [...state.states, alignedState]
      }
    },
    {
      events: [] as TClassifiedAllocationRecord[],
      states: [] as TReallocationState[]
    }
  )

  const panels = chronologicalStates.events.slice(1).map((event, index) => {
    const beforeState = chronologicalStates.states[index]
    const afterState = chronologicalStates.states[index + 1]
    return {
      afterState,
      afterTimestampUtc: afterState.timestampUtc,
      annotation: event.badgeText,
      annotationTone: event.badgeTone,
      beforeState,
      beforeTimestampUtc: beforeState.timestampUtc,
      createdBy: event.createdBy,
      id: `historical:${beforeState.id}->${afterState.id}`,
      inputSelector: event.inputSelector,
      kind: 'historical',
      reallocationType: event.changeSource === 'automatic' ? 'automatic' : 'manual',
      to: event.to,
      txHash: event.txHash
    } satisfies TReallocationPanel
  })

  const panelMeta = Object.fromEntries(
    chronologicalStates.events.slice(1).map((event, index) => {
      const panel = panels[index]
      return [
        panel.id,
        {
          annotationTone: event.badgeTone,
          changeSource: event.changeSource,
          createdBy: event.createdBy,
          inputSelector: event.inputSelector,
          to: event.to,
          topChanges: buildTopChanges(panel.beforeState, panel.afterState),
          txHash: event.txHash
        } satisfies TSankeyMockupPanelMeta
      ] as const
    })
  )

  return {
    generatedAt: new Date().toISOString(),
    panelMeta,
    panels,
    vaultAddress: artifact.vaultAddress,
    vaultLabel: buildVaultLabel(artifact.vaultAddress)
  }
}

async function main(): Promise<void> {
  const parsedArgs = parseCliArgs(process.argv.slice(2))
  const requestedVaults = (parsedArgs.flags.vaults ?? '')
    .split(',')
    .map((vaultAddress) => vaultAddress.trim().toLowerCase())
    .filter(Boolean)

  const artifacts = (
    await Promise.all(
      SUPPORTED_ARCHIVE_ALLOCATION_HISTORY_TARGETS.filter((target) =>
        requestedVaults.length === 0 ? true : requestedVaults.includes(target.vaultAddress.toLowerCase())
      ).map(async (target) => {
        const artifact = await readLocalArchiveAllocationHistoryArtifact({
          chainId: target.chainId,
          vaultAddress: target.vaultAddress
        })

        return artifact ? { artifact, label: buildVaultLabel(target.vaultAddress) } : null
      })
    )
  )
    .filter(Boolean)
    .sort((left, right) => left!.label.localeCompare(right!.label)) as Array<{
    artifact: TArchiveAllocationHistoryArtifact
    label: string
  }>

  if (artifacts.length === 0) {
    throw new Error('No local archive allocation history artifacts found. Run bun run archive-history:save first.')
  }

  const feeds = await Promise.all(artifacts.map(({ artifact }) => buildVaultFeed(artifact)))
  const combinedJsonPath = join(OUTPUT_DIR, 'combined-feed.json')
  const mockupHtmlPath = join(OUTPUT_DIR, 'mockup.html')

  await mkdir(dirname(combinedJsonPath), { recursive: true })
  await Promise.all(
    feeds.flatMap((feed) => {
      const filePath = join(OUTPUT_DIR, `${feed.vaultLabel}.json`)
      return [writeFile(filePath, `${JSON.stringify(feed, null, 2)}\n`, 'utf8')]
    })
  )
  await writeFile(combinedJsonPath, `${JSON.stringify(feeds, null, 2)}\n`, 'utf8')
  await writeFile(mockupHtmlPath, `${buildMockupHtml(feeds)}\n`, 'utf8')

  console.log(
    JSON.stringify(
      {
        combinedJsonPath,
        feeds: feeds.map((feed) => ({
          panelCount: feed.panels.length,
          vaultAddress: feed.vaultAddress,
          vaultLabel: feed.vaultLabel
        })),
        mockupHtmlPath
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
