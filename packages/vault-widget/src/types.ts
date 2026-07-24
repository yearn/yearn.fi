import type { ComponentType, CSSProperties, ReactNode } from 'react'
import type { Address, Hash, Hex, PublicClient } from 'viem'

export type VaultWidgetMode = 'deposit' | 'withdraw' | 'migrate' | 'rewards' | 'info'

export type VaultWidgetToken = {
  address: Address
  chainId: number
  decimals: number
  symbol: string
  name?: string
  logoURI?: string
  priceUsd?: number
  isNative?: boolean
  requiresApprovalReset?: boolean
}

export type VaultWidgetTokenReference = Pick<VaultWidgetToken, 'address' | 'chainId'>

export type VaultWidgetTokenSelectorChain = {
  id: number
  name: string
  logoURI: string
}

export type VaultWidgetTokenSelectorConfig = {
  chains?: readonly VaultWidgetTokenSelectorChain[]
  defaultTokens?: Partial<
    Record<Extract<VaultWidgetMode, 'deposit' | 'withdraw'>, readonly VaultWidgetTokenReference[]>
  >
}

export type VaultWidgetRequest = {
  account: Address
  amount: bigint
  chainId: number
  maxLossBps: number
  mode: 'deposit' | 'withdraw'
  positionBalance: bigint
  selectedToken: VaultWidgetToken
  signal: AbortSignal
  slippageBps: number
}

export type VaultWidgetTransactionRequest = {
  chainId: number
  to: Address
  data: Hex
  value?: bigint
}

export type VaultWidgetApproval = {
  amount: bigint
  spender: Address
  token: VaultWidgetToken
  resetBeforeApproval?: boolean
}

export type VaultWidgetApprovalTarget = Pick<VaultWidgetApproval, 'spender' | 'token'>

export type VaultWidgetExecutionCall = {
  id: string
  label: string
  transaction: VaultWidgetTransactionRequest
}

export type VaultWidgetQuote = {
  adapterId: string
  activityType?: VaultWidgetActivity['type']
  amountIn: bigint
  assetValue?: bigint
  expectedOut: bigint
  minExpectedOut: bigint
  positionAmount: bigint
  expiresAt?: number
  transaction: VaultWidgetTransactionRequest
  transactions?: readonly VaultWidgetExecutionCall[]
  approval?: VaultWidgetApproval
  priceImpactPercent?: number | null
  isCrossChain?: boolean
}

export type VaultWidgetRouteAdapter = {
  id: string
  supports: (request: Pick<VaultWidgetRequest, 'chainId' | 'mode' | 'selectedToken'>) => boolean
  getApprovalTarget?: (
    request: Pick<VaultWidgetRequest, 'chainId' | 'mode' | 'selectedToken'>
  ) => VaultWidgetApprovalTarget | undefined
  quote: (request: VaultWidgetRequest, publicClient: PublicClient) => Promise<VaultWidgetQuote>
}

export type VaultWidgetConfig = {
  id: string
  name: string
  chainId: number
  vaultAddress: Address
  positionToken: VaultWidgetToken
  depositTokens: readonly VaultWidgetToken[]
  withdrawTokens: readonly VaultWidgetToken[]
  adapters: readonly VaultWidgetRouteAdapter[]
  modes?: readonly VaultWidgetMode[]
  defaultMode?: VaultWidgetMode
  defaultDepositToken?: Address
  defaultWithdrawToken?: Address
  defaultSlippagePercent?: number
  defaultMaxLossBps?: number
  tokenSelector?: VaultWidgetTokenSelectorConfig
  readPositionValue?: (publicClient: PublicClient, shares: bigint) => Promise<bigint>
  solvers?: readonly string[]
  copy?: Partial<VaultWidgetCopy>
  display?: {
    approvalSpenderName?: Partial<Record<'deposit' | 'withdraw', string>>
    assetPriceUsd?: number
    estimatedApr?: number
    modeLabels?: Partial<Record<VaultWidgetMode, string>>
    positionLabel?: string
  }
}

export type VaultWidgetExecutionStepKind =
  | 'switch-chain'
  | 'reset-approval'
  | 'approve'
  | 'permit'
  | 'safe-proposal'
  | 'execute'
  | 'refresh'

export type VaultWidgetExecutionStep = {
  id: string
  kind: VaultWidgetExecutionStepKind
  label: string
  chainId?: number
  request?: VaultWidgetTransactionRequest
}

