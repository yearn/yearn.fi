import { useVaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import { useYvUsdVaults } from '@pages/vaults/hooks/useYvUsdVaults'
import {
  convertYvUsdVariantAmountString,
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
import { toAddress, zeroNormalizedBN } from '@shared/utils'
import type { ReactElement } from 'react'
import { useState } from 'react'
import { useAccount } from 'wagmi'
import { WidgetDeposit } from '../deposit'
import { YvUsdVariantToggle } from './YvUsdVariantToggle'

type Props = {
  chainId: number
  assetAddress: `0x${string}`
  onDepositSuccess?: () => void
  collapseDetails?: boolean
  onVariantChange?: (variant: TYvUsdVariant) => void
}

type DepositPrefill = {
  address: `0x${string}`
  chainId: number
  amount?: string
}

type LockedDepositExtraTokenCandidate = {
  address?: string
  name?: string
  symbol?: string
  decimals?: number
  chainID?: number
  balance?: TToken['balance']
}

type TYvUsdAmountUnit = 'underlying' | 'shares' | 'other'

function getLockedDepositExtraTokens(token?: LockedDepositExtraTokenCandidate): TToken[] {
  if (!token?.address || !token.chainID || !token.symbol || !token.name || !token.decimals) {
    return []
  }

  return [
    {
      address: toAddress(token.address),
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      chainID: token.chainID,
      value: 0,
      balance: token.balance ?? zeroNormalizedBN
    }
  ]
}

function getYvUsdAmountUnit(address: `0x${string}`, underlyingAssetAddress: `0x${string}`): TYvUsdAmountUnit {
  if (address === YVUSD_UNLOCKED_ADDRESS) {
    return 'shares'
  }
  if (address === underlyingAssetAddress) {
    return 'underlying'
  }
  return 'other'
}

function getDepositPrefill(
  variant: TYvUsdVariant | null,
  unlockedAssetAddress: `0x${string}`,
  chainId: number,
  pendingPrefillAmount?: string
): DepositPrefill | undefined {
  if (variant === 'locked') {
    return {
      address: unlockedAssetAddress,
      chainId,
      amount: pendingPrefillAmount
    }
  }
  if (variant === 'unlocked' && pendingPrefillAmount !== undefined) {
    return {
      address: unlockedAssetAddress,
      chainId,
      amount: pendingPrefillAmount
    }
  }
  return undefined
}

function getYvUsdDepositSymbol(variant: TYvUsdVariant | null): string {
  switch (variant) {
    case 'locked':
      return 'yvUSD (Locked)'
    case 'unlocked':
      return 'yvUSD (Unlocked)'
    default:
      return 'yvUSD'
  }
}

function getVaultSharesLabel(variant: TYvUsdVariant | null): string | undefined {
  switch (variant) {
    case 'locked':
      return 'Locked Vault Shares'
    case 'unlocked':
      return 'Unlocked Vault Shares'
    default:
      return undefined
  }
}

export function YvUsdDeposit({
  chainId,
  assetAddress,
  onDepositSuccess,
  collapseDetails,
  onVariantChange
}: Props): ReactElement {
  const { address: account } = useAccount()
  const { unlockedVault, lockedVault, metrics, isLoading } = useYvUsdVaults()
  const [variant, setVariant] = useState<TYvUsdVariant | null>(null)
  const [draftDepositAmount, setDraftDepositAmount] = useState('')
  const [pendingPrefillAmount, setPendingPrefillAmount] = useState<string | undefined>(undefined)
  const unlockedAssetAddress = toAddress(unlockedVault?.token.address ?? assetAddress)
  const lockedAssetAddress = YVUSD_UNLOCKED_ADDRESS
  const [selectedDepositTokenAddress, setSelectedDepositTokenAddress] = useState<`0x${string}` | undefined>(undefined)
  const unlockedUserData = useVaultUserData({
    vaultAddress: unlockedVault?.address ?? YVUSD_UNLOCKED_ADDRESS,
    assetAddress: unlockedAssetAddress,
    chainId,
    account
  })
  const lockedUserData = useVaultUserData({
    vaultAddress: lockedVault?.address ?? YVUSD_LOCKED_ADDRESS,
    assetAddress: lockedAssetAddress,
    chainId,
    account
  })
  const isLockedVariant = variant === 'locked'
  const selectedAssetAddress = isLockedVariant ? lockedAssetAddress : unlockedAssetAddress
  const selectedVaultUserData = isLockedVariant ? lockedUserData : unlockedUserData
  const lockedDepositInputToken = isLockedVariant
    ? {
        address: unlockedUserData.assetToken?.address ?? unlockedAssetAddress,
        name: unlockedUserData.assetToken?.name ?? unlockedVault.token.name ?? 'USD Coin',
        symbol: unlockedUserData.assetToken?.symbol ?? unlockedVault.token.symbol ?? 'USDC',
        decimals: unlockedUserData.assetToken?.decimals ?? unlockedVault.token.decimals ?? 6,
        chainID: unlockedUserData.assetToken?.chainID ?? chainId,
        balance: unlockedUserData.assetToken?.balance
      }
    : undefined
  const lockedDepositExtraTokens = getLockedDepositExtraTokens(lockedDepositInputToken)

  if (isLoading || !unlockedVault || !lockedVault) {
    return (
      <div className="p-6 flex items-center justify-center h-[317px]">
        <div className="w-6 h-6 border-2 border-border border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  const unlockedApr = metrics?.unlocked.apy ?? unlockedVault.apr?.netAPR ?? 0
  const lockedApr = metrics?.locked.apy ?? lockedVault.apr?.netAPR ?? 0
  const selectedVault = isLockedVariant ? lockedVault : unlockedVault
  const unlockedAssetDecimals = unlockedUserData.assetToken?.decimals ?? 6
  const lockedAssetDecimals = lockedUserData.assetToken?.decimals ?? unlockedUserData.vaultToken?.decimals ?? 18
  const unlockedVaultDecimals = unlockedUserData.vaultToken?.decimals ?? unlockedVault.decimals ?? 18

  const handleVariantChange = (nextVariant: TYvUsdVariant): void => {
    const currentInputTokenAddress = toAddress(selectedDepositTokenAddress ?? unlockedAssetAddress)
    const nextInputTokenAddress = unlockedAssetAddress
    const currentAmountUnit = getYvUsdAmountUnit(currentInputTokenAddress, unlockedAssetAddress)
    const nextAmountUnit = getYvUsdAmountUnit(nextInputTokenAddress, unlockedAssetAddress)
    const canPreserveRawAmount =
      currentInputTokenAddress === nextInputTokenAddress ||
      (currentAmountUnit !== 'other' && nextAmountUnit !== 'other')
    const shouldConvertAmount =
      draftDepositAmount.length > 0 && canPreserveRawAmount && currentAmountUnit !== nextAmountUnit
    const nextAmount = shouldConvertAmount
      ? convertYvUsdVariantAmountString({
          amount: draftDepositAmount,
          fromVariant: currentAmountUnit === 'shares' ? 'locked' : 'unlocked',
          toVariant: nextAmountUnit === 'shares' ? 'locked' : 'unlocked',
          fromDecimals: currentAmountUnit === 'shares' ? lockedAssetDecimals : unlockedAssetDecimals,
          toDecimals: nextAmountUnit === 'shares' ? lockedAssetDecimals : unlockedAssetDecimals,
          unlockedPricePerShare: unlockedUserData.pricePerShare,
          unlockedVaultDecimals
        })
      : canPreserveRawAmount && draftDepositAmount.length > 0
        ? draftDepositAmount
        : undefined
    setDraftDepositAmount(nextAmount ?? '')
    setPendingPrefillAmount(nextAmount)
    setVariant(nextVariant)
    onVariantChange?.(nextVariant)
  }
  const depositPrefill = getDepositPrefill(variant, unlockedAssetAddress, chainId, pendingPrefillAmount)

  const headerToggle =
    variant === null ? undefined : <YvUsdVariantToggle activeVariant={variant} onChange={handleVariantChange} />

  const depositTypeSection = variant ? (
    <div className="rounded-lg border border-border bg-surface-secondary px-3 py-2 text-sm text-text-secondary">
      <p className="text-sm text-text-secondary">
        {variant === 'locked'
          ? `Locked deposits earn additional yield from unlocked positions. Your position will be locked with a ${YVUSD_LOCKED_COOLDOWN_DAYS}-day cooldown and a ${YVUSD_WITHDRAW_WINDOW_DAYS} day withdrawal window.`
          : `Unlocked deposits stay liquid but earn less.`}
      </p>
    </div>
  ) : (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-secondary p-4 text-sm text-text-secondary">
      <p>{'You can lock your vault position to earn additional yield. Locking helps manage system liquidity.'}</p>
      <p>{`Locks are subject to a ${YVUSD_LOCKED_COOLDOWN_DAYS}-day cooldown and a ${YVUSD_WITHDRAW_WINDOW_DAYS} day withdrawal window.`}</p>
      <p className="font-semibold text-text-primary">{'Please choose your deposit type'}</p>
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="filled"
          classNameOverride="yearn--button--nextgen w-full"
          onClick={() => handleVariantChange('unlocked')}
        >
          <span className="inline-flex items-center gap-2">
            <IconLockOpen className="size-6" />
            {'Unlocked'}
          </span>
        </Button>
        <Button
          variant="filled"
          classNameOverride="yearn--button--nextgen w-full"
          onClick={() => handleVariantChange('locked')}
        >
          <span className="inline-flex items-center gap-2">
            <IconLock className="size-6" />
            {'Locked'}
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
        directDepositTokenAddress={isLockedVariant ? unlockedAssetAddress : undefined}
        chainId={chainId}
        vaultAPR={isLockedVariant ? lockedApr : unlockedApr}
        vaultSymbol={getYvUsdDepositSymbol(variant)}
        vaultUserData={selectedVaultUserData}
        handleDepositSuccess={onDepositSuccess}
        onAmountChange={setDraftDepositAmount}
        onTokenSelectionChange={setSelectedDepositTokenAddress}
        hideDetails={!variant}
        hideActionButton={!variant}
        hideContainerBorder
        headerActions={headerToggle}
        contentBelowInput={depositTypeSection}
        collapseDetails={Boolean(collapseDetails && variant !== null)}
        prefill={depositPrefill}
        onPrefillApplied={() => setPendingPrefillAmount(undefined)}
        tokenSelectorExtraTokens={lockedDepositExtraTokens}
        vaultSharesLabel={getVaultSharesLabel(variant)}
      />
    </div>
  )
}
