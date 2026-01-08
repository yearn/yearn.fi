import type { Hash, TransactionReceipt } from 'viem'
import type { TAddress } from './address'

export type TNotificationStatus = 'pending' | 'submitted' | 'success' | 'error'

export type TNotificationType =
  | 'approve'
  | 'deposit'
  | 'withdraw'
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
  id?: number
  type: TNotificationType
  address: TAddress
  chainId: number
  toChainId?: number // Destination chain ID for cross-chain transactions
  spenderAddress?: TAddress
  spenderName?: string
  amount: string
  fromAddress?: TAddress // Token to deposit
  fromTokenName?: string
  fromAmount?: string
  toAddress?: TAddress // Vault token to receive
  toTokenName?: string
  toAmount?: string // Expected output amount for withdrawals
  txHash?: Hash
  timeFinished?: number
  blockNumber?: bigint
  status: TNotificationStatus
}

export type TCurtainStatus = { isOpen: boolean }

export type TNotificationsContext = {
  shouldOpenCurtain: boolean
  cachedEntries: TNotification[]
  notificationStatus: TNotificationStatus | null
  isLoading: boolean
  error: string | null
  setNotificationStatus: (value: TNotificationStatus | null) => void
  deleteByID: (id: number) => Promise<void>
  updateEntry: (value: Partial<TNotification>, id: number) => Promise<void>
  addNotification: (value: TNotification) => Promise<number>
  setShouldOpenCurtain: (value: boolean) => void
}

// New flat notification API types
export type TCreateNotificationParams = {
  type: TNotificationType
  amount: string // pre-formatted by caller
  fromAddress: TAddress
  fromSymbol: string
  fromChainId: number
  toAddress?: TAddress // optional for approve/claim
  toSymbol?: string
  toAmount?: string // expected output amount for withdrawals
  toChainId?: number // only when cross-chain
}

export type TUpdateNotificationParams = {
  id: number
  txHash?: Hash
  status?: TNotificationStatus
  receipt?: TransactionReceipt
}

export type TNotificationsActionsContext = {
  createNotification: (params: TCreateNotificationParams) => Promise<number>
  updateNotification: (params: TUpdateNotificationParams) => Promise<void>
}
