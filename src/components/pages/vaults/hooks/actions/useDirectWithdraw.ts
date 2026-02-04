import type { UseWidgetWithdrawFlowReturn } from '@pages/vaults/types'
import { erc4626Abi } from '@shared/contracts/abi/4626.abi'
import { vaultAbi } from '@shared/contracts/abi/vaultV2.abi'
import { toAddress } from '@shared/utils'
import type { Address } from 'viem'
import { maxUint256 } from 'viem'
import { type UseSimulateContractReturnType, useSimulateContract } from 'wagmi'

interface UseDirectWithdrawParams {
  vaultAddress: Address
  assetAddress: Address
  amount: bigint // desired underlying asset amount
  maxShares?: bigint // full share balance for redeem-all
  redeemAll?: boolean
  pricePerShare: bigint // pre-fetched from component
  account?: Address
  chainId: number
  decimals: number // asset decimals
  vaultDecimals: number // vault decimals
  enabled: boolean
  useErc4626: boolean
}

export function useDirectWithdraw(params: UseDirectWithdrawParams): UseWidgetWithdrawFlowReturn {
  // Calculate required vault shares from desired underlying amount
  // Formula: requiredShares = (desiredUnderlying * 10^vaultDecimals) / pricePerShare
  const requiredShares =
    params.pricePerShare > 0n
      ? (params.amount * 10n ** BigInt(params.vaultDecimals) + params.pricePerShare - 1n) / params.pricePerShare
      : 0n

  const redeemAll = !!params.redeemAll && (params.maxShares ?? 0n) > 0n
  const redeemShares = redeemAll ? (params.maxShares ?? 0n) : 0n

  const isValidInput = redeemAll ? redeemShares > 0n : params.amount > 0n && requiredShares > 0n
  const prepareWithdrawEnabled = isValidInput && !!params.account && params.enabled

  // Prepare withdraw transaction using ERC4626 withdraw function
  // withdraw(assets, receiver, owner) - no approval needed when owner == msg.sender
  const prepareWithdrawErc4626: UseSimulateContractReturnType = useSimulateContract({
    abi: erc4626Abi,
    functionName: redeemAll ? 'redeem' : 'withdraw',
    address: params.vaultAddress,
    args: params.account
      ? redeemAll
        ? [redeemShares, toAddress(params.account), toAddress(params.account)]
        : [params.amount, toAddress(params.account), toAddress(params.account)]
      : undefined,
    account: params.account ? toAddress(params.account) : undefined,
    chainId: params.chainId,
    query: { enabled: prepareWithdrawEnabled && params.useErc4626 }
  })

  const prepareWithdrawV2: UseSimulateContractReturnType = useSimulateContract({
    abi: vaultAbi,
    functionName: 'withdraw',
    address: params.vaultAddress,
    args: params.account ? [redeemAll ? redeemShares : requiredShares, toAddress(params.account)] : undefined,
    account: params.account ? toAddress(params.account) : undefined,
    chainId: params.chainId,
    query: { enabled: prepareWithdrawEnabled && !params.useErc4626 }
  })

  const prepareWithdraw = params.useErc4626 ? prepareWithdrawErc4626 : prepareWithdrawV2

  const expectedOut = redeemAll
    ? params.pricePerShare > 0n
      ? (redeemShares * params.pricePerShare) / 10n ** BigInt(params.vaultDecimals)
      : 0n
    : params.amount

  return {
    actions: {
      prepareWithdraw
    },
    periphery: {
      prepareApproveEnabled: false, // No approval needed for withdrawing own shares
      prepareWithdrawEnabled,
      isAllowanceSufficient: true, // No approval needed for withdrawing own shares
      allowance: maxUint256, // No approval needed - unlimited
      expectedOut, // User gets what they requested (or full balance for redeem-all)
      isLoadingRoute: false, // No routing needed for direct withdraw
      isCrossChain: false, // Direct withdraw is always same-chain
      error: undefined
    }
  }
}
