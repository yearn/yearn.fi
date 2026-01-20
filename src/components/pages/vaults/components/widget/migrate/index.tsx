import { useVaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import { Button } from '@shared/components/Button'
import { TokenLogo } from '@shared/components/TokenLogo'
import { useWallet } from '@shared/contexts/useWallet'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { formatTAmount } from '@shared/utils'
import { type FC, useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { formatUnits } from 'viem'
import { useAccount } from 'wagmi'
import { TransactionOverlay, type TransactionStep } from '../shared/TransactionOverlay'
import { useMigrateError } from './useMigrateError'
import { useMigrateFlow } from './useMigrateFlow'

interface Props {
  vaultAddress: `0x${string}`
  assetAddress: `0x${string}`
  stakingAddress?: `0x${string}`
  chainId: number
  vaultSymbol: string
  migrationTarget: `0x${string}`
  migrationTargetSymbol?: string
  handleMigrateSuccess?: () => void
}

export const WidgetMigrate: FC<Props> = ({
  vaultAddress,
  assetAddress,
  stakingAddress,
  chainId,
  vaultSymbol,
  migrationTarget,
  migrationTargetSymbol,
  handleMigrateSuccess: onMigrateSuccess
}) => {
  const navigate = useNavigate()
  const { address: account } = useAccount()
  const { openLoginModal } = useWeb3()
  const { getToken } = useWallet()

  const [showTransactionOverlay, setShowTransactionOverlay] = useState(false)

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
    balance: migrateBalance,
    account,
    chainId,
    enabled: chainId === 1 && migrateBalance > 0n
  })

  // Error handling
  const migrateError = useMigrateError({
    balance: migrateBalance,
    account,
    simulationError: periphery.error,
    isSimulating: actions.prepareMigrate.isLoading
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

  // Transaction steps
  const needsApproval = !periphery.isAllowanceSufficient && periphery.routeType === 'APPROVE'
  const needsPermit = periphery.supportsPermit && !periphery.isAllowanceSufficient && !periphery.permitSignature

  const currentStep: TransactionStep | undefined = useMemo(() => {
    // Step 1: Permit signing (if vault supports EIP-2612 and no signature yet)
    if (needsPermit && periphery.permitData) {
      return {
        prepare: actions.prepareMigrate, // Dummy - not used for permit
        label: 'Permit',
        confirmMessage: `Sign permit for ${formattedBalance} ${vaultSymbol}`,
        successTitle: 'Permit signed',
        successMessage: `Permit signed.\nReady to migrate.`,
        isPermit: true,
        permitData: {
          domain: periphery.permitData.domain,
          types: periphery.permitData.types,
          message: periphery.permitData.message,
          primaryType: periphery.permitData.primaryType
        },
        onPermitSigned: periphery.setPermitSignature
      }
    }

    // Step 2: Approve (if vault doesn't support permit)
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

    // Step 3: Migrate
    return {
      prepare: actions.prepareMigrate,
      label: 'Migrate',
      confirmMessage: `Migrating ${formattedBalance} ${vaultSymbol}`,
      successTitle: 'Migration successful!',
      successMessage: `Your funds have been migrated to the new vault.`,
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
    needsPermit,
    needsApproval,
    periphery.permitData,
    periphery.setPermitSignature,
    actions.prepareApprove,
    actions.prepareMigrate,
    formattedBalance,
    vaultSymbol,
    vaultAddress,
    migrationTarget,
    chainId
  ])

  // Handlers
  const handleMigrateSuccess = useCallback(() => {
    refetchVaultUserData()
    onMigrateSuccess?.()
  }, [refetchVaultUserData, onMigrateSuccess])

  // Button text
  const buttonText = useMemo(() => {
    if (needsPermit) return 'Permit & Migrate'
    if (needsApproval) return 'Approve & Migrate'
    return 'Migrate All'
  }, [needsPermit, needsApproval])

  // Button disabled state
  const isButtonDisabled = useMemo(() => {
    if (migrateError) return true
    if (migrateBalance === 0n) return true
    // For permit flow: need permitData when allowance insufficient
    if (periphery.supportsPermit && !periphery.isAllowanceSufficient && !periphery.permitData) {
      return true
    }
    // For approve flow: need prepareApproveEnabled when allowance insufficient
    if (!periphery.supportsPermit && !periphery.isAllowanceSufficient && !periphery.prepareApproveEnabled) {
      return true
    }
    // For migrate step (when allowance is sufficient or permit signed): need prepareMigrateEnabled
    if ((periphery.isAllowanceSufficient || periphery.permitSignature) && !periphery.prepareMigrateEnabled) {
      return true
    }
    return false
  }, [
    migrateError,
    migrateBalance,
    periphery.supportsPermit,
    periphery.isAllowanceSufficient,
    periphery.permitData,
    periphery.permitSignature,
    periphery.prepareApproveEnabled,
    periphery.prepareMigrateEnabled
  ])

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
        <button
          type="button"
          onClick={() => navigate(`/vaults/${chainId}/${migrationTarget}`)}
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
          <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
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
        onClose={() => setShowTransactionOverlay(false)}
        step={currentStep}
        isLastStep={!needsPermit && !needsApproval}
        onAllComplete={handleMigrateSuccess}
      />
    </div>
  )
}
