import { getHistoryChainIds, getPriceChainName } from '@yearn/chains'
export interface ChainConfig {
  id: number
  name: string
  defillamaPrefix: string
}

export const SUPPORTED_CHAINS: ChainConfig[] = getHistoryChainIds().map((id) => ({
  id,
  name: getPriceChainName(id, 'yearn-prices')!,
  defillamaPrefix: getPriceChainName(id, 'defillama')!
}))

export interface DepositEvent {
  id: string
  vaultAddress: string
  chainId: number
  blockNumber: number
  blockTimestamp: number
  logIndex: number
  transactionHash: string
  transactionFrom: string
  owner: string
  sender: string
  assets: string
  shares: string
}

export interface WithdrawEvent {
  id: string
  vaultAddress: string
  chainId: number
  blockNumber: number
  blockTimestamp: number
  logIndex: number
  transactionHash: string
  transactionFrom: string
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
  logIndex: number
  transactionHash: string
  transactionFrom: string
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
  logIndex: number
  transactionHash: string
  transactionFrom: string
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
  logIndex: number
  transactionHash: string
  transactionFrom: string
  sender: string
  receiver: string
  value: string
}

export interface VaultMetadata {
  address: string
  chainId: number
  version: 'v2' | 'v3'
  category: 'stable' | 'volatile'
  isHidden?: boolean
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
