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
import { yvUsdLockedVaultAbi } from '@shared/contracts/abi/yvUsdLockedVault.abi'
import { formatTAmount, toAddress } from '@shared/utils'
import type { ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { UseSimulateContractReturnType } from 'wagmi'
import { useAccount, useReadContract, useSimulateContract } from 'wagmi'
import { TransactionOverlay, type TransactionStep } from '../shared/TransactionOverlay'
import { WidgetWithdraw } from '../withdraw'
import { YvUsdVariantToggle } from './YvUsdVariantToggle'

type Props = {
  chainId: number
  assetAddress: `0x${string}`
  onWithdrawSuccess?: () => void
}

type TCooldownStatus = {
  cooldownEnd: number
  windowEnd: number
  shares: bigint
}

const EMPTY_COOLDOWN_STATUS: TCooldownStatus = {
  cooldownEnd: 0,
  windowEnd: 0,
  shares: 0n
}

const parseCooldownStatus = (status: unknown): TCooldownStatus => {
  if (!status) return EMPTY_COOLDOWN_STATUS

  if (Array.isArray(status)) {
    const [cooldownEnd, windowEnd, shares] = status
    return {
      cooldownEnd: typeof cooldownEnd === 'bigint' ? Number(cooldownEnd) : 0,
      windowEnd: typeof windowEnd === 'bigint' ? Number(windowEnd) : 0,
      shares: typeof shares === 'bigint' ? shares : 0n
    }
  }

  if (typeof status === 'object') {
    const parsed = status as {
      cooldownEnd?: unknown
      windowEnd?: unknown
      shares?: unknown
    }
    return {
      cooldownEnd: typeof parsed.cooldownEnd === 'bigint' ? Number(parsed.cooldownEnd) : 0,
      windowEnd: typeof parsed.windowEnd === 'bigint' ? Number(parsed.windowEnd) : 0,
      shares: typeof parsed.shares === 'bigint' ? parsed.shares : 0n
    }
  }

  return EMPTY_COOLDOWN_STATUS
}

const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s'
  const totalSeconds = Math.floor(seconds)
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const secs = totalSeconds % 60

  if (days > 0) return `${days}d ${hours}h ${minutes}m ${secs}s`
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`
  if (minutes > 0) return `${minutes}m ${secs}s`
  return `${secs}s`
}

const formatDays = (seconds: number, fallbackDays: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return `${fallbackDays} days`
  const days = seconds / 86_400
  const rounded = Math.round(days * 100) / 100
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded} days`
}

const scaleAmountDecimals = (value: bigint, fromDecimals: number, toDecimals: number): bigint => {
  if (value === 0n || fromDecimals === toDecimals) return value
  if (fromDecimals > toDecimals) {
    return value / 10n ** BigInt(fromDecimals - toDecimals)
  }
  return value * 10n ** BigInt(toDecimals - fromDecimals)
}

