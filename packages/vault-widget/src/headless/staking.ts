import { type Address, encodeFunctionData, isAddressEqual, type PublicClient } from 'viem'
import type { VaultWidgetRouteAdapter, VaultWidgetToken } from '../types'

export type VaultWidgetStakingSource = 'VeYFI' | 'yBOLD' | 'default'

const STAKING_PREVIEW_ABI = [
  {
    type: 'function',
    name: 'previewDeposit',
    stateMutability: 'view',
    inputs: [{ name: 'assets', type: 'uint256' }],
    outputs: [{ name: 'shares', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'previewWithdraw',
    stateMutability: 'view',
    inputs: [{ name: 'assets', type: 'uint256' }],
    outputs: [{ name: 'shares', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'previewRedeem',
    stateMutability: 'view',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [{ name: 'assets', type: 'uint256' }]
  }
] as const

const DEFAULT_STAKING_ABI = [
  {
    type: 'function',
    name: 'stake',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: []
  },
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: []
  }
] as const

const VEYFI_STAKING_ABI = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'assets', type: 'uint256' }],
    outputs: [{ name: 'shares', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'owner', type: 'address' }
    ],
    outputs: [{ name: 'shares', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'redeem',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'shares', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'owner', type: 'address' }
    ],
    outputs: [{ name: 'assets', type: 'uint256' }]
  }
] as const

const TOKENIZED_STAKING_ABI = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' }
    ],
    outputs: [{ name: 'shares', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'owner', type: 'address' }
    ],
    outputs: [{ name: 'shares', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'redeem',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'shares', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'owner', type: 'address' }
    ],
    outputs: [{ name: 'assets', type: 'uint256' }]
  }
] as const

type StakingAdapterOptions = {
  chainId: number
  positionSourceId?: string
  readVaultAmount?: (publicClient: PublicClient, assets: bigint) => Promise<bigint>
  source?: string
  stakingAddress: Address
  stakingToken: VaultWidgetToken
  vaultToken: VaultWidgetToken
}

type UnstakeAndWithdrawAdapterOptions = {
  assetToken: VaultWidgetToken
  positionSourceId?: string
  stakingAdapter: VaultWidgetRouteAdapter
  vaultAdapter: VaultWidgetRouteAdapter
  vaultToken: VaultWidgetToken
}

type DepositAndStakeAdapterOptions = {
  assetToken: VaultWidgetToken
  stakingAdapter: VaultWidgetRouteAdapter
  stakingToken: VaultWidgetToken
  vaultAdapter: VaultWidgetRouteAdapter
  vaultToken: VaultWidgetToken
}

export function normalizeStakingSource(source?: string): VaultWidgetStakingSource {
  if (source === 'VeYFI') return 'VeYFI'
  if (source === 'yBOLD') return 'yBOLD'
  return 'default'
}

async function previewStakingAmount(
  publicClient: PublicClient,
  stakingAddress: Address,
  functionName: 'previewDeposit' | 'previewWithdraw' | 'previewRedeem',
  amount: bigint
): Promise<bigint> {
  return publicClient.readContract({
    address: stakingAddress,
    abi: STAKING_PREVIEW_ABI,
    functionName,
    args: [amount]
  })
}

function encodeStake(source: VaultWidgetStakingSource, amount: bigint, account: Address): `0x${string}` {
  if (source === 'VeYFI') {
    return encodeFunctionData({
      abi: VEYFI_STAKING_ABI,
      functionName: 'deposit',
      args: [amount]
    })
  }
  if (source === 'yBOLD') {
    return encodeFunctionData({
      abi: TOKENIZED_STAKING_ABI,
      functionName: 'deposit',
      args: [amount, account]
    })
  }
  return encodeFunctionData({
    abi: DEFAULT_STAKING_ABI,
    functionName: 'stake',
    args: [amount]
  })
}

function encodeUnstake(source: VaultWidgetStakingSource, amount: bigint, account: Address): `0x${string}` {
  if (source === 'VeYFI' || source === 'yBOLD') {
    return encodeFunctionData({
      abi: source === 'VeYFI' ? VEYFI_STAKING_ABI : TOKENIZED_STAKING_ABI,
      functionName: 'withdraw',
      args: [amount, account, account]
    })
  }
  return encodeFunctionData({
    abi: DEFAULT_STAKING_ABI,
    functionName: 'withdraw',
    args: [amount]
  })
}

