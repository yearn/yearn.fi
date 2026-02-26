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
