import { type AppUseSimulateContractReturnType, useSimulateContract } from '@shared/hooks/useAppWagmi'
import type { TNormalizedBN } from '@shared/types'
import { isZeroAddress, toNormalizedBN } from '@shared/utils'
import { getApproveAbi } from '@shared/utils/approve'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Address } from 'viem'
import { env } from '@/env'
import {
  getKnownEnsoRouterAddress,
  getValidatedEnsoRouterAddress,
  UNKNOWN_ENSO_APPROVAL_ROUTER_MESSAGE
} from '../../utils/ensoRouters'
import { useTokenAllowance } from '../useTokenAllowance'
import { type EnsoError, type EnsoRouteResponse, normalizeEnsoRouteResponse, routeHasSwapStep } from './ensoRoute'

const ENSO_ROUTE_PROXY = '/api/enso/route'
export type EnsoRoutingStrategy = 'router' | 'delegate' | 'router-legacy' | 'delegate-legacy' | 'ensowallet'

interface UseSolverEnsoProps {
  tokenIn: Address
  tokenOut: Address
  amountIn: bigint
  fromAddress?: Address
  receiver?: Address
  chainId: number
  destinationChainId?: number
  slippage?: number // in basis points (e.g., 100 = 1%)
  routingStrategy?: EnsoRoutingStrategy
  requestKey?: string
  enabled?: boolean
  decimalsOut?: number
}

