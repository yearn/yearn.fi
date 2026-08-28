import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type AppUseSimulateContractReturnType,
  useSimulateContract
} from '@yearn/vault-widget/internal/hooks/useAppWagmi'
import { isZeroAddress, toNormalizedBN } from '@yearn/vault-widget/internal/utils'
import { getApproveAbi } from '@yearn/vault-widget/internal/utils/approve'
import { MIN_CROSS_CHAIN_ENSO_SLIPPAGE_BPS } from '@yearn/vault-widget/internal/utils/slippage'
import { useVaultWidgetRuntime } from '@yearn/vault-widget/runtime'
import type { TNormalizedBN } from '@yearn/vault-widget/types'
import { useCallback, useMemo } from 'react'
import type { Address } from 'viem'
import {
  getKnownEnsoRouterAddress,
  getValidatedEnsoRouterAddress,
  UNKNOWN_ENSO_APPROVAL_ROUTER_MESSAGE
} from '../../utils/ensoRouters'
import { useTokenAllowance } from '../useTokenAllowance'
import {
  type EnsoError,
  type EnsoRouteResponse,
  getEnsoBridgeProtocol,
  normalizeEnsoRouteResponse,
  routeHasSwapStep
} from './ensoRoute'

const ENSO_ROUTE_PROXY = '/api/enso/route'
export type EnsoRoutingStrategy = 'router' | 'delegate' | 'router-legacy' | 'delegate-legacy' | 'ensowallet'
export type EnsoQuotePurpose = 'calibration' | 'execution'

export function getEffectiveEnsoRequestSlippage(requestedSlippage: number, isCrossChain: boolean): number {
  const normalizedSlippage = Number.isFinite(requestedSlippage) ? Math.max(0, Math.floor(requestedSlippage)) : 0
  return isCrossChain && normalizedSlippage === 0 ? MIN_CROSS_CHAIN_ENSO_SLIPPAGE_BPS : normalizedSlippage
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
  quotePurpose?: EnsoQuotePurpose
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
    bridgeProtocol: ReturnType<typeof getEnsoBridgeProtocol>
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
  quotePurpose = 'execution',
  routingStrategy,
  requestKey = 'default',
  decimalsOut = 18,
  enabled = true
}: UseSolverEnsoProps): UseSolverEnsoReturn => {
  const runtime = useVaultWidgetRuntime()
  const isCrossChain = destinationChainId !== undefined && destinationChainId !== chainId
  const normalizedSlippage = Number.isFinite(slippage) ? Math.max(0, Math.floor(slippage)) : 0
  const effectiveSlippage = getEffectiveEnsoRequestSlippage(normalizedSlippage, isCrossChain)
  const canRequestRoute =
    enabled && !!fromAddress && amountIn > 0n && !isZeroAddress(tokenIn) && !isZeroAddress(tokenOut)
  const routeQueryKey = useMemo(
    () =>
      [
        'enso-route',
        quotePurpose,
        requestKey,
        chainId,
        destinationChainId ?? 'same-chain',
        tokenIn,
        tokenOut,
        amountIn.toString(),
        fromAddress ?? 'no-account',
        receiver ?? 'no-receiver',
        normalizedSlippage,
        effectiveSlippage,
        routingStrategy ?? 'default-strategy'
      ] as const,
    [
      amountIn,
      chainId,
      destinationChainId,
      effectiveSlippage,
      fromAddress,
      normalizedSlippage,
      quotePurpose,
      receiver,
      requestKey,
      routingStrategy,
      tokenIn,
      tokenOut
    ]
  )
  const queryClient = useQueryClient()
  const routeEndpoint = runtime.routing.ensoRouteEndpoint ?? ENSO_ROUTE_PROXY
  const routeQuery = useQuery({
    queryKey: routeQueryKey,
    enabled: canRequestRoute,
    retry: false,
    staleTime: 0,
    queryFn: async ({ signal }) => {
      if (!fromAddress) return undefined
      const params = new URLSearchParams({
        fromAddress,
        chainId: chainId.toString(),
        tokenIn,
        tokenOut,
        amountIn: amountIn.toString(),
        slippage: effectiveSlippage.toString(),
        ...(routingStrategy && { routingStrategy }),
        ...(isCrossChain && { destinationChainId: destinationChainId!.toString() }),
        ...(receiver && { receiver })
      })
      const response = await fetch(`${routeEndpoint}?${params}`, { signal })
      const data = await response.json()
      return normalizeEnsoRouteResponse(data, response.status, chainId)
    }
  })
  const requestedRoute = routeQuery.data?.route
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
      : (routeQuery.data?.error ??
        (routeQuery.error
          ? {
              error: routeQuery.error.name || 'EnsoRouteFetchFailed',
              message: routeQuery.error.message || 'Failed to get Enso route',
              statusCode: 0
            }
          : undefined))
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

  const getRoute = useCallback(async (): Promise<void> => {
    await routeQuery.refetch({ cancelRefetch: false })
  }, [routeQuery.refetch])

  const getEnsoTransaction = useCallback((): EnsoRouteResponse['tx'] | undefined => {
    return visibleRoute?.tx
  }, [visibleRoute])

  const resetRoute = useCallback(() => {
    void queryClient.cancelQueries({ queryKey: routeQueryKey, exact: true })
    queryClient.removeQueries({ queryKey: routeQueryKey, exact: true })
  }, [queryClient, routeQueryKey])

  const isValidInput = amountIn > 0n
  const isLoadingCurrentRequest = canRequestRoute && (routeQuery.isLoading || routeQuery.isFetching)
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
      bridgeProtocol: getEnsoBridgeProtocol(visibleRoute),
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
