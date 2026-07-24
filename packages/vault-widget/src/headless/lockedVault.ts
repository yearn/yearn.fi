import { type Address, encodeFunctionData, erc4626Abi, formatUnits, isAddressEqual, type PublicClient } from 'viem'
import type {
  VaultWidgetQuote,
  VaultWidgetRouteAdapter,
  VaultWidgetToken,
  VaultWidgetTransactionRequest
} from '../types'

export const YVUSD_LOCKED_VAULT_ABI = [
  {
    stateMutability: 'view',
    type: 'function',
    name: 'availableWithdrawLimit',
    inputs: [{ name: '_owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    stateMutability: 'view',
    type: 'function',
    name: 'cooldownDuration',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    stateMutability: 'view',
    type: 'function',
    name: 'withdrawalWindow',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    stateMutability: 'view',
    type: 'function',
    name: 'getCooldownStatus',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      { name: 'cooldownEnd', type: 'uint256' },
      { name: 'windowEnd', type: 'uint256' },
      { name: 'shares', type: 'uint256' }
    ]
  },
  {
    stateMutability: 'nonpayable',
    type: 'function',
    name: 'startCooldown',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: []
  },
  {
    stateMutability: 'nonpayable',
    type: 'function',
    name: 'cancelCooldown',
    inputs: [],
    outputs: []
  }
] as const

export const YVUSD_LOCKED_ZAP_ABI = [
  {
    inputs: [{ name: '_amount', type: 'uint256' }],
    name: 'previewZapIn',
    outputs: [{ name: 'lockedShares', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: '_amount', type: 'uint256' },
      { name: '_receiver', type: 'address' }
    ],
    name: 'zapIn',
    outputs: [{ name: 'lockedShares', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const

export type VaultWidgetCooldownStatus = {
  cooldownEnd: number
  windowEnd: number
  shares: bigint
}

export type VaultWidgetCooldownStateName = 'none' | 'cooling' | 'ready' | 'expired'

export type VaultWidgetCooldownState = VaultWidgetCooldownStatus & {
  availableWithdrawLimit: bigint
  cooldownDuration: number
  maxRedeem: bigint
  now: number
  state: VaultWidgetCooldownStateName
  withdrawalWindow: number
}

function toTimestamp(value: bigint): number {
  const timestamp = Number(value)
  return Number.isSafeInteger(timestamp) && timestamp >= 0 ? timestamp : 0
}

export function resolveVaultWidgetCooldownState(params: {
  availableWithdrawLimit: bigint
  cooldownDuration: bigint
  maxRedeem: bigint
  now: number
  status: readonly [bigint, bigint, bigint]
  withdrawalWindow: bigint
}): VaultWidgetCooldownState {
  const [cooldownEndRaw, windowEndRaw, shares] = params.status
  const cooldownEnd = toTimestamp(cooldownEndRaw)
  const windowEnd = toTimestamp(windowEndRaw)
  const hasCooldown = shares > 0n
  const state: VaultWidgetCooldownStateName =
    params.availableWithdrawLimit > 0n || (hasCooldown && params.now >= cooldownEnd && params.now <= windowEnd)
      ? 'ready'
      : !hasCooldown
        ? 'none'
        : params.now < cooldownEnd
          ? 'cooling'
          : 'expired'

  return {
    availableWithdrawLimit: params.availableWithdrawLimit,
    cooldownDuration: toTimestamp(params.cooldownDuration),
    cooldownEnd,
    maxRedeem: params.maxRedeem,
    now: params.now,
    shares,
    state,
    withdrawalWindow: toTimestamp(params.withdrawalWindow),
    windowEnd
  }
}

export async function readVaultWidgetCooldownState(params: {
  account: Address
  publicClient: PublicClient
  vaultAddress: Address
}): Promise<VaultWidgetCooldownState> {
  const { account, publicClient, vaultAddress } = params
  const [cooldownDuration, withdrawalWindow, status, availableWithdrawLimit, maxRedeem, block] = await Promise.all([
    publicClient.readContract({
      address: vaultAddress,
      abi: YVUSD_LOCKED_VAULT_ABI,
      functionName: 'cooldownDuration'
    }),
    publicClient.readContract({
      address: vaultAddress,
      abi: YVUSD_LOCKED_VAULT_ABI,
      functionName: 'withdrawalWindow'
    }),
    publicClient.readContract({
      address: vaultAddress,
      abi: YVUSD_LOCKED_VAULT_ABI,
      functionName: 'getCooldownStatus',
      args: [account]
    }),
    publicClient.readContract({
      address: vaultAddress,
      abi: YVUSD_LOCKED_VAULT_ABI,
      functionName: 'availableWithdrawLimit',
      args: [account]
    }),
    publicClient.readContract({
      address: vaultAddress,
      abi: erc4626Abi,
      functionName: 'maxRedeem',
      args: [account]
    }),
    publicClient.getBlock()
  ])

  return resolveVaultWidgetCooldownState({
    availableWithdrawLimit,
    cooldownDuration,
    maxRedeem,
    now: toTimestamp(block.timestamp),
    status,
    withdrawalWindow
  })
}

export function createStartCooldownTransaction(params: {
  chainId: number
  shares: bigint
  vaultAddress: Address
}): VaultWidgetTransactionRequest {
  if (params.shares <= 0n) throw new Error('Cooldown shares must be greater than zero')
  return {
    chainId: params.chainId,
    to: params.vaultAddress,
    data: encodeFunctionData({
      abi: YVUSD_LOCKED_VAULT_ABI,
      functionName: 'startCooldown',
      args: [params.shares]
    })
  }
}

export function createCancelCooldownTransaction(params: {
  chainId: number
  vaultAddress: Address
}): VaultWidgetTransactionRequest {
  return {
    chainId: params.chainId,
    to: params.vaultAddress,
    data: encodeFunctionData({
      abi: YVUSD_LOCKED_VAULT_ABI,
      functionName: 'cancelCooldown'
    })
  }
}

type LockedVaultAdapterOptions = {
  asset: VaultWidgetToken
  positionToken: VaultWidgetToken
  lockedVaultAddress: Address
  unlockedVaultAddress: Address
  zapAddress: Address
}

export function createLockedVaultPositionValueReader(
  options: Pick<LockedVaultAdapterOptions, 'lockedVaultAddress' | 'unlockedVaultAddress'>
): (publicClient: PublicClient, shares: bigint) => Promise<bigint> {
  return async (publicClient, shares) => {
    if (shares <= 0n) return 0n
    const unlockedShares = await publicClient.readContract({
      address: options.lockedVaultAddress,
      abi: erc4626Abi,
      functionName: 'previewRedeem',
      args: [shares]
    })
    if (unlockedShares <= 0n) return 0n
    return publicClient.readContract({
      address: options.unlockedVaultAddress,
      abi: erc4626Abi,
      functionName: 'previewRedeem',
      args: [unlockedShares]
    })
  }
}

async function quoteLockedWithdrawal(
  options: LockedVaultAdapterOptions,
  request: Parameters<VaultWidgetRouteAdapter['quote']>[0],
  publicClient: PublicClient
): Promise<VaultWidgetQuote> {
  const cooldown = await readVaultWidgetCooldownState({
    account: request.account,
    publicClient,
    vaultAddress: options.lockedVaultAddress
  })
  const unlockedShares = await publicClient.readContract({
    address: options.unlockedVaultAddress,
    abi: erc4626Abi,
    functionName: 'previewWithdraw',
    args: [request.amount]
  })
  const lockedShares = await publicClient.readContract({
    address: options.lockedVaultAddress,
    abi: erc4626Abi,
    functionName: 'previewWithdraw',
    args: [unlockedShares]
  })

  if (unlockedShares > cooldown.availableWithdrawLimit || lockedShares > cooldown.maxRedeem) {
    const shouldStartCooldown = cooldown.state === 'none' || cooldown.state === 'expired'
    const transaction = shouldStartCooldown
      ? createStartCooldownTransaction({
          chainId: request.chainId,
          shares: lockedShares,
          vaultAddress: options.lockedVaultAddress
        })
      : createCancelCooldownTransaction({
          chainId: request.chainId,
          vaultAddress: options.lockedVaultAddress
        })

    return {
      actionLabel: shouldStartCooldown ? 'Start Cooldown' : 'Cancel Cooldown',
      activityAmount: formatUnits(shouldStartCooldown ? lockedShares : cooldown.shares, options.positionToken.decimals),
      adapterId: 'yvUSD-cooldown',
      activityType: shouldStartCooldown ? 'start cooldown' : 'cancel cooldown',
      amountIn: shouldStartCooldown ? lockedShares : cooldown.shares,
      assetValue: request.amount,
      expectedOut: 0n,
      hideDetails: true,
      minExpectedOut: 0n,
      notice: shouldStartCooldown
        ? `Start the cooldown for these shares. Withdrawals become available in ${cooldown.cooldownDuration / 86_400} days.`
        : cooldown.state === 'cooling'
          ? 'These shares are cooling down. Cancel the active cooldown before choosing a different amount.'
          : 'Only the cooled-down amount can be withdrawn. Cancel and restart to include more shares.',
      positionAmount: shouldStartCooldown ? lockedShares : cooldown.shares,
      transaction
    }
  }

  const unlockTransaction: VaultWidgetTransactionRequest = {
    chainId: request.chainId,
    to: options.lockedVaultAddress,
    data: encodeFunctionData({
      abi: erc4626Abi,
      functionName: 'withdraw',
      args: [unlockedShares, request.account, request.account]
    })
  }
  const withdrawTransaction: VaultWidgetTransactionRequest = {
    chainId: request.chainId,
    to: options.unlockedVaultAddress,
    data: encodeFunctionData({
      abi: erc4626Abi,
      functionName: 'withdraw',
      args: [request.amount, request.account, request.account]
    })
  }

  return {
    adapterId: 'yvUSD-locked',
    activityType: 'withdraw',
    amountIn: lockedShares,
    assetValue: request.amount,
    expectedOut: request.amount,
    minExpectedOut: request.amount,
    positionAmount: lockedShares,
    transaction: unlockTransaction,
    transactions: [
      { id: 'unlock-yvUSD', label: 'Unlock to yvUSD', transaction: unlockTransaction },
      { id: 'withdraw-usdc', label: 'Withdraw to USDC', transaction: withdrawTransaction }
    ]
  }
}

export function createLockedVaultAdapter(options: LockedVaultAdapterOptions): VaultWidgetRouteAdapter {
  return {
    id: 'yvUSD-locked',
    supports(request): boolean {
      return (
        request.chainId === options.asset.chainId &&
        isAddressEqual(request.selectedToken.address, options.asset.address)
      )
    },
    getApprovalTarget(request) {
      return request.mode === 'deposit' ? { spender: options.zapAddress, token: options.asset } : undefined
    },
    async quote(request, publicClient) {
      if (request.mode === 'withdraw') return quoteLockedWithdrawal(options, request, publicClient)

      const expectedOut = await publicClient.readContract({
        address: options.zapAddress,
        abi: YVUSD_LOCKED_ZAP_ABI,
        functionName: 'previewZapIn',
        args: [request.amount]
      })
      return {
        adapterId: 'yvUSD-locked',
        activityType: 'deposit',
        amountIn: request.amount,
        assetValue: request.amount,
        expectedOut,
        minExpectedOut: expectedOut,
        positionAmount: expectedOut,
        approval: {
          amount: request.amount,
          spender: options.zapAddress,
          token: options.asset
        },
        transaction: {
          chainId: request.chainId,
          to: options.zapAddress,
          data: encodeFunctionData({
            abi: YVUSD_LOCKED_ZAP_ABI,
            functionName: 'zapIn',
            args: [request.amount, request.account]
          })
        }
      }
    }
  }
}
