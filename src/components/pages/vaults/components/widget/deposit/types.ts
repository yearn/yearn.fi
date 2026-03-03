export type DepositRouteType = 'DIRECT_DEPOSIT' | 'DIRECT_STAKE' | 'SPLITTER_DEPOSIT' | 'ENSO' | 'NO_ROUTE'

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
