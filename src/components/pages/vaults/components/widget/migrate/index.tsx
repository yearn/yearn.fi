import { useVaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import { Button } from '@shared/components/Button'
import { TokenLogo } from '@shared/components/TokenLogo'
import { useWallet } from '@shared/contexts/useWallet'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { PERMIT_ABI, type TPermitSignature } from '@shared/hooks/usePermit'
import { IconLinkOut } from '@shared/icons/IconLinkOut'
import { formatTAmount, isZeroAddress } from '@shared/utils'
import { type FC, useCallback, useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import { useAccount, usePublicClient } from 'wagmi'
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
  handleMigrateSuccess?: () => void
}

export const WidgetMigrate: FC<Props> = ({
  vaultAddress,
  assetAddress,
  stakingAddress,
  chainId,
  vaultSymbol,
  vaultVersion,
  migrationTarget,
  migrationContract,
  migrationTargetSymbol,
  handleMigrateSuccess: onMigrateSuccess
}) => {
  const { address: account } = useAccount()
  const { openLoginModal } = useWeb3()
  const { getToken } = useWallet()
  const client = usePublicClient({ chainId })

  const [showTransactionOverlay, setShowTransactionOverlay] = useState(false)
  const [permitSignature, setPermitSignature] = useState<TPermitSignature | undefined>()

  // Get destination vault token info
  const destinationVault = getToken({ address: migrationTarget, chainID: chainId })

  // Get user's vault balance
  const {
    vaultToken,
    pricePerShare,
    isLoading: isLoadingVaultData,
    refetch: refetchVaultUserData
  } = useVaultUserData({
    vaultAddress,
    assetAddress,
    stakingAddress,
    chainId,
    account
  })

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
    if (migrateBalance === 0n || !pricePerShare) return '0.00'
    const valueInAsset = (migrateBalance * pricePerShare) / 10n ** BigInt(vaultToken?.decimals ?? 18)
    // Simple USD estimate - in a full implementation would use price oracle
    return formatUnits(valueInAsset, 18).slice(0, 10)
  }, [migrateBalance, pricePerShare, vaultToken?.decimals])

  // Determine flow based on routeType
  const isPermitFlow = periphery.routeType === 'permit'

  // For approve flow: needs approval if allowance insufficient
  const needsApproval = !isPermitFlow && !periphery.isAllowanceSufficient

  // For permit flow: needs permit signing if no valid signature
  const needsPermitSign = isPermitFlow && !permitSignature

  // Permit data for signing (async getter to read contract data)
  const getPermitData = useCallback(async () => {
    if (!account || !client) return undefined

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
    const name = nameResult.status === 'fulfilled' ? nameResult.value : ''
    // Yearn V3 vaults use apiVersion for EIP-712 domain, prioritize it over version()
    const version =
      apiVersionResult.status === 'fulfilled' && apiVersionResult.value
        ? apiVersionResult.value
        : versionResult.status === 'fulfilled' && versionResult.value
          ? versionResult.value
          : '1'

    return {
      domain: {
        name,
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
    }
  }, [account, client, vaultAddress, chainId, periphery.routerAddress, migrateBalance, periphery.permitDeadline])

  // Handle permit signed callback
  const handlePermitSigned = useCallback(
    (signature: `0x${string}`) => {
      // Parse signature into r, s, v
      const r = `0x${signature.slice(2, 66)}` as `0x${string}`
      const s = `0x${signature.slice(66, 130)}` as `0x${string}`
      const v = parseInt(signature.slice(130, 132), 16)

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
  console.log(permitSignature)
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
          toAddress: migrationTarget
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
        toAddress: migrationTarget
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
    chainId
  ])

  // Handlers
  const handleMigrateSuccess = useCallback(() => {
    setPermitSignature(undefined) // Clear permit signature after successful migration
    refetchVaultUserData()
    onMigrateSuccess?.()
  }, [refetchVaultUserData, onMigrateSuccess])

  const handleOverlayClose = useCallback(() => {
    setShowTransactionOverlay(false)
    // Clear permit signature if user closes during permit flow (they can re-sign)
    if (needsPermitSign) {
      setPermitSignature(undefined)
    }
  }, [needsPermitSign])

  // Button text
  const buttonText = useMemo(() => {
    if (isPermitFlow) {
      return needsPermitSign ? 'Sign & Migrate' : 'Migrate All'
    }
    if (needsApproval) return 'Approve & Migrate'
    return 'Migrate All'
  }, [isPermitFlow, needsPermitSign, needsApproval])

  // Button disabled state
  const isButtonDisabled = useMemo(() => {
    if (migrateError) return true
    if (migrateBalance === 0n) return true

    // Permit flow: always enabled if we have balance (permit signing happens in overlay)
    if (isPermitFlow) {
      // If we have signature, check if multicall is ready
      if (permitSignature && !periphery.prepareMulticallEnabled) {
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
    permitSignature,
    needsApproval,
    periphery.prepareApproveEnabled,
    periphery.prepareMigrateEnabled,
    periphery.prepareMulticallEnabled
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
      <div className="p-6 flex items-center justify-center h-[317px]">
        <div className="w-6 h-6 border-2 border-border border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col relative">
      {/* Educational Banner */}
      <div className="mx-6 mt-7 p-4 bg-surface-secondary border-l-4 border-l-orange-500 dark:border-l-yellow-500 rounded-lg">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-orange-500 dark:text-yellow-500 mt-0.5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <h4 className="text-sm font-semibold text-text-primary">Vault is retired</h4>
            <p className="text-xs text-text-secondary mt-1">
              This vault is retired and won't be earning yield. Please migrate your shares to the newest version.
            </p>
          </div>
        </div>
      </div>

      {/* Balance Section */}
      <div className="px-6 pt-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-text-secondary">Your Balance</span>
        </div>
        <div className="flex flex-col items-start">
          <span className="text-xl font-semibold text-text-primary">
            {formattedBalance} {vaultToken?.symbol || vaultSymbol}
          </span>
          <span className="text-sm text-text-secondary">${balanceUsd}</span>
        </div>
      </div>

      {/* Destination Section */}
      <div className="px-6 pt-6">
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

      {/* Action Button */}
      <div className="px-6 pt-6 pb-6">
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
