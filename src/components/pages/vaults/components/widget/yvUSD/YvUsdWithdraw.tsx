import { useVaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import { useYvUsdVaults } from '@pages/vaults/hooks/useYvUsdVaults'
import {
  type TYvUsdVariant,
  YVUSD_BASELINE_VAULT_ADDRESS,
  YVUSD_LOCKED_COOLDOWN_DAYS,
  YVUSD_WITHDRAW_WINDOW_DAYS
} from '@pages/vaults/utils/yvUsd'
import { Button } from '@shared/components/Button'
import { IconLock } from '@shared/icons/IconLock'
import { IconLockOpen } from '@shared/icons/IconLockOpen'
import { cl, toAddress } from '@shared/utils'
import type { ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { WidgetWithdraw } from '../withdraw'

type Props = {
  chainId: number
  assetAddress: `0x${string}`
  onWithdrawSuccess?: () => void
}

const DAY_MS = 86_400_000

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function YvUsdWithdraw({ chainId, assetAddress, onWithdrawSuccess }: Props): ReactElement {
  const { address: account } = useAccount()
  const { unlockedVault, lockedVault, isLoading } = useYvUsdVaults()
  const [variant, setVariant] = useState<TYvUsdVariant | null>(null)
  const [cooldownStart, setCooldownStart] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(interval)
  }, [])

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
    }
  }, [hasLocked, hasUnlocked, variant])

  const status = useMemo(() => {
    if (!cooldownStart) return 'not-started'
    const cooldownEnd = cooldownStart + YVUSD_LOCKED_COOLDOWN_DAYS * DAY_MS
    const windowEnd = cooldownEnd + YVUSD_WITHDRAW_WINDOW_DAYS * DAY_MS
    if (now < cooldownEnd) return 'cooling'
    if (now <= windowEnd) return 'withdraw-open'
    return 'expired'
  }, [cooldownStart, now])

  const cooldownEndsAt = useMemo(() => {
    if (!cooldownStart) return null
    return cooldownStart + YVUSD_LOCKED_COOLDOWN_DAYS * DAY_MS
  }, [cooldownStart])

  const windowEndsAt = useMemo(() => {
    if (!cooldownStart) return null
    return cooldownStart + (YVUSD_LOCKED_COOLDOWN_DAYS + YVUSD_WITHDRAW_WINDOW_DAYS) * DAY_MS
  }, [cooldownStart])

  const handleStartCooldown = useCallback(() => {
    setCooldownStart(Date.now())
  }, [])

  if (isLoading || !unlockedVault || !lockedVault) {
    return (
      <div className="p-6 flex items-center justify-center h-[317px]">
        <div className="w-6 h-6 border-2 border-border border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  const selectedVault = variant === 'locked' ? lockedVault : unlockedVault
  const disableWithdraw = variant === 'locked' && status !== 'withdraw-open'
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

      {variant === 'locked' ? (
        <div className="mx-6 mb-4 rounded-lg border border-border bg-surface-secondary p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="font-semibold text-text-primary">{'Locked withdrawal cooldown'}</p>
              <p className="text-xs text-text-secondary">
                {`Cooldown: ${YVUSD_LOCKED_COOLDOWN_DAYS} days | Withdrawal window: ${YVUSD_WITHDRAW_WINDOW_DAYS} days`}
              </p>
            </div>
            <Button
              variant="filled"
              classNameOverride="yearn--button--nextgen"
              disabled={status === 'cooling'}
              onClick={handleStartCooldown}
            >
              {status === 'not-started' ? 'Start cooldown' : status === 'expired' ? 'Restart cooldown' : 'Cooldown'}
            </Button>
          </div>
          <div className="mt-3 flex flex-col gap-1 text-xs text-text-secondary">
            <p>
              {'Status: '}
              <span className="text-text-primary">
                {status === 'not-started'
                  ? 'Not started'
                  : status === 'cooling'
                    ? 'Cooling down'
                    : status === 'withdraw-open'
                      ? 'Withdrawal window open'
                      : 'Window expired'}
              </span>
            </p>
            {cooldownEndsAt ? (
              <p>
                {'Cooldown ends in '}
                {status === 'cooling' ? formatDuration(cooldownEndsAt - now) : '0m'}
              </p>
            ) : null}
            {windowEndsAt ? (
              <p>
                {'Window closes in '}
                {formatDuration(windowEndsAt - now)}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {variant ? (
        <div className={cl(disableWithdraw ? 'opacity-60 pointer-events-none' : '')}>
          <WidgetWithdraw
            key={selectedVault.address}
            vaultAddress={toAddress(selectedVault.address)}
            assetAddress={assetAddress}
            chainId={chainId}
            vaultSymbol={variant === 'locked' ? 'yvUSD (Locked)' : 'yvUSD (Unlocked)'}
            handleWithdrawSuccess={onWithdrawSuccess}
          />
        </div>
      ) : (
        <div className="px-6 pb-6 text-sm text-text-secondary">
          {'Connect a wallet with yvUSD deposits to withdraw.'}
        </div>
      )}
      {variant === 'locked' && disableWithdraw ? (
        <div className="px-6 pb-6 text-xs text-text-secondary">
          {'Withdrawals unlock after the cooldown completes.'}
        </div>
      ) : null}
    </div>
  )
}
