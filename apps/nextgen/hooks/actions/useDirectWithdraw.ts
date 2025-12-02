import { toAddress } from '@lib/utils'
import { erc4626Abi } from '@lib/utils/abi/4626.abi'
import type { UseWidgetWithdrawFlowReturn } from '@nextgen/types'
import type { Address } from 'viem'
import { type UseSimulateContractReturnType, useSimulateContract } from 'wagmi'

interface UseDirectWithdrawParams {
  vaultAddress: Address
  assetAddress: Address
  amount: bigint // desired underlying asset amount
  pricePerShare: bigint // pre-fetched from component
  account?: Address
  chainId: number
  decimals: number // asset decimals
  vaultDecimals: number // vault decimals
  enabled: boolean
}

export function useDirectWithdraw(params: UseDirectWithdrawParams): UseWidgetWithdrawFlowReturn {
  // Calculate required vault shares from desired underlying amount
  // Formula: requiredShares = (desiredUnderlying * 10^vaultDecimals) / pricePerShare
  const requiredShares =
    params.pricePerShare > 0n ? (params.amount * 10n ** BigInt(params.vaultDecimals)) / params.pricePerShare : 0n

  const isValidInput = params.amount > 0n && requiredShares > 0n
  const prepareWithdrawEnabled = isValidInput && !!params.account && params.enabled

  // Prepare withdraw transaction using ERC4626 withdraw function
  // withdraw(assets, receiver, owner) - no approval needed when owner == msg.sender
  const prepareWithdraw: UseSimulateContractReturnType = useSimulateContract({
    abi: erc4626Abi,
    functionName: 'withdraw',
    address: params.vaultAddress,
    args: [params.amount, toAddress(params.account), toAddress(params.account)],
    account: toAddress(params.account),
    chainId: params.chainId,
    query: { enabled: prepareWithdrawEnabled }
  })

  return {
    actions: {
      prepareWithdraw
    },
    periphery: {
      prepareWithdrawEnabled,
      isAllowanceSufficient: true, // No approval needed for withdrawing own shares
      expectedOut: params.amount, // User gets what they requested
      isLoadingRoute: false, // No routing needed for direct withdraw
      isCrossChain: false, // Direct withdraw is always same-chain
      error: undefined
    }
  }
}
