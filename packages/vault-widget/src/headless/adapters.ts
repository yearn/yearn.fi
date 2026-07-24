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

type Erc4626AdapterOptions = {
  asset: VaultWidgetToken
  vaultAddress: Address
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

export { ERC4626_ABI, erc20Abi }
