import { type Abi, type Address, encodeFunctionData, erc20Abi, isAddressEqual, type PublicClient } from 'viem'
import type { EnsoQuoteProvider, VaultWidgetRouteAdapter, VaultWidgetToken } from '../types'

const ERC4626_ABI = [
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
  },
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

const YEARN_V2_VAULT_ABI = [
  {
    type: 'function',
    name: 'pricePerShare',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_amount', type: 'uint256' },
      { name: 'recipient', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'maxShares', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      { name: 'maxLoss', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  }
] as const

function divideUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error('Vault price per share is unavailable')
  return (numerator + denominator - 1n) / denominator
}

async function readYearnV2PricePerShare(publicClient: PublicClient, vaultAddress: Address): Promise<bigint> {
  const pricePerShare = await publicClient.readContract({
    address: vaultAddress,
    abi: YEARN_V2_VAULT_ABI,
    functionName: 'pricePerShare'
  })
  if (pricePerShare <= 0n) throw new Error('Vault price per share is unavailable')
  return pricePerShare
}

type Erc4626AdapterOptions = {
  asset: VaultWidgetToken
  vaultAddress: Address
}

export function createErc4626PositionValueReader(
  options: Pick<Erc4626AdapterOptions, 'vaultAddress'>
): (publicClient: PublicClient, shares: bigint) => Promise<bigint> {
  return async (publicClient, shares) => {
    if (shares === 0n) return 0n
    return publicClient.readContract({
      address: options.vaultAddress,
      abi: ERC4626_ABI,
      functionName: 'previewRedeem',
      args: [shares]
    })
  }
}

export function createErc4626Adapter(options: Erc4626AdapterOptions): VaultWidgetRouteAdapter {
  return {
    id: 'erc4626',
    supports(request): boolean {
      return (
        request.chainId === options.asset.chainId &&
        isAddressEqual(request.selectedToken.address, options.asset.address)
      )
    },
    getApprovalTarget(request) {
      if (request.mode === 'withdraw' || request.selectedToken.isNative) return undefined
      return { spender: options.vaultAddress, token: request.selectedToken }
    },
    async quote(request, publicClient) {
      if (request.mode === 'deposit') {
        const expectedOut = await publicClient.readContract({
          address: options.vaultAddress,
          abi: ERC4626_ABI,
          functionName: 'previewDeposit',
          args: [request.amount]
        })
        return {
          adapterId: 'erc4626',
          amountIn: request.amount,
          assetValue: request.amount,
          expectedOut,
          minExpectedOut: expectedOut,
          positionAmount: expectedOut,
          approval: request.selectedToken.isNative
            ? undefined
            : {
                amount: request.amount,
                spender: options.vaultAddress,
                token: request.selectedToken,
                resetBeforeApproval: request.selectedToken.requiresApprovalReset
              },
          transaction: {
            chainId: request.chainId,
            to: options.vaultAddress,
            data: encodeFunctionData({
              abi: ERC4626_ABI,
              functionName: 'deposit',
              args: [request.amount, request.account]
            })
          }
        }
      }

      const shares = await publicClient.readContract({
        address: options.vaultAddress,
        abi: ERC4626_ABI,
        functionName: 'previewWithdraw',
        args: [request.amount]
      })
      return {
        adapterId: 'erc4626',
        amountIn: shares,
        assetValue: request.amount,
        expectedOut: request.amount,
        minExpectedOut: request.amount,
        positionAmount: shares,
        transaction: {
          chainId: request.chainId,
          to: options.vaultAddress,
          data: encodeFunctionData({
            abi: ERC4626_ABI,
            functionName: 'withdraw',
            args: [request.amount, request.account, request.account]
          })
        }
      }
    }
  }
}

type YearnV2AdapterOptions = {
  asset: VaultWidgetToken
  positionToken: VaultWidgetToken
  vaultAddress: Address
}

export function createYearnV2PositionValueReader(
  options: Pick<YearnV2AdapterOptions, 'positionToken' | 'vaultAddress'>
): (publicClient: PublicClient, shares: bigint) => Promise<bigint> {
  return async (publicClient, shares) => {
    if (shares === 0n) return 0n
    const pricePerShare = await readYearnV2PricePerShare(publicClient, options.vaultAddress)
    return (shares * pricePerShare) / 10n ** BigInt(options.positionToken.decimals)
  }
}

export function createYearnV2Adapter(options: YearnV2AdapterOptions): VaultWidgetRouteAdapter {
  return {
    id: 'yearn-v2',
    supports(request): boolean {
      return (
        request.chainId === options.asset.chainId &&
        isAddressEqual(request.selectedToken.address, options.asset.address)
      )
    },
    getApprovalTarget(request) {
      if (request.mode === 'withdraw' || request.selectedToken.isNative) return undefined
      return { spender: options.vaultAddress, token: request.selectedToken }
    },
    async quote(request, publicClient) {
      const pricePerShare = await readYearnV2PricePerShare(publicClient, options.vaultAddress)
      const shareScale = 10n ** BigInt(options.positionToken.decimals)

      if (request.mode === 'deposit') {
        const expectedOut = (request.amount * shareScale) / pricePerShare
        return {
          adapterId: 'yearn-v2',
          amountIn: request.amount,
          assetValue: request.amount,
          expectedOut,
          minExpectedOut: expectedOut,
          positionAmount: expectedOut,
          approval: request.selectedToken.isNative
            ? undefined
            : {
                amount: request.amount,
                spender: options.vaultAddress,
                token: request.selectedToken,
                resetBeforeApproval: request.selectedToken.requiresApprovalReset
              },
          transaction: {
            chainId: request.chainId,
            to: options.vaultAddress,
            data: encodeFunctionData({
              abi: YEARN_V2_VAULT_ABI,
              functionName: 'deposit',
              args: [request.amount, request.account]
            })
          }
        }
      }

      const shares = divideUp(request.amount * shareScale, pricePerShare)
      return {
        adapterId: 'yearn-v2',
        amountIn: shares,
        assetValue: request.amount,
        expectedOut: request.amount,
        minExpectedOut: request.amount,
        positionAmount: shares,
        transaction: {
          chainId: request.chainId,
          to: options.vaultAddress,
          data: encodeFunctionData({
            abi: YEARN_V2_VAULT_ABI,
            functionName: 'withdraw',
            args: [shares, request.account, BigInt(request.maxLossBps)]
          })
        }
      }
    }
  }
}

type YBoldAdapterOptions = {
  asset: VaultWidgetToken
  positionToken: VaultWidgetToken
  stakingAbi: Abi
  zapperAbi: Abi
  zapperAddress: Address
}

async function readYBoldWithdrawalShares(
  publicClient: PublicClient,
  positionToken: VaultWidgetToken,
  stakingAbi: Abi,
  amount: bigint
): Promise<bigint> {
  return publicClient.readContract({
    address: positionToken.address,
    abi: stakingAbi,
    functionName: 'previewWithdraw',
    args: [amount]
  }) as Promise<bigint>
}

export function createYBoldAdapter(options: YBoldAdapterOptions): VaultWidgetRouteAdapter {
  return {
    id: 'ybold-zapper',
    supports(request): boolean {
      return (
        request.chainId === options.asset.chainId &&
        isAddressEqual(request.selectedToken.address, options.asset.address)
      )
    },
    getApprovalTarget(request) {
      return {
        spender: options.zapperAddress,
        token: request.mode === 'deposit' ? options.asset : options.positionToken
      }
    },
    async quote(request, publicClient) {
      if (request.mode === 'deposit') {
        const expectedOut = (await publicClient.readContract({
          address: options.zapperAddress,
          abi: options.zapperAbi,
          functionName: 'previewDeposit',
          args: [request.amount]
        })) as bigint
        return {
          adapterId: 'ybold-zapper',
          amountIn: request.amount,
          assetValue: request.amount,
          expectedOut,
          minExpectedOut: expectedOut,
          positionAmount: expectedOut,
          approval: {
            amount: request.amount,
            spender: options.zapperAddress,
            token: options.asset
          },
          transaction: {
            chainId: request.chainId,
            to: options.zapperAddress,
            data: encodeFunctionData({
              abi: options.zapperAbi,
              functionName: 'zapIn',
              args: [request.amount, request.account]
            })
          }
        }
      }

      const positionAmount = await readYBoldWithdrawalShares(
        publicClient,
        options.positionToken,
        options.stakingAbi,
        request.amount
      )
      const expectedOut = (await publicClient.readContract({
        address: options.zapperAddress,
        abi: options.zapperAbi,
        functionName: 'previewRedeem',
        args: [positionAmount]
      })) as bigint
      return {
        adapterId: 'ybold-zapper',
        amountIn: positionAmount,
        assetValue: expectedOut,
        expectedOut,
        minExpectedOut: expectedOut,
        positionAmount,
        approval: {
          amount: positionAmount,
          spender: options.zapperAddress,
          token: options.positionToken
        },
        transaction: {
          chainId: request.chainId,
          to: options.zapperAddress,
          data: encodeFunctionData({
            abi: options.zapperAbi,
            functionName: 'zapOut',
            args: [positionAmount, request.account, BigInt(request.maxLossBps)]
          })
        }
      }
    }
  }
}

type EnsoAdapterOptions = {
  asset: VaultWidgetToken
  destinationChainId: number
  positionToken: VaultWidgetToken
  provider: EnsoQuoteProvider
  routerByChain: Readonly<Record<number, Address>>
  slippageBps?: number
  readPositionValue?: (publicClient: PublicClient, shares: bigint) => Promise<bigint>
  withdrawAmountToPosition?: (publicClient: PublicClient, amount: bigint) => Promise<bigint>
}

export function createEnsoAdapter(options: EnsoAdapterOptions): VaultWidgetRouteAdapter {
  return {
    id: 'enso',
    supports(request): boolean {
      return !isAddressEqual(request.selectedToken.address, options.asset.address)
    },
    getApprovalTarget(request) {
      const token = request.mode === 'deposit' ? request.selectedToken : options.positionToken
      if (token.isNative) return undefined
      const sourceChainId = request.mode === 'deposit' ? request.selectedToken.chainId : options.positionToken.chainId
      const spender = options.routerByChain[sourceChainId]
      return spender ? { spender, token } : undefined
    },
    async quote(request, publicClient) {
      const positionAmount =
        request.mode === 'withdraw' && options.withdrawAmountToPosition
          ? await options.withdrawAmountToPosition(publicClient, request.amount)
          : request.amount
      const tokenIn = request.mode === 'deposit' ? request.selectedToken.address : options.positionToken.address
      const tokenOut = request.mode === 'deposit' ? options.positionToken.address : request.selectedToken.address
      const sourceChainId = request.mode === 'deposit' ? request.selectedToken.chainId : options.positionToken.chainId
      const destinationChainId = request.mode === 'deposit' ? options.destinationChainId : request.selectedToken.chainId
      const route = await options.provider.getRoute({
        account: request.account,
        amountIn: positionAmount,
        chainId: sourceChainId,
        destinationChainId,
        receiver: request.account,
        slippageBps: request.slippageBps || options.slippageBps || 100,
        tokenIn,
        tokenOut,
        signal: request.signal
      })
      const approvalToken = request.mode === 'deposit' ? request.selectedToken : options.positionToken
      const router = options.routerByChain[sourceChainId]
      if (!router) throw new Error(`No trusted Enso router is configured for chain ${sourceChainId}`)
      const assetValue =
        request.mode === 'deposit' && options.readPositionValue
          ? await options.readPositionValue(publicClient, route.amountOut)
          : route.amountOut

      return {
        adapterId: 'enso',
        amountIn: positionAmount,
        assetValue,
        expectedOut: route.amountOut,
        expiresAt: route.expiresAt,
        minExpectedOut: route.minAmountOut,
        positionAmount: request.mode === 'deposit' ? route.amountOut : positionAmount,
        approval: approvalToken.isNative
          ? undefined
          : {
              amount: positionAmount,
              spender: router,
              token: approvalToken,
              resetBeforeApproval: approvalToken.requiresApprovalReset
            },
        transaction: route.transaction,
        priceImpactPercent: route.priceImpactPercent,
        isCrossChain: sourceChainId !== destinationChainId
      }
    }
  }
}

export { ERC4626_ABI, erc20Abi, YEARN_V2_VAULT_ABI }
