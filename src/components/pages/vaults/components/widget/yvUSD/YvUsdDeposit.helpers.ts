import type { TYvUsdVariant } from '@pages/vaults/utils/yvUsd'

export function shouldDeferYvUsdDepositSuccessUntilClose(variant: TYvUsdVariant | null): boolean {
  return variant === 'locked'
}

export function scheduleAdditionalYvUsdDepositRefetch(
  variant: TYvUsdVariant | null,
  refetchUnlocked: () => void
): void {
  if (!shouldDeferYvUsdDepositSuccessUntilClose(variant)) {
    return
  }

  globalThis.setTimeout(() => {
    refetchUnlocked()
  }, 0)
}
