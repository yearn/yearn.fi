import type {
  TDoaOptimizationRecord,
  TDoaOptimizationStrategyDebtRatio
} from '@shared/utils/schemas/doaOptimizationSchema'

const TOTAL_BPS = 10000
const NORMALIZATION_TOLERANCE_BPS = 5
const FLOW_EPSILON = 1e-9
const DEFAULT_NODE_GAP_RATIO = 12 / 390
const UNALLOCATED_STRATEGY_ID = 'unallocated'
const UNALLOCATED_COLOR = '#9ca3af'

const LIGHT_PANEL_COLORS = ['#0f4ccf', '#1d63e0', '#3479ee', '#4b8ff6', '#63a5ff', '#7abaff', '#90cffd', '#3f5fb3']
const DARK_PANEL_COLORS = ['#8fb7ff', '#70a3ff', '#4f8dff', '#3178ff', '#6fa7ff', '#a3c6ff', '#c8dcff', '#5876c7']

const FILTERED_NO_CHANGE_LINE_PATTERN = /^\s{2}(.+?):\s*(-?\d+(?:\.\d+)?)%\s*=>\s*no change \(filtered\)\s*$/i
const STRATEGY_APR_LINE_PATTERN = /^\s*\((-?\d+(?:\.\d+)?)%\)\s*\((-?\d+(?:\.\d+)?)%\s*=>\s*(-?\d+(?:\.\d+)?)%\)\s*$/

type TStrategyNameMap = Record<string, string>

type TExplainNoChangeStrategy = {
  name: string
  currentRatio: number
  targetRatio: number
  currentApr: number | null
  targetApr: number | null
}

type TNormalizedReallocationStrategy = {
  strategyId: string
  strategyAddress: string | null
  name: string
  isUnallocated: boolean
  currentRatio: number
  targetRatio: number
  currentRatioPct: number
  targetRatioPct: number
}

type TNormalizedReallocationChange = {
  sourceKey: string
  timestampUtc: string | null
  strategies: TNormalizedReallocationStrategy[]
}

export type TReallocationStateStrategy = {
  strategyId: string
  strategyAddress: string | null
  name: string
  isUnallocated: boolean
  allocationPct: number
}

export type TReallocationState = {
  id: string
  timestampUtc: string | null
  strategies: TReallocationStateStrategy[]
}

export type TReallocationPanel = {
  id: string
  beforeState: TReallocationState
  afterState: TReallocationState
  beforeTimestampUtc: string | null
  afterTimestampUtc: string | null
  kind: 'historical' | 'proposal'
}

export interface TSankeyNodeLabel {
  position: 'left' | 'right'
  align: 'left' | 'right'
}

export interface TSankeyNode {
  id: string
  displayName: string
  labelText: string
  value: number
  localY: number
  heightRatio: number
  side: 'before' | 'after'
  label: TSankeyNodeLabel
}

export interface TSankeyLink {
  source: string
  target: string
  value: number
}

export interface TSankeyGraph {
  nodes: TSankeyNode[]
  links: TSankeyLink[]
}

function isPositive(value: number): boolean {
  return value > FLOW_EPSILON
}

