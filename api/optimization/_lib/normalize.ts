import { getChainLogoUrl, getTokenAddressForSymbol, getTokenLogoUrl, getVaultAssetToken } from './assetLogos'
import { assignStrategyColors } from './colors'
import { parseExplainMetadata, parseFilteredNoChangeStrategies } from './explain-parse'
import { formatAddress } from './formatters'
import type { OptimizationSourceMeta } from './redis'
import type { StrategyDebtRatio, VaultOptimization } from './schema'

const TOTAL_BPS = 10000
export const NORMALIZATION_TOLERANCE_BPS = 5

function buildSyntheticStrategyAddress(vaultAddress: string, strategyName: string, index: number, salt = 0): string {
  const seed = `${vaultAddress.toLowerCase()}|${strategyName.toLowerCase()}|${index}|${salt}`
  const bytes = new Uint8Array(20)

  for (let byteIndex = 0; byteIndex < bytes.length; byteIndex += 1) {
    bytes[byteIndex] = (byteIndex * 29 + 17) & 0xff
  }

  for (let charIndex = 0; charIndex < seed.length; charIndex += 1) {
    const code = seed.charCodeAt(charIndex)
    const slot = charIndex % bytes.length
    const mixed = (bytes[slot] * 33 + code + ((charIndex * 13) & 0xff)) & 0xff
    bytes[slot] = mixed
  }

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `0x${hex}`
}

export interface NormalizedStrategy {
  strategy: string
  strategyAddress: string | null
  name: string
  isVaultName: boolean
  isUnallocated: boolean
  currentRatio: number
  targetRatio: number
  allocationDeltaBps: number
  currentRatioPct: number
  targetRatioPct: number
  allocationDeltaPct: number
  currentApr: number | null
  targetApr: number | null
  aprDeltaBps: number | null
  currentAprPct: number | null
  targetAprPct: number | null
  aprDeltaPct: number | null
  color: string
}

export interface NormalizedChange {
  vault: string
  vaultLabel: string
  chainId: number | null
  chainName: string | null
  tvl: number | null
  tvlUnit: string | null
  explain: string
  optimizationMethod: string | null
  changesFiltered: number | null
  strategies: NormalizedStrategy[]
  vaultAprCurrentPct: number
  vaultAprProposedPct: number
  vaultAprDeltaPct: number
  vaultAprDeltaRelativePct: number | null
  hasUnallocated: boolean
  unallocatedBps: number
  tokenLogoUrl: string | null
  chainLogoUrl: string | null
  timestampUtc: string | null
  isLatestAlias: boolean
  sourceKey: string
}

