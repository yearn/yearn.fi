import type { UseWidgetWithdrawFlowReturn } from '@pages/vaults/types'
import { erc4626Abi } from '@shared/contracts/abi/4626.abi'
import { vaultAbi } from '@shared/contracts/abi/vaultV2.abi'
import { toAddress } from '@shared/utils'
import { useMemo } from 'react'
import type { Address } from 'viem'
import { maxUint256 } from 'viem'
import { type UseSimulateContractReturnType, useSimulateContract } from 'wagmi'

interface UseDirectWithdrawParams {
  vaultAddress: Address
  amount: bigint // desired underlying asset amount
  maxShares?: bigint // full share balance for redeem-all
  redeemSharesOverride?: bigint // exact vault shares to redeem in fallback unstake->withdraw flows
  redeemAll?: boolean
  pricePerShare: bigint // pre-fetched from component
  account?: Address
  chainId: number
  vaultDecimals: number // vault decimals
  enabled: boolean
  useErc4626: boolean
}

function computeExpectedOut(params: {
  amount: bigint
  pricePerShare: bigint
  redeemAll: boolean
  shouldRedeemExactShares: boolean
  redeemShares: bigint
  vaultDecimals: number
}): bigint {
  if (!params.redeemAll && !params.shouldRedeemExactShares) {
    return params.amount
  }

  if (params.pricePerShare === 0n) {
    return 0n
  }

  return (params.redeemShares * params.pricePerShare) / 10n ** BigInt(params.vaultDecimals)
}

function areContractArgsEqual(actual?: readonly unknown[], expected?: readonly unknown[]): boolean {
  if (!actual && !expected) return true
  if (!actual || !expected || actual.length !== expected.length) return false

  return actual.every((value, index) => {
    const nextValue = expected[index]
    if (typeof value === 'bigint' || typeof nextValue === 'bigint') {
      return value === nextValue
    }
    if (typeof value === 'string' && typeof nextValue === 'string') {
      return value.toLowerCase() === nextValue.toLowerCase()
    }
    return value === nextValue
  })
}

export function useDirectWithdraw(params: UseDirectWithdrawParams): UseWidgetWithdrawFlowReturn {
  // Calculate required vault shares from desired underlying amount
  // Formula: requiredShares = (desiredUnderlying * 10^vaultDecimals) / pricePerShare
  const requiredShares =
    params.pricePerShare > 0n
      ? (params.amount * 10n ** BigInt(params.vaultDecimals) + params.pricePerShare - 1n) / params.pricePerShare
      : 0n

  const redeemSharesOverride = params.redeemSharesOverride ?? 0n
  const shouldRedeemExactShares = redeemSharesOverride > 0n
  const redeemAll = !!params.redeemAll && (params.maxShares ?? 0n) > 0n
  const redeemShares = shouldRedeemExactShares ? redeemSharesOverride : redeemAll ? (params.maxShares ?? 0n) : 0n

  const isValidInput =
    shouldRedeemExactShares || redeemAll ? redeemShares > 0n : params.amount > 0n && requiredShares > 0n
  const prepareWithdrawEnabled = isValidInput && !!params.account && params.enabled
  const accountAddress = prepareWithdrawEnabled && params.account ? toAddress(params.account) : undefined
  const erc4626FunctionName = redeemShares > 0n ? 'redeem' : 'withdraw'
  const erc4626Args: readonly [bigint, Address, Address] | undefined = accountAddress
    ? redeemShares > 0n
      ? [redeemShares, accountAddress, accountAddress]
      : [params.amount, accountAddress, accountAddress]
    : undefined
  const withdrawV2Args: readonly [bigint, Address] | undefined = accountAddress
    ? [redeemShares > 0n ? redeemShares : requiredShares, accountAddress]
    : undefined

  // Prepare withdraw transaction using ERC4626 withdraw function
  // withdraw(assets, receiver, owner) - no approval needed when owner == msg.sender
  const prepareWithdrawErc4626: UseSimulateContractReturnType = useSimulateContract({
    abi: erc4626Abi,
    functionName: erc4626FunctionName,
    address: params.vaultAddress,
    args: erc4626Args,
    account: accountAddress,
    chainId: params.chainId,
    query: { enabled: prepareWithdrawEnabled && params.useErc4626 }
  })

  const prepareWithdrawV2: UseSimulateContractReturnType = useSimulateContract({
    abi: vaultAbi,
    functionName: 'withdraw',
    address: params.vaultAddress,
    args: withdrawV2Args,
    account: accountAddress,
    chainId: params.chainId,
    query: { enabled: prepareWithdrawEnabled && !params.useErc4626 }
  })

  const prepareWithdraw = useMemo((): UseSimulateContractReturnType => {
    const livePrepare = params.useErc4626 ? prepareWithdrawErc4626 : prepareWithdrawV2
    const expectedArgs = params.useErc4626 ? erc4626Args : withdrawV2Args
    const expectedFunctionName = params.useErc4626 ? erc4626FunctionName : 'withdraw'
    const request = livePrepare.data?.request as
      | {
          args?: readonly unknown[]
          functionName?: string
        }
      | undefined
    const hasCurrentRequest =
      prepareWithdrawEnabled &&
      request?.functionName === expectedFunctionName &&
      areContractArgsEqual(request.args, expectedArgs)

    if (hasCurrentRequest) {
      return livePrepare
    }

    return {
      ...livePrepare,
      data: undefined,
      isSuccess: false
    } as UseSimulateContractReturnType
  }, [
    prepareWithdrawEnabled,
    params.useErc4626,
    prepareWithdrawErc4626,
    prepareWithdrawV2,
    erc4626Args,
    withdrawV2Args,
    erc4626FunctionName
  ])

  const expectedOut = computeExpectedOut({
    amount: params.amount,
    pricePerShare: params.pricePerShare,
    redeemAll,
    shouldRedeemExactShares,
    redeemShares,
    vaultDecimals: params.vaultDecimals
  })

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
