import { useVaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import { useYvUsdVaults } from '@pages/vaults/hooks/useYvUsdVaults'
import {
  convertYvUsdLockedAssetRawAmountToUnderlying,
  convertYvUsdLockedPricePerShareToUnderlying,
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
import { type AppUseSimulateContractReturnType, useReadContract, useSimulateContract } from '@shared/hooks/useAppWagmi'
import { useChainTimestamp } from '@shared/hooks/useChainTimestamp'
import { IconCheck } from '@shared/icons/IconCheck'
import { formatTAmount, toAddress } from '@shared/utils'
import type { ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import { useAccount } from 'wagmi'
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
  getLockedCooldownMaxAssetAmount,
  getLockedCooldownMaxDisplayAmount,
  resolveCooldownSharesToStart,
  resolveLockedRedeemAssets,
  resolveLockedRequestedAmountFromInput,
  resolveLockedRequestedWithdrawAssets,
  resolveLockedRequestedWithdrawShares,
  resolveLockedWithdrawDisplayAmount,
  resolveLockedWithdrawExecutionSnapshot,
  resolveLockedWithdrawExpectedOut,
  resolveLockedWithdrawMethod,
  shouldNormalizeLockedWithdrawDisplayAmount,
  shouldUseLockedManagedWithdrawFlow,
  type TLockedWithdrawExecutionSnapshot
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
  const [lockedWithdrawPhase, setLockedWithdrawPhase] = useState<'withdraw' | 'redeem'>('withdraw')
  const [lockedWithdrawExecutionSnapshot, setLockedWithdrawExecutionSnapshot] =
    useState<TLockedWithdrawExecutionSnapshot | null>(null)
  const [selectedLockedWithdrawTokenAddress, setSelectedLockedWithdrawTokenAddress] = useState<
    `0x${string}` | undefined
  >(undefined)
  const [selectedLockedWithdrawChainId, setSelectedLockedWithdrawChainId] = useState<number | undefined>(undefined)
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
  const { data: rawMaxRedeemShares, refetch: refetchMaxRedeemShares } = useReadContract({
    address: YVUSD_LOCKED_ADDRESS,
    abi: erc4626Abi,
    functionName: 'maxRedeem',
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
  const maxRedeemShares = typeof rawMaxRedeemShares === 'bigint' ? rawMaxRedeemShares : 0n

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
  const maxCooldownAssetAmount = useMemo(
    () =>
      getLockedCooldownMaxAssetAmount({
        lockedWalletShares,
        lockedPricePerShare: lockedUserData.pricePerShare,
        lockedVaultTokenDecimals
      }),
    [lockedWalletShares, lockedUserData.pricePerShare, lockedVaultTokenDecimals]
  )
  const maxCooldownDisplayAmount = useMemo(
    () =>
      getLockedCooldownMaxDisplayAmount({
        maxCooldownAssetAmount,
        isLockedUnderlyingDisplay,
        unlockedPricePerShare: unlockedUserData.pricePerShare,
        unlockedVaultDecimals
      }),
    [maxCooldownAssetAmount, isLockedUnderlyingDisplay, unlockedUserData.pricePerShare, unlockedVaultDecimals]
  )
  const { data: rawPreviewWithdrawForRequestedAmount, refetch: refetchPreviewWithdrawForRequestedAmount } =
    useReadContract({
      address: YVUSD_UNLOCKED_ADDRESS,
      abi: erc4626Abi,
      functionName: 'previewWithdraw',
      args:
        isLockedVariant &&
        draftWithdrawAmount > 0n &&
        (canWithdrawNow || (!canWithdrawNow && needsCooldownStart && isLockedUnderlyingDisplay))
          ? [draftWithdrawAmount]
          : undefined,
      chainId,
      query: {
        enabled:
          !!account &&
          isLockedVariant &&
          draftWithdrawAmount > 0n &&
          (canWithdrawNow || (!canWithdrawNow && needsCooldownStart && isLockedUnderlyingDisplay))
      }
    })
  const lockedRequestedCooldownAssets = useMemo(() => {
    if (!isLockedVariant || canWithdrawNow) {
      return 0n
    }

    const inputUnit = isLockedUnderlyingDisplay ? 'underlying' : 'shares'
    return resolveLockedRequestedAmountFromInput({
      amount: draftWithdrawAmount,
      inputUnit,
      canWithdrawNow,
      needsCooldownStart,
      maxCooldownDisplayAmount,
      maxCooldownAssetAmount,
      previewWithdrawLockedAssets:
        typeof rawPreviewWithdrawForRequestedAmount === 'bigint' ? rawPreviewWithdrawForRequestedAmount : undefined,
      lockedDisplayPricePerShare,
      lockedVaultTokenDecimals,
      unlockedPricePerShare: unlockedUserData.pricePerShare,
      unlockedVaultDecimals
    })
  }, [
    isLockedVariant,
    canWithdrawNow,
    isLockedUnderlyingDisplay,
    draftWithdrawAmount,
    needsCooldownStart,
    maxCooldownDisplayAmount,
    maxCooldownAssetAmount,
    rawPreviewWithdrawForRequestedAmount,
    lockedDisplayPricePerShare,
    lockedVaultTokenDecimals,
    unlockedUserData.pricePerShare,
    unlockedVaultDecimals
  ])
  const { data: rawPreviewWithdrawSharesForRequestedCooldownAmount } = useReadContract({
    address: YVUSD_LOCKED_ADDRESS,
    abi: erc4626Abi,
    functionName: 'previewWithdraw',
    args:
      !!account && isLockedVariant && !canWithdrawNow && needsCooldownStart && lockedRequestedCooldownAssets > 0n
        ? [lockedRequestedCooldownAssets]
        : undefined,
    chainId,
    query: {
      enabled:
        !!account && isLockedVariant && !canWithdrawNow && needsCooldownStart && lockedRequestedCooldownAssets > 0n
    }
  })

  const cooldownSharesToStart = useMemo(() => {
    return resolveCooldownSharesToStart({
      needsCooldownStart,
      lockedRequestedAmountRaw: lockedRequestedCooldownAssets,
      maxCooldownAssetAmount,
      previewWithdrawShares:
        typeof rawPreviewWithdrawSharesForRequestedCooldownAmount === 'bigint'
          ? rawPreviewWithdrawSharesForRequestedCooldownAmount
          : undefined,
      lockedPricePerShare: lockedUserData.pricePerShare,
      lockedVaultTokenDecimals,
      lockedWalletShares
    })
  }, [
    needsCooldownStart,
    lockedRequestedCooldownAssets,
    maxCooldownAssetAmount,
    rawPreviewWithdrawSharesForRequestedCooldownAmount,
    lockedUserData.pricePerShare,
    lockedVaultTokenDecimals,
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

  const prepareStartCooldown: AppUseSimulateContractReturnType = useSimulateContract({
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
  const prepareCancelCooldown: AppUseSimulateContractReturnType = useSimulateContract({
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
  const {
    data: rawPreviewWithdrawLockedSharesForRequestedAssets,
    refetch: refetchPreviewWithdrawLockedSharesForRequestedAssets
  } = useReadContract({
    address: YVUSD_LOCKED_ADDRESS,
    abi: erc4626Abi,
    functionName: 'previewWithdraw',
    args:
      !!account && isLockedVariant && canWithdrawNow && lockedRequestedWithdrawAssets > 0n
        ? [lockedRequestedWithdrawAssets]
        : undefined,
    chainId,
    query: {
      enabled: !!account && isLockedVariant && canWithdrawNow && lockedRequestedWithdrawAssets > 0n
    }
  })
  const lockedRequestedWithdrawShares = useMemo(
    () =>
      resolveLockedRequestedWithdrawShares({
        requestedLockedAssets: lockedRequestedWithdrawAssets,
        maxWithdrawAssets,
        maxRedeemShares,
        previewWithdrawShares:
          typeof rawPreviewWithdrawLockedSharesForRequestedAssets === 'bigint'
            ? rawPreviewWithdrawLockedSharesForRequestedAssets
            : undefined,
        lockedPricePerShare: lockedUserData.pricePerShare,
        lockedVaultTokenDecimals
      }),
    [
      lockedRequestedWithdrawAssets,
      maxWithdrawAssets,
      maxRedeemShares,
      rawPreviewWithdrawLockedSharesForRequestedAssets,
      lockedUserData.pricePerShare,
      lockedVaultTokenDecimals
    ]
  )

  const hasLockedWithdrawExecutionSnapshot = lockedWithdrawExecutionSnapshot !== null
  const executionRequestedLockedShares =
    lockedWithdrawExecutionSnapshot?.requestedLockedShares ?? lockedRequestedWithdrawShares
  const isExecutingLockedWithdrawRedeem = lockedWithdrawPhase === 'redeem' && hasLockedWithdrawExecutionSnapshot
  const {
    data: rawPreviewRedeemLockedAssetsForQuotedShares,
    refetch: refetchPreviewRedeemLockedAssetsForQuotedShares
  } = useReadContract({
    address: YVUSD_LOCKED_ADDRESS,
    abi: erc4626Abi,
    functionName: 'previewRedeem',
    args: executionRequestedLockedShares > 0n ? [executionRequestedLockedShares] : undefined,
    chainId,
    query: {
      enabled:
        !!account &&
        isLockedVariant &&
        executionRequestedLockedShares > 0n &&
        (canWithdrawNow || isExecutingLockedWithdrawRedeem)
    }
  })
  const quotedLockedWithdrawRedeemAssets = useMemo(
    () =>
      resolveLockedRedeemAssets({
        requestedLockedShares: executionRequestedLockedShares,
        maxWithdrawAssets,
        maxRedeemShares,
        previewRedeemAssets:
          typeof rawPreviewRedeemLockedAssetsForQuotedShares === 'bigint'
            ? rawPreviewRedeemLockedAssetsForQuotedShares
            : undefined,
        lockedPricePerShare: lockedUserData.pricePerShare,
        lockedVaultTokenDecimals
      }),
    [
      executionRequestedLockedShares,
      maxWithdrawAssets,
      maxRedeemShares,
      rawPreviewRedeemLockedAssetsForQuotedShares,
      lockedUserData.pricePerShare,
      lockedVaultTokenDecimals
    ]
  )
  const currentLockedWithdrawMethod = useMemo(
    () =>
      resolveLockedWithdrawMethod({
        requestedLockedAssets: lockedRequestedWithdrawAssets,
        requestedLockedShares: lockedRequestedWithdrawShares,
        redeemableLockedAssets: quotedLockedWithdrawRedeemAssets
      }),
    [lockedRequestedWithdrawAssets, lockedRequestedWithdrawShares, quotedLockedWithdrawRedeemAssets]
  )
  const currentReceivedLockedAssets = useMemo(() => {
    if (currentLockedWithdrawMethod === 'withdraw') {
      return lockedRequestedWithdrawAssets
    }

    return quotedLockedWithdrawRedeemAssets
  }, [currentLockedWithdrawMethod, lockedRequestedWithdrawAssets, quotedLockedWithdrawRedeemAssets])
  const {
    lockedStepMethod: executionLockedWithdrawMethod,
    requestedLockedAssets: executionRequestedLockedAssets,
    requestedLockedShares: executionLockedWithdrawShares,
    receivedLockedAssets: executionLockedWithdrawAssets
  } = useMemo(
    () =>
      resolveLockedWithdrawExecutionSnapshot({
        executionSnapshot: lockedWithdrawExecutionSnapshot,
        currentLockedWithdrawMethod,
        currentRequestedLockedAssets: lockedRequestedWithdrawAssets,
        currentRequestedLockedShares: lockedRequestedWithdrawShares,
        currentReceivedLockedAssets
      }),
    [
      lockedWithdrawExecutionSnapshot,
      currentLockedWithdrawMethod,
      lockedRequestedWithdrawAssets,
      lockedRequestedWithdrawShares,
      currentReceivedLockedAssets
    ]
  )
  const { data: rawPreviewRedeemForQuotedAmount, refetch: refetchPreviewRedeemForQuotedAmount } = useReadContract({
    address: YVUSD_UNLOCKED_ADDRESS,
    abi: erc4626Abi,
    functionName: 'previewRedeem',
    args: executionLockedWithdrawAssets > 0n ? [executionLockedWithdrawAssets] : undefined,
    chainId,
    query: {
      enabled:
        !!account &&
        isLockedVariant &&
        executionLockedWithdrawAssets > 0n &&
        (canWithdrawNow || isExecutingLockedWithdrawRedeem)
    }
  })

  const quotedUnderlyingWithdrawAssets = useMemo(() => {
    if (executionLockedWithdrawAssets <= 0n) {
      return 0n
    }

    if (typeof rawPreviewRedeemForQuotedAmount === 'bigint') {
      return rawPreviewRedeemForQuotedAmount
    }

    if (executionLockedWithdrawAssets === maxWithdrawAssets && typeof rawPreviewRedeemForMaxWithdraw === 'bigint') {
      return rawPreviewRedeemForMaxWithdraw
    }

    return 0n
  }, [
    executionLockedWithdrawAssets,
    rawPreviewRedeemForQuotedAmount,
    maxWithdrawAssets,
    rawPreviewRedeemForMaxWithdraw
  ])

  const lockedWithdrawExpectedUnderlyingOut = useMemo(
    () =>
      resolveLockedWithdrawExpectedOut({
        requestedLockedAssets: executionLockedWithdrawAssets,
        previewRedeemAssets:
          typeof rawPreviewRedeemForQuotedAmount === 'bigint'
            ? rawPreviewRedeemForQuotedAmount
            : executionLockedWithdrawAssets === maxWithdrawAssets && typeof rawPreviewRedeemForMaxWithdraw === 'bigint'
              ? rawPreviewRedeemForMaxWithdraw
              : undefined,
        unlockedPricePerShare: unlockedUserData.pricePerShare,
        unlockedVaultDecimals
      }),
    [
      executionLockedWithdrawAssets,
      rawPreviewRedeemForQuotedAmount,
      maxWithdrawAssets,
      rawPreviewRedeemForMaxWithdraw,
      unlockedUserData.pricePerShare,
      unlockedVaultDecimals
    ]
  )
  const executionUnderlyingWithdrawAssets = quotedUnderlyingWithdrawAssets
  const executionExpectedUnderlyingOut = lockedWithdrawExpectedUnderlyingOut

  const lockedWithdrawExecutionPlan = useMemo(
    () =>
      buildLockedWithdrawNoZapExecutionPlan({
        account,
        lockedStepMethod: executionLockedWithdrawMethod,
        requestedLockedAssets: executionRequestedLockedAssets,
        requestedLockedShares: executionLockedWithdrawShares,
        requestedUnderlyingAssets: executionUnderlyingWithdrawAssets
      }),
    [
      account,
      executionLockedWithdrawMethod,
      executionRequestedLockedAssets,
      executionLockedWithdrawShares,
      executionUnderlyingWithdrawAssets
    ]
  )
  const lockedWithdrawArgs = lockedWithdrawExecutionPlan[0]?.args
  const unlockedWithdrawArgs = lockedWithdrawExecutionPlan[1]?.args

  const prepareLockedRedeemNow: AppUseSimulateContractReturnType = useSimulateContract({
    address: YVUSD_LOCKED_ADDRESS,
    abi: erc4626Abi,
    functionName: 'redeem',
    args: lockedWithdrawArgs,
    account: account ? toAddress(account) : undefined,
    chainId,
    query: {
      enabled:
        !!account &&
        isLockedVariant &&
        canWithdrawNow &&
        lockedWithdrawPhase === 'withdraw' &&
        executionLockedWithdrawMethod === 'redeem' &&
        executionLockedWithdrawShares > 0n
    }
  })
  const prepareLockedWithdrawNow: AppUseSimulateContractReturnType = useSimulateContract({
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
        executionLockedWithdrawMethod === 'withdraw' &&
        executionLockedWithdrawAssets > 0n
    }
  })
  const prepareLockedWithdrawStep =
    executionLockedWithdrawMethod === 'redeem' ? prepareLockedRedeemNow : prepareLockedWithdrawNow

  const prepareUnlockedWithdraw: AppUseSimulateContractReturnType = useSimulateContract({
    address: YVUSD_UNLOCKED_ADDRESS,
    abi: erc4626Abi,
    functionName: 'withdraw',
    args: unlockedWithdrawArgs,
    account: account ? toAddress(account) : undefined,
    chainId,
    query: {
      enabled:
        !!account &&
        isLockedVariant &&
        lockedWithdrawPhase === 'redeem' &&
        hasLockedWithdrawExecutionSnapshot &&
        executionUnderlyingWithdrawAssets > 0n
    }
  })

  const refetchLockedWithdrawState = useCallback((): void => {
    void refetchCooldownStatus()
    void refetchMaxWithdrawAssets()
    void refetchMaxRedeemShares()
    void refetchPreviewRedeemForMaxWithdraw()
    if (draftWithdrawAmount > 0n) {
      void refetchPreviewWithdrawForRequestedAmount()
      void refetchPreviewWithdrawLockedSharesForRequestedAssets()
    }
    if (executionLockedWithdrawShares > 0n) {
      void refetchPreviewRedeemLockedAssetsForQuotedShares()
    }
    if (executionLockedWithdrawAssets > 0n) {
      void refetchPreviewRedeemForQuotedAmount()
    }
    lockedUserData.refetch()
    unlockedUserData.refetch()
  }, [
    refetchCooldownStatus,
    refetchMaxWithdrawAssets,
    refetchMaxRedeemShares,
    refetchPreviewRedeemForMaxWithdraw,
    draftWithdrawAmount,
    refetchPreviewWithdrawForRequestedAmount,
    refetchPreviewWithdrawLockedSharesForRequestedAssets,
    executionLockedWithdrawShares,
    refetchPreviewRedeemLockedAssetsForQuotedShares,
    executionLockedWithdrawAssets,
    refetchPreviewRedeemForQuotedAmount,
    lockedUserData,
    unlockedUserData
  ])

  const handleCooldownSuccess = useCallback((): void => {
    setShowCooldownOverlay(false)
    setDraftWithdrawAmount(selectedCooldownDisplayAssets)
    setPendingPrefillAddress(lockedInputAddress)
    setPendingPrefillAmount(formatUnits(selectedCooldownDisplayAssets, lockedDisplayAssetDecimals))
    setPrefillRequestKey((current) => current + 1)
    refetchLockedWithdrawState()
  }, [refetchLockedWithdrawState, selectedCooldownDisplayAssets, lockedInputAddress, lockedDisplayAssetDecimals])

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

  const handleLockedWithdrawBeforeSuccess = useCallback(
    async (_label: string): Promise<void> => {
      refetchLockedWithdrawState()
      await refreshWalletBalances([
        { address: YVUSD_LOCKED_ADDRESS, chainID: chainId },
        { address: YVUSD_UNLOCKED_ADDRESS, chainID: chainId },
        { address: unlockedAssetAddress, chainID: chainId }
      ])
    },
    [chainId, refetchLockedWithdrawState, refreshWalletBalances, unlockedAssetAddress]
  )

  const handleLockedWithdrawSuccess = useCallback((): void => {
    setPendingPrefillAddress(lockedInputAddress)
    setPendingPrefillAmount('')
    setPrefillRequestKey((current) => current + 1)
    setLockedWithdrawExecutionSnapshot(null)
    setDraftWithdrawAmount(0n)
    onWithdrawSuccess?.()
  }, [lockedInputAddress, onWithdrawSuccess])

  const handleFillAvailableWithdrawAmount = useCallback((): void => {
    if (!canWithdrawNow || lockedMaxWithdrawDisplayAmount <= 0n) {
      return
    }
    setPendingPrefillAddress(lockedInputAddress)
    setPendingPrefillAmount(formatUnits(lockedMaxWithdrawDisplayAmount, lockedDisplayAssetDecimals))
    setPrefillRequestKey((current) => current + 1)
  }, [canWithdrawNow, lockedMaxWithdrawDisplayAmount, lockedDisplayAssetDecimals, lockedInputAddress])

  const selectedDisplayAssetAddress = isLockedVariant ? lockedInputAddress : unlockedAssetAddress

  const handleVariantChange = useCallback((nextVariant: TYvUsdVariant): void => {
    setDraftWithdrawAmount(0n)
    setPendingPrefillAmount(undefined)
    setPendingPrefillAddress(undefined)
    setSelectedLockedWithdrawTokenAddress(undefined)
    setSelectedLockedWithdrawChainId(undefined)
    setVariant(nextVariant)
  }, [])

  const handleAmountChange = useCallback((amount: bigint): void => {
    setDraftWithdrawAmount(amount)
  }, [])
  const handleLockedWithdrawTokenSelectionChange = useCallback((address: `0x${string}`, nextChainId: number): void => {
    setSelectedLockedWithdrawTokenAddress(address)
    setSelectedLockedWithdrawChainId(nextChainId)
  }, [])

  useEffect(() => {
    if (!showLockedWithdrawOverlay) {
      setLockedWithdrawPhase('withdraw')
      setLockedWithdrawExecutionSnapshot(null)
    }
  }, [showLockedWithdrawOverlay])

  const shouldNormalizeLockedWithdrawMaxInput = shouldNormalizeLockedWithdrawDisplayAmount({
    canWithdrawNow: isLockedVariant && canWithdrawNow,
    currentDisplayAmount: draftWithdrawAmount,
    maxDisplayAmount: lockedMaxWithdrawDisplayAmount,
    requestedLockedAssets: lockedRequestedWithdrawAssets,
    maxWithdrawAssets
  })

  useEffect(() => {
    if (!shouldNormalizeLockedWithdrawMaxInput) {
      return
    }

    setDraftWithdrawAmount(lockedMaxWithdrawDisplayAmount)
    setPendingPrefillAddress(lockedInputAddress)
    setPendingPrefillAmount(formatUnits(lockedMaxWithdrawDisplayAmount, lockedDisplayAssetDecimals))
    setPrefillRequestKey((current) => current + 1)
  }, [
    shouldNormalizeLockedWithdrawMaxInput,
    lockedMaxWithdrawDisplayAmount,
    lockedInputAddress,
    lockedDisplayAssetDecimals
  ])

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
  const usesLockedManagedWithdrawFlow =
    isLockedVariant &&
    !!account &&
    shouldUseLockedManagedWithdrawFlow({
      canWithdrawNow,
      selectedTokenAddress: selectedLockedWithdrawTokenAddress,
      selectedChainId: selectedLockedWithdrawChainId,
      chainId,
      underlyingAssetAddress: unlockedAssetAddress
    })
  const disableLockedAmountInput = isLockedVariant && isCooldownActive && !canWithdrawNow
  const hideLockedWithdrawAction = usesLockedManagedWithdrawFlow
  const lockedWithdrawInputError =
    !isLockedVariant || !account || draftWithdrawAmount <= 0n
      ? undefined
      : !canWithdrawNow
        ? maxCooldownAssetAmount > 0n && lockedRequestedCooldownAssets > maxCooldownAssetAmount
          ? 'Insufficient balance'
          : undefined
        : !shouldNormalizeLockedWithdrawMaxInput &&
            lockedMaxWithdrawDisplayAmount > 0n &&
            draftWithdrawAmount > lockedMaxWithdrawDisplayAmount
          ? 'Amount exceeds currently available withdraw limit.'
          : undefined
  const lockedReadyWithdrawStep =
    !account ||
    executionLockedWithdrawAssets <= 0n ||
    (lockedWithdrawPhase === 'withdraw' && !canWithdrawNow) ||
    (lockedWithdrawPhase === 'redeem' && !hasLockedWithdrawExecutionSnapshot) ||
    executionUnderlyingWithdrawAssets <= 0n
      ? undefined
      : buildLockedWithdrawTransactionStep({
          phase: lockedWithdrawPhase,
          lockedStepMethod: executionLockedWithdrawMethod,
          prepareLockedWithdraw: prepareLockedWithdrawStep,
          prepareUnlockedWithdraw: prepareUnlockedWithdraw,
          requestedLockedShares: executionLockedWithdrawShares,
          receivedLockedAssets: executionLockedWithdrawAssets,
          expectedUnderlyingOut: executionExpectedUnderlyingOut,
          lockedVaultTokenDecimals,
          lockedAssetDecimals,
          underlyingDecimals: unlockedAssetDecimals,
          lockedVaultTokenSymbol,
          lockedAssetSymbol: lockedUserData.assetToken?.symbol ?? 'yvUSD',
          underlyingSymbol: unlockedUserData.assetToken?.symbol ?? 'USDC'
        })
  const isLockedWithdrawReady =
    draftWithdrawAmount > 0n &&
    (currentLockedWithdrawMethod === 'redeem'
      ? lockedRequestedWithdrawShares > 0n && lockedRequestedWithdrawShares <= maxRedeemShares
      : lockedRequestedWithdrawAssets > 0n && lockedRequestedWithdrawAssets <= maxWithdrawAssets) &&
    executionUnderlyingWithdrawAssets > 0n &&
    !lockedWithdrawInputError &&
    !!lockedReadyWithdrawStep?.prepare.isSuccess &&
    !!lockedReadyWithdrawStep.prepare.data?.request

  const withdrawPrefill = getWithdrawPrefill(
    activeVariant,
    lockedInputAddress,
    pendingPrefillAddress,
    unlockedAssetAddress,
    chainId,
    pendingPrefillAmount
  )
  const showLockedWithdrawAction = usesLockedManagedWithdrawFlow && canWithdrawNow && !isCooldownDataLoading
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
        <div className="mt-3">
          <Button
            variant="filled"
            disabled={!isLockedWithdrawReady}
            classNameOverride="yearn--button--nextgen w-full"
            onClick={() => {
              setLockedWithdrawExecutionSnapshot({
                lockedStepMethod: currentLockedWithdrawMethod,
                requestedLockedAssets: lockedRequestedWithdrawAssets,
                requestedLockedShares: lockedRequestedWithdrawShares,
                receivedLockedAssets: currentReceivedLockedAssets
              })
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
        inputBalanceOverride={
          isLockedVariant && account
            ? canWithdrawNow
              ? lockedMaxWithdrawDisplayAmount
              : maxCooldownDisplayAmount
            : undefined
        }
        inputDisplayBalanceOverride={isLockedVariant && account ? lockedDisplayUserData.depositedValue : undefined}
        maxWithdrawAssets={isLockedVariant && account && canWithdrawNow ? lockedMaxWithdrawDisplayAmount : undefined}
        customErrorMessage={isLockedVariant && account ? lockedWithdrawInputError : undefined}
        disableFlow={usesLockedManagedWithdrawFlow}
        disableTokenSelector={isLockedVariant && !canWithdrawNow}
        disableAmountInput={disableLockedAmountInput}
        hideActionButton={hideLockedWithdrawAction}
        headerActions={<YvUsdVariantToggle activeVariant={activeVariant} onChange={handleVariantChange} />}
        onAmountChange={handleAmountChange}
        onTokenSelectionChange={handleLockedWithdrawTokenSelectionChange}
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
        onBeforeSuccess={handleLockedWithdrawBeforeSuccess}
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
