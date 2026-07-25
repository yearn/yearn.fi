import type { ComponentType, CSSProperties, ReactNode } from 'react'
import type { Address, Hash, Hex, PublicClient } from 'viem'

export type VaultWidgetMode = 'deposit' | 'withdraw' | 'migrate' | 'rewards' | 'info'
export type VaultWidgetTransactionMode = Exclude<VaultWidgetMode, 'info'>

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

export type VaultWidgetPositionSource = {
  balanceLabel?: string
  id: string
  label: string
  token: VaultWidgetToken
  withdrawLabel?: string
  readAmount?: (publicClient: PublicClient, assets: bigint) => Promise<bigint>
  readValue?: (publicClient: PublicClient, balance: bigint) => Promise<bigint>
}

export type VaultWidgetPositionSourceState = VaultWidgetPositionSource & {
  balance: bigint
  value: bigint
}

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
  autoStake?: boolean
  chainId: number
  maxLossBps: number
  mode: 'deposit' | 'withdraw'
  positionBalance: bigint
  positionSource?: VaultWidgetPositionSource
  redeemAll?: boolean
  requestedPositionAmount?: bigint
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
  actionLabel?: string
  activityAmount?: string
  activityTokenIn?: Address
  activityTokenOut?: Address
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
  approvals?: readonly VaultWidgetApproval[]
  priceImpactPercent?: number | null
  isCrossChain?: boolean
  bridge?: EnsoBridgeDetails
  hideDetails?: boolean
  notice?: string
}

export type VaultWidgetRouteAdapter = {
  id: string
  supports: (
    request: Pick<VaultWidgetRequest, 'autoStake' | 'chainId' | 'mode' | 'positionSource' | 'selectedToken'>
  ) => boolean
  getApprovalTarget?: (
    request: Pick<VaultWidgetRequest, 'autoStake' | 'chainId' | 'mode' | 'positionSource' | 'selectedToken'>
  ) => VaultWidgetApprovalTarget | undefined
  getApprovalTargets?: (
    request: Pick<VaultWidgetRequest, 'autoStake' | 'chainId' | 'mode' | 'positionSource' | 'selectedToken'>
  ) => readonly VaultWidgetApprovalTarget[]
  quote: (request: VaultWidgetRequest, publicClient: PublicClient) => Promise<VaultWidgetQuote>
}