function roundFlowValue(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

function percentToBps(percent: number): number {
  return Math.round(percent * 100)
}

function wrapLabelText(value: string, maxLineLength = 18): string {
  const words = value.trim().split(/\s+/).filter(Boolean)
  const state = words.reduce(
    (acc, word) => {
      if (word.length > maxLineLength) {
        return {
          lines: [
            ...acc.lines,
            ...(acc.currentLine ? [acc.currentLine] : []),
            ...word.match(new RegExp(`.{1,${maxLineLength}}`, 'g'))!
          ],
          currentLine: ''
        }
      }

      const nextLine = acc.currentLine ? `${acc.currentLine} ${word}` : word
      if (nextLine.length <= maxLineLength) {
        return {
          lines: acc.lines,
          currentLine: nextLine
        }
      }

      return {
        lines: [...acc.lines, ...(acc.currentLine ? [acc.currentLine] : [])],
        currentLine: word
      }
    },
    {
      lines: [] as string[],
      currentLine: ''
    }
  )

  return [...state.lines, ...(state.currentLine ? [state.currentLine] : [])].join('\n') || value
}

function getPanelPalette(isDark: boolean): string[] {
  return isDark ? DARK_PANEL_COLORS : LIGHT_PANEL_COLORS
}

function getTimestampKey(optimization: TDoaOptimizationRecord): string {
  return optimization.source.latestMatchedTimestampUtc ?? optimization.source.timestampUtc ?? optimization.source.key
}

function getTimestampMs(optimization: TDoaOptimizationRecord): number {
  const timestamp = optimization.source.latestMatchedTimestampUtc ?? optimization.source.timestampUtc
  if (!timestamp) {
    return 0
  }

  return new Date(timestamp.replace(' UTC', 'Z').replace(' ', 'T')).getTime()
}

function buildSyntheticStrategyAddress(
  vaultAddress: string,
  strategyName: string,
  index: number,
  salt = 0
): `0x${string}` {
  const seed = `${vaultAddress.toLowerCase()}|${strategyName.toLowerCase()}|${index}|${salt}`
  const initialBytes = Array.from({ length: 20 }, (_, byteIndex) => (byteIndex * 29 + 17) & 0xff)
  const mixedBytes = Array.from(seed).reduce((bytes, character, charIndex) => {
    const code = character.charCodeAt(0)
    const slot = charIndex % bytes.length
    return bytes.map((value, byteIndex) => {
      if (byteIndex !== slot) {
        return value
      }

      return (value * 33 + code + ((charIndex * 13) & 0xff)) & 0xff
    })
  }, initialBytes)

  return `0x${mixedBytes.map((value) => value.toString(16).padStart(2, '0')).join('')}` as `0x${string}`
}

function resolveSyntheticStrategyAddress(
  vaultAddress: string,
  strategyName: string,
  index: number,
  usedAddresses: Set<string>,
  salt = 0
): `0x${string}` {
  const candidate = buildSyntheticStrategyAddress(vaultAddress, strategyName, index, salt)
  return usedAddresses.has(candidate.toLowerCase())
    ? resolveSyntheticStrategyAddress(vaultAddress, strategyName, index, usedAddresses, salt + 1)
    : candidate
}

function parseFilteredNoChangeStrategies(explain: string): TExplainNoChangeStrategy[] {
  const lines = explain.split('\n')

  return lines.reduce((acc, line, index) => {
    const match = line.match(FILTERED_NO_CHANGE_LINE_PATTERN)
    if (!match) {
      return acc
    }

    const name = match[1]?.trim()
    const currentRatioPct = Number.parseFloat(match[2] ?? '')
    if (!name || !Number.isFinite(currentRatioPct) || currentRatioPct <= 0) {
      return acc
    }

    const aprMatch = lines[index + 1]?.match(STRATEGY_APR_LINE_PATTERN)
    const currentAprPct = aprMatch?.[2] ? Number.parseFloat(aprMatch[2]) : null
    const targetAprPct = aprMatch?.[3] ? Number.parseFloat(aprMatch[3]) : null

    return acc.concat({
      name,
      currentRatio: percentToBps(currentRatioPct),
      targetRatio: percentToBps(currentRatioPct),
      currentApr: currentAprPct !== null && Number.isFinite(currentAprPct) ? percentToBps(currentAprPct) : null,
      targetApr: targetAprPct !== null && Number.isFinite(targetAprPct) ? percentToBps(targetAprPct) : null
    })
  }, [] as TExplainNoChangeStrategy[])
}

function dedupeInputStrategies(
  strategies: readonly TDoaOptimizationStrategyDebtRatio[]
): TDoaOptimizationStrategyDebtRatio[] {
  return strategies.reduce(
    (state, strategy) => {
      const normalizedAddress = strategy.strategy.toLowerCase()
      if (state.seen.has(normalizedAddress)) {
        return state
      }

      const nextSeen = new Set(state.seen)
      nextSeen.add(normalizedAddress)

      return {
        seen: nextSeen,
        strategies: [...state.strategies, strategy]
      }
    },
    {
      seen: new Set<string>(),
      strategies: [] as TDoaOptimizationStrategyDebtRatio[]
    }
  ).strategies
}

function augmentStrategiesFromExplain(raw: TDoaOptimizationRecord): {
  strategies: TDoaOptimizationStrategyDebtRatio[]
  syntheticStrategyIds: Map<string, string>
} {
  const dedupedInputStrategies = dedupeInputStrategies(raw.strategyDebtRatios)
  const currentSum = dedupedInputStrategies.reduce((sum, strategy) => sum + strategy.currentRatio, 0)
  const targetSum = dedupedInputStrategies.reduce((sum, strategy) => sum + strategy.targetRatio, 0)
  const hasAllocationGap =
    currentSum < TOTAL_BPS - NORMALIZATION_TOLERANCE_BPS || targetSum < TOTAL_BPS - NORMALIZATION_TOLERANCE_BPS

  if (!hasAllocationGap) {
    return {
      strategies: dedupedInputStrategies,
      syntheticStrategyIds: new Map<string, string>()
    }
  }

  const filteredNoChangeStrategies = parseFilteredNoChangeStrategies(raw.explain)
  if (filteredNoChangeStrategies.length === 0) {
    return {
      strategies: dedupedInputStrategies,
      syntheticStrategyIds: new Map<string, string>()
    }
  }

  const initialExistingNames = new Set(
    dedupedInputStrategies
      .map((strategy) => strategy.name?.trim().toLowerCase())
      .filter((name): name is string => Boolean(name))
  )
  const initialUsedAddresses = new Set(dedupedInputStrategies.map((strategy) => strategy.strategy.toLowerCase()))
  type TAugmentedStrategiesState = {
    existingNames: Set<string>
    usedAddresses: Set<string>
    syntheticIndex: number
    syntheticStrategyIds: Map<string, string>
    strategies: TDoaOptimizationStrategyDebtRatio[]
  }

  const augmented = filteredNoChangeStrategies.reduce<TAugmentedStrategiesState>(
    (state, filteredStrategy) => {
      const normalizedName = filteredStrategy.name.trim().toLowerCase()
      if (normalizedName && state.existingNames.has(normalizedName)) {
        return state
      }

      const nextSyntheticIndex = state.syntheticIndex + 1
      const syntheticAddress = resolveSyntheticStrategyAddress(
        raw.vault,
        filteredStrategy.name,
        nextSyntheticIndex,
        state.usedAddresses
      )
      const normalizedSyntheticAddress = syntheticAddress.toLowerCase()

      const nextExistingNames = new Set(state.existingNames)
      if (normalizedName) {
        nextExistingNames.add(normalizedName)
      }

      const nextUsedAddresses = new Set(state.usedAddresses)
      nextUsedAddresses.add(normalizedSyntheticAddress)

      const nextSyntheticStrategyIds = new Map(state.syntheticStrategyIds)
      nextSyntheticStrategyIds.set(
        normalizedSyntheticAddress,
        `synthetic:${raw.vault.toLowerCase()}:${normalizedName}:${nextSyntheticIndex}`
      )

      return {
        existingNames: nextExistingNames,
        usedAddresses: nextUsedAddresses,
        syntheticIndex: nextSyntheticIndex,
        syntheticStrategyIds: nextSyntheticStrategyIds,
        strategies: [
          ...state.strategies,
          {
            strategy: syntheticAddress,
            name: filteredStrategy.name,
            currentRatio: filteredStrategy.currentRatio,
            targetRatio: filteredStrategy.targetRatio,
            currentApr: filteredStrategy.currentApr,
            targetApr: filteredStrategy.targetApr
          }
        ]
      }
    },
    {
      existingNames: initialExistingNames,
      usedAddresses: initialUsedAddresses,
      syntheticIndex: 0,
      syntheticStrategyIds: new Map<string, string>(),
      strategies: dedupedInputStrategies
    }
  )

  return {
    strategies: augmented.strategies,
    syntheticStrategyIds: augmented.syntheticStrategyIds
  }
}

function dedupeVaultHistory(optimizations: readonly TDoaOptimizationRecord[]): TDoaOptimizationRecord[] {
  const sortedOptimizations = [...optimizations].sort((left, right) => getTimestampMs(right) - getTimestampMs(left))

  return sortedOptimizations.reduce(
    (state, optimization) => {
      const dedupeKey = [
        optimization.vault.toLowerCase(),
        optimization.source.chainId ?? 'unknown',
        getTimestampKey(optimization),
        optimization.currentApr,
        optimization.proposedApr
      ].join('|')

      if (state.seen.has(dedupeKey)) {
        return state
      }

      const nextSeen = new Set(state.seen)
      nextSeen.add(dedupeKey)
      return {
        seen: nextSeen,
        records: [...state.records, optimization]
      }
    },
    {
      seen: new Set<string>(),
      records: [] as TDoaOptimizationRecord[]
    }
  ).records
}

function normalizeChange(
  optimization: TDoaOptimizationRecord,
  strategyNamesByAddress: TStrategyNameMap
): TNormalizedReallocationChange {
  const { strategies: augmentedStrategies, syntheticStrategyIds } = augmentStrategiesFromExplain(optimization)
  const namedStrategies = augmentedStrategies.map((strategy, index) => ({
    ...strategy,
    name: strategy.name?.trim() || `Strategy ${index + 1}`
  }))

  const totalCurrentBps = namedStrategies.reduce((sum, strategy) => sum + strategy.currentRatio, 0)
  const totalTargetBps = namedStrategies.reduce((sum, strategy) => sum + strategy.targetRatio, 0)
  const unallocatedCurrentBps = Math.max(0, TOTAL_BPS - totalCurrentBps)
  const unallocatedTargetBps = Math.max(0, TOTAL_BPS - totalTargetBps)
  const strategiesWithUnallocated =
    unallocatedCurrentBps > NORMALIZATION_TOLERANCE_BPS || unallocatedTargetBps > NORMALIZATION_TOLERANCE_BPS
      ? [
          ...namedStrategies,
          {
            strategy: UNALLOCATED_STRATEGY_ID,
            name: 'Unallocated',
            currentRatio: unallocatedCurrentBps,
            targetRatio: unallocatedTargetBps,
            currentApr: null,
            targetApr: null
          }
        ]
      : namedStrategies

  const resolvedStrategies = strategiesWithUnallocated.reduce(
    (state, strategy) => {
      const normalizedAddress = strategy.strategy.toLowerCase()
      const baseStrategyId = syntheticStrategyIds.get(normalizedAddress) ?? normalizedAddress
      const resolvedStrategyId = state.usedIds.has(baseStrategyId)
        ? `${baseStrategyId}#${state.duplicateCounts.get(baseStrategyId)! + 1}`
        : baseStrategyId
      const nextDuplicateCounts = new Map(state.duplicateCounts)
      nextDuplicateCounts.set(baseStrategyId, (nextDuplicateCounts.get(baseStrategyId) ?? 0) + 1)

      const nextUsedIds = new Set(state.usedIds)
      nextUsedIds.add(resolvedStrategyId)

      const isUnallocated = strategy.strategy === UNALLOCATED_STRATEGY_ID
      const strategyAddress = syntheticStrategyIds.has(normalizedAddress) || isUnallocated ? null : strategy.strategy
      const overrideName = strategyAddress ? strategyNamesByAddress[strategyAddress.toLowerCase()] : undefined

      return {
        usedIds: nextUsedIds,
        duplicateCounts: nextDuplicateCounts,
        strategies: [
          ...state.strategies,
          {
            strategyId: resolvedStrategyId,
            strategyAddress,
            name: overrideName ?? strategy.name,
            isUnallocated,
            currentRatio: strategy.currentRatio,
            targetRatio: strategy.targetRatio,
            currentRatioPct: strategy.currentRatio / 100,
            targetRatioPct: strategy.targetRatio / 100
          }
        ]
      }
    },
    {
      usedIds: new Set<string>(),
      duplicateCounts: new Map<string, number>(),
      strategies: [] as TNormalizedReallocationStrategy[]
    }
  ).strategies

  return {
    sourceKey: optimization.source.key,
    timestampUtc: optimization.source.isLatestAlias
      ? optimization.source.latestMatchedTimestampUtc
      : (optimization.source.timestampUtc ?? null),
    strategies: resolvedStrategies
  }
}

function buildSnapshotState(change: TNormalizedReallocationChange): TReallocationState {
  return {
    id: `snapshot:${change.sourceKey}`,
    timestampUtc: change.timestampUtc,
    strategies: change.strategies.map((strategy) => ({
      strategyId: strategy.strategyId,
      strategyAddress: strategy.strategyAddress,
      name: strategy.name,
      isUnallocated: strategy.isUnallocated,
      allocationPct: strategy.currentRatioPct
    }))
  }
}

function buildProposalState(change: TNormalizedReallocationChange): TReallocationState {
  return {
    id: `proposal:${change.sourceKey}`,
    timestampUtc: change.timestampUtc,
    strategies: change.strategies.map((strategy) => ({
      strategyId: strategy.strategyId,
      strategyAddress: strategy.strategyAddress,
      name: strategy.name,
      isUnallocated: strategy.isUnallocated,
      allocationPct: strategy.targetRatioPct
    }))
  }
}

function panelHasAllocations(panel: TReallocationPanel): boolean {
  return [...panel.beforeState.strategies, ...panel.afterState.strategies].some((strategy) =>
    isPositive(strategy.allocationPct)
  )
}

export function buildReallocationPanels(
  optimizations: readonly TDoaOptimizationRecord[],
  strategyNamesByAddress: TStrategyNameMap = {}
): TReallocationPanel[] {
  const dedupedHistory = dedupeVaultHistory(optimizations)
  const normalizedHistory = dedupedHistory.map((optimization) => normalizeChange(optimization, strategyNamesByAddress))
  const chronologicalHistory = normalizedHistory.slice().reverse()

  const historicalPanels = chronologicalHistory.slice(1).map((change, index) => {
    const beforeChange = chronologicalHistory[index]

    return {
      id: `historical:${beforeChange.sourceKey}->${change.sourceKey}`,
      beforeState: buildSnapshotState(beforeChange),
      afterState: buildSnapshotState(change),
      beforeTimestampUtc: beforeChange.timestampUtc,
      afterTimestampUtc: change.timestampUtc,
      kind: 'historical' as const
    }
  })

  const latestChange = normalizedHistory[0]
  const proposalPanel = latestChange
    ? [
        {
          id: `proposal:${latestChange.sourceKey}`,
          beforeState: buildSnapshotState(latestChange),
          afterState: buildProposalState(latestChange),
          beforeTimestampUtc: latestChange.timestampUtc,
          afterTimestampUtc: latestChange.timestampUtc,
          kind: 'proposal' as const
        }
      ]
    : []

  return [...historicalPanels, ...proposalPanel].filter(panelHasAllocations)
}

function getNodeLabel(side: 'before' | 'after'): TSankeyNodeLabel {
  return side === 'after' ? { position: 'left', align: 'right' } : { position: 'right', align: 'left' }
}

function buildOrderedNodes(
  strategies: Array<{ strategyId: string; name: string; allocationPct: number }>,
  side: 'before' | 'after',
  gapRatio = DEFAULT_NODE_GAP_RATIO
): TSankeyNode[] {
  const totalValue = strategies.reduce((sum, strategy) => sum + strategy.allocationPct, 0)
  const totalGap = Math.max(0, strategies.length - 1) * gapRatio
  const scale = totalValue > 0 ? Math.max(0, 1 - totalGap) / totalValue : 0

  return strategies.reduce(
    (state, strategy) => {
      const heightRatio = strategy.allocationPct * scale
      const node: TSankeyNode = {
        id: `${side}:${strategy.strategyId}`,
        displayName: strategy.name,
        labelText: wrapLabelText(strategy.name),
        value: strategy.allocationPct,
        localY: state.offset,
        heightRatio,
        side,
        label: getNodeLabel(side)
      }

      return {
        offset: state.offset + heightRatio + gapRatio,
        nodes: [...state.nodes, node]
      }
    },
    {
      offset: 0,
      nodes: [] as TSankeyNode[]
    }
  ).nodes
}

function allocateRemainingFlows(
  outgoing: Array<{ source: string; remaining: number }>,
  incoming: Array<{ target: string; remaining: number }>,
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

export function buildStateTransitionSankeyGraph(
  beforeStrategies: readonly TReallocationStateStrategy[],
  afterStrategies: readonly TReallocationStateStrategy[]
): TSankeyGraph {
  const indexedBeforeStrategies = beforeStrategies
    .filter((strategy) => isPositive(strategy.allocationPct))
    .map((strategy) => ({
      ...strategy,
      strategyId: strategy.isUnallocated ? UNALLOCATED_STRATEGY_ID : strategy.strategyId
    }))
  const indexedAfterStrategies = afterStrategies
    .filter((strategy) => isPositive(strategy.allocationPct))
    .map((strategy) => ({
      ...strategy,
      strategyId: strategy.isUnallocated ? UNALLOCATED_STRATEGY_ID : strategy.strategyId
    }))

  const afterByStrategyId = new Map(indexedAfterStrategies.map((strategy) => [strategy.strategyId, strategy]))
  const matchedBeforeStrategies = indexedBeforeStrategies.filter((strategy) =>
    afterByStrategyId.has(strategy.strategyId)
  )
  const matchedStrategyIds = new Set(matchedBeforeStrategies.map((strategy) => strategy.strategyId))
  const beforeOnlyStrategies = indexedBeforeStrategies.filter(
    (strategy) => !matchedStrategyIds.has(strategy.strategyId)
  )
  const afterOnlyStrategies = indexedAfterStrategies.filter((strategy) => !matchedStrategyIds.has(strategy.strategyId))
  const orderedAfterStrategies = [
    ...matchedBeforeStrategies
      .map((strategy) => afterByStrategyId.get(strategy.strategyId))
      .filter((strategy): strategy is (typeof indexedAfterStrategies)[number] => Boolean(strategy)),
    ...afterOnlyStrategies
  ]

  const nodes = [
    ...buildOrderedNodes(
      [...matchedBeforeStrategies, ...beforeOnlyStrategies].map((strategy) => ({
        strategyId: strategy.strategyId,
        name: strategy.name,
        allocationPct: strategy.allocationPct
      })),
      'before'
    ),
    ...buildOrderedNodes(
      orderedAfterStrategies.map((strategy) => ({
        strategyId: strategy.strategyId,
        name: strategy.name,
        allocationPct: strategy.allocationPct
      })),
      'after'
    )
  ]

  const afterValueByStrategyId = new Map(
    indexedAfterStrategies.map((strategy) => [strategy.strategyId, strategy.allocationPct])
  )
  const beforeValueByStrategyId = new Map(
    indexedBeforeStrategies.map((strategy) => [strategy.strategyId, strategy.allocationPct])
  )

  const directLinks = indexedBeforeStrategies
    .map((strategy) => {
      const overlap = Math.min(strategy.allocationPct, afterValueByStrategyId.get(strategy.strategyId) ?? 0)
      return isPositive(overlap)
        ? {
            source: `before:${strategy.strategyId}`,
            target: `after:${strategy.strategyId}`,
            value: roundFlowValue(overlap)
          }
        : null
    })
    .filter(Boolean) as TSankeyLink[]

  const outgoing = indexedBeforeStrategies
    .map((strategy) => {
      const overlap = Math.min(strategy.allocationPct, afterValueByStrategyId.get(strategy.strategyId) ?? 0)
      return {
        source: `before:${strategy.strategyId}`,
        remaining: roundFlowValue(strategy.allocationPct - overlap)
      }
    })
    .filter(({ remaining }) => isPositive(remaining))

  const incoming = indexedAfterStrategies
    .map((strategy) => {
      const overlap = Math.min(strategy.allocationPct, beforeValueByStrategyId.get(strategy.strategyId) ?? 0)
      return {
        target: `after:${strategy.strategyId}`,
        remaining: roundFlowValue(strategy.allocationPct - overlap)
      }
    })
    .filter(({ remaining }) => isPositive(remaining))

  return {
    nodes,
    links: [...directLinks, ...allocateRemainingFlows(outgoing, incoming)]
  }
}

export function buildColorByStrategyId(panels: readonly TReallocationPanel[], isDark: boolean): Map<string, string> {
  const palette = getPanelPalette(isDark)

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
        nextMap.set(strategy.strategyId, palette[state.colorIndex % palette.length])

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