function encodeRedeem(
  source: Exclude<VaultWidgetStakingSource, 'default'>,
  shares: bigint,
  account: Address
): `0x${string}` {
  return encodeFunctionData({
    abi: source === 'VeYFI' ? VEYFI_STAKING_ABI : TOKENIZED_STAKING_ABI,
    functionName: 'redeem',
    args: [shares, account, account]
  })
}

export function createStakingPositionValueReader(
  options: Pick<StakingAdapterOptions, 'source' | 'stakingAddress'>
): (publicClient: PublicClient, shares: bigint) => Promise<bigint> {
  const source = normalizeStakingSource(options.source)
  return async (publicClient, shares) => {
    if (shares === 0n || source === 'default') return shares
    return previewStakingAmount(publicClient, options.stakingAddress, 'previewRedeem', shares)
  }
}

export function createStakingPositionAmountReader(
  options: Pick<StakingAdapterOptions, 'source' | 'stakingAddress'>
): (publicClient: PublicClient, assets: bigint) => Promise<bigint> {
  const source = normalizeStakingSource(options.source)
  return async (publicClient, assets) => {
    if (assets === 0n || source === 'default') return assets
    return previewStakingAmount(publicClient, options.stakingAddress, 'previewWithdraw', assets)
  }
}

export function createStakingAdapter(options: StakingAdapterOptions): VaultWidgetRouteAdapter {
  const source = normalizeStakingSource(options.source)

  return {
    id: `staking-${source.toLowerCase()}`,
    supports(request): boolean {
      return (
        request.chainId === options.chainId &&
        (!options.positionSourceId ||
          request.mode === 'deposit' ||
          request.positionSource?.id === options.positionSourceId) &&
        isAddressEqual(request.selectedToken.address, options.vaultToken.address)
      )
    },
    getApprovalTarget(request) {
      if (request.mode === 'withdraw') return undefined
      return { spender: options.stakingAddress, token: options.vaultToken }
    },
    async quote(request, publicClient) {
      if (request.mode === 'deposit') {
        const expectedOut =
          source === 'default'
            ? request.amount
            : await previewStakingAmount(publicClient, options.stakingAddress, 'previewDeposit', request.amount)
        const transaction = {
          chainId: options.chainId,
          to: options.stakingAddress,
          data: encodeStake(source, request.amount, request.account)
        }
        return {
          adapterId: `staking-${source.toLowerCase()}`,
          activityType: 'stake',
          amountIn: request.amount,
          assetValue: request.amount,
          expectedOut,
          minExpectedOut: expectedOut,
          positionAmount: expectedOut,
          approval: {
            amount: request.amount,
            spender: options.stakingAddress,
            token: options.vaultToken,
            resetBeforeApproval: options.vaultToken.requiresApprovalReset
          },
          transaction,
          transactions: [{ id: 'stake', label: 'Stake', transaction }]
        }
      }

      const redeemAll = request.redeemAll === true && request.positionBalance > 0n
      const vaultAmount = redeemAll
        ? source === 'default'
          ? request.positionBalance
          : await previewStakingAmount(publicClient, options.stakingAddress, 'previewRedeem', request.positionBalance)
        : (request.requestedPositionAmount ??
          (options.readVaultAmount ? await options.readVaultAmount(publicClient, request.amount) : request.amount))
      const positionAmount = redeemAll
        ? request.positionBalance
        : source === 'default'
          ? vaultAmount
          : await previewStakingAmount(publicClient, options.stakingAddress, 'previewWithdraw', vaultAmount)
      const transaction = {
        chainId: options.chainId,
        to: options.stakingAddress,
        data:
          redeemAll && source !== 'default'
            ? encodeRedeem(source, positionAmount, request.account)
            : encodeUnstake(source, vaultAmount, request.account)
      }
      return {
        adapterId: `staking-${source.toLowerCase()}`,
        activityType: 'unstake',
        amountIn: positionAmount,
        assetValue: request.amount,
        expectedOut: vaultAmount,
        minExpectedOut: vaultAmount,
        positionAmount,
        transaction,
        transactions: [{ id: 'unstake', label: 'Unstake', transaction }]
      }
    }
  }
}