function augmentStrategiesFromExplain(
  raw: VaultOptimization,
  strategies: StrategyDebtRatio[]
): { strategies: StrategyDebtRatio[]; syntheticStrategyKeysByAddress: Map<string, string> } {
  const dedupedInputStrategies: StrategyDebtRatio[] = []
  const seenInputAddresses = new Set<string>()
  for (const strategy of strategies) {
    const normalizedAddress = strategy.strategy.toLowerCase()
    if (seenInputAddresses.has(normalizedAddress)) {
      continue
    }
    seenInputAddresses.add(normalizedAddress)
    dedupedInputStrategies.push(strategy)
  }

  const currentSum = dedupedInputStrategies.reduce((sum, strategy) => sum + strategy.currentRatio, 0)
  const targetSum = dedupedInputStrategies.reduce((sum, strategy) => sum + strategy.targetRatio, 0)
  const hasAllocationGap =
    currentSum < TOTAL_BPS - NORMALIZATION_TOLERANCE_BPS || targetSum < TOTAL_BPS - NORMALIZATION_TOLERANCE_BPS

  if (!hasAllocationGap) {
    return { strategies: dedupedInputStrategies, syntheticStrategyKeysByAddress: new Map<string, string>() }
  }

  const filteredNoChangeStrategies = parseFilteredNoChangeStrategies(raw.explain)
  if (filteredNoChangeStrategies.length === 0) {
    return { strategies: dedupedInputStrategies, syntheticStrategyKeysByAddress: new Map<string, string>() }
  }

  const existingNames = new Set(
    dedupedInputStrategies
      .map((strategy) => strategy.name?.trim().toLowerCase())
      .filter((name): name is string => Boolean(name))
  )

  const augmentedStrategies = [...dedupedInputStrategies]
  const syntheticStrategyKeysByAddress = new Map<string, string>()
  const usedStrategyAddresses = new Set(dedupedInputStrategies.map((strategy) => strategy.strategy.toLowerCase()))
  let syntheticIndex = 0

  for (const filteredStrategy of filteredNoChangeStrategies) {
    const normalizedName = filteredStrategy.name.trim().toLowerCase()
    if (normalizedName && existingNames.has(normalizedName)) {
      continue
    }

    if (normalizedName) {
      existingNames.add(normalizedName)
    }

    syntheticIndex += 1
    let salt = 0
    let syntheticAddress = buildSyntheticStrategyAddress(raw.vault, filteredStrategy.name, syntheticIndex, salt)
    while (usedStrategyAddresses.has(syntheticAddress.toLowerCase())) {
      salt += 1
      syntheticAddress = buildSyntheticStrategyAddress(raw.vault, filteredStrategy.name, syntheticIndex, salt)
    }

    const normalizedSyntheticAddress = syntheticAddress.toLowerCase()
    usedStrategyAddresses.add(normalizedSyntheticAddress)
    syntheticStrategyKeysByAddress.set(
      normalizedSyntheticAddress,
      `synthetic:${raw.vault.toLowerCase()}:${normalizedName}:${syntheticIndex}`
    )
    augmentedStrategies.push({
      strategy: syntheticAddress,
      name: filteredStrategy.name,
      currentRatio: filteredStrategy.currentRatio,
      targetRatio: filteredStrategy.targetRatio,
      currentApr: filteredStrategy.currentApr ?? undefined,
      targetApr: filteredStrategy.targetApr ?? filteredStrategy.currentApr ?? undefined
    })
  }

  return { strategies: augmentedStrategies, syntheticStrategyKeysByAddress }
}

function normalizeStrategyNames(strategies: StrategyDebtRatio[]): StrategyDebtRatio[] {
  return strategies.map((strategy, index) => ({
    ...strategy,
    name: strategy.name?.trim() || `Strategy ${index + 1}`
  }))
}

