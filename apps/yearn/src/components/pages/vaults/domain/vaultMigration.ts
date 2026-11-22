import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { WidgetActionType } from '@pages/vaults/types'
import { resolveRouteVaultFromMap } from '@pages/vaults/utils/routeVault'

export function isListedMigrationTarget(
  catalogVaults: Record<string, TKongVaultInput | undefined>,
  chainId: number,
  target?: string | null
): boolean {
  return Boolean(resolveRouteVaultFromMap(catalogVaults, { routeChainId: chainId, routeAddress: target }))
}

export function getVaultWidgetActions({
  isRetired,
  isMigratable,
  canMigrate
}: {
  isRetired: boolean
  isMigratable: boolean
  canMigrate: boolean
}): WidgetActionType[] {
  if (!isRetired && !isMigratable) {
    return [WidgetActionType.Deposit, WidgetActionType.Withdraw]
  }
  return canMigrate ? [WidgetActionType.Migrate, WidgetActionType.Withdraw] : [WidgetActionType.Withdraw]
}