export function createDepositAndStakeAdapter(options: DepositAndStakeAdapterOptions): VaultWidgetRouteAdapter {
  return {
    id: 'deposit-and-stake',
    supports(request): boolean {
      return (
        request.autoStake === true &&
        request.mode === 'deposit' &&
        request.chainId === options.assetToken.chainId &&
        isAddressEqual(request.selectedToken.address, options.assetToken.address)
      )
    },
    getApprovalTargets(request) {
      const vaultTarget = options.vaultAdapter.getApprovalTarget?.({ ...request, autoStake: false })
      const stakingTarget = options.stakingAdapter.getApprovalTarget?.({
        ...request,
        autoStake: false,
        selectedToken: options.vaultToken
      })
      return [vaultTarget, stakingTarget].filter((target) => target !== undefined)
    },
    async quote(request, publicClient) {
      if (request.mode !== 'deposit') throw new Error('Combined deposit and stake only supports deposits')

      const vaultQuote = await options.vaultAdapter.quote({ ...request, autoStake: false }, publicClient)
      const stakingQuote = await options.stakingAdapter.quote(
        {
          ...request,
          amount: vaultQuote.expectedOut,
          autoStake: false,
          selectedToken: options.vaultToken
        },
        publicClient
      )
      const depositTransactions = vaultQuote.transactions ?? [
        { id: 'deposit', label: 'Deposit', transaction: vaultQuote.transaction }
      ]
      const stakingTransactions = stakingQuote.transactions ?? [
        { id: 'stake', label: 'Stake', transaction: stakingQuote.transaction }
      ]
      const approvals = [
        ...(vaultQuote.approvals ?? (vaultQuote.approval ? [vaultQuote.approval] : [])),
        ...(stakingQuote.approvals ?? (stakingQuote.approval ? [stakingQuote.approval] : []))
      ]

      return {
        actionLabel: 'Deposit and stake',
        adapterId: 'deposit-and-stake',
        activityType: 'deposit and stake',
        activityTokenOut: options.stakingToken.address,
        amountIn: vaultQuote.amountIn,
        assetValue: vaultQuote.assetValue ?? vaultQuote.amountIn,
        expectedOut: stakingQuote.expectedOut,
        minExpectedOut: stakingQuote.minExpectedOut,
        positionAmount: stakingQuote.positionAmount,
        transaction: stakingQuote.transaction,
        transactions: [...depositTransactions, ...stakingTransactions],
        approval: approvals[0],
        approvals
      }
    }
  }
}

export function createUnstakeAndWithdrawAdapter(options: UnstakeAndWithdrawAdapterOptions): VaultWidgetRouteAdapter {
  return {
    id: 'unstake-and-withdraw',
    supports(request): boolean {
      return (
        request.mode === 'withdraw' &&
        request.chainId === options.assetToken.chainId &&
        (!options.positionSourceId || request.positionSource?.id === options.positionSourceId) &&
        isAddressEqual(request.selectedToken.address, options.assetToken.address)
      )
    },
    async quote(request, publicClient) {
      if (request.mode !== 'withdraw') throw new Error('Combined unstake and withdraw only supports withdrawals')

      const stakingQuote = request.redeemAll
        ? await options.stakingAdapter.quote(
            {
              ...request,
              selectedToken: options.vaultToken
            },
            publicClient
          )
        : undefined
      const vaultQuote = await options.vaultAdapter.quote(
        request.redeemAll && stakingQuote
          ? {
              ...request,
              positionBalance: stakingQuote.expectedOut
            }
          : request,
        publicClient
      )
      const resolvedStakingQuote =
        stakingQuote ??
        (await options.stakingAdapter.quote(
          {
            ...request,
            requestedPositionAmount: vaultQuote.positionAmount,
            selectedToken: options.vaultToken
          },
          publicClient
        ))
      const unstakeTransactions = resolvedStakingQuote.transactions ?? [
        { id: 'unstake', label: 'Unstake', transaction: resolvedStakingQuote.transaction }
      ]
      const withdrawTransactions = vaultQuote.transactions ?? [
        { id: 'withdraw', label: 'Withdraw', transaction: vaultQuote.transaction }
      ]

      return {
        adapterId: 'unstake-and-withdraw',
        activityType: 'unstake and withdraw',
        amountIn: resolvedStakingQuote.positionAmount,
        assetValue: vaultQuote.assetValue ?? vaultQuote.expectedOut,
        expectedOut: vaultQuote.expectedOut,
        minExpectedOut: vaultQuote.minExpectedOut,
        positionAmount: resolvedStakingQuote.positionAmount,
        transaction: vaultQuote.transaction,
        transactions: [...unstakeTransactions, ...withdrawTransactions]
      }
    }
  }
}

export { DEFAULT_STAKING_ABI, STAKING_PREVIEW_ABI, TOKENIZED_STAKING_ABI, VEYFI_STAKING_ABI }