export function normalizeChange(data: VaultOptimization, source?: OptimizationSourceMeta): NormalizedChange {
  const metadata = parseExplainMetadata(data.explain)

  const { strategies: augmentedStrategies, syntheticStrategyKeysByAddress } = augmentStrategiesFromExplain(
    data,
    data.strategyDebtRatios
  )
  const inputStrategies = normalizeStrategyNames(augmentedStrategies)

  let strategies = inputStrategies
  let hasUnallocated = false
  let unallocatedBps = 0

  const totalCurrentBps = strategies.reduce((sum, s) => sum + s.currentRatio, 0)
  const totalTargetBps = strategies.reduce((sum, s) => sum + s.targetRatio, 0)

  const unallocatedCurrentBps = Math.max(0, TOTAL_BPS - totalCurrentBps)
  const unallocatedTargetBps = Math.max(0, TOTAL_BPS - totalTargetBps)

  if (unallocatedCurrentBps > NORMALIZATION_TOLERANCE_BPS || unallocatedTargetBps > NORMALIZATION_TOLERANCE_BPS) {
    hasUnallocated = unallocatedCurrentBps > NORMALIZATION_TOLERANCE_BPS
    unallocatedBps = unallocatedCurrentBps

    strategies = [
      ...strategies,
      {
        strategy: 'unallocated',
        name: 'Unallocated',
        currentRatio: unallocatedCurrentBps,
        targetRatio: unallocatedTargetBps,
        currentApr: undefined,
        targetApr: undefined
      } as StrategyDebtRatio
    ]
  }

  const strategyKeys: string[] = []
  const usedKeys = new Set<string>()
  for (const strategy of strategies) {
    const normalizedAddress = strategy.strategy.toLowerCase()
    const baseKey = syntheticStrategyKeysByAddress.get(normalizedAddress) ?? normalizedAddress
    let resolvedKey = baseKey
    let duplicateCounter = 1
    while (usedKeys.has(resolvedKey)) {
      duplicateCounter += 1
      resolvedKey = `${baseKey}#${duplicateCounter}`
    }
    usedKeys.add(resolvedKey)
    strategyKeys.push(resolvedKey)
  }

  const colorMap = assignStrategyColors(strategyKeys)

  const normalizedStrategies: NormalizedStrategy[] = strategies.map((strategy, index) => {
    const currentApr = strategy.currentApr ?? null
    const targetApr = strategy.targetApr ?? null
    const allocationDeltaBps = strategy.targetRatio - strategy.currentRatio
    const aprDeltaBps = currentApr !== null && targetApr !== null ? targetApr - currentApr : null

    const normalizedAddress = strategy.strategy.toLowerCase()
    const baseSyntheticKey = syntheticStrategyKeysByAddress.get(normalizedAddress)
    const strategyKey = strategyKeys[index]

    const isUnallocated = strategy.strategy === 'unallocated'

    return {
      strategy: strategyKey,
      strategyAddress: baseSyntheticKey || isUnallocated ? null : strategy.strategy,
      name: strategy.name!,
      isVaultName: false,
      isUnallocated,
      currentRatio: strategy.currentRatio,
      targetRatio: strategy.targetRatio,
      allocationDeltaBps,
      currentRatioPct: strategy.currentRatio / 100,
      targetRatioPct: strategy.targetRatio / 100,
      allocationDeltaPct: allocationDeltaBps / 100,
      currentApr,
      targetApr,
      aprDeltaBps,
      currentAprPct: currentApr !== null ? currentApr / 100 : null,
      targetAprPct: targetApr !== null ? targetApr / 100 : null,
      aprDeltaPct: aprDeltaBps !== null ? aprDeltaBps / 100 : null,
      color: isUnallocated ? '#9ca3af' : (colorMap.get(strategyKey) ?? '#9ca3af')
    }
  })

  const vaultAprCurrentPct = data.currentApr / 100
  const vaultAprProposedPct = data.proposedApr / 100
  const vaultAprDeltaPct = vaultAprProposedPct - vaultAprCurrentPct
  const vaultAprDeltaRelativePct = vaultAprCurrentPct > 0 ? (vaultAprDeltaPct / vaultAprCurrentPct) * 100 : null

  const chainLogoUrl = metadata.chainId !== null ? getChainLogoUrl(metadata.chainId) : null

  let tokenLogoUrl: string | null = null
  const knownAsset = getVaultAssetToken(data.vault)
  if (knownAsset) {
    tokenLogoUrl = getTokenLogoUrl(knownAsset.chainId, knownAsset.tokenAddress)
  } else if (metadata.chainId !== null) {
    const tokenSymbol = inferVaultTokenSymbol(metadata.vaultLabel)
    if (tokenSymbol) {
      const tokenAddress = getTokenAddressForSymbol(metadata.chainId, tokenSymbol)
      if (tokenAddress) {
        tokenLogoUrl = getTokenLogoUrl(metadata.chainId, tokenAddress)
      }
    }
  }

  const timestampUtc = source?.isLatestAlias ? source.latestMatchedTimestampUtc : (source?.timestampUtc ?? null)

  return {
    vault: data.vault,
    vaultLabel: metadata.vaultLabel ?? formatAddress(data.vault),
    chainId: metadata.chainId,
    chainName: metadata.chainName,
    tvl: metadata.tvl,
    tvlUnit: metadata.tvlUnit,
    explain: data.explain,
    optimizationMethod: metadata.optimizationMethod,
    changesFiltered: metadata.changesFiltered,
    strategies: normalizedStrategies,
    vaultAprCurrentPct,
    vaultAprProposedPct,
    vaultAprDeltaPct,
    vaultAprDeltaRelativePct,
    hasUnallocated,
    unallocatedBps,
    tokenLogoUrl,
    chainLogoUrl,
    timestampUtc,
    isLatestAlias: source?.isLatestAlias ?? false,
    sourceKey: source?.key ?? 'unknown'
  }
}

function inferVaultTokenSymbol(vaultLabel: string | null): string | null {
  if (!vaultLabel) {
    return null
  }

  const firstToken = vaultLabel.trim().split(/\s+/)[0]
  if (!firstToken) {
    return null
  }

  const symbol = firstToken.replace(/-\d+$/, '')
  return symbol || null
}
