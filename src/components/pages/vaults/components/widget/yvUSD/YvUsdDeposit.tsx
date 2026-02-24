import { useVaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import { useYvUsdVaults } from '@pages/vaults/hooks/useYvUsdVaults'
import {
  type TYvUsdVariant,
  YVUSD_LOCKED_ADDRESS,
  YVUSD_LOCKED_COOLDOWN_DAYS,
  YVUSD_UNLOCKED_ADDRESS,
  YVUSD_WITHDRAW_WINDOW_DAYS
} from '@pages/vaults/utils/yvUsd'
import { Button } from '@shared/components/Button'
import { IconLock } from '@shared/icons/IconLock'
import { IconLockOpen } from '@shared/icons/IconLockOpen'
import { cl, toAddress } from '@shared/utils'
import type { ReactElement } from 'react'
import { useState } from 'react'
import { useAccount } from 'wagmi'
import { WidgetDeposit } from '../deposit'

type Props = {
  chainId: number
  assetAddress: `0x${string}`
  onDepositSuccess?: () => void
}

export function YvUsdDeposit({ chainId, assetAddress, onDepositSuccess }: Props): ReactElement {
  const { address: account } = useAccount()
  const { unlockedVault, lockedVault, metrics, isLoading } = useYvUsdVaults()
  const [variant, setVariant] = useState<TYvUsdVariant | null>(null)
  const selectedVaultAddress = variant === 'locked' ? lockedVault?.address : unlockedVault?.address
  const selectedVaultUserData = useVaultUserData({
    vaultAddress: selectedVaultAddress ?? (variant === 'locked' ? YVUSD_LOCKED_ADDRESS : YVUSD_UNLOCKED_ADDRESS),
    assetAddress,
    chainId,
    account
  })

  if (isLoading || !unlockedVault || !lockedVault) {
    return (
      <div className="p-6 flex items-center justify-center h-[317px]">
        <div className="w-6 h-6 border-2 border-border border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  const unlockedApr = metrics?.unlocked.apy ?? unlockedVault.apr?.netAPR ?? 0
  const lockedApr = metrics?.locked.apy ?? lockedVault.apr?.netAPR ?? 0
  const unlockedAprPercent = unlockedApr * 100
  const lockedAprPercent = lockedApr * 100
  const selectedVault = variant === 'locked' ? lockedVault : unlockedVault

  const depositTypeSection = variant ? (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{'Deposit Type'}</p>
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
              <IconLock className="size-6" />
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
              <IconLockOpen className="size-6" />
              {'Unlocked'}
            </span>
          </button>
        </div>
      </div>
      <p className="text-xs text-text-secondary">
        {variant === 'locked'
          ? `Locked deposits earn additional yield (~${lockedAprPercent.toFixed(2)}% est. APY). Your position will be locked with a ${YVUSD_LOCKED_COOLDOWN_DAYS}-day cooldown and a ${YVUSD_WITHDRAW_WINDOW_DAYS} day withdrawal window.`
          : `Unlocked deposits stay liquid (~${unlockedAprPercent.toFixed(2)}% est. APY).`}
      </p>
    </div>
  ) : (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-secondary p-4 text-sm text-text-secondary">
      <p>{'You can lock your vault position to earn additional yield. Locking helps manage system liquidity.'}</p>
      <p>{`Locks are subject to a ${YVUSD_LOCKED_COOLDOWN_DAYS}-day cooldown and a ${YVUSD_WITHDRAW_WINDOW_DAYS} day withdrawal window.`}</p>
      <p className="font-semibold text-text-primary">{'Please choose your deposit type'}</p>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="filled" classNameOverride="yearn--button--nextgen w-full" onClick={() => setVariant('locked')}>
          <span className="inline-flex items-center gap-2">
            <IconLock className="size-6" />
            {'Locked'}
          </span>
        </Button>
        <Button
          variant="filled"
          classNameOverride="yearn--button--nextgen w-full"
          onClick={() => setVariant('unlocked')}
        >
          <span className="inline-flex items-center gap-2">
            <IconLockOpen className="size-6" />
            {'Unlocked'}
          </span>
        </Button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-0">
      <WidgetDeposit
        vaultAddress={toAddress(selectedVault.address)}
        assetAddress={assetAddress}
        chainId={chainId}
        vaultAPR={variant === 'locked' ? lockedApr : unlockedApr}
        vaultSymbol={variant === 'locked' ? 'yvUSD (Locked)' : variant === 'unlocked' ? 'yvUSD (Unlocked)' : 'yvUSD'}
        vaultUserData={selectedVaultUserData}
        handleDepositSuccess={onDepositSuccess}
        hideDetails={!variant}
        hideActionButton={!variant}
        hideContainerBorder
        contentBelowInput={depositTypeSection}
        vaultSharesLabel={
          variant === 'locked' ? 'Locked Vault Shares' : variant === 'unlocked' ? 'Unlocked Vault Shares' : undefined
        }
      />
    </div>
  )
}
