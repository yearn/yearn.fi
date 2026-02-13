type TVaultInclusion = Record<string, boolean> | undefined

type TVaultListFilterInput = {
  category?: string | null
  inclusion?: TVaultInclusion
}

export function getInclusionFlag(inclusion: TVaultInclusion, key: string): boolean | undefined {
  if (!inclusion) {
    return undefined
  }

  if (key in inclusion) {
    return inclusion[key]
  }

  const normalizedKey = key.toLowerCase()
  const match = Object.entries(inclusion).find(([entryKey]) => entryKey.toLowerCase() === normalizedKey)
  return match?.[1]
}

export function matchesVaultCategory(item: TVaultListFilterInput, expectedCategory: string): boolean {
  return (
    String(item.category ?? '')
      .trim()
      .toLowerCase() === expectedCategory.toLowerCase()
  )
}