export type VaultWidgetTransactionPlan = {
  id: string
  mode: 'deposit' | 'withdraw'
  quote: VaultWidgetQuote
  steps: readonly VaultWidgetExecutionStep[]
}

export type VaultWidgetExecutionState =
  | { status: 'idle' }
  | { status: 'confirming'; step: VaultWidgetExecutionStep; stepIndex: number; stepCount: number }
  | {
      status: 'pending'
      step: VaultWidgetExecutionStep
      stepIndex: number
      stepCount: number
      hash: Hash
    }
  | { status: 'success'; hash?: Hash }
  | { status: 'error'; error: Error; hash?: Hash }

export type VaultWidgetEvent =
  | { type: 'mode_changed'; mode: VaultWidgetMode }
  | { type: 'token_changed'; mode: 'deposit' | 'withdraw'; token: VaultWidgetToken }
  | { type: 'quote_received'; quote: VaultWidgetQuote }
  | { type: 'transaction_started'; plan: VaultWidgetTransactionPlan }
  | { type: 'transaction_step'; step: VaultWidgetExecutionStep; hash?: Hash }
  | { type: 'transaction_succeeded'; plan: VaultWidgetTransactionPlan; hash?: Hash }
  | { type: 'transaction_failed'; plan: VaultWidgetTransactionPlan; error: Error; hash?: Hash }

export type VaultWidgetCopy = {
  connect: string
  amount: string
  balance: string
  position: string
  settings: string
  slippage: string
  maximumLoss: string
  solver: string
  autoStake: string
  submitDeposit: string
  submitWithdraw: string
  findingRoute: string
  approveAndDeposit: string
  approveAndWithdraw: string
  noRoute: string
  youWillDeposit: string
  youWillReceive: string
  vaultShareValue: string
  estimatedAnnualReturn: string
  existingApproval: string
  unstakeAndRedeem: string
}

export type VaultWidgetSlots = {
  ConnectButton?: ComponentType<{ onClick: () => void; label: string }>
  TokenIcon?: ComponentType<{ token: VaultWidgetToken; size: number }>
  TransactionLink?: ComponentType<{ chainId: number; hash: Hash; children: ReactNode }>
  Header?: ComponentType<{ mode: VaultWidgetMode; name: string }>
  Details?: ComponentType<{ quote: VaultWidgetQuote | undefined; mode: 'deposit' | 'withdraw' }>
}

export type VaultWidgetProps = {
  chainId: number
  vaultAddress: Address
  config?: VaultWidgetConfig
  mode?: VaultWidgetMode
  defaultMode?: VaultWidgetMode
  onModeChange?: (mode: VaultWidgetMode) => void
  onConnectWallet?: () => void
  onClose?: () => void
  onEvent?: (event: VaultWidgetEvent) => void
  onSuccess?: (event: Extract<VaultWidgetEvent, { type: 'transaction_succeeded' }>) => void
  onError?: (event: Extract<VaultWidgetEvent, { type: 'transaction_failed' }>) => void
  copy?: Partial<VaultWidgetCopy>
  slots?: VaultWidgetSlots
  className?: string
  style?: CSSProperties
  showNavigation?: boolean
  viewport?: 'auto' | 'desktop' | 'mobile'
  renderPanel?: (mode: Exclude<VaultWidgetMode, 'deposit' | 'withdraw'>) => ReactNode
}

export type EnsoRouteRequest = {
  account: Address
  amountIn: bigint
  chainId: number
  destinationChainId: number
  receiver: Address
  slippageBps: number
  tokenIn: Address
  tokenOut: Address
  signal?: AbortSignal
}

export type EnsoRoute = {
  amountOut: bigint
  expiresAt?: number
  minAmountOut: bigint
  priceImpactPercent?: number | null
  routeHasSwap?: boolean
  transaction: VaultWidgetTransactionRequest & {
    from: Address
  }
}

export type EnsoQuoteProvider = {
  getRoute: (request: EnsoRouteRequest) => Promise<EnsoRoute>
}

export type VaultWidgetActivityStatus = 'pending' | 'submitted' | 'success' | 'error'

export type VaultWidgetActivity = {
  id?: number
  account: Address
  amount: string
  chainId: number
  destinationChainId?: number
  hash?: Hash
  status: VaultWidgetActivityStatus
  timestamp: number
  tokenIn?: Address
  tokenOut?: Address
  type:
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
}
