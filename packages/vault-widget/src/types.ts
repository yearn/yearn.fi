import type { ReactNode } from 'react'
import type { Hash, Hex, TransactionReceipt } from 'viem'

/**
 * An EVM address accepted by the widget.
 *
 * The package owns this structural type so its public model does not depend on
 * a host application's address aliases or API response types.
 */
export type WidgetAddress = `0x${string}`

/** Compatibility name used throughout the extracted widget implementation. */
export type TAddress = WidgetAddress
export type TAddressLike = WidgetAddress | string
export type TNumberish = bigint | number | string | `${number}`
export type TDict<T> = Record<string, T>
export type TNDict<T> = Record<number, T>

/** A token amount represented in both exact and display-friendly forms. */
export type NormalizedBalance = {
  raw: bigint
  normalized: number
  display: string
  decimals: number
}

/** Compatibility name used by the original Yearn amount helpers. */
export type TNormalizedBN = NormalizedBalance

/** Token metadata and wallet balance consumed by the widget. */
export type Token = {
  address: WidgetAddress
  chainId: number
  decimals: number
  symbol: string
  name: string
  balance: NormalizedBalance
  logoURI?: string
  /** Current USD value of the wallet balance, when supplied by the host. */
  value?: number
}

/** Fully-resolved token used by the selector and host runtime adapters. */
export type TToken = Token

/** The underlying asset accepted by a vault. */
export type VaultWidgetAsset = {
  address: WidgetAddress
  decimals: number
  symbol: string
  name: string
  logoURI?: string
}

/** Optional staking wrapper associated with a vault. */
export type VaultWidgetStaking = {
  address: WidgetAddress
  /** Identifies contract-specific behavior such as `VeYFI` or `yBOLD`. */
  source?: string
}

/** Optional migration route associated with a vault. */
export type VaultWidgetMigration = {
  available: boolean
  /** Vault that receives the migrated position. */
  address?: WidgetAddress
  /** Contract used to execute the migration. */
  contract?: WidgetAddress
}

/**
 * Framework-neutral vault descriptor used by the widget.
 *
 * Hosts normalize their API-specific vault shape into this small model before
 * rendering. APR values are fractional (for example, `0.05` means 5%).
 */
export type VaultWidgetVault = {
  address: WidgetAddress
  chainId: number
  version: string
  decimals: number
  symbol: string
  name: string
  asset: VaultWidgetAsset
  forwardAPR: number
  staking?: VaultWidgetStaking
  migration?: VaultWidgetMigration
  isRetired: boolean
  /** Used by token-selection policy when a host supplies a vault catalog. */
  isHidden?: boolean
}

/** User-specific on-chain data required by deposit and withdrawal flows. */
export type VaultUserData = {
  assetToken: Token | undefined
  vaultToken: Token | undefined
  stakingToken: Token | undefined
  pricePerShare: bigint
  availableToDeposit: bigint
  depositedShares: bigint
  depositedValue: bigint
  stakingWithdrawableAssets: bigint
  stakingRedeemableShares: bigint
  isLoading: boolean
  refetch: () => void | Promise<void>
}

export enum WidgetActionType {
  Deposit = 'deposit',
  Withdraw = 'withdraw',
  Migrate = 'migrate'
}

export type VaultWidgetPrefill = {
  address: WidgetAddress
  chainId: number
  amount?: string
  requestKey?: number | string
}

export type VaultWidgetWithdrawalSource = 'vault' | 'staking'

/** Public properties for the shared vault action widget. */
export type VaultWidgetProps = {
  currentVault: VaultWidgetVault
  vaultAddress?: WidgetAddress
  gaugeAddress?: WidgetAddress
  disableDepositStaking?: boolean
  actions: WidgetActionType[]
  chainId: number
  vaultUserData: VaultUserData
  handleSuccess?: () => void
  mode?: WidgetActionType
  onModeChange?: (mode: WidgetActionType) => void
  showTabs?: boolean
  onOpenSettings?: () => void
  isSettingsOpen?: boolean
  depositPrefill?: VaultWidgetPrefill | null
  onDepositPrefillConsumed?: () => void
  forceDepositStake?: boolean
  depositTitleOverride?: string
  onDepositUserTokenSelectionChange?: (address: WidgetAddress, chainId: number) => void
  hideTabSelector?: boolean
  disableBorderRadius?: boolean
  collapseDetails?: boolean
  disableTokenSelector?: boolean
  withdrawalSource?: VaultWidgetWithdrawalSource
  /** Allows a host to render app-specific actions such as migration. */
  renderAction?: (action: WidgetActionType) => ReactNode
}

export type VaultWidgetRef = {
  setMode: (mode: WidgetActionType) => void
}

/** Compatibility name used by the existing widget consumers. */
export type TWidgetRef = VaultWidgetRef

/**
 * Structural subset of Wagmi's simulate-contract result used by transaction
 * flows. Keeping this shape local prevents flow types from depending on a
 * particular Wagmi generic instantiation.
 */
