import type { VaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import type { ReactNode } from 'react'

export type WithdrawRouteType = 'DIRECT_WITHDRAW' | 'DIRECT_UNSTAKE' | 'DIRECT_UNSTAKE_WITHDRAW' | 'ENSO'

export type WithdrawalSource = 'vault' | 'staking' | null

export interface WithdrawWidgetProps {
  vaultAddress: `0x${string}`
  assetAddress: `0x${string}`
  displayAssetAddress?: `0x${string}`
  stakingAddress?: `0x${string}`
  chainId: number
  vaultSymbol: string
  stakingSource?: string
  vaultVersion?: string
  isVaultRetired?: boolean
  vaultUserData: VaultUserData
  maxWithdrawAssets?: bigint
  requiredSharesOverride?: bigint
  expectedOutOverride?: bigint
  isActionDisabled?: boolean
  actionDisabledReason?: string
  disableTokenSelector?: boolean
  hideZapForTokens?: `0x${string}`[]
  disableAmountInput?: boolean
  hideActionButton?: boolean
  prefill?: {
    address: `0x${string}`
    chainId: number
    amount?: string
  }
  prefillRequestKey?: string
  onPrefillApplied?: () => void
  headerActions?: ReactNode
  onAmountChange?: (amount: bigint) => void
  handleWithdrawSuccess?: () => void
  onOpenSettings?: () => void
  isSettingsOpen?: boolean
}
