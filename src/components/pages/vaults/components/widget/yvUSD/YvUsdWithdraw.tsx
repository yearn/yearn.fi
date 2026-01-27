import { useVaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import { useYvUsdVaults } from '@pages/vaults/hooks/useYvUsdVaults'
import {
  type TYvUsdVariant,
  YVUSD_BASELINE_VAULT_ADDRESS,
  YVUSD_LOCKED_COOLDOWN_DAYS,
  YVUSD_WITHDRAW_WINDOW_DAYS
} from '@pages/vaults/utils/yvUsd'
import { IconLock } from '@shared/icons/IconLock'
import { IconLockOpen } from '@shared/icons/IconLockOpen'
import { cl, toAddress } from '@shared/utils'
import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { WidgetWithdraw } from '../withdraw'

type Props = {
  chainId: number
  assetAddress: `0x${string}`
  onWithdrawSuccess?: () => void
}

export function YvUsdWithdraw({ chainId, assetAddress, onWithdrawSuccess }: Props): ReactElement {
  const { address: account } = useAccount()
  const { unlockedVault, lockedVault, isLoading } = useYvUsdVaults()
  const [variant, setVariant] = useState<TYvUsdVariant | null>(null)

  const unlockedUserData = useVaultUserData({
    vaultAddress: unlockedVault?.address ?? YVUSD_BASELINE_VAULT_ADDRESS,
    assetAddress,
    chainId,
    account
  })
  const lockedUserData = useVaultUserData({
    vaultAddress: lockedVault?.address ?? YVUSD_BASELINE_VAULT_ADDRESS,
    assetAddress,
    chainId,
    account
  })

  const hasUnlocked = unlockedUserData.depositedShares > 0n
  const hasLocked = lockedUserData.depositedShares > 0n

  useEffect(() => {
    if (variant) return
    if (hasLocked && !hasUnlocked) {
      setVariant('locked')
    } else if (hasUnlocked && !hasLocked) {
      setVariant('unlocked')
    } else if (hasUnlocked && hasLocked) {
      setVariant('unlocked')
    } else {
      setVariant('unlocked')
    }
  }, [hasLocked, hasUnlocked, variant])

  if (isLoading || !unlockedVault || !lockedVault) {
    return (
      <div className="p-6 flex items-center justify-center h-[317px]">
        <div className="w-6 h-6 border-2 border-border border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  const activeVariant = variant ?? 'unlocked'
  const selectedVault = activeVariant === 'locked' ? lockedVault : unlockedVault
  const showToggle = hasUnlocked && hasLocked

  return (
    <div className="flex flex-col gap-0">
      {showToggle ? (
        <div className="px-6 pb-4 pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{'Withdraw From'}</p>
            <div className="flex items-center gap-1 rounded-lg bg-surface-secondary p-1 shadow-inner">
              <button
                type="button"
                onClick={() => setVariant('locked')}
                className={cl(
                  'rounded-sm px-3 py-1 text-xs font-semibold transition-all',
                  variant === 'locked'
                    ? 'bg-surface text-text-primary'
                    : 'bg-transparent text-text-secondary hover:text-text-secondary'
                )}
              >
                <span className="inline-flex items-center gap-1">
                  <IconLock className="size-3" />
                  {'Locked'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setVariant('unlocked')}
                className={cl(
                  'rounded-sm px-3 py-1 text-xs font-semibold transition-all',
                  variant === 'unlocked'
                    ? 'bg-surface text-text-primary'
                    : 'bg-transparent text-text-secondary hover:text-text-secondary'
                )}
              >
                <span className="inline-flex items-center gap-1">
                  <IconLockOpen className="size-3" />
                  {'Unlocked'}
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeVariant === 'locked' ? (
        <div className="mx-6 mb-4 rounded-lg border border-border bg-surface-secondary p-4 text-sm">
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-text-primary">{'Locked withdrawal cooldown'}</p>
            <p className="text-xs text-text-secondary">
              {`Cooldown: ${YVUSD_LOCKED_COOLDOWN_DAYS} days | Withdrawal window: ${YVUSD_WITHDRAW_WINDOW_DAYS} days`}
            </p>
          </div>
          <div className="mt-3 flex flex-col gap-1 text-xs text-text-secondary">
            <p>{'Cooldown remaining: --'}</p>
            <p>{'Withdrawal window remaining: --'}</p>
          </div>
        </div>
      ) : null}

      <WidgetWithdraw
        key={selectedVault.address}
        vaultAddress={toAddress(selectedVault.address)}
        assetAddress={assetAddress}
        chainId={chainId}
        vaultSymbol={activeVariant === 'locked' ? 'yvUSD (Locked)' : 'yvUSD (Unlocked)'}
        handleWithdrawSuccess={onWithdrawSuccess}
      />
    </div>
  )
}
