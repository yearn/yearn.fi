import type { TVaultType } from './vaultTypeCopy'

export type TYieldRateFilter = 'all' | 'floating'

export function shouldIncludeFixedYieldVaults(vaultType: TVaultType, yieldRateFilter: TYieldRateFilter): boolean {
  return vaultType === 'fixed' || (vaultType === 'all' && yieldRateFilter === 'all')
}
