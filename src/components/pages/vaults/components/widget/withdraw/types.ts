import type { VaultUserData } from '@pages/vaults/hooks/useVaultUserData'

export type WithdrawRouteType = 'DIRECT_WITHDRAW' | 'DIRECT_UNSTAKE' | 'ENSO'

export type WithdrawalSource = 'vault' | 'staking' | null

export interface WithdrawWidgetProps {
  vaultAddress: `0x${string}`
  assetAddress: `0x${string}`
  stakingAddress?: `0x${string}`
  chainId: number
  vaultSymbol: string
  vaultVersion?: string
  isVaultRetired?: boolean
  vaultUserData: VaultUserData
  handleWithdrawSuccess?: () => void
  onOpenSettings?: () => void
  isSettingsOpen?: boolean
}
