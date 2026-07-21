import type { VaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import { Button } from '@shared/components/Button'
import { erc4626Abi } from '@shared/contracts/abi/4626.abi'
import { yvUsdLockedVaultAbi } from '@shared/contracts/abi/yvUsdLockedVault.abi'
import { type AppUseSimulateContractReturnType, useReadContract, useSimulateContract } from '@shared/hooks/useAppWagmi'
import { useChainTimestamp } from '@shared/hooks/useChainTimestamp'
import { IconCheck } from '@shared/icons/IconCheck'
import { formatTAmount, toAddress } from '@shared/utils'
import type { ReactElement } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { TransactionOverlay, type TransactionStep } from '../shared/TransactionOverlay'
import { WidgetWithdraw } from '../withdraw'
import {
  formatDays,
  formatDuration,
  parseCooldownStatus,
  resolveCooldownWindowState,
  resolveDurationSeconds
} from '../yvUSD/cooldownUtils'

type Props = {
  vaultAddress: `0x${string}`
  assetAddress: `0x${string}`
  chainId: number
  vaultSymbol: string
  vaultVersion?: string
  vaultUserData: VaultUserData
  onOpenSettings?: () => void
  isSettingsOpen?: boolean
}

const FALLBACK_COOLDOWN_DAYS = 7
const FALLBACK_WITHDRAWAL_WINDOW_DAYS = 3

export function LeveredTrancheWithdraw({
  vaultAddress,
  assetAddress,
  chainId,
  vaultSymbol,
  vaultVersion,
  vaultUserData,
  onOpenSettings,
  isSettingsOpen
}: Props): ReactElement {
  const { address: account } = useAccount()
  const [withdrawAmount, setWithdrawAmount] = useState(0n)
  const [overlay, setOverlay] = useState<'start' | 'cancel' | null>(null)

  const {
    data: rawCooldownStatus,
    isLoading: isLoadingCooldownStatus,
    refetch: refetchCooldownStatus
  } = useReadContract({
    address: vaultAddress,
    abi: yvUsdLockedVaultAbi,
    functionName: 'getCooldownStatus',
    args: account ? [toAddress(account)] : undefined,
    chainId,
    query: { enabled: !!account, refetchInterval: account ? 30_000 : false }
  })
  const { data: rawCooldownDuration } = useReadContract({
    address: vaultAddress,
    abi: yvUsdLockedVaultAbi,
    functionName: 'cooldownDuration',
    chainId
  })
  const { data: rawWithdrawalWindow } = useReadContract({
    address: vaultAddress,
    abi: yvUsdLockedVaultAbi,
    functionName: 'withdrawalWindow',
    chainId
  })
  const {
    data: rawMaxWithdrawAssets,
    isLoading: isLoadingMaxWithdraw,
    refetch: refetchMaxWithdraw
  } = useReadContract({
    address: vaultAddress,
    abi: erc4626Abi,
    functionName: 'maxWithdraw',
    args: account ? [toAddress(account)] : undefined,
    chainId,
    query: { enabled: !!account, refetchInterval: account ? 30_000 : false }
  })
  const { data: rawPreviewWithdrawShares } = useReadContract({
    address: vaultAddress,
    abi: erc4626Abi,
    functionName: 'previewWithdraw',
    args: withdrawAmount > 0n ? [withdrawAmount] : undefined,
    chainId,
    query: { enabled: !!account && withdrawAmount > 0n }
  })

  const cooldownStatus = useMemo(() => parseCooldownStatus(rawCooldownStatus), [rawCooldownStatus])
  const maxWithdrawAssets = typeof rawMaxWithdrawAssets === 'bigint' ? rawMaxWithdrawAssets : 0n
  const hasActiveCooldown = cooldownStatus.shares > 0n
  const { timestamp: nowTimestamp } = useChainTimestamp({ chainId, enabled: !!account })
  const { isCooldownActive, isWithdrawalWindowOpen, isCooldownWindowExpired } = resolveCooldownWindowState({
    hasActiveCooldown,
    nowTimestamp,
    cooldownEnd: cooldownStatus.cooldownEnd,
    windowEnd: cooldownStatus.windowEnd,
    availableWithdrawLimit: maxWithdrawAssets
  })
  const depositedShares = vaultUserData.depositedShares
  const depositedAssets = vaultUserData.depositedValue
  const requestedShares = useMemo(() => {
    if (withdrawAmount <= 0n || depositedShares <= 0n) return 0n
    if (withdrawAmount >= depositedAssets) return depositedShares
    return typeof rawPreviewWithdrawShares === 'bigint' ? rawPreviewWithdrawShares : 0n
  }, [depositedAssets, depositedShares, rawPreviewWithdrawShares, withdrawAmount])
  const sharesToCooldown = requestedShares > depositedShares ? depositedShares : requestedShares

  const prepareStartCooldown: AppUseSimulateContractReturnType = useSimulateContract({
    address: vaultAddress,
    abi: yvUsdLockedVaultAbi,
    functionName: 'startCooldown',
    args: sharesToCooldown > 0n ? [sharesToCooldown] : undefined,
    account: account ? toAddress(account) : undefined,
    chainId,
    query: { enabled: !!account && !hasActiveCooldown && sharesToCooldown > 0n }
  })
  const prepareCancelCooldown: AppUseSimulateContractReturnType = useSimulateContract({
    address: vaultAddress,
    abi: yvUsdLockedVaultAbi,
    functionName: 'cancelCooldown',
    account: account ? toAddress(account) : undefined,
    chainId,
    query: { enabled: !!account && hasActiveCooldown }
  })

  const cooldownDuration = resolveDurationSeconds(rawCooldownDuration, FALLBACK_COOLDOWN_DAYS)
  const withdrawalWindow = resolveDurationSeconds(rawWithdrawalWindow, FALLBACK_WITHDRAWAL_WINDOW_DAYS)
  const vaultDecimals = vaultUserData.vaultToken?.decimals ?? 18
  const assetDecimals = vaultUserData.assetToken?.decimals ?? 6
  const assetSymbol = vaultUserData.assetToken?.symbol ?? 'USDC'

  const startStep = useMemo((): TransactionStep | undefined => {
    if (!prepareStartCooldown.isSuccess || !prepareStartCooldown.data?.request) return undefined
    return {
      prepare: prepareStartCooldown,
      label: 'Start Cooldown',
      confirmMessage: `Starting cooldown for ${formatTAmount({ value: sharesToCooldown, decimals: vaultDecimals })} ${vaultSymbol}`,
      successTitle: 'Cooldown started',
      successMessage: `Your withdrawal will be available in ${formatDays(cooldownDuration, FALLBACK_COOLDOWN_DAYS)}.`
    }
  }, [cooldownDuration, prepareStartCooldown, sharesToCooldown, vaultDecimals, vaultSymbol])

  const cancelStep = useMemo((): TransactionStep | undefined => {
    if (!prepareCancelCooldown.isSuccess || !prepareCancelCooldown.data?.request) return undefined
    return {
      prepare: prepareCancelCooldown,
      label: 'Cancel Cooldown',
      confirmMessage: `Canceling the active ${vaultSymbol} cooldown`,
      successTitle: 'Cooldown canceled',
      successMessage: 'Choose an amount and start a new cooldown when you are ready.'
    }
  }, [prepareCancelCooldown, vaultSymbol])

  const refresh = useCallback((): void => {
    void refetchCooldownStatus()
    void refetchMaxWithdraw()
    void vaultUserData.refetch()
  }, [refetchCooldownStatus, refetchMaxWithdraw, vaultUserData])

  const isLoadingStatus = isLoadingCooldownStatus || isLoadingMaxWithdraw
  const hasBalance = depositedShares > 0n
  const canStartCooldown = !!account && hasBalance && !hasActiveCooldown && !isLoadingStatus
  const cooldownRemaining = Math.max(0, cooldownStatus.cooldownEnd - nowTimestamp)
  const windowRemaining = Math.max(0, cooldownStatus.windowEnd - nowTimestamp)
  const inputBalance = isWithdrawalWindowOpen ? maxWithdrawAssets : depositedAssets

  const cooldownPanel = (
    <div className="mt-3 rounded-lg border border-primary/80 bg-surface-tertiary/80 p-4 text-sm text-text-primary">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">{'Levered withdrawal cooldown'}</p>
        {isWithdrawalWindowOpen ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium">
            <IconCheck className="size-3 text-green-600" />
            {'Ready'}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-text-secondary">
        {`Cooldown: ${formatDays(cooldownDuration, FALLBACK_COOLDOWN_DAYS)} · Withdrawal window: ${formatDays(withdrawalWindow, FALLBACK_WITHDRAWAL_WINDOW_DAYS)}`}
      </p>
      <div className="mt-3 space-y-1 text-text-secondary">
        {!account ? (
          <p>{'Connect wallet to view cooldown status.'}</p>
        ) : isLoadingStatus ? (
          <p>{'Loading cooldown status…'}</p>
        ) : !hasBalance && !hasActiveCooldown ? (
          <p>{'No Levered Yield balance found in this wallet.'}</p>
        ) : isWithdrawalWindowOpen ? (
          <>
            <p>{`Available now: ${formatTAmount({ value: maxWithdrawAssets, decimals: assetDecimals })} ${assetSymbol}`}</p>
            <p>{`Window remaining: ${formatDuration(windowRemaining)}`}</p>
          </>
        ) : isCooldownActive ? (
          <>
            <p>{`Shares cooling down: ${formatTAmount({ value: cooldownStatus.shares, decimals: vaultDecimals })} ${vaultSymbol}`}</p>
            <p>{`Cooldown remaining: ${formatDuration(cooldownRemaining)}`}</p>
          </>
        ) : isCooldownWindowExpired ? (
          <p>{'The withdrawal window closed. Cancel this cooldown, then start a new one.'}</p>
        ) : (
          <p>{'Choose an amount above, then start the cooldown.'}</p>
        )}
      </div>
      {canStartCooldown ? (
        <Button
          variant={prepareStartCooldown.isLoading || prepareStartCooldown.isFetching ? 'busy' : 'filled'}
          isBusy={prepareStartCooldown.isLoading || prepareStartCooldown.isFetching}
          disabled={!startStep}
          classNameOverride="yearn--button--nextgen mt-3 w-full"
          onClick={() => setOverlay('start')}
        >
          {'Start Cooldown'}
        </Button>
      ) : hasActiveCooldown && !isWithdrawalWindowOpen ? (
        <Button
          variant={prepareCancelCooldown.isLoading || prepareCancelCooldown.isFetching ? 'busy' : 'outlined'}
          isBusy={prepareCancelCooldown.isLoading || prepareCancelCooldown.isFetching}
          disabled={!cancelStep}
          classNameOverride="yearn--button--nextgen mt-3 w-full"
          onClick={() => setOverlay('cancel')}
        >
          {isCooldownWindowExpired ? 'Reset Cooldown' : 'Cancel Cooldown'}
        </Button>
      ) : null}
    </div>
  )

  return (
    <div className="relative flex flex-col gap-0">
      <WidgetWithdraw
        vaultAddress={vaultAddress}
        assetAddress={assetAddress}
        chainId={chainId}
        vaultSymbol={vaultSymbol}
        vaultVersion={vaultVersion}
        vaultUserData={vaultUserData}
        inputBalanceOverride={account ? inputBalance : undefined}
        maxWithdrawAssets={isWithdrawalWindowOpen ? maxWithdrawAssets : undefined}
        disableFlow={!isWithdrawalWindowOpen}
        disableTokenSelector={!isWithdrawalWindowOpen}
        disableAmountInput={isCooldownActive}
        hideActionButton={!isWithdrawalWindowOpen}
        onAmountChange={setWithdrawAmount}
        handleWithdrawSuccess={refresh}
        onOpenSettings={onOpenSettings}
        isSettingsOpen={isSettingsOpen}
        hideContainerBorder
        contentBelowInput={cooldownPanel}
      />
      <TransactionOverlay
        isOpen={overlay === 'start'}
        onClose={() => setOverlay(null)}
        step={startStep}
        isLastStep
        onAllComplete={refresh}
      />
      <TransactionOverlay
        isOpen={overlay === 'cancel'}
        onClose={() => setOverlay(null)}
        step={cancelStep}
        isLastStep
        onAllComplete={refresh}
      />
    </div>
  )
}
