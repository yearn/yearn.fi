import {
  WithdrawalCooldownPanel,
  WithdrawalCooldownStatus
} from '@pages/vaults/components/widget/WithdrawalCooldownPanel'
import {
  formatDays,
  formatDuration,
  parseCooldownStatus,
  resolveCooldownWindowState,
  resolveDurationSeconds
} from '@pages/vaults/components/widget/yvUSD/cooldownUtils'
import { YVUSD_JUNIOR_COOLDOWN_DAYS } from '@pages/vaults/constants/tranchedProducts'
import type { VaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import { Button } from '@shared/components/Button'
import { erc4626Abi } from '@shared/contracts/abi/4626.abi'
import { yvUsdLockedVaultAbi } from '@shared/contracts/abi/yvUsdLockedVault.abi'
import { type AppUseSimulateContractReturnType, useReadContract, useSimulateContract } from '@shared/hooks/useAppWagmi'
import { useChainTimestamp } from '@shared/hooks/useChainTimestamp'
import { IconCheck } from '@shared/icons/IconCheck'
import { formatTAmount, toAddress } from '@shared/utils'
import { TransactionOverlay, type TransactionStep, WidgetWithdraw } from '@yearn/vault-widget/advanced'
import type { ReactElement } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useAccount } from 'wagmi'

type Props = {
  vaultAddress: `0x${string}`
  assetAddress: `0x${string}`
  chainId: number
  vaultSymbol: string
  vaultVersion?: string
  vaultUserData: VaultUserData
  onOpenSettings?: () => void
  isSettingsOpen?: boolean
  disableActions?: boolean
}

const FALLBACK_WITHDRAWAL_WINDOW_DAYS = 3

