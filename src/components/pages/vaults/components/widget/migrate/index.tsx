import { usePlausible } from '@hooks/usePlausible'
import type { VaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import { Button } from '@shared/components/Button'
import { TokenLogo } from '@shared/components/TokenLogo'
import { useWallet } from '@shared/contexts/useWallet'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { usePublicClient } from '@shared/hooks/useAppWagmi'
import type { TPermitSignature } from '@shared/hooks/usePermit'
import { IconLinkOut } from '@shared/icons/IconLinkOut'
import { formatTAmount, isZeroAddress, toAddress, toNormalizedBN } from '@shared/utils'
import { PLAUSIBLE_EVENTS } from '@shared/utils/plausible'
import { type FC, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { hexToNumber, slice } from 'viem'
import { useAccount } from 'wagmi'
import { useYearn } from '@/components/shared/contexts/useYearn'
import { TransactionOverlay, type TransactionStep } from '../shared/TransactionOverlay'
import { formatWidgetValue } from '../shared/valueDisplay'
import { WidgetHeader } from '../shared/WidgetHeader'
import { buildVerifiedPermitData, createPermitDeadline } from './permitData'
import { useMigrateError } from './useMigrateError'
import { useMigrateFlow } from './useMigrateFlow'

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
  vaultUserData: VaultUserData
  handleMigrateSuccess?: () => void
}

type PermitSignatureState = {
  key: string
  signature: TPermitSignature
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
  vaultUserData,
  handleMigrateSuccess: onMigrateSuccess
}) => {
  const { address: account } = useAccount()
  const { openLoginModal } = useWeb3()
  const { getToken } = useWallet()
  const trackEvent = usePlausible()
  const { getPrice, zapSlippage } = useYearn()
  const client = usePublicClient({ chainId })

  const [showTransactionOverlay, setShowTransactionOverlay] = useState(false)
  const [permitSignatureState, setPermitSignatureState] = useState<PermitSignatureState | undefined>()
  const [isLoadingPermitData, setIsLoadingPermitData] = useState(false)
  const [permitDomainVerified, setPermitDomainVerified] = useState(false)
  const lastPermitDeadlineRef = useRef<bigint | undefined>(undefined)

  // Get destination vault token info
  const destinationVault = getToken({ address: migrationTarget, chainID: chainId })

  // Get user's vault balance from props
  const { vaultToken, isLoading: isLoadingVaultData, refetch: refetchVaultUserData } = vaultUserData

  // Use only vault token balance (not staked)
  const migrateBalance = vaultToken?.balance.raw ?? 0n

  const permitSigningKey = useMemo(
    () =>
      [
        (account ?? '').toLowerCase(),
        vaultAddress.toLowerCase(),
        chainId,
        migrationContract.toLowerCase(),
        vaultVersion ?? '',
        migrateBalance.toString()
      ].join(':'),
    [account, vaultAddress, chainId, migrationContract, vaultVersion, migrateBalance]
  )
  const permitSignature = permitSignatureState?.key === permitSigningKey ? permitSignatureState.signature : undefined

  // Migration flow
  const { actions, periphery } = useMigrateFlow({
    vaultFrom: vaultAddress,
    vaultTo: migrationTarget,
    router: migrationContract,
    vaultVersion,
    balance: migrateBalance,
    account,
    chainId,
    enabled: migrateBalance > 0n && !isZeroAddress(migrationContract),
    slippage: zapSlippage,
    permitSignature,
    permitDomainVerified
  })

  // Error handling
  const migrateError = useMigrateError({
    balance: migrateBalance,
    account,
    simulationError: periphery.error,
    isSimulating: actions.prepareMigrate.isLoading || actions.prepareMulticall.isLoading
  })

  // Formatted values
  const formattedBalance = formatTAmount({
    value: migrateBalance,
    decimals: vaultToken?.decimals ?? 18,
    options: { maximumFractionDigits: 6 }
  })
  const displayBalance = formatWidgetValue(migrateBalance, vaultToken?.decimals ?? 18)

  const balanceUsd = useMemo(() => {
    if (migrateBalance === 0n) return '$0'

    const usdValue =
      Number(toNormalizedBN(migrateBalance, vaultToken?.decimals ?? 18).display) *
      getPrice({ address: vaultAddress, chainID: chainId }).normalized
    return `$${formatWidgetValue(usdValue)}`
  }, [migrateBalance, vaultAddress, chainId, getPrice, vaultToken?.decimals])

  // Determine flow based on routeType
  const isPermitFlow = periphery.routeType === 'permit'

  // For approve flow: needs approval if allowance insufficient
  const needsApproval = !isPermitFlow && !periphery.isAllowanceSufficient

  // For permit flow: needs permit signing if no valid signature
  const needsPermitSign = isPermitFlow && !permitSignature

  useEffect(() => {
    setPermitSignatureState(undefined)
    lastPermitDeadlineRef.current = undefined
  }, [permitSigningKey, periphery.routerAddress])

  // Verify permit domain before offering the permit path.
  useEffect(() => {
    let isCurrent = true

    const verifyPermitDomain = async () => {
      if (!account || !client || migrateBalance === 0n) {
        setPermitDomainVerified(false)
        setIsLoadingPermitData(false)
        return
      }

      setPermitDomainVerified(false)
      setIsLoadingPermitData(true)

      try {
        const deadline = createPermitDeadline()
        const data = await buildVerifiedPermitData({
          client,
          vaultAddress,
          account,
          spender: periphery.routerAddress,
          value: migrateBalance,
          chainId,
          deadline
        })
        if (isCurrent) {
          setPermitDomainVerified(Boolean(data))
        }
      } catch {
        if (isCurrent) {
          setPermitDomainVerified(false)
        }
      } finally {
        if (isCurrent) {
          setIsLoadingPermitData(false)
        }
      }
    }

    verifyPermitDomain()

    return () => {
      isCurrent = false
    }
  }, [account, client, vaultAddress, chainId, periphery.routerAddress, migrateBalance])

  const getPermitData = useCallback(async () => {
    if (!account || !client || migrateBalance === 0n) return undefined

    const deadline = createPermitDeadline()
    const data = await buildVerifiedPermitData({
      client,
      vaultAddress,
      account,
      spender: periphery.routerAddress,
      value: migrateBalance,
      chainId,
      deadline
    })

    lastPermitDeadlineRef.current = data?.message.deadline
    return data
  }, [account, client, vaultAddress, chainId, periphery.routerAddress, migrateBalance])

  // Handle permit signed callback
  const handlePermitSigned = useCallback(
    (signature: `0x${string}`) => {
      // Parse signature into r, s, v using viem utilities
      const r = slice(signature, 0, 32)
      const s = slice(signature, 32, 64)
      const vRaw = hexToNumber(slice(signature, 64, 65))
      // Normalize v to 27 or 28 (some wallets return 0 or 1)
      const v = vRaw < 27 ? vRaw + 27 : vRaw
      const deadline = lastPermitDeadlineRef.current

      if (deadline === undefined) {
        throw new Error('Missing permit deadline')
      }

      setPermitSignatureState({
        key: permitSigningKey,
        signature: {
          r,
          s,
          v,
          deadline,
          signature
        }
      })
    },
    [permitSigningKey]
  )
  // Transaction steps
  const currentStep: TransactionStep | undefined = useMemo(() => {
    // PERMIT FLOW
    if (isPermitFlow) {
      // Step 1: Sign permit
      if (needsPermitSign) {
        return {
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
    setPermitSignatureState(undefined) // Clear permit signature after successful migration
    refetchVaultUserData()
    onMigrateSuccess?.()
  }, [trackEvent, chainId, vaultAddress, migrationTarget, vaultSymbol, refetchVaultUserData, onMigrateSuccess])

  const handleOverlayClose = useCallback(() => {
    setShowTransactionOverlay(false)
    // Clear permit signature if user closes during permit flow (they can re-sign)
    if (needsPermitSign) {
      setPermitSignatureState(undefined)
    }
  }, [needsPermitSign])

  // Button text
  const buttonText = useMemo(() => {
    if (isLoadingPermitData || periphery.isCheckingPermit) return 'Loading...'
    if (isPermitFlow) {
      return needsPermitSign ? 'Sign & Migrate' : 'Migrate All'
    }
    if (needsApproval) return 'Approve & Migrate'
    return 'Migrate All'
  }, [isPermitFlow, isLoadingPermitData, needsPermitSign, needsApproval, periphery.isCheckingPermit])

  // Button disabled state
  const isButtonDisabled = useMemo(() => {
    if (migrateError) return true

    if (migrateBalance === 0n) return true

    if (isLoadingPermitData || periphery.isCheckingPermit) return true

    // Permit flow
    if (isPermitFlow) {
      if (permitSignature && !actions.prepareMulticall.isSuccess) {
        return true
      }
      return false
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
    migrateError,
    migrateBalance,
    isPermitFlow,
    isLoadingPermitData,
    permitSignature,
    needsApproval,
    periphery.prepareApproveEnabled,
    periphery.prepareMigrateEnabled,
    actions.prepareMulticall.isSuccess,
    periphery.isCheckingPermit
  ])

  // Determine if current step is the last step
  const isLastStep = useMemo(() => {
    if (isPermitFlow) {
      return !needsPermitSign // Last step when we have permit signature
    }
    return !needsApproval // Last step when we have approval
  }, [isPermitFlow, needsPermitSign, needsApproval])

  // Loading state
  if (isLoadingVaultData) {
    return (
      <div className="flex flex-col border border-border rounded-lg relative h-full">
        <WidgetHeader title="Migrate" />
        <div className="flex items-center justify-center flex-1 p-6">
          <div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col border border-border rounded-lg relative h-full">
      <WidgetHeader title="Migrate" />
      <div className="flex flex-col flex-1 p-6 gap-6">
        {/* Balance Section */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-text-secondary">Your Balance</span>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-xl font-semibold text-text-primary">
              {displayBalance} {vaultToken?.symbol || vaultSymbol}
            </span>
            <span className="text-sm text-text-secondary">{balanceUsd}</span>
          </div>
        </div>

        {/* Destination Section */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-text-secondary">Destination</span>
          </div>
          <a
            href={`/vaults/${chainId}/${migrationTarget}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-between p-3 bg-surface-secondary hover:bg-surface-secondary/80 rounded-lg transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <TokenLogo
                src={
                  destinationVault?.logoURI ||
                  `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${chainId}/${assetAddress.toLowerCase()}/logo-128.png`
                }
                altSrc={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${chainId}/${assetAddress.toLowerCase()}/logo-128.png`}
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

        <div className="mt-auto">
          {/* Action Button */}
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
                onClick={() => setShowTransactionOverlay(true)}
                variant="filled"
                disabled={isButtonDisabled}
                className="w-full"
                classNameOverride="yearn--button--nextgen w-full"
              >
                {migrateError || buttonText}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Transaction Overlay */}
      <TransactionOverlay
        isOpen={showTransactionOverlay}
        onClose={handleOverlayClose}
        step={currentStep}
        isLastStep={isLastStep}
        autoContinueToNextStep
        autoContinueStepLabels={['Approve', 'Sign Permit']}
        onAllComplete={handleMigrateSuccess}
      />
    </div>
  )
}
