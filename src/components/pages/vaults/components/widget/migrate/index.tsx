import { usePlausible } from '@hooks/usePlausible'
import type { VaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import { Button } from '@shared/components/Button'
import { TokenLogo } from '@shared/components/TokenLogo'
import { useWallet } from '@shared/contexts/useWallet'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { PERMIT_ABI, type TPermitSignature } from '@shared/hooks/usePermit'
import { IconLinkOut } from '@shared/icons/IconLinkOut'
import { formatCounterValue, formatTAmount, isZeroAddress, toAddress, toNormalizedBN } from '@shared/utils'
import { PLAUSIBLE_EVENTS } from '@shared/utils/plausible'
import { type FC, useCallback, useEffect, useMemo, useState } from 'react'
import { hexToNumber, slice } from 'viem'
import { useAccount, usePublicClient } from 'wagmi'
import { useYearn } from '@/components/shared/contexts/useYearn'
import { TransactionOverlay, type TransactionStep } from '../shared/TransactionOverlay'
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
  const { getPrice } = useYearn()
  const client = usePublicClient({ chainId })

  const [showTransactionOverlay, setShowTransactionOverlay] = useState(false)
  const [permitSignature, setPermitSignature] = useState<TPermitSignature | undefined>()
  const [permitData, setPermitData] = useState<any>(undefined)
  const [isLoadingPermitData, setIsLoadingPermitData] = useState(false)

  // Get destination vault token info
  const destinationVault = getToken({ address: migrationTarget, chainID: chainId })

  // Get user's vault balance from props
  const { vaultToken, isLoading: isLoadingVaultData, refetch: refetchVaultUserData } = vaultUserData

  // Use only vault token balance (not staked)
  const migrateBalance = vaultToken?.balance.raw ?? 0n

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
    permitSignature
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

  const balanceUsd = useMemo(() => {
    if (migrateBalance === 0n) return '$0.00'

    return formatCounterValue(
      toNormalizedBN(migrateBalance, vaultToken?.decimals ?? 18).display,
      getPrice({ address: vaultAddress, chainID: chainId }).normalized
    )
  }, [migrateBalance, vaultAddress, chainId, getPrice, vaultToken?.decimals])

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
            chainId,
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
            nonce,
            deadline: periphery.permitDeadline
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
  }, [
    isPermitFlow,
    account,
    client,
    vaultAddress,
    chainId,
    periphery.routerAddress,
    migrateBalance,
    periphery.permitDeadline,
    isV3Vault
  ])

  // Getter for permit data (returns cached data)
  const getPermitData = useCallback(async () => {
    return permitData
  }, [permitData])

  // Handle permit signed callback
  const handlePermitSigned = useCallback(
    (signature: `0x${string}`) => {
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
        deadline: periphery.permitDeadline,
        signature
      })
    },
    [periphery.permitDeadline]
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
        chainID: chainId,
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
    // Clear permit signature if user closes during permit flow (they can re-sign)
    if (needsPermitSign) {
      setPermitSignature(undefined)
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
      <div className="flex items-center justify-center h-[317px]">
        <div className="w-6 h-6 border-2 border-border border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col border border-border rounded-lg relative h-full">
      <div className="flex items-center justify-between gap-3 px-6 pt-4 ">
        <h3 className="text-base font-semibold text-text-primary">Migrate</h3>
      </div>
      <div className="flex flex-col flex-1 p-6 gap-6">
        {/* Balance Section */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-text-secondary">Your Balance</span>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-xl font-semibold text-text-primary">
              {formattedBalance} {vaultToken?.symbol || vaultSymbol}
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
        onAllComplete={handleMigrateSuccess}
      />
    </div>
  )
}
