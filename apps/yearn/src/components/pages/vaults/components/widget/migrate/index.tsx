import { usePlausible } from '@hooks/usePlausible'
import { useMigrateError } from '@pages/vaults/components/widget/migrate/useMigrateError'
import { useMigrateFlow } from '@pages/vaults/components/widget/migrate/useMigrateFlow'
import type { VaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import { Button } from '@shared/components/Button'
import { TokenLogoV2 } from '@shared/components/TokenLogoV2'
import { useWalletTokens } from '@shared/contexts/useWallet'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { usePublicClient } from '@shared/hooks/useAppWagmi'
import { PERMIT_ABI, type TPermitSignature } from '@shared/hooks/usePermit'
import { useYearnSpotPrices } from '@shared/hooks/useYearnSpotPrices'
import { IconLinkOut } from '@shared/icons/IconLinkOut'
import { cl, formatTAmount, isZeroAddress, toAddress, toNormalizedBN } from '@shared/utils'
import { PLAUSIBLE_EVENTS } from '@shared/utils/plausible'
import { formatWidgetValue, TransactionOverlay, type TransactionStep, WidgetHeader } from '@yearn/vault-widget/advanced'
import { type FC, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { hexToNumber, slice } from 'viem'
import { useAccount } from 'wagmi'
import { env } from '@/env'

interface Props {
  vaultAddress: `0x${string}`
  assetAddress: `0x${string}`
  stakingAddress?: `0x${string}`
  chainId: number
  vaultSymbol: string
  vaultVersion?: string
  migrationTarget: `0x${string}`
  migrationContract: `0x${string}`
  migrationTargetSymbol?: string
  migrationTargetLogoURI?: string
  vaultUserData: VaultUserData
  migrationBalanceOverride?: bigint
  displayVaultUserData?: VaultUserData
  balanceLabel?: string
  readyBalance?: bigint
  transactionStepOverride?: TransactionStep
  onTransactionStepSuccess?: (stepId: string) => void | Promise<void>
  actionLabelOverride?: string
  handleMigrateSuccess?: () => void
  headerActions?: ReactNode
  destinationActions?: ReactNode
  contentAboveButton?: ReactNode
  actionButtonOverride?: ReactNode
  disableFlow?: boolean
  hideContainerBorder?: boolean
  onTransactionOpenChange?: (isOpen: boolean) => void
}

export const WidgetMigrate: FC<Props> = ({
  vaultAddress,
  assetAddress,
  chainId,
  vaultSymbol,
  vaultVersion,
  migrationTarget,
  migrationContract,
  migrationTargetSymbol,
  migrationTargetLogoURI,
  vaultUserData,
  migrationBalanceOverride,
  displayVaultUserData,
  balanceLabel = 'Your Balance',
  readyBalance,
  transactionStepOverride,
  onTransactionStepSuccess,
  actionLabelOverride,
  handleMigrateSuccess: onMigrateSuccess,
  headerActions,
  destinationActions,
  contentAboveButton,
  actionButtonOverride,
  disableFlow = false,
  hideContainerBorder = false,
  onTransactionOpenChange
}) => {
  const { address: account } = useAccount()
  const { openLoginModal } = useWeb3()
  const { getToken } = useWalletTokens()
  const trackEvent = usePlausible()
  const { getPrice } = useYearnSpotPrices([{ address: assetAddress, chainID: chainId }])
  const client = usePublicClient({ chainId })

  const [showTransactionOverlay, setShowTransactionOverlay] = useState(false)
  const [permitSignature, setPermitSignature] = useState<TPermitSignature | undefined>()
  const [permitData, setPermitData] = useState<any>(undefined)
  const [isLoadingPermitData, setIsLoadingPermitData] = useState(false)
  const signingDeadline = useRef<bigint | null>(null)

  // Get destination vault token info
  const destinationVault = getToken({ address: migrationTarget, chainID: chainId })

  // Get user's vault balance from props
  const { vaultToken, isLoading: isLoadingVaultData, refetch: refetchVaultUserData } = vaultUserData

  // Use only vault token balance (not staked)
  const migrateBalance = migrationBalanceOverride ?? vaultToken?.balance.raw ?? 0n
  const displayedUserData = displayVaultUserData ?? vaultUserData
  const displayedToken = displayedUserData.vaultToken
  const displayedBalance = displayVaultUserData ? (displayedToken?.balance.raw ?? 0n) : migrateBalance

  // Migration flow
  const { actions, periphery } = useMigrateFlow({
    vaultFrom: vaultAddress,
    vaultTo: migrationTarget,
    assetAddress,
    router: migrationContract,
    vaultVersion,
    balance: migrateBalance,
    account,
    chainId,
    enabled: !disableFlow && !transactionStepOverride && migrateBalance > 0n && !isZeroAddress(migrationContract),
    permitSignature
  })

  // Error handling
  const migrateError = useMigrateError({
    balance: migrateBalance,
    account,
    simulationError: transactionStepOverride ? undefined : periphery.error,
    isSimulating: actions.prepareMigrate.isLoading || actions.prepareMulticall.isLoading
  })

  // Formatted values
  const formattedBalance = formatTAmount({
    value: migrateBalance,
    decimals: vaultToken?.decimals ?? 18,
    options: { maximumFractionDigits: 6 }
  })
  const displayedBalances = useMemo(() => {
    const vaultDecimals = displayedToken?.decimals ?? 18
    const assetDecimals = displayedUserData.assetToken?.decimals ?? vaultDecimals
    const assetPrice = getPrice({ address: assetAddress, chainID: chainId }).normalized
    const balances = [
      { label: balanceLabel, amount: displayedBalance },
      ...(readyBalance === undefined ? [] : [{ label: 'Ready to migrate', amount: readyBalance }])
    ]

    return balances.map(({ label, amount }) => {
      const assetAmount =
        displayedUserData.pricePerShare > 0n
          ? (amount * displayedUserData.pricePerShare) / 10n ** BigInt(vaultDecimals)
          : 0n
      const usdValue = toNormalizedBN(assetAmount, assetDecimals).normalized * assetPrice
      return {
        label,
        amount: formatWidgetValue(amount, vaultDecimals),
        usdValue: `$${formatWidgetValue(usdValue)}`
      }
    })
  }, [
    assetAddress,
    balanceLabel,
    chainId,
    displayedBalance,
    displayedToken?.decimals,
    displayedUserData.assetToken?.decimals,
    displayedUserData.pricePerShare,
    getPrice,
    readyBalance
  ])

  // Determine flow based on routeType
  const isPermitFlow = periphery.routeType === 'permit'

  // For approve flow: needs approval if allowance insufficient
  const needsApproval = !isPermitFlow && !periphery.isAllowanceSufficient

  // For permit flow: needs permit signing if no valid signature
  const needsPermitSign = isPermitFlow && !permitSignature

  // Check if this is a V3 vault
  const isV3Vault = vaultVersion?.startsWith('3') || vaultVersion?.startsWith('~3')

  // Pre-fetch permit data when in permit flow
  useEffect(() => {
    const fetchPermitData = async () => {
      if (!isPermitFlow || !account || !client || migrateBalance === 0n) {
        setPermitData(undefined)
        return
      }

      setIsLoadingPermitData(true)

      try {
        // Read contract metadata
        const [nonceResult, nameResult, versionResult, apiVersionResult] = await Promise.allSettled([
          client.readContract({
            address: vaultAddress,
            abi: PERMIT_ABI,
            functionName: 'nonces',
            args: [account]
          }),
          client.readContract({
            address: vaultAddress,
            abi: PERMIT_ABI,
            functionName: 'name'
          }),
          client.readContract({
            address: vaultAddress,
            abi: PERMIT_ABI,
            functionName: 'version'
          }),
          client.readContract({
            address: vaultAddress,
            abi: PERMIT_ABI,
            functionName: 'apiVersion'
          })
        ])

        const nonce = nonceResult.status === 'fulfilled' ? nonceResult.value : 0n
        const tokenName = nameResult.status === 'fulfilled' ? nameResult.value : ''

        const domainName = isV3Vault ? 'Yearn Vault' : tokenName

        const version =
          apiVersionResult.status === 'fulfilled' && apiVersionResult.value
            ? apiVersionResult.value
            : versionResult.status === 'fulfilled' && versionResult.value
              ? versionResult.value
              : '1'

        setPermitData({
          domain: {
            name: domainName,
            version: version || '1',
            chainId: client.chain.id,
            verifyingContract: vaultAddress
          },
          types: {
            Permit: [
              { name: 'owner', type: 'address' },
              { name: 'spender', type: 'address' },
              { name: 'value', type: 'uint256' },
              { name: 'nonce', type: 'uint256' },
              { name: 'deadline', type: 'uint256' }
            ]
          },
          message: {
            owner: account,
            spender: periphery.routerAddress,
            value: migrateBalance,
            nonce
          },
          primaryType: 'Permit'
        })
      } catch {
        setPermitData(undefined)
      } finally {
        setIsLoadingPermitData(false)
      }
    }

    fetchPermitData()
  }, [isPermitFlow, account, client, vaultAddress, chainId, periphery.routerAddress, migrateBalance, isV3Vault])

  const getPermitData = useCallback(async () => {
    if (!permitData || !client) return undefined
    const { timestamp } = await client.getBlock()
    const deadline = timestamp + 20n * 60n
    signingDeadline.current = deadline
    return { ...permitData, message: { ...permitData.message, deadline } }
  }, [client, permitData])

  // Handle permit signed callback
  const handlePermitSigned = useCallback((signature: `0x${string}`) => {
    const deadline = signingDeadline.current
    if (deadline === null) return
    // Parse signature into r, s, v using viem utilities
    const r = slice(signature, 0, 32)
    const s = slice(signature, 32, 64)
    const vRaw = hexToNumber(slice(signature, 64, 65))
    // Normalize v to 27 or 28 (some wallets return 0 or 1)
    const v = vRaw < 27 ? vRaw + 27 : vRaw

    setPermitSignature({
      r,
      s,
      v,
      deadline,
      signature
    })
  }, [])
  // Transaction steps
  const currentStep: TransactionStep | undefined = useMemo(() => {
    if (transactionStepOverride) return transactionStepOverride
    // PERMIT FLOW
    if (isPermitFlow) {
      // Step 1: Sign permit
      if (needsPermitSign) {
        return {
          id: 'permit',
          isEnabled: !periphery.isCheckingPermit && !isLoadingPermitData && !!permitData,
          prepare: { isSuccess: true, data: { request: {} } } as any, // Permit doesn't need prepare
          label: 'Sign Permit',
          confirmMessage: `Sign permit for ${formattedBalance} ${vaultSymbol}`,
          successTitle: 'Permit signed',
          successMessage: 'Ready to migrate.',
          completesFlow: false,
          isPermit: true,
          permitData: { getPermitData } as any,
          onPermitSigned: handlePermitSigned,
          notification: {
            type: 'approve' as const,
            amount: formattedBalance,
            fromAddress: vaultAddress,
            fromSymbol: vaultSymbol,
            fromChainId: chainId
          }
        }
      }

      // Step 2: Execute multicall (selfPermit + migrate)
      return {
        id: 'migrate',
        isEnabled: !periphery.isCheckingPermit && periphery.prepareMulticallEnabled,
        prepare: actions.prepareMulticall,
        label: 'Migrate',
        confirmMessage: `Migrating ${formattedBalance} ${vaultSymbol}`,
        successTitle: 'Migration successful!',
        successMessage: 'Your funds have been migrated to the new vault.',
        completesFlow: true,
        showConfetti: true,
        notification: {
          type: 'migrate' as const,
          amount: formattedBalance,
          fromAddress: vaultAddress,
          fromSymbol: vaultSymbol,
          fromChainId: chainId,
          toAddress: migrationTarget,
          toSymbol: destinationVault?.symbol || migrationTargetSymbol || 'New Vault'
        }
      }
    }

    // APPROVE FLOW
    // Step 1: Approve
    if (needsApproval) {
      return {
        id: 'approve',
        isEnabled: !periphery.isCheckingPermit && periphery.prepareApproveEnabled,
        prepare: actions.prepareApprove,
        label: 'Approve',
        confirmMessage: `Approving ${formattedBalance} ${vaultSymbol} for migration`,
        successTitle: 'Approval successful',
        successMessage: `Approved ${formattedBalance} ${vaultSymbol}.\nReady to migrate.`,
        completesFlow: false,
        notification: {
          type: 'approve' as const,
          amount: formattedBalance,
          fromAddress: vaultAddress,
          fromSymbol: vaultSymbol,
          fromChainId: chainId
        }
      }
    }

    // Step 2: Migrate
    return {
      id: 'migrate',
      isEnabled: !periphery.isCheckingPermit && periphery.prepareMigrateEnabled,
      prepare: actions.prepareMigrate,
      label: 'Migrate',
      confirmMessage: `Migrating ${formattedBalance} ${vaultSymbol}`,
      successTitle: 'Migration successful!',
      successMessage: 'Your funds have been migrated to the new vault.',
      completesFlow: true,
      showConfetti: true,
      notification: {
        type: 'migrate' as const,
        amount: formattedBalance,
        fromAddress: vaultAddress,
        fromSymbol: vaultSymbol,
        fromChainId: chainId,
        toAddress: migrationTarget,
        toSymbol: destinationVault?.symbol || migrationTargetSymbol || 'New Vault'
      }
    }
  }, [
    transactionStepOverride,
    periphery.isCheckingPermit,
    periphery.prepareApproveEnabled,
    periphery.prepareMulticallEnabled,
    periphery.prepareMigrateEnabled,
    isLoadingPermitData,
    permitData,
    isPermitFlow,
    needsPermitSign,
    needsApproval,
    getPermitData,
    handlePermitSigned,
    actions.prepareApprove,
    actions.prepareMigrate,
    actions.prepareMulticall,
    formattedBalance,
    vaultSymbol,
    vaultAddress,
    migrationTarget,
    migrationTargetSymbol,
    destinationVault?.symbol,
    chainId
  ])

  // Handlers
  const handleMigrateSuccess = useCallback(() => {
    trackEvent(PLAUSIBLE_EVENTS.MIGRATE, {
      props: {
        chainID: String(chainId),
        fromVault: toAddress(vaultAddress),
        toVault: toAddress(migrationTarget),
        vaultSymbol
      }
    })
    setPermitSignature(undefined) // Clear permit signature after successful migration
    refetchVaultUserData()
    onMigrateSuccess?.()
  }, [trackEvent, chainId, vaultAddress, migrationTarget, vaultSymbol, refetchVaultUserData, onMigrateSuccess])

  const handleOverlayClose = useCallback(() => {
    setShowTransactionOverlay(false)
    onTransactionOpenChange?.(false)
    setPermitSignature(undefined)
  }, [onTransactionOpenChange])

  // Button text
  const buttonText = useMemo(() => {
    if (actionLabelOverride) return actionLabelOverride
    if (isLoadingPermitData || periphery.isCheckingPermit) return 'Loading...'
    if (isPermitFlow) {
      return needsPermitSign ? 'Sign & Migrate' : 'Migrate All'
    }
    if (needsApproval) return 'Approve & Migrate'
    return 'Migrate All'
  }, [
    actionLabelOverride,
    isPermitFlow,
    isLoadingPermitData,
    needsPermitSign,
    needsApproval,
    periphery.isCheckingPermit
  ])

  // Button disabled state
  const isButtonDisabled = useMemo(() => {
    if (disableFlow || isZeroAddress(migrationContract)) return true
    if (transactionStepOverride) {
      return (
        !account ||
        migrateBalance <= 0n ||
        transactionStepOverride.isEnabled === false ||
        !transactionStepOverride.prepare.isSuccess
      )
    }
    if (migrateError) return true

    if (migrateBalance === 0n) return true

    if (isLoadingPermitData || periphery.isCheckingPermit) return true

    // Permit flow
    if (isPermitFlow) {
      return needsPermitSign ? !permitData : !actions.prepareMulticall.isSuccess
    }

    // Approve flow
    if (needsApproval && !periphery.prepareApproveEnabled) {
      return true
    }
    if (!needsApproval && !periphery.prepareMigrateEnabled) {
      return true
    }
    return false
  }, [
    disableFlow,
    migrationContract,
    transactionStepOverride,
    account,
    migrateError,
    migrateBalance,
    isPermitFlow,
    isLoadingPermitData,
    permitData,
    needsPermitSign,
    needsApproval,
    periphery.prepareApproveEnabled,
    periphery.prepareMigrateEnabled,
    actions.prepareMulticall.isSuccess,
    periphery.isCheckingPermit
  ])

  // Determine if current step is the last step
  const isLastStep = useMemo(() => {
    if (transactionStepOverride) return Boolean(transactionStepOverride.completesFlow)
    if (isPermitFlow) {
      return !needsPermitSign // Last step when we have permit signature
    }
    return !needsApproval // Last step when we have approval
  }, [transactionStepOverride, isPermitFlow, needsPermitSign, needsApproval])

  // Loading state
  if (isLoadingVaultData && !showTransactionOverlay) {
    return (
      <div className={cl('flex flex-col rounded-lg relative', hideContainerBorder ? '' : 'border border-border')}>
        <WidgetHeader title="Migrate" actions={headerActions} />
        <div className="flex items-center justify-center flex-1 p-6">
          <div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className={cl('flex flex-col rounded-lg relative', hideContainerBorder ? '' : 'border border-border')}>
      <WidgetHeader title="Migrate" actions={headerActions} />
      <div className="flex flex-col p-6 gap-6">
        {/* Balance Section */}
        <div className="space-y-4">
          {displayedBalances.map(({ label, amount, usdValue }) => (
            <div key={label}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-text-secondary">{label}</span>
              </div>
              <div className="flex flex-col items-start">
                <span className="text-xl font-semibold text-text-primary">
                  {amount} {displayedToken?.symbol || vaultSymbol}
                </span>
                <span className="text-sm text-text-secondary">{usdValue}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Destination Section */}
        <div>
          <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
            <span className="text-xs text-text-secondary">Destination</span>
            {destinationActions}
          </div>
          <a
            href={`/vaults/${chainId}/${migrationTarget}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-between p-3 bg-surface-secondary hover:bg-surface-secondary/80 rounded-lg transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <TokenLogoV2
                src={
                  migrationTargetLogoURI ||
                  destinationVault?.logoURI ||
                  `${env.NEXT_PUBLIC_BASE_YEARN_ASSETS_URI}/tokens/${chainId}/${assetAddress.toLowerCase()}/logo-128.png`
                }
                altSrc={
                  migrationTargetLogoURI
                    ? undefined
                    : `${env.NEXT_PUBLIC_BASE_YEARN_ASSETS_URI}/tokens/${chainId}/${assetAddress.toLowerCase()}/logo-128.png`
                }
                tokenSymbol={destinationVault?.symbol || migrationTargetSymbol}
                tokenName={destinationVault?.name}
                width={32}
                height={32}
              />
              <div className="text-left">
                <p className="text-sm font-medium text-text-primary">
                  {destinationVault?.name || destinationVault?.symbol || migrationTargetSymbol || 'New Vault'}
                </p>
                <p className="text-xs text-text-secondary font-mono">
                  {migrationTarget.slice(0, 6)}...{migrationTarget.slice(-4)}
                </p>
              </div>
            </div>
            <IconLinkOut className="w-4 h-4 text-text-secondary" />
          </a>
        </div>

        {contentAboveButton}

        <div className="mt-auto">
          {actionButtonOverride ?? (
            <div>
              {!account ? (
                <Button
                  onClick={openLoginModal}
                  variant="filled"
                  className="w-full"
                  classNameOverride="yearn--button--nextgen w-full"
                >
                  Connect Wallet
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setShowTransactionOverlay(true)
                    onTransactionOpenChange?.(true)
                  }}
                  variant="filled"
                  disabled={isButtonDisabled}
                  className="w-full"
                  classNameOverride="yearn--button--nextgen w-full"
                >
                  {migrateError || buttonText}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Transaction Overlay */}
      <TransactionOverlay
        isOpen={showTransactionOverlay}
        onClose={handleOverlayClose}
        step={currentStep}
        isLastStep={isLastStep}
        autoContinueToNextStep
        autoContinueStepIds={['unlock', 'approve', 'permit']}
        onStepSuccess={onTransactionStepSuccess}
        onAllComplete={handleMigrateSuccess}
      />
    </div>
  )
}
