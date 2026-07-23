import { type TYvUsdVariant, YVUSD_LOCKED_COOLDOWN_DAYS, YVUSD_WITHDRAW_WINDOW_DAYS } from '@pages/vaults/utils/yvUsd'

export function getYvUsdDepositTypeItems(variant: TYvUsdVariant): string[] {
  if (variant === 'locked') {
    return [
      `${YVUSD_LOCKED_COOLDOWN_DAYS} day cooldown`,
      `${YVUSD_WITHDRAW_WINDOW_DAYS} day withdrawal window`,
      'Higher yield'
    ]
  }

  return ['No cooldown or withdrawal window', 'Lower yield']
}

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
