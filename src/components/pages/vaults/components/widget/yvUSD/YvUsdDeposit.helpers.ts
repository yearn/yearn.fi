import type { TYvUsdVariant } from '@pages/vaults/utils/yvUsd'

export function shouldRefetchUnlockedAfterYvUsdDeposit(variant: TYvUsdVariant | null): boolean {
  return variant === 'locked'
}

export function scheduleAdditionalYvUsdDepositRefetch(
  variant: TYvUsdVariant | null,
  refetchUnlocked: () => void
): void {
  if (!shouldRefetchUnlockedAfterYvUsdDeposit(variant)) {
    return
  }

  globalThis.setTimeout(() => {
    refetchUnlocked()
  }, 0)
}