export type AppUseSimulateContractReturnType = {
  data?: {
    request?: {
      chainId?: number
      address?: unknown
      functionName?: unknown
      args?: readonly unknown[]
      [key: string]: unknown
    }
    result?: unknown
    [key: string]: unknown
  }
  error?: unknown
  isError: boolean
  isFetching: boolean
  isLoading: boolean
  isPending?: boolean
  isRefetching?: boolean
  isSuccess: boolean
  refetch?: () => Promise<unknown> | unknown
  status: string
  [key: string]: unknown
}

export type TRawTransaction = {
  to: TAddress
  data: Hex
  value: string
  from: TAddress
  chainId: number
}

export type TRawTransactionPreparation = {
  kind: 'raw'
  transaction?: TRawTransaction
  chainId: number
  execute: () => Promise<Hash>
  refetch: () => Promise<unknown>
  error: Error | null
  isError: boolean
  isLoading: boolean
  isFetching: boolean
  isSuccess: boolean
  status: 'pending' | 'error' | 'success'
}

export type TTransactionPreparation = AppUseSimulateContractReturnType | TRawTransactionPreparation

export function isRawTransactionPreparation(
  preparation?: TTransactionPreparation
): preparation is TRawTransactionPreparation {
  return Boolean(preparation && 'kind' in preparation && preparation.kind === 'raw')
}

export function getContractTransactionRequest(preparation?: TTransactionPreparation): unknown {
  return preparation && !isRawTransactionPreparation(preparation) ? preparation.data?.request : undefined
}

export function getTransactionPreparationChainId(preparation?: TTransactionPreparation): number | undefined {
  if (!preparation) return undefined
  return isRawTransactionPreparation(preparation)
    ? preparation.chainId
    : (preparation.data?.request as { chainId?: number } | undefined)?.chainId
}

export function isTransactionPreparationReady(preparation?: TTransactionPreparation): boolean {
  if (!preparation?.isSuccess) return false
  return isRawTransactionPreparation(preparation)
    ? Boolean(preparation.transaction)
    : Boolean(preparation.data?.request)
}

type WidgetFlow<TActions, TPeriphery> = {
  actions: TActions
  periphery: TPeriphery
}

export type UseWidgetDepositFlowReturn = WidgetFlow<
  {
    prepareApprove: TTransactionPreparation
    prepareDeposit: TTransactionPreparation
  },
  {
    prepareApproveEnabled: boolean
    prepareDepositEnabled: boolean
    isAllowanceSufficient: boolean
    allowance: bigint
    expectedOut: bigint
    minExpectedOut: bigint
    priceImpact?: number | null
    isLoadingRoute: boolean
    isCrossChain: boolean
    routeHasSwap?: boolean
    bridgeProtocol?: 'stargate' | 'ccip' | 'relay'
    tx?: {
      to: TAddress
      data: Hex
      value: string
      from: TAddress
    }
    gas?: string
    routerAddress?: TAddress
    approvalSpenderAddress?: TAddress
    approvalWarning?: string
    error?: string
    refetchAllowance?: () => Promise<unknown>
  }
>

export type UseWidgetWithdrawFlowReturn = WidgetFlow<
  {
    prepareWithdraw: TTransactionPreparation
    prepareApprove?: TTransactionPreparation
  },
  {
    prepareWithdrawEnabled: boolean
    prepareApproveEnabled?: boolean
    isAllowanceSufficient: boolean
    allowance: bigint
    shareAmount?: bigint
    expectedOut: bigint
    minExpectedOut: bigint
    priceImpact?: number | null
    isLoadingRoute: boolean
    isCrossChain: boolean
    routeHasSwap?: boolean
    bridgeProtocol?: 'stargate' | 'ccip' | 'relay'
    routerAddress?: TAddress
    tx?: {
      to: TAddress
      data: Hex
      value: string
      from: TAddress
    }
    gas?: string
    error?: string
    resetQuote?: () => void
  }
>

export type TNotificationStatus = 'pending' | 'submitted' | 'success' | 'error'

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

export type TCreateNotificationParams = {
  type: TNotificationType
  amount: string
  fromAddress: TAddress
  fromSymbol: string
  fromChainId: number
  executionChainId?: number
  toAddress?: TAddress
  toSymbol?: string
  toAmount?: string
  toChainId?: number
  bridgeProtocol?: 'stargate' | 'ccip' | 'relay'
}

export type TCreateSubmittedNotificationParams = TCreateNotificationParams & {
  awaitingExecution?: boolean
  ownerAddress: TAddress
  status: Extract<TNotificationStatus, 'pending' | 'submitted'>
  txHash: Hash
}

export type TUpdateNotificationParams = {
  id: number
  txHash?: Hash
  status?: TNotificationStatus
  receipt?: TransactionReceipt
  awaitingExecution?: boolean
  bridgeStatus?: 'pending' | 'inflight' | 'delivered' | 'failed' | 'ready_for_manual_execution' | 'unknown'
}