export type VaultWidgetConfig = {
  id: string
  name: string
  chainId: number
  vaultAddress: Address
  positionToken: VaultWidgetToken
  positionSources?: readonly VaultWidgetPositionSource[]
  infoPositionSources?: readonly VaultWidgetPositionSource[]
  depositTokens: readonly VaultWidgetToken[]
  withdrawTokens: readonly VaultWidgetToken[]
  adapters: readonly VaultWidgetRouteAdapter[]
  modes?: readonly VaultWidgetMode[]
  defaultMode?: VaultWidgetMode
  defaultDepositToken?: Address
  defaultWithdrawToken?: Address
  defaultPositionSource?: string
  defaultSlippagePercent?: number
  defaultMaxLossBps?: number
  tokenSelector?: VaultWidgetTokenSelectorConfig
  readPositionValue?: (publicClient: PublicClient, shares: bigint) => Promise<bigint>
  readPositionAmount?: (publicClient: PublicClient, assets: bigint) => Promise<bigint>
  migration?: VaultWidgetMigrationConfig
  rewards?: VaultWidgetRewardsConfig
  info?: VaultWidgetInfoConfig
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

export type VaultWidgetInfoConfig = {
  cooldownVaultAddress?: Address
  relatedAddresses?: readonly Address[]
  showAllPositionSources?: boolean
  showTotalShares?: boolean
}

export type VaultWidgetMigrationConfig = {
  migratorAddress: Address
  sourceVersion?: string
  targetToken?: VaultWidgetToken
  targetVault: Address
}

export type VaultWidgetRewardToken = VaultWidgetToken & {
  isFinished?: boolean
}

export type VaultWidgetRewardsConfig = {
  merkleTokenAllowlist?: readonly Address[]
  stakingAddress?: Address
  stakingSource?: string
  tokens: readonly VaultWidgetRewardToken[]
}

export type VaultWidgetVariant = {
  id: string
  label: string
  description?: string
  available: boolean
  config?: VaultWidgetConfig
  unavailableMessage?: string
}

export type VaultWidgetFamilyPreset = {
  id: string
  name: string
  defaultVariant: string
  variants: readonly VaultWidgetVariant[]
}

export type VaultWidgetExecutionStepKind =
  | 'switch-chain'
  | 'reset-approval'
  | 'approve'
  | 'permit'
  | 'safe-proposal'
  | 'execute'
  | 'wait-cross-chain'
  | 'refresh'

export type VaultWidgetExecutionStep = {
  id: string
  kind: VaultWidgetExecutionStepKind
  label: string
  chainId?: number
  request?: VaultWidgetTransactionRequest
  requests?: readonly VaultWidgetTransactionRequest[]
  bridge?: EnsoBridgeDetails
}

export type VaultWidgetWalletType = 'eoa' | 'safe'

export type VaultWidgetTransactionPlan = {
  id: string
  mode: VaultWidgetTransactionMode
  quote: VaultWidgetQuote
  steps: readonly VaultWidgetExecutionStep[]
  walletType: VaultWidgetWalletType
}

export type VaultWidgetExecutionState =
  | { status: 'idle' }
  | { status: 'confirming'; step: VaultWidgetExecutionStep; stepIndex: number; stepCount: number }
  | {
      status: 'pending'
      step: VaultWidgetExecutionStep
      stepIndex: number
      stepCount: number
      hash?: Hash
      proposalId?: Hex
    }
  | {
      status: 'submitted'
      step: VaultWidgetExecutionStep
      stepIndex: number
      stepCount: number
      hash: Hash
      proposalId?: Hex
    }
  | { status: 'success'; destinationHash?: Hash; hash?: Hash; proposalId?: Hex }
  | { status: 'error'; destinationHash?: Hash; error: Error; hash?: Hash; proposalId?: Hex }

export type VaultWidgetEvent =
  | { type: 'mode_changed'; mode: VaultWidgetMode }
  | { type: 'token_changed'; mode: 'deposit' | 'withdraw'; token: VaultWidgetToken }
  | { type: 'position_source_changed'; source: VaultWidgetPositionSource }
  | { type: 'quote_received'; quote: VaultWidgetQuote }
  | { type: 'transaction_started'; plan: VaultWidgetTransactionPlan }
  | { type: 'transaction_step'; step: VaultWidgetExecutionStep; hash?: Hash; proposalId?: Hex }
  | {
      type: 'transaction_submitted'
      plan: VaultWidgetTransactionPlan
      hash: Hash
      proposalId?: Hex
    }
  | { type: 'bridge_status'; status: EnsoBridgeStatus }
  | {
      type: 'transaction_succeeded'
      plan: VaultWidgetTransactionPlan
      destinationHash?: Hash
      hash?: Hash
      proposalId?: Hex
    }
  | {
      type: 'transaction_failed'
      plan: VaultWidgetTransactionPlan
      error: Error
      hash?: Hash
      proposalId?: Hex
    }

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
  confirmInWallet: string
  confirmInSafe: string
  transactionConfirmed: string
  transactionPending: string
  safeProposalPending: string
  safeProposalDescription: string
  crossChainSubmitted: string
  waitingForConfirmation: string
  waitingForDestination: string
  updatingBalances: string
  transactionComplete: string
  transactionFailed: string
  done: string
  tryAgain: string
  viewTransactionStatus: string
  viewOnBlockExplorer: string
  closeTransactionStatus: string
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
  onViewAllActivity?: () => void
  onEvent?: (event: VaultWidgetEvent) => void
  onSuccess?: (event: Extract<VaultWidgetEvent, { type: 'transaction_succeeded' }>) => void
  onError?: (event: Extract<VaultWidgetEvent, { type: 'transaction_failed' }>) => void
  copy?: Partial<VaultWidgetCopy>
  slots?: VaultWidgetSlots
  settingsOpen?: boolean
  defaultSettingsOpen?: boolean
  onSettingsOpenChange?: (open: boolean) => void
  className?: string
  style?: CSSProperties
  showNavigation?: boolean
  viewport?: 'auto' | 'desktop' | 'mobile'
  headerActions?: ReactNode
  renderPanel?: (mode: Exclude<VaultWidgetMode, 'deposit' | 'withdraw'>) => ReactNode
}

export type VaultFamilyWidgetProps = Omit<VaultWidgetProps, 'chainId' | 'config' | 'vaultAddress'> & {
  family: VaultWidgetFamilyPreset
  variant?: string
  defaultVariant?: string
  onVariantChange?: (variant: string) => void
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
  bridge?: EnsoBridgeDetails
  transaction: VaultWidgetTransactionRequest & {
    from: Address
  }
}

export type EnsoBridgeProtocol = 'stargate' | 'ccip' | 'relay'

export type EnsoBridgeDetails = {
  destinationChainId: number
  estimatedSeconds?: number
  protocol: EnsoBridgeProtocol
  sourceChainId: number
}

export type EnsoBridgeStatusName = 'pending' | 'inflight' | 'delivered' | 'failed' | 'unknown'

export type EnsoBridgeStatus = {
  destinationChainId?: number
  destinationTxHash?: Hash
  error?: string
  sourceChainId: number
  sourceTxHash: Hash
  status: EnsoBridgeStatusName
}

export type EnsoBridgeStatusRequest = EnsoBridgeDetails & {
  signal?: AbortSignal
  sourceTxHash: Hash
}

export type EnsoBridgeStatusProvider = {
  waitForCompletion: (
    request: EnsoBridgeStatusRequest,
    onStatus?: (status: EnsoBridgeStatus) => void
  ) => Promise<EnsoBridgeStatus>
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
  destinationHash?: Hash
  hash?: Hash
  proposalId?: Hex
  bridge?: EnsoBridgeDetails
  isFinalTransaction?: boolean
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
