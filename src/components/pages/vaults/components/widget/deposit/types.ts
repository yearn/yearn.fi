export type DepositRouteType = 'DIRECT_DEPOSIT' | 'DIRECT_STAKE' | 'ENSO' | 'KATANA_NATIVE_BRIDGE' | 'NO_ROUTE'

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
