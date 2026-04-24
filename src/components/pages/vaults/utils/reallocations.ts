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
const DEFAULT_PRIMARY_HUE = 220
const DEFAULT_PRIMARY_SATURATION = 95
const DEFAULT_PRIMARY_LIGHTNESS = 50

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

export type TCurrentAllocationStrategyInput = {
  strategyAddress: `0x${string}`
  name: string
  allocationPct: number
}

export type TCurrentAllocationInput = {
  timestampUtc: string
  strategies: readonly TCurrentAllocationStrategyInput[]
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
  kind: 'historical' | 'proposal' | 'current'
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalizeStrategyName(value: string): string {
  return value.trim().toLowerCase()
}

function parseHslColor(value: string): { hue: number; saturation: number; lightness: number } | null {
  const match = value
    .trim()
    .match(/^hsl\(\s*([-\d.]+)(?:deg)?(?:\s+|,\s*)([-\d.]+)%(?:\s+|,\s*)([-\d.]+)%(?:\s*\/\s*[-\d.]+%?)?\s*\)$/i)
  if (!match) {
    return null
  }

  const hue = Number.parseFloat(match[1])
  const saturation = Number.parseFloat(match[2])
  const lightness = Number.parseFloat(match[3])

  if (!Number.isFinite(hue) || !Number.isFinite(saturation) || !Number.isFinite(lightness)) {
    return null
  }

  return { hue, saturation, lightness }
}

function getPrimaryColorChannels(): { hue: number; saturation: number; lightness: number } {
  if (typeof window === 'undefined') {
    return {
      hue: DEFAULT_PRIMARY_HUE,
      saturation: DEFAULT_PRIMARY_SATURATION,
      lightness: DEFAULT_PRIMARY_LIGHTNESS
    }
  }

  const primaryValue = window.getComputedStyle(document.documentElement).getPropertyValue('--color-primary')
  return (
    parseHslColor(primaryValue) ?? {
      hue: DEFAULT_PRIMARY_HUE,
      saturation: DEFAULT_PRIMARY_SATURATION,
      lightness: DEFAULT_PRIMARY_LIGHTNESS
    }
  )
}

function buildPanelPalette(isDark: boolean): string[] {
  const { hue, saturation, lightness } = getPrimaryColorChannels()
  const paletteSteps = isDark
    ? [
        { saturationOffset: 0, lightnessOffset: 0 },
        { saturationOffset: -8, lightnessOffset: 8 },
        { saturationOffset: 4, lightnessOffset: -8 },
        { saturationOffset: -10, lightnessOffset: 16 },
        { saturationOffset: 6, lightnessOffset: -14 },
        { saturationOffset: -12, lightnessOffset: 24 },
        { saturationOffset: 8, lightnessOffset: -18 },
        { saturationOffset: -14, lightnessOffset: 30 }
      ]
    : [
        { saturationOffset: 0, lightnessOffset: 0 },
        { saturationOffset: -8, lightnessOffset: 8 },
        { saturationOffset: 4, lightnessOffset: -8 },
        { saturationOffset: -10, lightnessOffset: 16 },
        { saturationOffset: 6, lightnessOffset: -14 },
        { saturationOffset: -12, lightnessOffset: 22 },
        { saturationOffset: 8, lightnessOffset: -18 },
        { saturationOffset: -14, lightnessOffset: 28 }
      ]

  return paletteSteps.map(({ saturationOffset, lightnessOffset }) => {
    return `hsl(${hue} ${clamp(saturation + saturationOffset, 56, 100)}% ${clamp(lightness + lightnessOffset, 24, 86)}%)`
  })
}

function getPanelPalette(isDark: boolean): string[] {
  return buildPanelPalette(isDark)
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

function buildCurrentAllocationState(
  currentAllocation: TCurrentAllocationInput,
  referenceState?: TReallocationState
): TReallocationState {
  const referenceStrategies = referenceState?.strategies ?? []
  const referenceByAddress = new Map(
    referenceStrategies.flatMap((strategy) => {
      if (!strategy.strategyAddress) {
        return []
      }

      return [[strategy.strategyAddress.toLowerCase(), strategy] as const]
    })
  )
  const referenceByName = referenceStrategies.reduce((state, strategy) => {
    const normalizedName = normalizeStrategyName(strategy.name)
    if (!normalizedName) {
      return state
    }

    const nextMatches = [...(state.get(normalizedName) ?? []), strategy]
    const nextState = new Map(state)
    nextState.set(normalizedName, nextMatches)
    return nextState
  }, new Map<string, TReallocationStateStrategy[]>())

  const resolvedStrategies = currentAllocation.strategies.reduce(
    (state, strategy, index) => {
      const normalizedAddress = strategy.strategyAddress.toLowerCase()
      if (state.seenAddresses.has(normalizedAddress)) {
        return state
      }

      const referenceMatchByAddress = referenceByAddress.get(normalizedAddress)
      const normalizedName = normalizeStrategyName(strategy.name)
      const referenceMatchByName =
        normalizedName && !referenceMatchByAddress
          ? (referenceByName.get(normalizedName) ?? []).find(
              (candidate) => !state.usedReferenceIds.has(candidate.strategyId)
            )
          : undefined
      const referenceMatch = referenceMatchByAddress ?? referenceMatchByName
      const resolvedStrategyId = referenceMatch?.strategyId ?? normalizedAddress
      const fallbackName = strategy.name.trim() || `Strategy ${index + 1}`
      const resolvedName = referenceMatch?.name ?? fallbackName
      const nextSeenAddresses = new Set(state.seenAddresses)
      nextSeenAddresses.add(normalizedAddress)
      const nextUsedReferenceIds = referenceMatch
        ? new Set([...state.usedReferenceIds, referenceMatch.strategyId])
        : state.usedReferenceIds

      return {
        seenAddresses: nextSeenAddresses,
        usedReferenceIds: nextUsedReferenceIds,
        strategies: [
          ...state.strategies,
          {
            strategyId: resolvedStrategyId,
            strategyAddress: strategy.strategyAddress,
            name: resolvedName,
            isUnallocated: false,
            allocationPct: strategy.allocationPct
          }
        ]
      }
    },
    {
      seenAddresses: new Set<string>(),
      usedReferenceIds: new Set<string>(),
      strategies: [] as TReallocationStateStrategy[]
    }
  ).strategies

  const totalAllocationBps = resolvedStrategies.reduce((sum, strategy) => sum + percentToBps(strategy.allocationPct), 0)
  const unallocatedBps = Math.max(0, TOTAL_BPS - totalAllocationBps)
  const strategiesWithUnallocated =
    unallocatedBps > NORMALIZATION_TOLERANCE_BPS
      ? [
          ...resolvedStrategies,
          {
            strategyId: UNALLOCATED_STRATEGY_ID,
            strategyAddress: null,
            name: 'Unallocated',
            isUnallocated: true,
            allocationPct: unallocatedBps / 100
          }
        ]
      : resolvedStrategies

  return {
    id: `current:${currentAllocation.timestampUtc}`,
    timestampUtc: currentAllocation.timestampUtc,
    strategies: strategiesWithUnallocated
  }
}

function getStateStrategyIdentity(strategy: TReallocationStateStrategy): string {
  return strategy.isUnallocated ? UNALLOCATED_STRATEGY_ID : strategy.strategyId
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

  const remainingStrategies = nextState.strategies.filter(
    (strategy) => !carriedStrategyIds.has(getStateStrategyIdentity(strategy))
  )

  return {
    ...nextState,
    strategies: [...carriedStrategies, ...remainingStrategies]
  }
}

function alignChronologicalStateStrategies(states: readonly TReallocationState[]): TReallocationState[] {
  return states.reduce((orderedStates, state) => {
    orderedStates.push(alignStateStrategyOrder(orderedStates[orderedStates.length - 1], state))
    return orderedStates
  }, [] as TReallocationState[])
}

function buildStateAllocationMap(state: TReallocationState): Map<string, number> {
  return state.strategies.reduce((allocationByStrategyId, strategy) => {
    const nextAllocationByStrategyId = new Map(allocationByStrategyId)
    nextAllocationByStrategyId.set(getStateStrategyIdentity(strategy), percentToBps(strategy.allocationPct))
    return nextAllocationByStrategyId
  }, new Map<string, number>())
}

function statesMatch(leftState: TReallocationState, rightState: TReallocationState): boolean {
  const leftAllocationByStrategyId = buildStateAllocationMap(leftState)
  const rightAllocationByStrategyId = buildStateAllocationMap(rightState)
  const allStrategyIds = new Set([...leftAllocationByStrategyId.keys(), ...rightAllocationByStrategyId.keys()])

  return [...allStrategyIds].every((strategyId) => {
    const leftAllocation = leftAllocationByStrategyId.get(strategyId) ?? 0
    const rightAllocation = rightAllocationByStrategyId.get(strategyId) ?? 0
    return Math.abs(leftAllocation - rightAllocation) <= NORMALIZATION_TOLERANCE_BPS
  })
}

function panelHasAllocations(panel: TReallocationPanel): boolean {
  return [...panel.beforeState.strategies, ...panel.afterState.strategies].some((strategy) =>
    isPositive(strategy.allocationPct)
  )
}

export function buildReallocationPanels(
  optimizations: readonly TDoaOptimizationRecord[],
  strategyNamesByAddress: TStrategyNameMap = {},
  currentAllocation?: TCurrentAllocationInput
): TReallocationPanel[] {
  const dedupedHistory = dedupeVaultHistory(optimizations)
  const normalizedHistory = dedupedHistory.map((optimization) => normalizeChange(optimization, strategyNamesByAddress))
  const chronologicalHistory = normalizedHistory.slice().reverse()
  const chronologicalSnapshotStates = alignChronologicalStateStrategies(chronologicalHistory.map(buildSnapshotState))

  const historicalPanels = chronologicalSnapshotStates.slice(1).map((afterState, index) => {
    const beforeState = chronologicalSnapshotStates[index]

    return {
      id: `historical:${beforeState.id}->${afterState.id}`,
      beforeState,
      afterState,
      beforeTimestampUtc: beforeState.timestampUtc,
      afterTimestampUtc: afterState.timestampUtc,
      kind: 'historical' as const
    }
  })

  const latestChange = normalizedHistory[0]
  const latestSnapshotState = chronologicalSnapshotStates[chronologicalSnapshotStates.length - 1]
  const currentPanel =
    latestSnapshotState && currentAllocation
      ? (() => {
          const alignedCurrentState = alignStateStrategyOrder(
            latestSnapshotState,
            buildCurrentAllocationState(currentAllocation, latestSnapshotState)
          )

          return {
            id: `current:${latestSnapshotState.id}->${alignedCurrentState.id}`,
            beforeState: latestSnapshotState,
            afterState: alignedCurrentState,
            beforeTimestampUtc: latestSnapshotState.timestampUtc,
            afterTimestampUtc: currentAllocation.timestampUtc,
            kind: 'current' as const
          }
        })()
      : null
  const proposalPanel = latestChange
    ? latestSnapshotState
      ? [
          {
            id: `proposal:${latestChange.sourceKey}`,
            beforeState: latestSnapshotState,
            afterState: alignStateStrategyOrder(latestSnapshotState, buildProposalState(latestChange)),
            beforeTimestampUtc: latestSnapshotState.timestampUtc,
            afterTimestampUtc: latestChange.timestampUtc,
            kind: 'proposal' as const
          }
        ]
      : []
    : []

  const currentMatchesLatestSnapshot = currentPanel
    ? statesMatch(currentPanel.beforeState, currentPanel.afterState)
    : false
  const adjustedHistoricalPanels =
    currentMatchesLatestSnapshot && historicalPanels.length > 0 && currentAllocation
      ? historicalPanels.map((panel, index) => {
          if (index !== historicalPanels.length - 1) {
            return panel
          }

          return {
            ...panel,
            afterState: {
              ...panel.afterState,
              timestampUtc: currentAllocation.timestampUtc
            },
            afterTimestampUtc: currentAllocation.timestampUtc
          }
        })
      : historicalPanels
  const terminalPanels = currentPanel
    ? currentMatchesLatestSnapshot
      ? historicalPanels.length > 0
        ? []
        : [currentPanel]
      : [currentPanel]
    : proposalPanel

  return [...adjustedHistoricalPanels, ...terminalPanels].filter(panelHasAllocations)
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

  const nodes = [
    ...buildOrderedNodes(
      indexedBeforeStrategies.map((strategy) => ({
        strategyId: strategy.strategyId,
        name: strategy.name,
        allocationPct: strategy.allocationPct
      })),
      'before'
    ),
    ...buildOrderedNodes(
      indexedAfterStrategies.map((strategy) => ({
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