export function LeveredTrancheWithdraw({
  vaultAddress,
  assetAddress,
  chainId,
  vaultSymbol,
  vaultVersion,
  vaultUserData,
  onOpenSettings,
  isSettingsOpen,
  disableActions = false
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
    query: { enabled: !disableActions && !!account, refetchInterval: account ? 30_000 : false }
  })
  const { data: rawCooldownDuration } = useReadContract({
    address: vaultAddress,
    abi: yvUsdLockedVaultAbi,
    functionName: 'cooldownDuration',
    chainId,
    query: { enabled: !disableActions }
  })
  const { data: rawWithdrawalWindow } = useReadContract({
    address: vaultAddress,
    abi: yvUsdLockedVaultAbi,
    functionName: 'withdrawalWindow',
    chainId,
    query: { enabled: !disableActions }
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
  const maxWithdrawAssets = !disableActions && typeof rawMaxWithdrawAssets === 'bigint' ? rawMaxWithdrawAssets : 0n
  const hasActiveCooldown = !disableActions && cooldownStatus.shares > 0n
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
    query: { enabled: !disableActions && !!account && !hasActiveCooldown && sharesToCooldown > 0n }
  })
  const prepareCancelCooldown: AppUseSimulateContractReturnType = useSimulateContract({
    address: vaultAddress,
    abi: yvUsdLockedVaultAbi,
    functionName: 'cancelCooldown',
    account: account ? toAddress(account) : undefined,
    chainId,
    query: { enabled: !disableActions && !!account && hasActiveCooldown }
  })

  const cooldownDuration = resolveDurationSeconds(rawCooldownDuration, YVUSD_JUNIOR_COOLDOWN_DAYS)
  const withdrawalWindow = resolveDurationSeconds(rawWithdrawalWindow, FALLBACK_WITHDRAWAL_WINDOW_DAYS)
  const vaultDecimals = vaultUserData.vaultToken?.decimals ?? 18
  const assetDecimals = vaultUserData.assetToken?.decimals ?? 6
  const assetSymbol = vaultUserData.assetToken?.symbol ?? 'USDC'

  const startStep = useMemo((): TransactionStep | undefined => {
    if (!prepareStartCooldown.isSuccess || !prepareStartCooldown.data?.request) return undefined
    return {
      id: 'start-cooldown',
      prepare: prepareStartCooldown,
      label: 'Start Cooldown',
      confirmMessage: `Starting cooldown for ${formatTAmount({ value: sharesToCooldown, decimals: vaultDecimals })} ${vaultSymbol}`,
      successTitle: 'Cooldown started',
      successMessage: `Your withdrawal will be available in ${formatDays(cooldownDuration, YVUSD_JUNIOR_COOLDOWN_DAYS)}.`
    }
  }, [cooldownDuration, prepareStartCooldown, sharesToCooldown, vaultDecimals, vaultSymbol])

  const cancelStep = useMemo((): TransactionStep | undefined => {
    if (!prepareCancelCooldown.isSuccess || !prepareCancelCooldown.data?.request) return undefined
    return {
      id: 'cancel-cooldown',
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

  const cooldownDurationLabel = formatDays(cooldownDuration, YVUSD_JUNIOR_COOLDOWN_DAYS)
  const withdrawalWindowLabel = formatDays(withdrawalWindow, FALLBACK_WITHDRAWAL_WINDOW_DAYS)
  const selectedAmount = formatTAmount({ value: withdrawAmount, decimals: assetDecimals })
  const cooldownPanel = (
    <WithdrawalCooldownPanel
      title="Junior withdrawal cooldown"
      cooldownDuration={cooldownDurationLabel}
      withdrawalWindow={disableActions ? undefined : withdrawalWindowLabel}
      info={
        <>
          <p>{`The planned Junior withdrawal cooldown is ${cooldownDurationLabel}.`}</p>
          {disableActions ? (
            <p>{'Cooldown and withdrawal transactions are disabled in this preview.'}</p>
          ) : (
            <p>{`Withdraw during the ${withdrawalWindowLabel} window after the cooldown finishes.`}</p>
          )}
        </>
      }
      actions={
        disableActions || canStartCooldown || (hasActiveCooldown && !isWithdrawalWindowOpen) ? (
          <div className="mt-3 space-y-2">
            {disableActions || canStartCooldown ? (
              <Button
                variant={prepareStartCooldown.isLoading || prepareStartCooldown.isFetching ? 'busy' : 'filled'}
                isBusy={prepareStartCooldown.isLoading || prepareStartCooldown.isFetching}
                disabled={disableActions || !startStep}
                classNameOverride="yearn--button--nextgen w-full"
                onClick={() => setOverlay('start')}
              >
                {'Start Cooldown'}
              </Button>
            ) : (
              <Button
                variant={prepareCancelCooldown.isLoading || prepareCancelCooldown.isFetching ? 'busy' : 'outlined'}
                isBusy={prepareCancelCooldown.isLoading || prepareCancelCooldown.isFetching}
                disabled={disableActions || !cancelStep}
                classNameOverride="yearn--button--nextgen w-full"
                onClick={() => setOverlay('cancel')}
              >
                {isCooldownWindowExpired ? 'Reset Cooldown' : 'Cancel Cooldown'}
              </Button>
            )}
            {disableActions ? (
              <Button disabled classNameOverride="yearn--button--nextgen w-full">
                {'Withdraw'}
              </Button>
            ) : null}
          </div>
        ) : null
      }
    >
      {!disableActions && !account ? (
        <p>{'Connect wallet to view cooldown status.'}</p>
      ) : isLoadingStatus && !disableActions ? (
        <p>{'Loading cooldown status…'}</p>
      ) : !disableActions && !hasBalance && !hasActiveCooldown ? (
        <p>{'No Junior balance found in this wallet.'}</p>
      ) : (
        <>
          {isWithdrawalWindowOpen ? (
            <p>{`Available to withdraw now: ${formatTAmount({ value: maxWithdrawAssets, decimals: assetDecimals })} ${assetSymbol}`}</p>
          ) : hasActiveCooldown ? (
            <p>{`Shares in cooldown: ${formatTAmount({ value: cooldownStatus.shares, decimals: vaultDecimals })} ${vaultSymbol}`}</p>
          ) : (
            <p>{`Selected cooldown amount: ${selectedAmount} ${assetSymbol}`}</p>
          )}
          <WithdrawalCooldownStatus
            remaining={
              isWithdrawalWindowOpen ? (
                <span className="inline-flex items-center gap-1 text-text-primary">
                  {'Complete'}
                  <IconCheck className="size-3 text-green-600" />
                </span>
              ) : (
                <span>
                  {isCooldownActive
                    ? formatDuration(cooldownRemaining)
                    : isCooldownWindowExpired
                      ? 'Complete'
                      : 'Not started'}
                </span>
              )
            }
            windowRemaining={isWithdrawalWindowOpen ? formatDuration(windowRemaining) : 'Closed'}
          />
        </>
      )}
    </WithdrawalCooldownPanel>
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
        disableFlow={disableActions || !isWithdrawalWindowOpen}
        disableTokenSelector={disableActions || !isWithdrawalWindowOpen}
        disableAmountInput={isCooldownActive}
        hideActionButton={disableActions || !isWithdrawalWindowOpen}
        onAmountChange={setWithdrawAmount}
        handleWithdrawSuccess={refresh}
        onOpenSettings={onOpenSettings}
        isSettingsOpen={isSettingsOpen}
        contentBelowInput={cooldownPanel}
      />
      <TransactionOverlay
        isOpen={!disableActions && overlay === 'start'}
        onClose={() => setOverlay(null)}
        step={startStep}
        isLastStep
        onAllComplete={refresh}
      />
      <TransactionOverlay
        isOpen={!disableActions && overlay === 'cancel'}
        onClose={() => setOverlay(null)}
        step={cancelStep}
        isLastStep
        onAllComplete={refresh}
      />
    </div>
  )
}
