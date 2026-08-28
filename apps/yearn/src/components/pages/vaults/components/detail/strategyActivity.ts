import type { TKongVaultStrategy } from '@pages/vaults/domain/kongVaultSelectors'
import { toBigInt } from '@shared/utils'

export function isActiveStrategy(strategy: TKongVaultStrategy): boolean {
  return (
    strategy.status === 'active' &&
    toBigInt(strategy.details?.totalDebt || 0) > 0n &&
    (strategy.details?.debtRatio || 0) > 0
  )
}
