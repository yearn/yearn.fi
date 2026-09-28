import type { TEnsoBridgeProtocol, TEnsoBridgeStatus } from '@shared/types/ensoBridge'
import type { TTransactionRecord } from '@yearn/vault-widget/lifecycle'
import type { Hash } from 'viem'
import type { TAddress } from './address'

export type TNotificationStatus = 'pending' | 'submitted' | 'success' | 'error'
export type TBridgeTrackingState = 'active' | 'unavailable'

export type TNotificationType =
  | 'approve'
  | 'deposit'
  | 'withdraw'
  | 'start cooldown'
  | 'cancel cooldown'
  | 'zap'
  | 'crosschain zap'
  | 'withdraw zap'
  | 'crosschain withdraw zap'
  | 'deposit and stake'
  | 'stake'
  | 'unstake'
  | 'unstake and withdraw'
  | 'claim'
  | 'claim and exit'
  | 'migrate'

export type TNotification = {
  lifecycleRecord?: TTransactionRecord
  id?: number
  type: TNotificationType
  address: TAddress
  chainId: number
  executionChainId?: number
  toChainId?: number // Destination chain ID for cross-chain transactions
  spenderAddress?: TAddress
  spenderName?: string
  amount: string
  fromAddress?: TAddress // Token to deposit
  fromTokenName?: string
  fromAmount?: string
  toAddress?: TAddress // Vault token to receive
  toTokenName?: string
  toAmount?: string // Expected output amount for deposits/withdrawals
  txHash?: Hash
  createdAt?: number
  sourceConfirmedAt?: number
  lastBridgeCheckAt?: number
  bridgeCheckFailureStartedAt?: number
  timeFinished?: number
  blockNumber?: bigint
  awaitingExecution?: boolean
  bridgeProtocol?: TEnsoBridgeProtocol
  bridgeRequestId?: Hash
  bridgeStatus?: TEnsoBridgeStatus
  bridgeTrackingState?: TBridgeTrackingState
  destinationTxHash?: Hash
  bridgeError?: string
  status: TNotificationStatus
}

export type TNotificationsContext = {
  cachedEntries: TNotification[]
  notificationStatus: TNotificationStatus | null
  isLoading: boolean
  error: string | null
}
