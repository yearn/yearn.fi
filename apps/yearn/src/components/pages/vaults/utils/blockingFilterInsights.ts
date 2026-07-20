export function getCommonBlockingKeys<T extends string>(blockingKeysByVault: T[][]): T[] {
  if (blockingKeysByVault.length === 0) {
    return []
  }

  const common = new Set(blockingKeysByVault[0])
  for (const blockingKeys of blockingKeysByVault.slice(1)) {
    const current = new Set(blockingKeys)
    for (const key of Array.from(common)) {
      if (!current.has(key)) {
        common.delete(key)
      }
    }
  }

  return Array.from(common)
}

export function getAdditionalResultsForCombo<T extends string>(blockingKeysByVault: T[][], comboKeys: T[]): number {
  if (blockingKeysByVault.length === 0 || comboKeys.length === 0) {
    return 0
  }

  const comboKeySet = new Set(comboKeys)
  return blockingKeysByVault.reduce((count, blockingKeys) => {
    if (blockingKeys.length === 0) {
      return count
    }
    if (blockingKeys.every((key) => comboKeySet.has(key))) {
      return count + 1
    }
    return count
  }, 0)
}

export function getAdditionalUniqueEntriesCount<T extends string | number>({
  currentVisibleKeys,
  candidateKeys
}: {
  currentVisibleKeys: Set<T>
  candidateKeys: T[]
}): number {
  return Array.from(new Set(candidateKeys)).filter((key) => !currentVisibleKeys.has(key)).length
}

export function getBlockingFilterActionGroups<T extends string>(
  blockingKeysByVault: T[][]
): Array<{ keys: T[]; additionalResults: number }> {
  const groups = new Map<string, { keys: T[]; additionalResults: number }>()

  for (const blockingKeys of blockingKeysByVault) {
    const normalizedKeys = Array.from(new Set(blockingKeys)).sort()
    if (normalizedKeys.length === 0) {
      continue
    }

    const groupKey = normalizedKeys.join('|')
    const existing = groups.get(groupKey)
    if (existing) {
      groups.set(groupKey, {
        ...existing,
        additionalResults: existing.additionalResults + 1
      })
      continue
    }

    groups.set(groupKey, {
      keys: normalizedKeys,
      additionalResults: 1
    })
  }

  return Array.from(groups.values()).sort((left, right) => {
    if (right.additionalResults !== left.additionalResults) {
      return right.additionalResults - left.additionalResults
    }
    if (left.keys.length !== right.keys.length) {
      return left.keys.length - right.keys.length
    }
    return left.keys.join('|').localeCompare(right.keys.join('|'))
  })
}

export const MIN_TVL_DISABLED = 0

export function canClearMinTvl(minTvl: number): boolean {
  return minTvl > MIN_TVL_DISABLED
}

export function isVaultHiddenByMinTvl({ minTvl, vaultTvl }: { minTvl: number; vaultTvl: number }): boolean {
  return canClearMinTvl(minTvl) && vaultTvl < minTvl
}

export function shouldShowComboBlockingAction<T extends string>({
  hiddenByFiltersCount,
  comboKeys,
  actionableKeys
}: {
  hiddenByFiltersCount: number
  comboKeys: T[]
  actionableKeys: Set<T>
}): boolean {
  if (hiddenByFiltersCount <= 0 || comboKeys.length === 0) {
    return false
  }
  if (actionableKeys.size === 0) {
    return true
  }
  return comboKeys.some((key) => !actionableKeys.has(key))
}