interface UseSolverEnsoReturn {
  actions: {
    prepareApprove: AppUseSimulateContractReturnType
  }
  periphery: {
    prepareApproveEnabled: boolean
    expectedOut: TNormalizedBN
    minExpectedOut: TNormalizedBN
    priceImpact: number | null | undefined
    allowance: bigint
    isAllowanceSufficient: boolean
    route: EnsoRouteResponse | undefined
    routeHasSwap: boolean
    error: EnsoError | undefined
    isLoadingRoute: boolean
    isLoadingAllowance: boolean
    isCrossChain: boolean
    routerAddress: Address | undefined
    approvalSpenderAddress: Address | undefined
    approvalWarning: string | undefined
    refetchAllowance: () => Promise<unknown>
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
  routingStrategy,
  requestKey = 'default',
  decimalsOut = 18,
  enabled = true
}: UseSolverEnsoProps): UseSolverEnsoReturn => {
  const [route, setRoute] = useState<EnsoRouteResponse | undefined>()
  const [error, setError] = useState<EnsoError | undefined>()
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | undefined>()
  const [errorRequestKey, setErrorRequestKey] = useState<string | undefined>()
  const [isLoadingRoute, setIsLoadingRoute] = useState(false)
  const routeRequestIdRef = useRef(0)
  const routeAbortControllerRef = useRef<AbortController | null>(null)

  const isCrossChain = destinationChainId !== undefined && destinationChainId !== chainId
  const requestedRoute = resolvedRequestKey === requestKey ? route : undefined
  const requestedRouterAddress = requestedRoute?.tx?.to
  const routerAddress = getValidatedEnsoRouterAddress({
    chainId,
    routerAddress: requestedRouterAddress,
    routeChainId: requestedRoute?.tx?.chainId
  })
  const hasUntrustedRouterAddress = Boolean(requestedRoute && requestedRouterAddress && !routerAddress)
  const visibleRoute = hasUntrustedRouterAddress ? undefined : requestedRoute
  const visibleError =
    hasUntrustedRouterAddress && requestedRouterAddress
      ? {
          error: 'UnrecognizedEnsoRouter',
          message: UNKNOWN_ENSO_APPROVAL_ROUTER_MESSAGE,
          statusCode: 0
        }
      : errorRequestKey === requestKey
        ? error
        : undefined
  const visibleRouteHasSwap = routeHasSwapStep(visibleRoute)

  // Use known Enso router for pre-fetching allowance, fall back to actual router from route
  const knownRouterAddress = getKnownEnsoRouterAddress(chainId)
  const allowanceSpender = routerAddress || knownRouterAddress

  const {
    allowance = 0n,
    isLoading: isLoadingAllowance,
    refetch: refetchAllowance
  } = useTokenAllowance({
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
    const normalizedSlippage = Number.isFinite(slippage) ? Math.max(0, Math.floor(slippage)) : 0

    const requestId = routeRequestIdRef.current + 1
    routeRequestIdRef.current = requestId
    routeAbortControllerRef.current?.abort()
    const abortController = new AbortController()
    routeAbortControllerRef.current = abortController

    setIsLoadingRoute(true)
    try {
      const params = new URLSearchParams({
        fromAddress,
        chainId: chainId.toString(),
        tokenIn,
        tokenOut,
        amountIn: amountIn.toString(),
        slippage: normalizedSlippage.toString(),
        ...(routingStrategy && { routingStrategy }),
        ...(isCrossChain && { destinationChainId: destinationChainId!.toString() }),
        ...(receiver && { receiver })
      })

      const response = await fetch(`${ENSO_ROUTE_PROXY}?${params}`, { signal: abortController.signal })

      const data = await response.json()
      const isLatestRequest = routeRequestIdRef.current === requestId && !abortController.signal.aborted

      if (!isLatestRequest) {
        return
      }

      const normalizedResponse = normalizeEnsoRouteResponse(data, response.status, chainId)
      if (normalizedResponse.error) {
        console.warn('[Enso] Route error', {
          chainId,
          destinationChainId,
          tokenIn,
          tokenOut,
          amountIn: amountIn.toString(),
          statusCode: normalizedResponse.error.statusCode,
          message: normalizedResponse.error.message,
          requestId: normalizedResponse.error.requestId
        })
        setRoute(undefined)
        setError(normalizedResponse.error)
        setResolvedRequestKey(undefined)
        setErrorRequestKey(requestKey)

        return
      }
      const resolvedRoute = normalizedResponse.route
      setError(undefined)
      setRoute(resolvedRoute)
      setResolvedRequestKey(requestKey)
      setErrorRequestKey(undefined)
      if (env.DEV && resolvedRoute) {
        console.log('[ENSO] route response', {
          chainId,
          destinationChainId,
          tokenIn,
          tokenOut,
          amountIn: amountIn.toString(),
          routeHasSwap: routeHasSwapStep(resolvedRoute),
          route: resolvedRoute.route
        })
      }
    } catch (err) {
      if (abortController.signal.aborted || routeRequestIdRef.current !== requestId) {
        return
      }
      setRoute(undefined)
      setError({
        error: err instanceof Error ? err.name : 'EnsoRouteFetchFailed',
        message: err instanceof Error ? err.message : 'Failed to get Enso route',
        statusCode: 0
      })
      setResolvedRequestKey(undefined)
      setErrorRequestKey(requestKey)
      console.error('Failed to get Enso route:', err, {
        chainId,
        destinationChainId,
        tokenIn,
        tokenOut,
        amountIn: amountIn.toString()
      })
    } finally {
      if (routeRequestIdRef.current === requestId) {
        setIsLoadingRoute(false)
        if (routeAbortControllerRef.current === abortController) {
          routeAbortControllerRef.current = null
        }
      }
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
    routingStrategy,
    requestKey,
    enabled,
    isCrossChain
  ])

  const getEnsoTransaction = useCallback((): EnsoRouteResponse['tx'] | undefined => {
    return visibleRoute?.tx
  }, [visibleRoute])

  const resetRoute = useCallback(() => {
    routeRequestIdRef.current += 1
    routeAbortControllerRef.current?.abort()
    routeAbortControllerRef.current = null
    setRoute(undefined)
    setError(undefined)
    setResolvedRequestKey(undefined)
    setErrorRequestKey(undefined)
    setIsLoadingRoute(false)
  }, [])

  useEffect(() => {
    return () => {
      routeAbortControllerRef.current?.abort()
      routeAbortControllerRef.current = null
    }
  }, [])

  const isValidInput = amountIn > 0n
  const canRequestRoute =
    enabled && !!fromAddress && isValidInput && !isZeroAddress(tokenIn) && !isZeroAddress(tokenOut)
  const hasCurrentRoute = resolvedRequestKey === requestKey
  const hasCurrentError = errorRequestKey === requestKey
  const isLoadingCurrentRequest = isLoadingRoute || (canRequestRoute && !hasCurrentRoute && !hasCurrentError)
  const isAllowanceSufficient = !allowanceSpender || allowance >= amountIn
  const prepareApproveEnabled = routerAddress && !isAllowanceSufficient && isValidInput && enabled
  const prepareApprove: AppUseSimulateContractReturnType = useSimulateContract({
    abi: getApproveAbi(tokenIn),
    functionName: 'approve',
    address: tokenIn,
    args: routerAddress ? [routerAddress, amountIn] : undefined,
    chainId,
    query: { enabled: !!prepareApproveEnabled && !!routerAddress }
  })
  const expectedOut = visibleRoute?.amountOut
    ? toNormalizedBN(BigInt(visibleRoute.amountOut), decimalsOut)
    : toNormalizedBN(0n, decimalsOut)

  const minExpectedOut = visibleRoute?.minAmountOut
    ? toNormalizedBN(BigInt(visibleRoute.minAmountOut), decimalsOut)
    : toNormalizedBN(0n, decimalsOut)
  return {
    actions: {
      prepareApprove
    },
    periphery: {
      prepareApproveEnabled: !!prepareApproveEnabled,
      expectedOut,
      minExpectedOut,
      priceImpact: visibleRoute?.priceImpact,
      allowance,
      isAllowanceSufficient,
      route: visibleRoute,
      routeHasSwap: visibleRouteHasSwap,
      error: visibleError,
      isLoadingRoute: isLoadingCurrentRequest,
      isLoadingAllowance,
      isCrossChain,
      routerAddress,
      approvalSpenderAddress: requestedRouterAddress,
      approvalWarning: hasUntrustedRouterAddress ? UNKNOWN_ENSO_APPROVAL_ROUTER_MESSAGE : undefined,
      refetchAllowance
    },
    methods: {
      getRoute,
      getEnsoTransaction,
      resetRoute
    }
  }
}
