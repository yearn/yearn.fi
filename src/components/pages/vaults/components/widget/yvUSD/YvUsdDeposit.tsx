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
import type { TToken } from '@shared/types'
import { toAddress } from '@shared/utils'
import type { ReactElement } from 'react'
import { useState } from 'react'
import { useAccount } from 'wagmi'
import { WidgetDeposit } from '../deposit'
import { YvUsdVariantToggle } from './YvUsdVariantToggle'

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
  const unlockedAssetAddress = toAddress(unlockedVault?.token.address ?? assetAddress)
  const lockedAssetAddress = YVUSD_UNLOCKED_ADDRESS
  const selectedAssetAddress = variant === 'locked' ? lockedAssetAddress : unlockedAssetAddress
  const selectedVaultUserData = useVaultUserData({
    vaultAddress: selectedVaultAddress ?? (variant === 'locked' ? YVUSD_LOCKED_ADDRESS : YVUSD_UNLOCKED_ADDRESS),
    assetAddress: selectedAssetAddress,
    chainId,
    account
  })
  const lockedDepositExtraTokens: TToken[] =
    variant !== 'locked'
      ? []
      : (() => {
          const token = selectedVaultUserData.assetToken
          if (!token?.address || !token.chainID || !token.symbol || !token.name || !token.decimals) {
            return []
          }
          if (token.balance.raw <= 0n) {
            return []
          }

          return [
            {
              address: token.address,
              name: token.name,
              symbol: token.symbol,
              decimals: token.decimals,
              chainID: token.chainID,
              value: 0,
              balance: token.balance
            }
          ]
        })()

  if (isLoading || !unlockedVault || !lockedVault) {
    return (
      <div className="p-6 flex items-center justify-center h-[317px]">
        <div className="w-6 h-6 border-2 border-border border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  const unlockedApr = metrics?.unlocked.apy ?? unlockedVault.apr?.netAPR ?? 0
  const lockedApr = metrics?.locked.apy ?? lockedVault.apr?.netAPR ?? 0
  const selectedVault = variant === 'locked' ? lockedVault : unlockedVault

  const headerToggle =
    variant === null ? undefined : <YvUsdVariantToggle activeVariant={variant} onChange={setVariant} />

  const depositTypeSection = variant ? (
    <div className="rounded-lg border border-border bg-surface-secondary p-4 text-sm text-text-secondary">
      <p className="text-sm text-text-secondary">
        {variant === 'locked'
          ? `Locked deposits earn additional yield from unlocked positions. Your position will be locked with a ${YVUSD_LOCKED_COOLDOWN_DAYS}-day cooldown and a ${YVUSD_WITHDRAW_WINDOW_DAYS} day withdrawal window.`
          : `Unlocked deposits stay liquid but pay some yield to locked positions.`}
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
        key={`${selectedVault.address}-${selectedAssetAddress}`}
        vaultAddress={toAddress(selectedVault.address)}
        assetAddress={selectedAssetAddress}
        chainId={chainId}
        vaultAPR={variant === 'locked' ? lockedApr : unlockedApr}
        vaultSymbol={variant === 'locked' ? 'yvUSD (Locked)' : variant === 'unlocked' ? 'yvUSD (Unlocked)' : 'yvUSD'}
        vaultUserData={selectedVaultUserData}
        handleDepositSuccess={onDepositSuccess}
        hideDetails={!variant}
        hideActionButton={!variant}
        hideContainerBorder
        headerActions={headerToggle}
        contentBelowInput={depositTypeSection}
        prefill={variant === 'locked' ? { address: unlockedAssetAddress, chainId } : undefined}
        tokenSelectorExtraTokens={lockedDepositExtraTokens}
        vaultSharesLabel={
          variant === 'locked' ? 'Locked Vault Shares' : variant === 'unlocked' ? 'Unlocked Vault Shares' : undefined
        }
      />
    </div>
  )
}
