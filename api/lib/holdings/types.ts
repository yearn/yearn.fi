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
  transactionHash: string
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
  transactionHash: string
  owner: string
  assets: string
  shares: string
}

export interface V2DepositEvent {
  id: string
  vaultAddress: string
  chainId: number
  blockNumber: number
  blockTimestamp: number
  transactionHash: string
  recipient: string
  amount: string
  shares: string
}

export interface V2WithdrawEvent {
  id: string
  vaultAddress: string
  chainId: number
  blockNumber: number
  blockTimestamp: number
  transactionHash: string
  recipient: string
  amount: string
  shares: string
}

export interface TransferEvent {
  id: string
  vaultAddress: string
  chainId: number
  blockNumber: number
  blockTimestamp: number
  transactionHash: string
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

// PnL Types

export interface FifoLot {
  shares: bigint
  assets: bigint // total assets for this lot (keeps BigInt precision)
  timestamp: number
}

export interface VaultPnL {
  vaultAddress: string
  chainId: number
  tokenSymbol: string
  tokenDecimals: number
  // In underlying token terms
  totalDeposited: number
  totalWithdrawn: number
  currentShares: number
  currentValue: number // shares * PPS
  realizedPnL: number
  unrealizedPnL: number
  totalPnL: number
  // In USD terms
  currentValueUsd: number
  realizedPnLUsd: number
  unrealizedPnLUsd: number
  totalPnLUsd: number
}

export interface PnLResponse {
  address: string
  summary: {
    totalDepositedUsd: number
    totalWithdrawnUsd: number
    currentValueUsd: number
    realizedPnLUsd: number
    unrealizedPnLUsd: number
    totalPnLUsd: number
    totalPnLPercent: number
  }
  vaults: VaultPnL[]
}
