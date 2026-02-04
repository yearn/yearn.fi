import { useEnsoStatus } from '@pages/vaults/contexts/useEnsoStatus'
import type { TNormalizedBN } from '@shared/types'
import { isZeroAddress, toNormalizedBN } from '@shared/utils'
import { useCallback, useState } from 'react'
import type { Address, Hex } from 'viem'
import { erc20Abi } from 'viem'
import { type UseSimulateContractReturnType, useSimulateContract } from 'wagmi'
import { useTokenAllowance } from '../useTokenAllowance'

const ENSO_ROUTE_PROXY = '/api/enso/route'

// Known Enso router addresses per chain for pre-fetching allowance
const ENSO_ROUTER_ADDRESSES: Record<number, Address> = {
  1: '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf', // Ethereum
  10: '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf', // Optimism
  137: '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf', // Polygon
  42161: '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf', // Arbitrum
  8453: '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf', // Base
  747474: '0x3067BDBa0e6628497d527bEF511c22DA8b32cA3F' // Katana
}

interface EnsoError {
  error: string
  message: string
  requestId: string
  statusCode: number
}
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
    isAllowanceSufficient: boolean
    route: EnsoRouteResponse | undefined
    error: EnsoError | undefined
    isLoadingRoute: boolean
    isLoadingAllowance: boolean
    isCrossChain: boolean
    routerAddress: Address | undefined
  }
  methods: {
    getRoute: () => Promise<void>
    getEnsoTransaction: () => EnsoRouteResponse['tx'] | undefined
    resetRoute: () => void
  }
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
  const { setEnsoFailed } = useEnsoStatus()
  const [route, setRoute] = useState<EnsoRouteResponse | undefined>()
  const [error, setError] = useState<EnsoError | undefined>()
  const [isLoadingRoute, setIsLoadingRoute] = useState(false)

  const isCrossChain = destinationChainId !== undefined && destinationChainId !== chainId
  const routerAddress = route?.tx?.to

  // Use known Enso router for pre-fetching allowance, fall back to actual router from route
  const knownRouterAddress = ENSO_ROUTER_ADDRESSES[chainId]
  const allowanceSpender = routerAddress || knownRouterAddress

  const { allowance = 0n, isLoading: isLoadingAllowance } = useTokenAllowance({
    account: fromAddress,
    token: tokenIn,
    spender: allowanceSpender,
    watch: true,
    chainId,
    enabled: !!allowanceSpender
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

      const response = await fetch(`${ENSO_ROUTE_PROXY}?${params}`)

      const data: EnsoRouteResponse & EnsoError = await response.json()

      if (data.error) {
        console.warn('[Enso] Route error', {
          chainId,
          destinationChainId,
          tokenIn,
          tokenOut,
          amountIn: amountIn.toString(),
          statusCode: data.statusCode || response.status,
          message: data.message,
          requestId: data.requestId
        })
        setError(data)
        // Only trigger fallback for server errors (5xx) or auth issues (401/403)
        // Normal errors like "no route found" (4xx) should not disable Enso
        const statusCode = data.statusCode || response.status
        if (statusCode >= 500 || statusCode === 401 || statusCode === 403) {
          setEnsoFailed(true)
        }
        throw new Error(`Enso API error: ${data.message}`)
      }
      setError(undefined)
      setRoute(data)
    } catch (err) {
      // Network errors (fetch failed) indicate API is unreachable
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setEnsoFailed(true)
      }
      console.error('Failed to get Enso route:', err, {
        chainId,
        destinationChainId,
        tokenIn,
        tokenOut,
        amountIn: amountIn.toString()
      })
    } finally {
      setIsLoadingRoute(false)
    }
  }, [
    tokenIn,
    tokenOut,
    amountIn,
    fromAddress,
    receiver,
    chainId,
    destinationChainId,
    slippage,
    enabled,
    isCrossChain,
    setEnsoFailed
  ])

  const getEnsoTransaction = useCallback((): EnsoRouteResponse['tx'] | undefined => {
    return route?.tx
  }, [route])

  const resetRoute = useCallback(() => {
    setRoute(undefined)
    setError(undefined)
  }, [])

  const isValidInput = amountIn > 0n
  const isAllowanceSufficient = !allowanceSpender || allowance >= amountIn
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
      isAllowanceSufficient,
      route,
      error,
      isLoadingRoute,
      isLoadingAllowance,
      isCrossChain,
      routerAddress
    },
    methods: {
      getRoute,
      getEnsoTransaction,
      resetRoute
    }
  }
}
