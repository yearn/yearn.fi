import { type EnsoRouteResponse, normalizeEnsoRouteResponse } from '@pages/vaults/hooks/solvers/ensoRoute'
import { clampZapSlippage, toBasisPoints } from '@shared/utils/slippage'
import { useCallback, useState } from 'react'
import { type Address, formatUnits } from 'viem'

const ENSO_ROUTE_PROXY = '/api/enso/route'
const MAX_QUOTE_GAS_PRICE_GWEI = 20n
const MAX_QUOTE_GAS_RESERVE_MULTIPLIER = 120n

interface UseFetchMaxQuoteProps {
  isNativeToken: boolean
  account?: Address
  balance?: bigint
  decimals: number
  depositToken: Address
  destinationToken: Address
  sourceChainId: number
  chainId: number
  slippage: number
  onResult: (value: string) => void
}

interface FetchMaxQuoteResult {
  fetchMaxQuote: () => Promise<void>
  isFetching: boolean
}

export const useFetchMaxQuote = ({
  isNativeToken,
  account,
  balance,
  decimals,
  depositToken,
  destinationToken,
  sourceChainId,
  chainId,
  slippage,
  onResult
}: UseFetchMaxQuoteProps): FetchMaxQuoteResult => {
  const [isFetching, setIsFetching] = useState(false)

  const fetchRoute = useCallback(
    async (routeSlippage: number): Promise<EnsoRouteResponse | undefined> => {
      const isCrossChain = sourceChainId !== chainId
      const params = new URLSearchParams({
        fromAddress: account!,
        chainId: sourceChainId.toString(),
        tokenIn: depositToken,
        tokenOut: destinationToken,
        amountIn: balance!.toString(),
        slippage: toBasisPoints(routeSlippage).toString(),
        ...(isCrossChain && { destinationChainId: chainId.toString() }),
        receiver: account!
      })

      const response = await fetch(`${ENSO_ROUTE_PROXY}?${params}`)
      const data = await response.json()
      const normalizedResponse = normalizeEnsoRouteResponse(data, response.status, sourceChainId)

      if (normalizedResponse.error) {
        console.warn('[Enso] MAX quote error', {
          sourceChainId,
          destinationChainId: isCrossChain ? chainId : undefined,
          depositToken,
          destinationToken,
          amountIn: balance?.toString(),
          slippage: routeSlippage,
          statusCode: normalizedResponse.error.statusCode,
          message: normalizedResponse.error.message,
          requestId: normalizedResponse.error.requestId
        })
        return undefined
      }

      return normalizedResponse.route
    },
    [account, balance, chainId, depositToken, destinationToken, sourceChainId]
  )

  const fetchMaxQuote = useCallback(async () => {
    if (!isNativeToken || !account || !balance || !depositToken) return

    setIsFetching(true)
    try {
      const routeForGas = await fetchRoute(clampZapSlippage(slippage))

      if (!routeForGas) {
        return
      }

      const gasEstimate = BigInt(routeForGas.gas)
      const gasPrice = MAX_QUOTE_GAS_PRICE_GWEI * 1_000_000_000n
      const gasReserve = (gasEstimate * gasPrice * MAX_QUOTE_GAS_RESERVE_MULTIPLIER) / 100n

      if (gasReserve >= balance) {
        onResult('0')
      } else {
        const adjustedBalance = balance - gasReserve
        onResult(formatUnits(adjustedBalance, decimals))
      }
    } catch (error) {
      console.error('Failed to fetch MAX quote:', error)
    } finally {
      setIsFetching(false)
    }
  }, [isNativeToken, account, balance, decimals, depositToken, slippage, fetchRoute, onResult])

  return {
    fetchMaxQuote,
    isFetching
  }
}
