import { useVaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import { useYvUsdVaults } from '@pages/vaults/hooks/useYvUsdVaults'
import {
  convertYvUsdLockedAssetRawAmountToUnderlying,
  convertYvUsdLockedPricePerShareToUnderlying,
  convertYvUsdUnderlyingRawAmountToLockedAsset,
  getYvUsdLockedWithdrawDisplayMode,
  type TYvUsdVariant,
  YVUSD_LOCKED_ADDRESS,
  YVUSD_LOCKED_COOLDOWN_DAYS,
  YVUSD_UNLOCKED_ADDRESS,
  YVUSD_WITHDRAW_WINDOW_DAYS
} from '@pages/vaults/utils/yvUsd'
import { Button } from '@shared/components/Button'
import { useWallet } from '@shared/contexts/useWallet'
import { erc4626Abi } from '@shared/contracts/abi/4626.abi'
import { yvUsdLockedVaultAbi } from '@shared/contracts/abi/yvUsdLockedVault.abi'
import { useChainTimestamp } from '@shared/hooks/useChainTimestamp'
import { IconCheck } from '@shared/icons/IconCheck'
import { formatTAmount, toAddress } from '@shared/utils'
import type { ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import type { UseSimulateContractReturnType } from 'wagmi'
import { useAccount, useReadContract, useSimulateContract } from 'wagmi'
import { InfoOverlay } from '../shared/InfoOverlay'
import { TransactionOverlay, type TransactionStep } from '../shared/TransactionOverlay'
import { WidgetWithdraw } from '../withdraw'
import {
  formatDays,
  formatDuration,
  parseCooldownStatus,
  resolveCooldownWindowState,
  resolveDurationSeconds
} from './cooldownUtils'
import { YvUsdVariantToggle } from './YvUsdVariantToggle'
import {
  buildLockedWithdrawNoZapExecutionPlan,
  buildLockedWithdrawTransactionStep,
  resolveLockedRequestedWithdrawAssets,
  resolveLockedWithdrawDisplayAmount,
  resolveLockedWithdrawExpectedOut
} from './YvUsdWithdraw.helpers'

type Props = {
  chainId: number
  assetAddress: `0x${string}`
  onWithdrawSuccess?: () => void
  collapseDetails?: boolean
}

type WithdrawPrefill = {
  address: `0x${string}`
  chainId: number
  amount?: string
}

type TYvUsdAmountUnit = 'underlying' | 'shares' | 'other'

function getDefaultVariant(hasLocked: boolean, hasUnlocked: boolean): TYvUsdVariant {
  if (hasLocked && !hasUnlocked) {
    return 'locked'
  }
  return 'unlocked'
}

function getWithdrawPrefill(
  activeVariant: TYvUsdVariant,
  lockedInputAddress: `0x${string}`,
  lockedPrefillAddress: `0x${string}` | undefined,
  unlockedAssetAddress: `0x${string}`,
  chainId: number,
  pendingPrefillAmount?: string
): WithdrawPrefill | undefined {
  if (activeVariant === 'locked') {
    return {
      address: lockedPrefillAddress ?? lockedInputAddress,
      chainId,
      amount: pendingPrefillAmount
    }
  }
  if (pendingPrefillAmount !== undefined) {
    return {
      address: unlockedAssetAddress,
      chainId,
      amount: pendingPrefillAmount
    }
  }
  return undefined
}

function getCooldownRemainingLabel(isCooldownActive: boolean, needsCooldownStart: boolean, seconds: number): string {
  if (isCooldownActive) {
    return formatDuration(seconds)
  }
  if (needsCooldownStart) {
    return 'Not started'
  }
  return 'Complete'
}

function getWithdrawalWindowRemainingLabel(
  isWithdrawalWindowOpen: boolean,
  isCooldownActive: boolean,
  hasActiveCooldown: boolean,
  seconds: number
): string {
  if (isWithdrawalWindowOpen) {
    return formatDuration(seconds)
  }
  if (isCooldownActive) {
    return 'Not open yet'
  }
  if (hasActiveCooldown) {
    return 'Closed'
  }
  return 'Not started'
}

function getYvUsdWithdrawSymbol(variant: TYvUsdVariant): string {
  return variant === 'locked' ? 'yvUSD (Locked)' : 'yvUSD (Unlocked)'
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

function convertYvUsdInputAmount({
  amount,
  fromUnit,
  toUnit,
  unlockedPricePerShare,
  unlockedVaultDecimals
}: {
  amount: bigint
  fromUnit: TYvUsdAmountUnit
  toUnit: TYvUsdAmountUnit
  unlockedPricePerShare: bigint
  unlockedVaultDecimals: number
}): bigint {
  if (amount <= 0n || fromUnit === toUnit || fromUnit === 'other' || toUnit === 'other') {
    return amount
  }

  if (fromUnit === 'shares' && toUnit === 'underlying') {
    return convertYvUsdLockedAssetRawAmountToUnderlying({
      amount,
      unlockedPricePerShare,
      unlockedVaultDecimals
    })
  }

  if (fromUnit === 'underlying' && toUnit === 'shares') {
    return convertYvUsdUnderlyingRawAmountToLockedAsset({
      amount,
      unlockedPricePerShare,
      unlockedVaultDecimals
    })
  }

  return amount
}

function resolveLockedRequestedAmountFromInput({
  amount,
  inputUnit,
  canWithdrawNow,
  lockedDisplayPricePerShare,
  lockedVaultTokenDecimals,
  unlockedPricePerShare,
  unlockedVaultDecimals
}: {
  amount: bigint
  inputUnit: TYvUsdAmountUnit
  canWithdrawNow: boolean
  lockedDisplayPricePerShare: bigint
  lockedVaultTokenDecimals: number
  unlockedPricePerShare: bigint
  unlockedVaultDecimals: number
}): bigint {
  if (inputUnit === 'shares') {
    return amount
  }

  if (canWithdrawNow) {
    if (lockedDisplayPricePerShare <= 0n) {
      return 0n
    }

    return (
      (amount * 10n ** BigInt(lockedVaultTokenDecimals) + lockedDisplayPricePerShare - 1n) / lockedDisplayPricePerShare
    )
  }

  return convertYvUsdUnderlyingRawAmountToLockedAsset({
    amount,
    unlockedPricePerShare,
    unlockedVaultDecimals
  })
}

export function YvUsdWithdraw({ chainId, assetAddress, onWithdrawSuccess, collapseDetails }: Props): ReactElement {
  const { address: account } = useAccount()
  const { onRefresh: refreshWalletBalances } = useWallet()
  const { unlockedVault, lockedVault, assetAddress: yvUsdAssetAddress, isLoading } = useYvUsdVaults()
  const [variant, setVariant] = useState<TYvUsdVariant | null>(null)
  const [showCooldownOverlay, setShowCooldownOverlay] = useState(false)
  const [showCancelCooldownOverlay, setShowCancelCooldownOverlay] = useState(false)
  const [showLockedWithdrawOverlay, setShowLockedWithdrawOverlay] = useState(false)
  const [showCooldownInfoOverlay, setShowCooldownInfoOverlay] = useState(false)
  const [draftWithdrawAmount, setDraftWithdrawAmount] = useState<bigint>(0n)
  const [pendingPrefillAmount, setPendingPrefillAmount] = useState<string | undefined>(undefined)
  const [pendingPrefillAddress, setPendingPrefillAddress] = useState<`0x${string}` | undefined>(undefined)
  const [prefillRequestKey, setPrefillRequestKey] = useState(0)
  const [lockedRequestedAmountRaw, setLockedRequestedAmountRaw] = useState<bigint>(0n)
  const [lockedWithdrawPhase, setLockedWithdrawPhase] = useState<'withdraw' | 'redeem'>('withdraw')
  const [selectedWithdrawTokenAddress, setSelectedWithdrawTokenAddress] = useState<`0x${string}` | undefined>(undefined)
  const activeVariant = variant ?? 'unlocked'
  const isLockedVariant = activeVariant === 'locked'

  const unlockedAssetAddress = toAddress(yvUsdAssetAddress ?? unlockedVault?.token.address ?? assetAddress)
  const lockedAssetAddress = YVUSD_UNLOCKED_ADDRESS
  const lockedWithdrawDisplayMode = getYvUsdLockedWithdrawDisplayMode()
  const lockedInputAddress = lockedWithdrawDisplayMode === 'underlying' ? unlockedAssetAddress : lockedAssetAddress

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

  const lockedWalletShares = lockedUserData.vaultToken?.balance.raw ?? 0n
  const lockedAssetDecimals = lockedUserData.assetToken?.decimals ?? 18
  const unlockedAssetDecimals = unlockedUserData.assetToken?.decimals ?? 6
  const unlockedVaultDecimals = unlockedUserData.vaultToken?.decimals ?? unlockedVault?.decimals ?? 18
  const isLockedUnderlyingDisplay = lockedWithdrawDisplayMode === 'underlying'
  const hasUnlocked = unlockedUserData.depositedShares > 0n
  const hasLocked = lockedWalletShares > 0n

  const { data: rawCooldownDuration } = useReadContract({
    address: YVUSD_LOCKED_ADDRESS,
    abi: yvUsdLockedVaultAbi,
    functionName: 'cooldownDuration',
    chainId,
    query: {
      enabled: isLockedVariant,
      refetchInterval: isLockedVariant ? 60_000 : false
    }
  })
  const { data: rawWithdrawalWindow } = useReadContract({
    address: YVUSD_LOCKED_ADDRESS,
    abi: yvUsdLockedVaultAbi,
    functionName: 'withdrawalWindow',
    chainId,
    query: {
      enabled: isLockedVariant,
      refetchInterval: isLockedVariant ? 60_000 : false
    }
  })
  const {
    data: rawCooldownStatus,
    isLoading: isLoadingCooldownStatus,
    refetch: refetchCooldownStatus
  } = useReadContract({
    address: YVUSD_LOCKED_ADDRESS,
    abi: yvUsdLockedVaultAbi,
    functionName: 'getCooldownStatus',
    args: account ? [toAddress(account)] : undefined,
    chainId,
    query: {
      enabled: !!account && isLockedVariant,
      refetchInterval: isLockedVariant ? 30_000 : false
    }
  })
  const {
    data: rawMaxWithdrawAssets,
    isLoading: isLoadingMaxWithdrawAssets,
    refetch: refetchMaxWithdrawAssets
  } = useReadContract({
    address: YVUSD_LOCKED_ADDRESS,
    abi: erc4626Abi,
    functionName: 'maxWithdraw',
    args: account ? [toAddress(account)] : undefined,
    chainId,
    query: {
      enabled: !!account && isLockedVariant,
      refetchInterval: isLockedVariant ? 30_000 : false
    }
  })

  const cooldownStatus = useMemo(() => parseCooldownStatus(rawCooldownStatus), [rawCooldownStatus])
  const cooldownDurationSeconds = resolveDurationSeconds(rawCooldownDuration, YVUSD_LOCKED_COOLDOWN_DAYS)
  const withdrawalWindowSeconds = resolveDurationSeconds(rawWithdrawalWindow, YVUSD_WITHDRAW_WINDOW_DAYS)
  const cooldownDurationLabel = useMemo(
    () => formatDays(cooldownDurationSeconds, YVUSD_LOCKED_COOLDOWN_DAYS),
    [cooldownDurationSeconds]
  )
  const withdrawalWindowLabel = useMemo(
    () => formatDays(withdrawalWindowSeconds, YVUSD_WITHDRAW_WINDOW_DAYS),
    [withdrawalWindowSeconds]
  )
  const maxWithdrawAssets = typeof rawMaxWithdrawAssets === 'bigint' ? rawMaxWithdrawAssets : 0n

  const hasActiveCooldown = cooldownStatus.shares > 0n
  const { timestamp: nowTimestamp } = useChainTimestamp({
    chainId,
    enabled: isLockedVariant
  })
  const { isCooldownActive, isWithdrawalWindowOpen, isCooldownWindowExpired } = resolveCooldownWindowState({
    hasActiveCooldown,
    nowTimestamp,
    cooldownEnd: cooldownStatus.cooldownEnd,
    windowEnd: cooldownStatus.windowEnd,
    availableWithdrawLimit: maxWithdrawAssets
  })
  const needsCooldownStart = hasLocked && (!hasActiveCooldown || isCooldownWindowExpired)

  const cooldownRemainingSeconds = isCooldownActive ? cooldownStatus.cooldownEnd - nowTimestamp : 0
  const windowRemainingSeconds = isWithdrawalWindowOpen ? cooldownStatus.windowEnd - nowTimestamp : 0
  const sharesUnderCooldown = hasActiveCooldown ? cooldownStatus.shares : 0n
  const assetsUnderCooldown = useMemo(() => {
    if (sharesUnderCooldown <= 0n || lockedUserData.pricePerShare <= 0n) return 0n
    const vaultDecimals = lockedUserData.vaultToken?.decimals ?? 18
    return (sharesUnderCooldown * lockedUserData.pricePerShare) / 10n ** BigInt(vaultDecimals)
  }, [sharesUnderCooldown, lockedUserData.pricePerShare, lockedUserData.vaultToken?.decimals])
  const lockedDisplayAssetDecimals = isLockedUnderlyingDisplay ? unlockedAssetDecimals : lockedAssetDecimals
  const lockedDisplayAssetSymbol = isLockedUnderlyingDisplay
    ? (unlockedUserData.assetToken?.symbol ?? 'USDC')
    : (lockedUserData.assetToken?.symbol ?? 'yvUSD')
  const lockedDisplayPricePerShare = useMemo(
    () =>
      isLockedUnderlyingDisplay
        ? convertYvUsdLockedPricePerShareToUnderlying({
            lockedPricePerShare: lockedUserData.pricePerShare,
            unlockedPricePerShare: unlockedUserData.pricePerShare,
            unlockedVaultDecimals
          })
        : lockedUserData.pricePerShare,
    [isLockedUnderlyingDisplay, lockedUserData.pricePerShare, unlockedUserData.pricePerShare, unlockedVaultDecimals]
  )
  const displayAssetsUnderCooldown = useMemo(
    () =>
      isLockedUnderlyingDisplay
        ? convertYvUsdLockedAssetRawAmountToUnderlying({
            amount: assetsUnderCooldown,
            unlockedPricePerShare: unlockedUserData.pricePerShare,
            unlockedVaultDecimals
          })
        : assetsUnderCooldown,
    [isLockedUnderlyingDisplay, assetsUnderCooldown, unlockedUserData.pricePerShare, unlockedVaultDecimals]
  )

  const formattedSharesUnderCooldown = formatTAmount({
    value: sharesUnderCooldown,
    decimals: lockedUserData.vaultToken?.decimals ?? 18
  })
  const formattedAssetsUnderCooldown = formatTAmount({
    value: displayAssetsUnderCooldown,
    decimals: lockedDisplayAssetDecimals
  })
  const canWithdrawNow = maxWithdrawAssets > 0n
  const hasLockedWithdrawPath = hasLocked || hasActiveCooldown || canWithdrawNow
  const isCooldownDataLoading =
    isLoadingCooldownStatus || isLoadingMaxWithdrawAssets || (isLockedUnderlyingDisplay && unlockedUserData.isLoading)
  const lockedVaultTokenDecimals = lockedUserData.vaultToken?.decimals ?? 18
  const lockedVaultTokenSymbol = lockedUserData.vaultToken?.symbol ?? 'yvUSD (Locked)'
  const { data: rawPreviewRedeemForMaxWithdraw, refetch: refetchPreviewRedeemForMaxWithdraw } = useReadContract({
    address: YVUSD_UNLOCKED_ADDRESS,
    abi: erc4626Abi,
    functionName: 'previewRedeem',
    args: canWithdrawNow ? [maxWithdrawAssets] : undefined,
    chainId,
    query: {
      enabled: !!account && isLockedVariant && canWithdrawNow && maxWithdrawAssets > 0n
    }
  })
  const lockedMaxWithdrawDisplayAmount = useMemo(
    () =>
      resolveLockedWithdrawDisplayAmount({
        maxWithdrawAssets,
        previewRedeemAssets:
          typeof rawPreviewRedeemForMaxWithdraw === 'bigint' ? rawPreviewRedeemForMaxWithdraw : undefined,
        unlockedPricePerShare: unlockedUserData.pricePerShare,
        unlockedVaultDecimals
      }),
    [maxWithdrawAssets, rawPreviewRedeemForMaxWithdraw, unlockedUserData.pricePerShare, unlockedVaultDecimals]
  )
  const formattedAvailableWithdrawLimit = formatTAmount({
    value: lockedMaxWithdrawDisplayAmount,
    decimals: lockedDisplayAssetDecimals
  })

  const cooldownSharesToStart = useMemo(() => {
    if (!needsCooldownStart || lockedRequestedAmountRaw <= 0n) return 0n
    if (lockedUserData.pricePerShare <= 0n) return 0n

    const vaultDecimals = lockedUserData.vaultToken?.decimals ?? 18
    const numerator = lockedRequestedAmountRaw * 10n ** BigInt(vaultDecimals)
    const requiredShares = (numerator + lockedUserData.pricePerShare - 1n) / lockedUserData.pricePerShare
    return requiredShares > lockedWalletShares ? lockedWalletShares : requiredShares
  }, [
    needsCooldownStart,
    lockedRequestedAmountRaw,
    lockedUserData.pricePerShare,
    lockedUserData.vaultToken?.decimals,
    lockedWalletShares
  ])
  const selectedCooldownAssets = useMemo(() => {
    if (cooldownSharesToStart <= 0n || lockedUserData.pricePerShare <= 0n) {
      return 0n
    }
    const vaultDecimals = lockedUserData.vaultToken?.decimals ?? 18
    return (cooldownSharesToStart * lockedUserData.pricePerShare) / 10n ** BigInt(vaultDecimals)
  }, [cooldownSharesToStart, lockedUserData.pricePerShare, lockedUserData.vaultToken?.decimals])
  const selectedCooldownDisplayAssets = useMemo(
    () =>
      isLockedUnderlyingDisplay
        ? convertYvUsdLockedAssetRawAmountToUnderlying({
            amount: selectedCooldownAssets,
            unlockedPricePerShare: unlockedUserData.pricePerShare,
            unlockedVaultDecimals
          })
        : selectedCooldownAssets,
    [isLockedUnderlyingDisplay, selectedCooldownAssets, unlockedUserData.pricePerShare, unlockedVaultDecimals]
  )
  const formattedSelectedCooldownAmount = formatTAmount({
    value: selectedCooldownDisplayAssets,
    decimals: lockedDisplayAssetDecimals
  })
  const cooldownRemainingLabel = getCooldownRemainingLabel(
    isCooldownActive,
    needsCooldownStart,
    cooldownRemainingSeconds
  )
  const withdrawalWindowRemainingLabel = getWithdrawalWindowRemainingLabel(
    isWithdrawalWindowOpen,
    isCooldownActive,
    hasActiveCooldown,
    windowRemainingSeconds
  )

  const prepareStartCooldown: UseSimulateContractReturnType = useSimulateContract({
    address: YVUSD_LOCKED_ADDRESS,
    abi: yvUsdLockedVaultAbi,
    functionName: 'startCooldown',
    args: cooldownSharesToStart > 0n ? [cooldownSharesToStart] : undefined,
    account: account ? toAddress(account) : undefined,
    chainId,
    query: {
      enabled: !!account && isLockedVariant && needsCooldownStart && cooldownSharesToStart > 0n
    }
  })
  const prepareCancelCooldown: UseSimulateContractReturnType = useSimulateContract({
    address: YVUSD_LOCKED_ADDRESS,
    abi: yvUsdLockedVaultAbi,
    functionName: 'cancelCooldown',
    account: account ? toAddress(account) : undefined,
    chainId,
    query: {
      enabled: !!account && isLockedVariant && hasActiveCooldown
    }
  })

  const cooldownStep = useMemo((): TransactionStep | undefined => {
    if (!prepareStartCooldown.isSuccess || !prepareStartCooldown.data?.request) return undefined

    const formattedCooldownShares = formatTAmount({
      value: cooldownSharesToStart,
      decimals: lockedUserData.vaultToken?.decimals ?? 18
    })
    const cooldownConfirmMessage = isLockedUnderlyingDisplay
      ? `Starting cooldown for ${formattedSelectedCooldownAmount} ${lockedDisplayAssetSymbol}`
      : `Starting cooldown for ${formattedCooldownShares} locked shares`

    return {
      prepare: prepareStartCooldown,
      label: 'Start Cooldown',
      confirmMessage: cooldownConfirmMessage,
      successTitle: 'Cooldown started',
      successMessage: `Cooldown has started. Withdrawals become available in ${cooldownDurationLabel}.`,
      notification:
        account && cooldownSharesToStart > 0n
          ? {
              type: 'start cooldown',
              amount: formatTAmount({ value: cooldownSharesToStart, decimals: lockedVaultTokenDecimals }),
              fromAddress: YVUSD_LOCKED_ADDRESS,
              fromSymbol: lockedVaultTokenSymbol,
              fromChainId: chainId
            }
          : undefined
    }
  }, [
    account,
    chainId,
    prepareStartCooldown,
    cooldownDurationLabel,
    cooldownSharesToStart,
    formattedSelectedCooldownAmount,
    isLockedUnderlyingDisplay,
    lockedDisplayAssetSymbol,
    lockedVaultTokenDecimals,
    lockedVaultTokenSymbol
  ])

  const cancelCooldownStep = useMemo((): TransactionStep | undefined => {
    if (!prepareCancelCooldown.isSuccess || !prepareCancelCooldown.data?.request) return undefined

    return {
      prepare: prepareCancelCooldown,
      label: 'Cancel Cooldown',
      confirmMessage: 'Canceling active cooldown for locked yvUSD shares',
      successTitle: 'Cooldown canceled',
      successMessage: 'Cooldown canceled. Start a new cooldown to withdraw from the locked vault.',
      notification:
        account && sharesUnderCooldown > 0n
          ? {
              type: 'cancel cooldown',
              amount: formatTAmount({ value: sharesUnderCooldown, decimals: lockedVaultTokenDecimals }),
              fromAddress: YVUSD_LOCKED_ADDRESS,
              fromSymbol: lockedVaultTokenSymbol,
              fromChainId: chainId
            }
          : undefined
    }
  }, [account, chainId, lockedVaultTokenDecimals, lockedVaultTokenSymbol, prepareCancelCooldown, sharesUnderCooldown])

  useEffect(() => {
    if (variant === null) {
      setVariant(getDefaultVariant(hasLockedWithdrawPath, hasUnlocked))
    }
  }, [hasLockedWithdrawPath, hasUnlocked, variant])

  const lockedDisplayUserData = useMemo(() => {
    if (!isLockedUnderlyingDisplay) {
      return lockedUserData
    }

    return {
      ...lockedUserData,
      assetToken: unlockedUserData.assetToken,
      availableToDeposit: unlockedUserData.availableToDeposit,
      depositedValue: convertYvUsdLockedAssetRawAmountToUnderlying({
        amount: lockedUserData.depositedValue,
        unlockedPricePerShare: unlockedUserData.pricePerShare,
        unlockedVaultDecimals
      }),
      pricePerShare: lockedDisplayPricePerShare,
      isLoading: lockedUserData.isLoading || unlockedUserData.isLoading,
      refetch: (): void => {
        lockedUserData.refetch()
        unlockedUserData.refetch()
      }
    }
  }, [
    isLockedUnderlyingDisplay,
    lockedUserData,
    unlockedUserData,
    unlockedUserData.assetToken,
    unlockedUserData.availableToDeposit,
    unlockedUserData.pricePerShare,
    unlockedVaultDecimals,
    lockedDisplayPricePerShare
  ])

  const { data: rawPreviewWithdrawForRequestedAmount } = useReadContract({
    address: YVUSD_UNLOCKED_ADDRESS,
    abi: erc4626Abi,
    functionName: 'previewWithdraw',
    args: canWithdrawNow && draftWithdrawAmount > 0n ? [draftWithdrawAmount] : undefined,
    chainId,
    query: {
      enabled: !!account && isLockedVariant && canWithdrawNow && draftWithdrawAmount > 0n
    }
  })

  const lockedRequestedWithdrawAssets = useMemo(
    () =>
      resolveLockedRequestedWithdrawAssets({
        requestedDisplayAmount: draftWithdrawAmount,
        maxDisplayAmount: lockedMaxWithdrawDisplayAmount,
        maxWithdrawAssets,
        previewWithdrawShares:
          typeof rawPreviewWithdrawForRequestedAmount === 'bigint' ? rawPreviewWithdrawForRequestedAmount : undefined
      }),
    [draftWithdrawAmount, lockedMaxWithdrawDisplayAmount, maxWithdrawAssets, rawPreviewWithdrawForRequestedAmount]
  )

  const { data: rawPreviewRedeemForRequestedAmount, refetch: refetchPreviewRedeemForRequestedAmount } = useReadContract(
    {
      address: YVUSD_UNLOCKED_ADDRESS,
      abi: erc4626Abi,
      functionName: 'previewRedeem',
      args: lockedRequestedWithdrawAssets > 0n ? [lockedRequestedWithdrawAssets] : undefined,
      chainId,
      query: {
        enabled: !!account && isLockedVariant && canWithdrawNow && lockedRequestedWithdrawAssets > 0n
      }
    }
  )

  const lockedWithdrawExpectedUnderlyingOut = useMemo(
    () =>
      resolveLockedWithdrawExpectedOut({
        requestedLockedAssets: lockedRequestedWithdrawAssets,
        previewRedeemAssets:
          typeof rawPreviewRedeemForRequestedAmount === 'bigint'
            ? rawPreviewRedeemForRequestedAmount
            : lockedRequestedWithdrawAssets === maxWithdrawAssets && typeof rawPreviewRedeemForMaxWithdraw === 'bigint'
              ? rawPreviewRedeemForMaxWithdraw
              : undefined,
        unlockedPricePerShare: unlockedUserData.pricePerShare,
        unlockedVaultDecimals
      }),
    [
      lockedRequestedWithdrawAssets,
      rawPreviewRedeemForRequestedAmount,
      maxWithdrawAssets,
      rawPreviewRedeemForMaxWithdraw,
      unlockedUserData.pricePerShare,
      unlockedVaultDecimals
    ]
  )

  const lockedWithdrawExecutionPlan = useMemo(
    () =>
      buildLockedWithdrawNoZapExecutionPlan({
        account,
        requestedLockedAssets: lockedRequestedWithdrawAssets
      }),
    [account, lockedRequestedWithdrawAssets]
  )
  const lockedWithdrawArgs = lockedWithdrawExecutionPlan[0]?.args
  const unlockedRedeemArgs = lockedWithdrawExecutionPlan[1]?.args

  const prepareLockedWithdrawNow: UseSimulateContractReturnType = useSimulateContract({
    address: YVUSD_LOCKED_ADDRESS,
    abi: erc4626Abi,
    functionName: 'withdraw',
    args: lockedWithdrawArgs,
    account: account ? toAddress(account) : undefined,
    chainId,
    query: {
      enabled:
        !!account &&
        isLockedVariant &&
        canWithdrawNow &&
        lockedWithdrawPhase === 'withdraw' &&
        lockedRequestedWithdrawAssets > 0n
    }
  })

  const prepareUnlockedRedeem: UseSimulateContractReturnType = useSimulateContract({
    address: YVUSD_UNLOCKED_ADDRESS,
    abi: erc4626Abi,
    functionName: 'redeem',
    args: unlockedRedeemArgs,
    account: account ? toAddress(account) : undefined,
    chainId,
    query: {
      enabled:
        !!account &&
        isLockedVariant &&
        canWithdrawNow &&
        lockedWithdrawPhase === 'redeem' &&
        lockedRequestedWithdrawAssets > 0n
    }
  })

  const refetchLockedWithdrawState = useCallback((): void => {
    void refetchCooldownStatus()
    void refetchMaxWithdrawAssets()
    void refetchPreviewRedeemForMaxWithdraw()
    if (lockedRequestedWithdrawAssets > 0n) {
      void refetchPreviewRedeemForRequestedAmount()
    }
    lockedUserData.refetch()
    unlockedUserData.refetch()
  }, [
    refetchCooldownStatus,
    refetchMaxWithdrawAssets,
    refetchPreviewRedeemForMaxWithdraw,
    lockedRequestedWithdrawAssets,
    refetchPreviewRedeemForRequestedAmount,
    lockedUserData,
    unlockedUserData
  ])

  const handleCooldownSuccess = useCallback((): void => {
    setShowCooldownOverlay(false)
    refetchLockedWithdrawState()
  }, [refetchLockedWithdrawState])

  const handleCancelCooldownSuccess = useCallback((): void => {
    setShowCancelCooldownOverlay(false)
    refetchLockedWithdrawState()
  }, [refetchLockedWithdrawState])

  const handleLockedWithdrawStepSuccess = useCallback(
    (label: string): void => {
      if (label !== 'Withdraw to yvUSD') {
        return
      }

      setLockedWithdrawPhase('redeem')
      refetchLockedWithdrawState()
      refreshWalletBalances([
        { address: YVUSD_LOCKED_ADDRESS, chainID: chainId },
        { address: YVUSD_UNLOCKED_ADDRESS, chainID: chainId }
      ])
    },
    [chainId, refetchLockedWithdrawState, refreshWalletBalances]
  )

  const handleLockedWithdrawSuccess = useCallback((): void => {
    refetchLockedWithdrawState()
    refreshWalletBalances([
      { address: YVUSD_LOCKED_ADDRESS, chainID: chainId },
      { address: YVUSD_UNLOCKED_ADDRESS, chainID: chainId },
      { address: unlockedAssetAddress, chainID: chainId }
    ])
    setPendingPrefillAddress(lockedInputAddress)
    setPendingPrefillAmount('')
    setPrefillRequestKey((current) => current + 1)
    setLockedRequestedAmountRaw(0n)
    setDraftWithdrawAmount(0n)
    onWithdrawSuccess?.()
  }, [
    chainId,
    refetchLockedWithdrawState,
    refreshWalletBalances,
    unlockedAssetAddress,
    lockedInputAddress,
    onWithdrawSuccess
  ])

  const handleFillAvailableWithdrawAmount = useCallback((): void => {
    if (!canWithdrawNow || lockedMaxWithdrawDisplayAmount <= 0n) {
      return
    }
    setPendingPrefillAddress(lockedInputAddress)
    setPendingPrefillAmount(formatUnits(lockedMaxWithdrawDisplayAmount, lockedDisplayAssetDecimals))
    setPrefillRequestKey((current) => current + 1)
  }, [canWithdrawNow, lockedMaxWithdrawDisplayAmount, lockedDisplayAssetDecimals, lockedInputAddress])

  const selectedDisplayAssetAddress = isLockedVariant ? lockedInputAddress : unlockedAssetAddress

  const handleVariantChange = useCallback(
    (nextVariant: TYvUsdVariant): void => {
      const currentInputTokenAddress = toAddress(selectedWithdrawTokenAddress ?? selectedDisplayAssetAddress)
      const nextInputTokenAddress = nextVariant === 'locked' ? lockedInputAddress : unlockedAssetAddress
      const currentAmountUnit = getYvUsdAmountUnit(currentInputTokenAddress, unlockedAssetAddress)
      const nextAmountUnit = getYvUsdAmountUnit(nextInputTokenAddress, unlockedAssetAddress)
      const canPreserveRawAmount =
        currentInputTokenAddress === nextInputTokenAddress ||
        (currentAmountUnit !== 'other' && nextAmountUnit !== 'other')
      const shouldConvertAmount =
        draftWithdrawAmount > 0n && canPreserveRawAmount && currentAmountUnit !== nextAmountUnit
      const nextRawAmount = shouldConvertAmount
        ? convertYvUsdInputAmount({
            amount: draftWithdrawAmount,
            fromUnit: currentAmountUnit,
            toUnit: nextAmountUnit,
            unlockedPricePerShare: unlockedUserData.pricePerShare,
            unlockedVaultDecimals
          })
        : canPreserveRawAmount
          ? draftWithdrawAmount
          : 0n
      const nextInputDecimals = nextAmountUnit === 'shares' ? lockedAssetDecimals : unlockedAssetDecimals
      setDraftWithdrawAmount(nextRawAmount)
      setPendingPrefillAmount(nextRawAmount > 0n ? formatUnits(nextRawAmount, nextInputDecimals) : undefined)
      setPendingPrefillAddress(nextVariant === 'locked' ? lockedInputAddress : unlockedAssetAddress)
      const nextLockedRequestedAmount =
        nextVariant === 'locked' && !canWithdrawNow
          ? resolveLockedRequestedAmountFromInput({
              amount: nextRawAmount,
              inputUnit: nextAmountUnit,
              canWithdrawNow,
              lockedDisplayPricePerShare,
              lockedVaultTokenDecimals,
              unlockedPricePerShare: unlockedUserData.pricePerShare,
              unlockedVaultDecimals
            })
          : 0n
      setLockedRequestedAmountRaw(nextLockedRequestedAmount)
      setVariant(nextVariant)
    },
    [
      selectedWithdrawTokenAddress,
      selectedDisplayAssetAddress,
      lockedInputAddress,
      unlockedAssetAddress,
      draftWithdrawAmount,
      unlockedUserData.pricePerShare,
      unlockedVaultDecimals,
      lockedAssetDecimals,
      unlockedAssetDecimals,
      canWithdrawNow,
      lockedDisplayPricePerShare,
      lockedVaultTokenDecimals,
      isLockedVariant
    ]
  )

  const handleAmountChange = useCallback(
    (amount: bigint): void => {
      setDraftWithdrawAmount(amount)
      if (!isLockedVariant || canWithdrawNow) {
        return
      }

      const inputUnit = isLockedUnderlyingDisplay ? 'underlying' : 'shares'
      const nextRequestedAmount = resolveLockedRequestedAmountFromInput({
        amount,
        inputUnit,
        canWithdrawNow,
        lockedDisplayPricePerShare,
        lockedVaultTokenDecimals,
        unlockedPricePerShare: unlockedUserData.pricePerShare,
        unlockedVaultDecimals
      })
      setLockedRequestedAmountRaw(nextRequestedAmount)
    },
    [
      isLockedVariant,
      canWithdrawNow,
      isLockedUnderlyingDisplay,
      lockedDisplayPricePerShare,
      lockedVaultTokenDecimals,
      unlockedUserData.pricePerShare,
      unlockedVaultDecimals
    ]
  )

  useEffect(() => {
    if (!showLockedWithdrawOverlay) {
      setLockedWithdrawPhase('withdraw')
    }
  }, [showLockedWithdrawOverlay])

  if (isLoading || !unlockedVault || !lockedVault) {
    return (
      <div className="p-6 flex items-center justify-center h-[317px]">
        <div className="w-6 h-6 border-2 border-border border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  const selectedVault = isLockedVariant ? lockedVault : unlockedVault
  const selectedRouteAssetAddress = isLockedVariant ? lockedAssetAddress : unlockedAssetAddress
  const selectedVaultUserData = isLockedVariant ? lockedDisplayUserData : unlockedUserData
  const disableLockedAmountInput = isLockedVariant && isCooldownActive && !canWithdrawNow
  const hideLockedWithdrawAction = isLockedVariant && !!account
  const lockedWithdrawInputError =
    !isLockedVariant || !account || draftWithdrawAmount <= 0n
      ? undefined
      : !canWithdrawNow
        ? lockedRequestedAmountRaw > lockedWalletShares
          ? 'Insufficient balance'
          : undefined
        : lockedMaxWithdrawDisplayAmount > 0n && draftWithdrawAmount > lockedMaxWithdrawDisplayAmount
          ? 'Amount exceeds currently available withdraw limit.'
          : undefined
  const lockedReadyWithdrawStep =
    !account || !canWithdrawNow || lockedRequestedWithdrawAssets <= 0n
      ? undefined
      : buildLockedWithdrawTransactionStep({
          phase: lockedWithdrawPhase,
          prepareLockedWithdraw: prepareLockedWithdrawNow,
          prepareUnlockedRedeem: prepareUnlockedRedeem,
          requestedLockedAssets: lockedRequestedWithdrawAssets,
          expectedUnderlyingOut: lockedWithdrawExpectedUnderlyingOut,
          lockedAssetDecimals,
          underlyingDecimals: unlockedAssetDecimals,
          lockedAssetSymbol: lockedUserData.assetToken?.symbol ?? 'yvUSD',
          underlyingSymbol: unlockedUserData.assetToken?.symbol ?? 'USDC'
        })
  const isLockedWithdrawReady =
    draftWithdrawAmount > 0n &&
    !lockedWithdrawInputError &&
    !!lockedReadyWithdrawStep?.prepare.isSuccess &&
    !!lockedReadyWithdrawStep.prepare.data?.request
  const formattedLockedRequestedWithdrawAssets = formatTAmount({
    value: lockedRequestedWithdrawAssets,
    decimals: lockedAssetDecimals
  })
  const formattedLockedWithdrawExpectedOut = formatTAmount({
    value: lockedWithdrawExpectedUnderlyingOut,
    decimals: unlockedAssetDecimals
  })

  const withdrawPrefill = getWithdrawPrefill(
    activeVariant,
    lockedInputAddress,
    pendingPrefillAddress,
    unlockedAssetAddress,
    chainId,
    pendingPrefillAmount
  )
  const showLockedWithdrawAction = !!account && canWithdrawNow && !isCooldownDataLoading
  const showStartCooldownActions =
    !!account && hasLocked && !isCooldownDataLoading && needsCooldownStart && !canWithdrawNow
  const showCancelCooldownAction =
    !!account && hasLocked && hasActiveCooldown && !isCooldownDataLoading && !isWithdrawalWindowOpen
  const showInlineResetCooldownAction =
    !!account && hasLocked && hasActiveCooldown && !isCooldownDataLoading && isWithdrawalWindowOpen
  const isStartCooldownPending = prepareStartCooldown.isLoading || prepareStartCooldown.isFetching
  const isCancelCooldownPending = prepareCancelCooldown.isLoading || prepareCancelCooldown.isFetching

  let cooldownStatusContent: ReactElement
  if (!account) {
    cooldownStatusContent = <p>{'Connect wallet to view cooldown status.'}</p>
  } else if (!hasLockedWithdrawPath) {
    cooldownStatusContent = <p>{'No locked balance found in this wallet.'}</p>
  } else if (isCooldownDataLoading) {
    cooldownStatusContent = <p>{'Loading cooldown status...'}</p>
  } else {
    cooldownStatusContent = (
      <>
        {canWithdrawNow ? (
          <p className="flex flex-wrap items-center gap-1">
            <span>{'Available to withdraw now:'}</span>
            <button
              type="button"
              onClick={handleFillAvailableWithdrawAmount}
              className="font-semibold text-text-primary underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-colors hover:text-primary hover:decoration-neutral-600"
            >
              {`${formattedAvailableWithdrawLimit} ${lockedDisplayAssetSymbol}`}
            </button>
          </p>
        ) : hasActiveCooldown ? (
          isLockedUnderlyingDisplay ? (
            <p>{`Amount in cooldown: ${formattedAssetsUnderCooldown} ${lockedDisplayAssetSymbol}`}</p>
          ) : (
            <>
              <p>{`Shares in cooldown: ${formattedSharesUnderCooldown}`}</p>
              <p>{`Estimated assets in cooldown: ${formattedAssetsUnderCooldown} ${lockedDisplayAssetSymbol}`}</p>
            </>
          )
        ) : null}
        {needsCooldownStart ? (
          <p>{`Selected cooldown amount: ${formattedSelectedCooldownAmount} ${lockedDisplayAssetSymbol}`}</p>
        ) : null}
        <p className="flex items-center gap-2">
          <span>{'Cooldown remaining:'}</span>
          {isWithdrawalWindowOpen ? (
            <span className="inline-flex items-center gap-1 text-text-primary">
              <span>{'Complete'}</span>
              <IconCheck className="size-3 text-green-600" />
              {showInlineResetCooldownAction ? (
                <button
                  type="button"
                  onClick={() => setShowCancelCooldownOverlay(true)}
                  disabled={!cancelCooldownStep || isCancelCooldownPending}
                  className="text-xs font-medium text-text-secondary underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-colors hover:text-text-primary hover:decoration-neutral-600 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60"
                >
                  {'reset'}
                </button>
              ) : null}
            </span>
          ) : (
            <span>{cooldownRemainingLabel}</span>
          )}
        </p>
        <p>{`Withdrawal window remaining: ${withdrawalWindowRemainingLabel}`}</p>
      </>
    )
  }

  const withdrawTypeSection = isLockedVariant ? (
    <div className="rounded-lg border border-border bg-surface-secondary mt-3 p-4 text-sm">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-text-primary">{'Locked withdrawal cooldown'}</p>
          <button
            type="button"
            onClick={() => setShowCooldownInfoOverlay(true)}
            className="text-xs font-medium text-text-secondary underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-colors hover:text-text-primary hover:decoration-neutral-600"
          >
            {'more info'}
          </button>
        </div>
        <p className="text-sm text-text-secondary">
          {`Cooldown: ${cooldownDurationLabel} | Withdrawal window: ${withdrawalWindowLabel}`}
        </p>
      </div>
      <div className="mt-3 flex flex-col gap-1 text-sm text-text-secondary">{cooldownStatusContent}</div>
      {showLockedWithdrawAction ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-secondary">
            <p>{'This experiment exits in two direct vault calls instead of the locked zap.'}</p>
            {draftWithdrawAmount > 0n ? (
              <>
                <p>{`Step 1: withdraw ${formattedLockedRequestedWithdrawAssets} yvUSD from the locked vault.`}</p>
                <p>{`Step 2: redeem to ${formattedLockedWithdrawExpectedOut} ${unlockedUserData.assetToken?.symbol ?? 'USDC'}.`}</p>
              </>
            ) : (
              <p>{'Enter a USDC amount to prepare the withdraw chain.'}</p>
            )}
          </div>
          <Button
            variant="filled"
            disabled={!isLockedWithdrawReady}
            classNameOverride="yearn--button--nextgen w-full"
            onClick={() => {
              setLockedWithdrawPhase('withdraw')
              setShowLockedWithdrawOverlay(true)
            }}
          >
            {'Withdraw'}
          </Button>
        </div>
      ) : showStartCooldownActions || showCancelCooldownAction ? (
        <div className={showStartCooldownActions ? 'mt-3 space-y-2' : 'mt-3'}>
          {showStartCooldownActions ? (
            <Button
              variant={isStartCooldownPending ? 'busy' : 'filled'}
              isBusy={isStartCooldownPending}
              disabled={!cooldownStep || !!lockedWithdrawInputError}
              classNameOverride="yearn--button--nextgen w-full"
              onClick={() => setShowCooldownOverlay(true)}
            >
              {'Start Cooldown'}
            </Button>
          ) : null}
          {showCancelCooldownAction ? (
            <Button
              variant={isCancelCooldownPending ? 'busy' : 'outlined'}
              isBusy={isCancelCooldownPending}
              disabled={!cancelCooldownStep}
              classNameOverride="yearn--button--nextgen w-full"
              onClick={() => setShowCancelCooldownOverlay(true)}
            >
              {'Cancel Cooldown'}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  ) : undefined

  return (
    <div className="relative flex flex-col gap-0">
      <WidgetWithdraw
        key={`${selectedVault.address}-${selectedDisplayAssetAddress}`}
        vaultAddress={toAddress(selectedVault.address)}
        assetAddress={selectedRouteAssetAddress}
        displayAssetAddress={selectedDisplayAssetAddress}
        chainId={chainId}
        vaultSymbol={getYvUsdWithdrawSymbol(activeVariant)}
        vaultVersion={selectedVault.version}
        vaultUserData={selectedVaultUserData}
        maxWithdrawAssets={isLockedVariant && account && canWithdrawNow ? lockedMaxWithdrawDisplayAmount : undefined}
        customErrorMessage={isLockedVariant && account ? lockedWithdrawInputError : undefined}
        disableFlow={isLockedVariant && !!account}
        disableTokenSelector={isLockedVariant}
        disableAmountInput={disableLockedAmountInput}
        hideActionButton={hideLockedWithdrawAction}
        headerActions={<YvUsdVariantToggle activeVariant={activeVariant} onChange={handleVariantChange} />}
        onAmountChange={handleAmountChange}
        onTokenSelectionChange={setSelectedWithdrawTokenAddress}
        handleWithdrawSuccess={isLockedVariant ? handleLockedWithdrawSuccess : onWithdrawSuccess}
        hideContainerBorder
        contentBelowInput={withdrawTypeSection}
        collapseDetails={collapseDetails}
        prefill={withdrawPrefill}
        prefillRequestKey={`${activeVariant}-${prefillRequestKey}`}
        onPrefillApplied={() => {
          setPendingPrefillAmount(undefined)
          setPendingPrefillAddress(undefined)
        }}
      />
      <TransactionOverlay
        isOpen={showCooldownOverlay}
        onClose={() => setShowCooldownOverlay(false)}
        step={cooldownStep}
        isLastStep
        onAllComplete={handleCooldownSuccess}
      />
      <TransactionOverlay
        isOpen={showCancelCooldownOverlay}
        onClose={() => setShowCancelCooldownOverlay(false)}
        step={cancelCooldownStep}
        isLastStep
        onAllComplete={handleCancelCooldownSuccess}
      />
      <TransactionOverlay
        isOpen={showLockedWithdrawOverlay}
        onClose={() => setShowLockedWithdrawOverlay(false)}
        step={lockedReadyWithdrawStep}
        isLastStep={lockedWithdrawPhase === 'redeem'}
        autoContinueToNextStep
        autoContinueStepLabels={['Withdraw to yvUSD']}
        onStepSuccess={handleLockedWithdrawStepSuccess}
        onAllComplete={handleLockedWithdrawSuccess}
      />
      <InfoOverlay
        isOpen={showCooldownInfoOverlay}
        onClose={() => setShowCooldownInfoOverlay(false)}
        title="Cooldown info"
      >
        <div className="space-y-3 text-sm text-text-secondary">
          <p>{'Locked yvUSD withdrawals use a cooldown period before the withdrawal window opens.'}</p>
          <p>{'Interest continues to accrue while your position is in cooldown.'}</p>
          <p>
            {
              'If only part of your deposited amount is in cooldown and you want to include more funds, cancel the current cooldown and restart it with the larger amount.'
            }
          </p>
          <p>{`Cooldown period: ${cooldownDurationLabel}. Withdrawal window: ${withdrawalWindowLabel}.`}</p>
        </div>
      </InfoOverlay>
    </div>
  )
}
