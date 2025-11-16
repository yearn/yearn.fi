import type { TNormalizedBN } from '@lib/types'
import { isZeroAddress, toNormalizedBN } from '@lib/utils'
import { useCallback, useState } from 'react'
import type { Address, Hex } from 'viem'
import { erc20Abi } from 'viem'
import { type UseSimulateContractReturnType, useSimulateContract } from 'wagmi'
import { useTokenAllowance } from '../useTokenAllowance'

const ENSO_API_BASE = 'https://api.enso.finance/api/v1'
const ENSO_API_KEY = import.meta.env.VITE_ENSO_API_KEY

interface EnsoRouteResponse {
  tx: {
    to: Address
    data: Hex
    value: string
    from: Address
    chainId: number
  }
  amountOut: string
  minAmountOut: string
  gas: string
  route: any[]
}

interface UseSolverEnsoProps {
  tokenIn: Address
  tokenOut: Address
  amountIn: bigint
  fromAddress?: Address
  receiver?: Address
  chainId: number
  destinationChainId?: number
  slippage?: number // in basis points (e.g., 100 = 1%)
  enabled?: boolean
  decimalsOut?: number
}

interface UseSolverEnsoReturn {
  actions: {
    prepareApprove: UseSimulateContractReturnType
  }
  periphery: {
    prepareApproveEnabled: boolean
    expectedOut: TNormalizedBN
    minExpectedOut: TNormalizedBN
    allowance: bigint
    route: EnsoRouteResponse | undefined
    isLoadingRoute: boolean
    isLoadingAllowance: boolean
    isCrossChain: boolean
    routerAddress: Address | undefined
  }
  getRoute: () => Promise<void>
  getEnsoTransaction: () => EnsoRouteResponse['tx'] | undefined
}

export const useSolverEnso = ({
  tokenIn,
  tokenOut,
  amountIn,
  fromAddress,
  receiver,
  chainId,
  destinationChainId,
  slippage = 100, // 1% default
  decimalsOut = 18,
  enabled = true
}: UseSolverEnsoProps): UseSolverEnsoReturn => {
  const [route, setRoute] = useState<EnsoRouteResponse | undefined>()
  const [isLoadingRoute, setIsLoadingRoute] = useState(false)

  const isCrossChain = destinationChainId !== undefined && destinationChainId !== chainId
  const routerAddress = route?.tx?.to

  const { allowance = 0n, isLoading: isLoadingAllowance } = useTokenAllowance({
    account: fromAddress,
    token: tokenIn,
    spender: routerAddress,
    watch: true,
    chainId,
    enabled: !!routerAddress
  })

  const getRoute = useCallback(async () => {
    if (!enabled || !fromAddress || amountIn <= 0n) return
    if (isZeroAddress(tokenIn) || isZeroAddress(tokenOut)) return

    setIsLoadingRoute(true)
    try {
      const params = new URLSearchParams({
        fromAddress,
        chainId: chainId.toString(),
        tokenIn,
        tokenOut,
        amountIn: amountIn.toString(),
        slippage: slippage.toString(),
        ...(isCrossChain && { destinationChainId: destinationChainId!.toString() }),
        ...(receiver && { receiver })
      })

      const response = await fetch(`${ENSO_API_BASE}/shortcuts/route?${params}`, {
        headers: {
          Authorization: `Bearer ${ENSO_API_KEY}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Enso API error: ${response.statusText}`)
      }

      const data: EnsoRouteResponse = await response.json()
      setRoute(data)
    } catch (error) {
      console.error('Failed to get Enso route:', error)
      setRoute(undefined)
    } finally {
      setIsLoadingRoute(false)
    }
  }, [tokenIn, tokenOut, amountIn, fromAddress, receiver, chainId, destinationChainId, slippage, enabled, isCrossChain])

  const getEnsoTransaction = useCallback((): EnsoRouteResponse['tx'] | undefined => {
    return route?.tx
  }, [route])

  const isValidInput = amountIn > 0n
  const isAllowanceSufficient = !routerAddress || allowance >= amountIn
  const prepareApproveEnabled = routerAddress && !isAllowanceSufficient && isValidInput && enabled
  const prepareApprove: UseSimulateContractReturnType = useSimulateContract({
    abi: erc20Abi,
    functionName: 'approve',
    address: tokenIn,
    args: routerAddress ? [routerAddress, amountIn] : undefined,
    chainId,
    query: { enabled: !!prepareApproveEnabled && !!routerAddress }
  })
  const expectedOut = route?.amountOut
    ? toNormalizedBN(BigInt(route.amountOut), decimalsOut)
    : toNormalizedBN(0n, decimalsOut)

  const minExpectedOut = route?.minAmountOut
    ? toNormalizedBN(BigInt(route.minAmountOut), decimalsOut)
    : toNormalizedBN(0n, decimalsOut)
  return {
    actions: {
      prepareApprove
    },
    periphery: {
      prepareApproveEnabled: !!prepareApproveEnabled,
      expectedOut,
      minExpectedOut,
      allowance,
      route,
      isLoadingRoute,
      isLoadingAllowance,
      isCrossChain,
      routerAddress
    },
    getRoute,
    getEnsoTransaction
  }
}
