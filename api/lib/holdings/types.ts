export interface ChainConfig {
  id: number
  name: string
  defillamaPrefix: string
}

export const SUPPORTED_CHAINS: ChainConfig[] = [
  { id: 1, name: 'ethereum', defillamaPrefix: 'ethereum' },
  { id: 8453, name: 'base', defillamaPrefix: 'base' },
  { id: 42161, name: 'arbitrum', defillamaPrefix: 'arbitrum' },
  { id: 137, name: 'polygon', defillamaPrefix: 'polygon' }
]

export interface DepositEvent {
  id: string
  vaultAddress: string
  chainId: number
  blockNumber: number
  blockTimestamp: number
  owner: string
  assets: string
  shares: string
}

export interface WithdrawEvent {
  id: string
  vaultAddress: string
  chainId: number
  blockNumber: number
  blockTimestamp: number
  owner: string
  assets: string
  shares: string
}

export interface TransferEvent {
  id: string
  vaultAddress: string
  chainId: number
  blockNumber: number
  blockTimestamp: number
  sender: string
  receiver: string
  value: string
}

export interface VaultMetadata {
  address: string
  chainId: number
  token: {
    address: string
    symbol: string
    decimals: number
  }
  decimals: number
}

export interface KongPPSDataPoint {
  time: number
  component: string
  value: string
}

export interface DefiLlamaPricePoint {
  timestamp: number
  price: number
  confidence: number
}

export interface DefiLlamaBatchResponse {
  coins: {
    [key: string]: {
      symbol: string
      prices: DefiLlamaPricePoint[]
    }
  }
}

export interface VaultHolding {
  address: string
  shares: string
  usdValue: number
  pricePerShare: number
  underlyingPrice: number
}

export interface ChainHoldings {
  chainId: number
  chainName: string
  totalUsdValue: number
  vaults: VaultHolding[]
}

export interface DailyHoldings {
  date: string
  timestamp: number
  totalUsdValue: number
  chains: ChainHoldings[]
}

export interface HoldingsHistoryResponse {
  address: string
  periodDays: number
  dataPoints: DailyHoldings[]
}

export interface CachedHolding {
  userAddress: string
  date: string
  chainId: number
  vaultAddress: string
  shares: string
  usdValue: number
  pricePerShare: number
  underlyingPrice: number
}

export interface UserEvents {
  deposits: DepositEvent[]
  withdrawals: WithdrawEvent[]
  transfersIn: TransferEvent[]
  transfersOut: TransferEvent[]
}

export interface TimelineEvent {
  vaultAddress: string
  chainId: number
  blockNumber: number
  blockTimestamp: number
  sharesChange: bigint
}
