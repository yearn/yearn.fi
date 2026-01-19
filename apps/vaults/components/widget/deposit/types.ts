export type DepositRouteType = 'DIRECT_DEPOSIT' | 'DIRECT_STAKE' | 'ENSO'

export interface DepositWidgetProps {
  vaultAddress: `0x${string}`
  assetAddress: `0x${string}`
  stakingAddress?: `0x${string}`
  chainId: number
  vaultAPR: number
  vaultSymbol: string
  stakingSource?: string
  handleDepositSuccess?: () => void
}