export function YvUsdWithdraw({ chainId, assetAddress, onWithdrawSuccess }: Props): ReactElement {
  const { address: account } = useAccount()
  const { unlockedVault, lockedVault, isLoading } = useYvUsdVaults()
  const [variant, setVariant] = useState<TYvUsdVariant | null>(null)
  const [showCooldownOverlay, setShowCooldownOverlay] = useState(false)
  const [showCancelCooldownOverlay, setShowCancelCooldownOverlay] = useState(false)
  const [lockedRequestedAssets, setLockedRequestedAssets] = useState<bigint>(0n)
  const [nowTimestamp, setNowTimestamp] = useState(() => Math.floor(Date.now() / 1000))
  const activeVariant = variant ?? 'unlocked'

  const unlockedAssetAddress = toAddress(unlockedVault?.token.address ?? assetAddress)
  const lockedAssetAddress = YVUSD_UNLOCKED_ADDRESS

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
  const lockedUnderlyingAssetDecimals = lockedUserData.assetToken?.decimals ?? 18
  const lockedInputAssetToken = unlockedUserData.assetToken ?? lockedUserData.assetToken
  const lockedInputAssetDecimals = lockedInputAssetToken?.decimals ?? lockedUnderlyingAssetDecimals
  const lockedInputPricePerShare = useMemo(
    () => scaleAmountDecimals(lockedUserData.pricePerShare, lockedUnderlyingAssetDecimals, lockedInputAssetDecimals),
    [lockedUserData.pricePerShare, lockedUnderlyingAssetDecimals, lockedInputAssetDecimals]
  )
  const lockedWithdrawUserData = useMemo(
    () => ({
      ...lockedUserData,
      assetToken: lockedInputAssetToken,
      pricePerShare: lockedInputPricePerShare,
      availableToDeposit: lockedInputAssetToken?.balance.raw ?? 0n,
      depositedValue: scaleAmountDecimals(
        lockedUserData.depositedValue,
        lockedUnderlyingAssetDecimals,
        lockedInputAssetDecimals
      )
    }),
    [
      lockedUserData,
      lockedInputAssetToken,
      lockedInputPricePerShare,
      lockedUnderlyingAssetDecimals,
      lockedInputAssetDecimals
    ]
  )

  const lockedWalletShares = lockedUserData.vaultToken?.balance.raw ?? 0n
  const hasUnlocked = unlockedUserData.depositedShares > 0n
  const hasLocked = lockedWalletShares > 0n

  const { data: rawCooldownDuration } = useReadContract({
    address: YVUSD_LOCKED_ADDRESS,
    abi: yvUsdLockedVaultAbi,
    functionName: 'cooldownDuration',
    chainId,
    query: {
      enabled: activeVariant === 'locked',
      refetchInterval: activeVariant === 'locked' ? 60_000 : false
    }
  })
  const { data: rawWithdrawalWindow } = useReadContract({
    address: YVUSD_LOCKED_ADDRESS,
    abi: yvUsdLockedVaultAbi,
    functionName: 'withdrawalWindow',
    chainId,
    query: {
      enabled: activeVariant === 'locked',
      refetchInterval: activeVariant === 'locked' ? 60_000 : false
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
      enabled: !!account && activeVariant === 'locked',
      refetchInterval: activeVariant === 'locked' ? 30_000 : false
    }
  })
  const {
    data: rawAvailableWithdrawLimit,
    isLoading: isLoadingAvailableWithdrawLimit,
    refetch: refetchAvailableWithdrawLimit
  } = useReadContract({
    address: YVUSD_LOCKED_ADDRESS,
    abi: yvUsdLockedVaultAbi,
    functionName: 'availableWithdrawLimit',
    args: account ? [toAddress(account)] : undefined,
    chainId,
    query: {
      enabled: !!account && activeVariant === 'locked',
      refetchInterval: activeVariant === 'locked' ? 30_000 : false
    }
  })
  const cooldownStatus = useMemo(() => parseCooldownStatus(rawCooldownStatus), [rawCooldownStatus])
  const cooldownDurationSeconds =
    typeof rawCooldownDuration === 'bigint' ? Number(rawCooldownDuration) : YVUSD_LOCKED_COOLDOWN_DAYS * 86_400
  const withdrawalWindowSeconds =
    typeof rawWithdrawalWindow === 'bigint' ? Number(rawWithdrawalWindow) : YVUSD_WITHDRAW_WINDOW_DAYS * 86_400
  const cooldownDurationLabel = useMemo(
    () => formatDays(cooldownDurationSeconds, YVUSD_LOCKED_COOLDOWN_DAYS),
    [cooldownDurationSeconds]
  )
  const withdrawalWindowLabel = useMemo(
    () => formatDays(withdrawalWindowSeconds, YVUSD_WITHDRAW_WINDOW_DAYS),
    [withdrawalWindowSeconds]
  )
  const availableWithdrawLimit = typeof rawAvailableWithdrawLimit === 'bigint' ? rawAvailableWithdrawLimit : 0n
  const availableWithdrawLimitForInput = scaleAmountDecimals(
    availableWithdrawLimit,
    lockedUnderlyingAssetDecimals,
    lockedInputAssetDecimals
  )

  const hasActiveCooldown = cooldownStatus.shares > 0n
  const isCooldownActive = hasActiveCooldown && nowTimestamp < cooldownStatus.cooldownEnd
  const isWithdrawalWindowOpen =
    hasActiveCooldown && nowTimestamp >= cooldownStatus.cooldownEnd && nowTimestamp <= cooldownStatus.windowEnd
  const isCooldownWindowExpired = hasActiveCooldown && nowTimestamp > cooldownStatus.windowEnd
  const needsCooldownStart = hasLocked && (!hasActiveCooldown || isCooldownWindowExpired)

  const cooldownRemainingSeconds = isCooldownActive ? cooldownStatus.cooldownEnd - nowTimestamp : 0
  const windowRemainingSeconds = isWithdrawalWindowOpen ? cooldownStatus.windowEnd - nowTimestamp : 0
  const sharesUnderCooldown = hasActiveCooldown ? cooldownStatus.shares : 0n
  const formattedSharesUnderCooldown = formatTAmount({
    value: sharesUnderCooldown,
    decimals: lockedUserData.vaultToken?.decimals ?? 18
  })
  const formattedAvailableWithdrawLimit = formatTAmount({
    value: availableWithdrawLimitForInput,
    decimals: lockedInputAssetDecimals
  })
  const canWithdrawNow = availableWithdrawLimitForInput > 0n
  const cooldownSharesToStart = useMemo(() => {
    if (!needsCooldownStart || lockedRequestedAssets <= 0n) return 0n
    if (lockedInputPricePerShare <= 0n) return 0n

    const vaultDecimals = lockedUserData.vaultToken?.decimals ?? 18
    const numerator = lockedRequestedAssets * 10n ** BigInt(vaultDecimals)
    const requiredShares = (numerator + lockedInputPricePerShare - 1n) / lockedInputPricePerShare
    return requiredShares > lockedWalletShares ? lockedWalletShares : requiredShares
  }, [
    needsCooldownStart,
    lockedRequestedAssets,
    lockedInputPricePerShare,
    lockedUserData.vaultToken?.decimals,
    lockedWalletShares
  ])
  const selectedCooldownAssets = useMemo(() => {
    if (cooldownSharesToStart <= 0n || lockedInputPricePerShare <= 0n) {
      return 0n
    }
    const vaultDecimals = lockedUserData.vaultToken?.decimals ?? 18
    return (cooldownSharesToStart * lockedInputPricePerShare) / 10n ** BigInt(vaultDecimals)
  }, [cooldownSharesToStart, lockedInputPricePerShare, lockedUserData.vaultToken?.decimals])
  const formattedSelectedCooldownAmount = formatTAmount({
    value: selectedCooldownAssets,
    decimals: lockedInputAssetDecimals
  })

  const prepareStartCooldown: UseSimulateContractReturnType = useSimulateContract({
    address: YVUSD_LOCKED_ADDRESS,
    abi: yvUsdLockedVaultAbi,
    functionName: 'startCooldown',
    args: cooldownSharesToStart > 0n ? [cooldownSharesToStart] : undefined,
    account: account ? toAddress(account) : undefined,
    chainId,
    query: {
      enabled: !!account && activeVariant === 'locked' && needsCooldownStart && cooldownSharesToStart > 0n
    }
  })
  const prepareCancelCooldown: UseSimulateContractReturnType = useSimulateContract({
    address: YVUSD_LOCKED_ADDRESS,
    abi: yvUsdLockedVaultAbi,
    functionName: 'cancelCooldown',
    account: account ? toAddress(account) : undefined,
    chainId,
    query: {
      enabled: !!account && activeVariant === 'locked' && hasActiveCooldown
    }
  })

  const cooldownStep = useMemo((): TransactionStep | undefined => {
    if (!prepareStartCooldown.isSuccess || !prepareStartCooldown.data?.request) return undefined

    return {
      prepare: prepareStartCooldown as unknown as UseSimulateContractReturnType,
      label: 'Start Cooldown',
      confirmMessage: `Starting cooldown for ${formatTAmount({
        value: cooldownSharesToStart,
        decimals: lockedUserData.vaultToken?.decimals ?? 18
      })} locked shares`,
      successTitle: 'Cooldown started',
      successMessage: `Cooldown has started. Withdrawals become available in ${cooldownDurationLabel}.`
    }
  }, [prepareStartCooldown, cooldownSharesToStart, lockedUserData.vaultToken?.decimals, cooldownDurationLabel])

  const handleCooldownSuccess = useCallback(() => {
    setShowCooldownOverlay(false)
    void refetchCooldownStatus()
    void refetchAvailableWithdrawLimit()
    lockedUserData.refetch()
  }, [lockedUserData, refetchCooldownStatus, refetchAvailableWithdrawLimit])
  const cancelCooldownStep = useMemo((): TransactionStep | undefined => {
    if (!prepareCancelCooldown.isSuccess || !prepareCancelCooldown.data?.request) return undefined

    return {
      prepare: prepareCancelCooldown as unknown as UseSimulateContractReturnType,
      label: 'Cancel Cooldown',
      confirmMessage: 'Canceling active cooldown for locked yvUSD shares',
      successTitle: 'Cooldown canceled',
      successMessage: 'Cooldown canceled. Start a new cooldown to withdraw from the locked vault.'
    }
  }, [prepareCancelCooldown])
  const handleCancelCooldownSuccess = useCallback(() => {
    setShowCancelCooldownOverlay(false)
    void refetchCooldownStatus()
    void refetchAvailableWithdrawLimit()
    lockedUserData.refetch()
  }, [lockedUserData, refetchCooldownStatus, refetchAvailableWithdrawLimit])

  const handleLockedWithdrawSuccess = useCallback(() => {
    void refetchCooldownStatus()
    void refetchAvailableWithdrawLimit()
    onWithdrawSuccess?.()
  }, [onWithdrawSuccess, refetchCooldownStatus, refetchAvailableWithdrawLimit])

  const lockedActionDisabledReason = useMemo(() => {
    if (activeVariant !== 'locked') return undefined
    if (!account) return undefined
    if (isLoadingCooldownStatus || isLoadingAvailableWithdrawLimit) return 'Loading cooldown status...'
    if (canWithdrawNow) return undefined
    if (!hasLocked) return 'No locked yvUSD shares available to withdraw.'
    if (needsCooldownStart) {
      return undefined
    }
    if (isCooldownActive) {
      return `Cooldown active. Withdrawals open in ${formatDuration(cooldownRemainingSeconds)}.`
    }
    if (!isWithdrawalWindowOpen) {
      return 'Withdrawal window closed. Start a new cooldown to withdraw.'
    }
    return undefined
  }, [
    activeVariant,
    account,
    hasLocked,
    isLoadingCooldownStatus,
    isLoadingAvailableWithdrawLimit,
    canWithdrawNow,
    needsCooldownStart,
    isCooldownActive,
    cooldownRemainingSeconds,
    isWithdrawalWindowOpen
  ])

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

  useEffect(() => {
    if (activeVariant !== 'locked') return

    setNowTimestamp(Math.floor(Date.now() / 1000))
    const interval = window.setInterval(() => {
      setNowTimestamp(Math.floor(Date.now() / 1000))
    }, 1_000)

    return () => window.clearInterval(interval)
  }, [activeVariant])

  if (isLoading || !unlockedVault || !lockedVault) {
    return (
      <div className="p-6 flex items-center justify-center h-[317px]">
        <div className="w-6 h-6 border-2 border-border border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  const selectedVault = activeVariant === 'locked' ? lockedVault : unlockedVault
  const selectedAssetAddress = activeVariant === 'locked' ? lockedAssetAddress : unlockedAssetAddress
  const selectedVaultUserData = activeVariant === 'locked' ? lockedWithdrawUserData : unlockedUserData
  const showToggle = hasUnlocked && hasLocked
  const disableLockedAmountInput = activeVariant === 'locked' && isCooldownActive
  const hideLockedWithdrawAction = activeVariant === 'locked' && !!account && !canWithdrawNow
  const effectiveLockedActionDisabledReason =
    activeVariant === 'locked' && !hideLockedWithdrawAction ? lockedActionDisabledReason : undefined
  const headerToggle = showToggle ? (
    <YvUsdVariantToggle activeVariant={activeVariant} onChange={setVariant} />
  ) : undefined
  const withdrawTypeSection =
    activeVariant === 'locked' ? (
      <div className="rounded-lg border border-border bg-surface-secondary mt-6 p-4 text-sm">
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-text-primary">{'Locked withdrawal cooldown'}</p>
          <p className="text-sm text-text-secondary">
            {`Cooldown: ${cooldownDurationLabel} | Withdrawal window: ${withdrawalWindowLabel}`}
          </p>
        </div>
        <div className="mt-3 flex flex-col gap-1 text-sm text-text-secondary">
          {!account ? (
            <p>{'Connect wallet to view cooldown status.'}</p>
          ) : !hasLocked ? (
            <p>{'No locked shares found in this wallet.'}</p>
          ) : isLoadingCooldownStatus || isLoadingAvailableWithdrawLimit ? (
            <p>{'Loading cooldown status...'}</p>
          ) : (
            <>
              <p>{`Available to withdraw now: ${formattedAvailableWithdrawLimit}`}</p>
              <p>{`Shares in cooldown: ${formattedSharesUnderCooldown}`}</p>
              {needsCooldownStart ? <p>{`Selected cooldown amount: ${formattedSelectedCooldownAmount}`}</p> : null}
              <p>
                {`Cooldown remaining: ${
                  isCooldownActive
                    ? formatDuration(cooldownRemainingSeconds)
                    : needsCooldownStart
                      ? 'Not started'
                      : 'Complete'
                }`}
              </p>
              <p>
                {`Withdrawal window remaining: ${
                  isWithdrawalWindowOpen
                    ? formatDuration(windowRemainingSeconds)
                    : isCooldownActive
                      ? 'Not open yet'
                      : hasActiveCooldown
                        ? 'Closed'
                        : 'Not started'
                }`}
              </p>
            </>
          )}
        </div>
        {account &&
        hasLocked &&
        !isLoadingCooldownStatus &&
        !isLoadingAvailableWithdrawLimit &&
        needsCooldownStart &&
        !canWithdrawNow ? (
          <div className="mt-3 space-y-2">
            <Button
              variant={prepareStartCooldown.isLoading || prepareStartCooldown.isFetching ? 'busy' : 'filled'}
              isBusy={prepareStartCooldown.isLoading || prepareStartCooldown.isFetching}
              disabled={!cooldownStep}
              classNameOverride="yearn--button--nextgen w-full"
              onClick={() => setShowCooldownOverlay(true)}
            >
              {'Start Cooldown'}
            </Button>
            {hasActiveCooldown ? (
              <Button
                variant={prepareCancelCooldown.isLoading || prepareCancelCooldown.isFetching ? 'busy' : 'outlined'}
                isBusy={prepareCancelCooldown.isLoading || prepareCancelCooldown.isFetching}
                disabled={!cancelCooldownStep}
                classNameOverride="yearn--button--nextgen w-full"
                onClick={() => setShowCancelCooldownOverlay(true)}
              >
                {'Cancel Cooldown'}
              </Button>
            ) : null}
          </div>
        ) : null}
        {account &&
        hasLocked &&
        hasActiveCooldown &&
        !isLoadingCooldownStatus &&
        !isLoadingAvailableWithdrawLimit &&
        !needsCooldownStart ? (
          <div className="mt-3">
            <Button
              variant={prepareCancelCooldown.isLoading || prepareCancelCooldown.isFetching ? 'busy' : 'outlined'}
              isBusy={prepareCancelCooldown.isLoading || prepareCancelCooldown.isFetching}
              disabled={!cancelCooldownStep}
              classNameOverride="yearn--button--nextgen w-full"
              onClick={() => setShowCancelCooldownOverlay(true)}
            >
              {'Cancel Cooldown'}
            </Button>
          </div>
        ) : null}
      </div>
    ) : undefined

  return (
    <div className="relative flex flex-col gap-0">
      <WidgetWithdraw
        key={selectedVault.address}
        vaultAddress={toAddress(selectedVault.address)}
        assetAddress={selectedAssetAddress}
        chainId={chainId}
        vaultSymbol={activeVariant === 'locked' ? 'yvUSD (Locked)' : 'yvUSD (Unlocked)'}
        vaultVersion={selectedVault.version}
        vaultUserData={selectedVaultUserData}
        maxWithdrawAssets={
          activeVariant === 'locked' && account && canWithdrawNow ? availableWithdrawLimitForInput : undefined
        }
        isActionDisabled={!!effectiveLockedActionDisabledReason}
        actionDisabledReason={effectiveLockedActionDisabledReason}
        disableTokenSelector={activeVariant === 'locked'}
        hideZapForTokens={activeVariant === 'locked' ? [unlockedAssetAddress, lockedAssetAddress] : undefined}
        disableAmountInput={disableLockedAmountInput}
        hideActionButton={hideLockedWithdrawAction}
        headerActions={headerToggle}
        onAmountChange={activeVariant === 'locked' ? (amount) => setLockedRequestedAssets(amount) : undefined}
        handleWithdrawSuccess={activeVariant === 'locked' ? handleLockedWithdrawSuccess : onWithdrawSuccess}
        hideContainerBorder
        contentBelowInput={withdrawTypeSection}
        prefill={activeVariant === 'locked' ? { address: unlockedAssetAddress, chainId } : undefined}
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
    </div>
  )
}
