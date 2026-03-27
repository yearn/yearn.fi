import type { TYvUsdVariant } from '@pages/vaults/utils/yvUsd'

export function scheduleAdditionalYvUsdDepositRefetch(
  variant: TYvUsdVariant | null,
  refetchUnlocked: () => void
): void {
  if (variant !== 'locked') {
    return
  }

  globalThis.setTimeout(() => {
    refetchUnlocked()
  }, 0)
}
