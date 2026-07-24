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
  }
] as const

type StakingAdapterOptions = {
  chainId: number
  source?: string
  stakingAddress: Address
  stakingToken: VaultWidgetToken
  vaultToken: VaultWidgetToken
}

type UnstakeAndWithdrawAdapterOptions = {
  assetToken: VaultWidgetToken
  stakingAdapter: VaultWidgetRouteAdapter
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

export function createStakingPositionValueReader(
  options: Pick<StakingAdapterOptions, 'source' | 'stakingAddress'>
): (publicClient: PublicClient, shares: bigint) => Promise<bigint> {
  const source = normalizeStakingSource(options.source)
  return async (publicClient, shares) => {
    if (shares === 0n || source === 'default') return shares
    return previewStakingAmount(publicClient, options.stakingAddress, 'previewRedeem', shares)
  }
}

export function createStakingAdapter(options: StakingAdapterOptions): VaultWidgetRouteAdapter {
  const source = normalizeStakingSource(options.source)

  return {
    id: `staking-${source.toLowerCase()}`,
    supports(request): boolean {
      return (
        request.chainId === options.chainId && isAddressEqual(request.selectedToken.address, options.vaultToken.address)
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

      const positionAmount =
        source === 'default'
          ? request.amount
          : await previewStakingAmount(publicClient, options.stakingAddress, 'previewWithdraw', request.amount)
      const transaction = {
        chainId: options.chainId,
        to: options.stakingAddress,
        data: encodeUnstake(source, request.amount, request.account)
      }
      return {
        adapterId: `staking-${source.toLowerCase()}`,
        activityType: 'unstake',
        amountIn: positionAmount,
        assetValue: request.amount,
        expectedOut: request.amount,
        minExpectedOut: request.amount,
        positionAmount,
        transaction,
        transactions: [{ id: 'unstake', label: 'Unstake', transaction }]
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
        isAddressEqual(request.selectedToken.address, options.assetToken.address)
      )
    },
    async quote(request, publicClient) {
      if (request.mode !== 'withdraw') throw new Error('Combined unstake and withdraw only supports withdrawals')

      const vaultQuote = await options.vaultAdapter.quote(request, publicClient)
      const stakingQuote = await options.stakingAdapter.quote(
        {
          ...request,
          amount: vaultQuote.positionAmount,
          selectedToken: options.vaultToken
        },
        publicClient
      )
      const unstakeTransactions = stakingQuote.transactions ?? [
        { id: 'unstake', label: 'Unstake', transaction: stakingQuote.transaction }
      ]
      const withdrawTransactions = vaultQuote.transactions ?? [
        { id: 'withdraw', label: 'Withdraw', transaction: vaultQuote.transaction }
      ]

      return {
        adapterId: 'unstake-and-withdraw',
        activityType: 'unstake and withdraw',
        amountIn: stakingQuote.positionAmount,
        assetValue: vaultQuote.assetValue ?? vaultQuote.expectedOut,
        expectedOut: vaultQuote.expectedOut,
        minExpectedOut: vaultQuote.minExpectedOut,
        positionAmount: stakingQuote.positionAmount,
        transaction: vaultQuote.transaction,
        transactions: [...unstakeTransactions, ...withdrawTransactions]
      }
    }
  }
}

export { DEFAULT_STAKING_ABI, STAKING_PREVIEW_ABI, TOKENIZED_STAKING_ABI, VEYFI_STAKING_ABI }
