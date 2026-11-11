import { buildLockedMigrationBatch } from '@pages/vaults/components/widget/yvUSD/lockedMigration'
import { useTokenAllowance } from '@pages/vaults/hooks/useTokenAllowance'
import type { VaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import { type TYvUsdVariant, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { erc4626Abi } from '@shared/contracts/abi/4626.abi'
import { useReadContract, useSimulateContract } from '@shared/hooks/useAppWagmi'
import { isZeroAddress } from '@shared/utils'
import { type TransactionStep, useAtomicBatchCapability } from '@yearn/vault-widget/advanced'
import { useState } from 'react'
import type { Address } from 'viem'

export function useYvUsdMigrationFlow({
  account,
  chainId,
  isLocked,
  router,
  assetAddress,
  destination,
  unlockedUserData,
  lockedUserData,
  onVariantChange,
  onMigrateSuccess
}: {
  account?: Address
  chainId: number
  isLocked: boolean
  router: Address
  assetAddress: Address
  destination: Address
  unlockedUserData: VaultUserData
  lockedUserData: VaultUserData
  onVariantChange: (variant: TYvUsdVariant) => void
  onMigrateSuccess?: () => void
}) {
  const { isWalletSafe } = useWeb3()
  const [isTransactionOpen, setIsTransactionOpen] = useState(false)
  const [unlockAmountSnapshot, setUnlockAmountSnapshot] = useState<bigint | null>(null)
  const [unlockedAmount, setUnlockedAmount] = useState<bigint | null>(null)
  const [isUnlockComplete, setIsUnlockComplete] = useState(false)
  const routeConfigured = !isZeroAddress(router)
  const { data: rawMaxWithdraw, refetch: refetchMaxWithdraw } = useReadContract({
    address: YVUSD_LOCKED_ADDRESS,
    abi: erc4626Abi,
    functionName: 'maxWithdraw',
    args: account ? [account, 0n] : undefined,
    chainId,
    query: { enabled: !!account && isLocked, refetchInterval: isLocked ? 15_000 : false }
  })
  const maxWithdraw = typeof rawMaxWithdraw === 'bigint' ? rawMaxWithdraw : 0n
  const unlockAmount = unlockAmountSnapshot ?? maxWithdraw
  const needsUnlock = isLocked && !isUnlockComplete
  const isReadyToUnlock = needsUnlock && unlockAmount > 0n
  const prepareUnlock = useSimulateContract({
    address: YVUSD_LOCKED_ADDRESS,
    abi: erc4626Abi,
    functionName: 'withdraw',
    // Exact assets and zero tolerated loss keep the next migration amount deterministic.
    args: account && unlockAmount > 0n ? [unlockAmount, account, account, 0n] : undefined,
    account,
    chainId,
    query: { enabled: !!account && isReadyToUnlock }
  })
  const simulatedLockedShares = prepareUnlock.data?.result
  const { allowance = 0n } = useTokenAllowance({
    account,
    token: YVUSD_UNLOCKED_ADDRESS,
    spender: router,
    chainId,
    watch: true,
    enabled: routeConfigured && isReadyToUnlock
  })
  const { supported: supportsAtomicBatch } = useAtomicBatchCapability({
    account,
    chainId,
    enabled: routeConfigured && isReadyToUnlock && !isWalletSafe
  })
  const batch =
    (isWalletSafe || supportsAtomicBatch) && isReadyToUnlock
      ? buildLockedMigrationBatch({
          account,
          router,
          assetAddress,
          destination,
          amount: unlockAmount,
          allowance,
          chainId
        })
      : undefined
  const transactionStep: TransactionStep | undefined = isReadyToUnlock
    ? {
        id: batch ? 'unlock-migrate' : 'unlock',
        prepare: prepareUnlock,
        isEnabled: routeConfigured,
        label: batch ? 'Unlock & Migrate' : 'Unlock',
        confirmMessage: batch ? 'Unlocking and migrating your Legacy yvUSD' : 'Unlocking Legacy yvUSD for migration',
        successTitle: batch ? 'Migration successful!' : 'Unlock successful',
        successMessage: batch
          ? 'Your funds have been migrated to the selected vault.'
          : 'Your yvUSD is unlocked. Continuing to migration.',
        completesFlow: !!batch,
        showConfetti: !!batch,
        batch
      }
    : undefined

  const refreshBalances = async (): Promise<void> => {
    await Promise.all([unlockedUserData.refetch(), lockedUserData.refetch(), refetchMaxWithdraw()])
  }
  const onStepSuccess = async (stepId: string): Promise<void> => {
    if (stepId !== 'unlock') return
    // Store the confirmed amount before refresh so recovery survives a refresh failure.
    setUnlockedAmount(unlockAmount)
    await refreshBalances()
    setIsUnlockComplete(true)
  }
  const onTransactionOpenChange = (isOpen: boolean): void => {
    if (isOpen) {
      // Keep the active panel mounted if confirming the migration empties its balance.
      onVariantChange(isLocked ? 'locked' : 'unlocked')
      if (needsUnlock) setUnlockAmountSnapshot(unlockAmount)
    }
    setIsTransactionOpen(isOpen)
    if (!isOpen) {
      setUnlockAmountSnapshot(null)
      if (unlockedAmount !== null) {
        onVariantChange('unlocked')
        if (unlockedAmount === 0n) setUnlockedAmount(null)
      }
    }
  }
  const selectVariant = (variant: TYvUsdVariant): void => {
    setUnlockedAmount(null)
    setIsUnlockComplete(false)
    setUnlockAmountSnapshot(null)
    onVariantChange(variant)
  }
  const completeMigration = (): void => {
    setUnlockedAmount(isLocked ? 0n : null)
    if (isLocked) setIsUnlockComplete(true)
    void refreshBalances().catch((error) => console.error('Failed to refresh yvUSD balances after migration', error))
    onMigrateSuccess?.()
  }

  return {
    isTransactionOpen,
    isReadyToUnlock,
    needsUnlock,
    transactionStep,
    readyLockedShares: isReadyToUnlock && typeof simulatedLockedShares === 'bigint' ? simulatedLockedShares : undefined,
    migrationAmount: unlockedAmount ?? (isLocked ? unlockAmount : undefined),
    hasPendingMigration: unlockedAmount !== null && unlockedAmount > 0n,
    onStepSuccess,
    onTransactionOpenChange,
    selectVariant,
    completeMigration
  }
}
