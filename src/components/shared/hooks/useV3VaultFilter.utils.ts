import type { TVaultListKind } from '@pages/vaults/utils/vaultListFacets'

type TMatchesSelectedV3Kind = {
  kind: TVaultListKind
  types: string[] | null
  hasUserHoldings: boolean
  includeYieldSplittersByDefault: boolean
}

export function matchesSelectedV3Kind({
  kind,
  types,
  hasUserHoldings,
  includeYieldSplittersByDefault
}: TMatchesSelectedV3Kind): boolean {
  if (hasUserHoldings || !types?.length) {
    return true
  }

  if (Boolean(types.includes('multi')) && kind === 'allocator') {
    return true
  }

  if (Boolean(types.includes('single')) && (kind === 'strategy' || kind === 'yieldSplitter')) {
    return true
  }

  return includeYieldSplittersByDefault && kind === 'yieldSplitter'
}
