import { getRedeemPreviewCall } from '@pages/vaults/hooks/actions/stakingAdapter'
import { type EnsoRouteResponse, normalizeEnsoRouteResponse } from '@pages/vaults/hooks/solvers/ensoRoute'
import { calculateRemainingEnsoSlippagePercentage, clampZapSlippage, toBasisPoints } from '@shared/utils/slippage'
import { useCallback, useState } from 'react'
import { type Address, formatUnits, isAddressEqual } from 'viem'
import { useConfig } from 'wagmi'
import { readContract } from 'wagmi/actions'
import { resolveExecutionChainId } from '@/config/tenderly'
import { calculateDepositValueInfo, resolveValuationShareCount } from './valuation'

const ENSO_ROUTE_PROXY = '/api/enso/route'
const MAX_QUOTE_GAS_PRICE_GWEI = 20n
const MAX_QUOTE_GAS_RESERVE_MULTIPLIER = 120n

export function resolveMaxQuoteSlippage({
  hasBootstrapQuote,
  userTolerancePercentage,
  quoteImpactPercentage
}: {
  hasBootstrapQuote: boolean
  userTolerancePercentage: number
  quoteImpactPercentage: number
}): number {
  if (!hasBootstrapQuote) {
    return clampZapSlippage(userTolerancePercentage)
  }

  return calculateRemainingEnsoSlippagePercentage({
    userTolerancePercentage,
    quoteImpactPercentage
  })
}

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
  inputTokenUsdPrice: number
  assetTokenUsdPrice: number
  pricePerShare: bigint
  vaultDecimals: number
  assetTokenDecimals: number
  vaultAddress: Address
  stakingAddress?: Address
  stakingSource?: string
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
  inputTokenUsdPrice,
  assetTokenUsdPrice,
  pricePerShare,
  vaultDecimals,
  assetTokenDecimals,
  vaultAddress,
  stakingAddress,
  stakingSource,
  onResult
}: UseFetchMaxQuoteProps): FetchMaxQuoteResult => {
  const [isFetching, setIsFetching] = useState(false)
  const config = useConfig()

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

  const normalizeVaultShares = useCallback(
    async (expectedOut: bigint): Promise<bigint> => {
      const shouldPreviewRedeem =
        !!stakingAddress && isAddressEqual(destinationToken, stakingAddress) && expectedOut > 0n
      const previewRedeemCall = shouldPreviewRedeem ? getRedeemPreviewCall(stakingSource, expectedOut) : undefined
      let previewedVaultShares: bigint | undefined

      if (stakingAddress && previewRedeemCall) {
        try {
          const normalized = await readContract(config, {
            chainId: resolveExecutionChainId(chainId) ?? chainId,
            address: stakingAddress,
            abi: previewRedeemCall.abi as any,
            functionName: previewRedeemCall.functionName as any,
            args: previewRedeemCall.args as any
          })
          previewedVaultShares = BigInt(normalized as bigint)
        } catch (error) {
          console.warn('Failed to normalize Enso MAX quote output', error)
        }
      }

      return resolveValuationShareCount({
        expectedOut,
        destinationToken,
        vaultAddress,
        stakingAddress,
        previewedVaultShares
      })
    },
    [chainId, config, destinationToken, stakingAddress, stakingSource, vaultAddress]
  )

  const fetchMaxQuote = useCallback(async () => {
    if (!isNativeToken || !account || !balance || !depositToken) return

    setIsFetching(true)
    try {
      const bootstrapRoute = await fetchRoute(0)
      const userTolerance = clampZapSlippage(slippage)

      let routeSlippage = resolveMaxQuoteSlippage({
        hasBootstrapQuote: Boolean(bootstrapRoute),
        userTolerancePercentage: userTolerance,
        quoteImpactPercentage: 0
      })

      if (bootstrapRoute) {
        const [normalizedExpectedOut, normalizedMinExpectedOut] = await Promise.all([
          normalizeVaultShares(BigInt(bootstrapRoute.amountOut)),
          normalizeVaultShares(BigInt(bootstrapRoute.minAmountOut))
        ])

        const depositValueInfo = calculateDepositValueInfo({
          depositAmountBn: balance,
          inputTokenDecimals: decimals,
          inputTokenUsdPrice,
          normalizedVaultShares: normalizedExpectedOut,
          normalizedMinVaultShares: normalizedMinExpectedOut,
          vaultDecimals,
          pricePerShare,
          assetTokenDecimals,
          assetUsdPrice: assetTokenUsdPrice
        })

        routeSlippage = resolveMaxQuoteSlippage({
          hasBootstrapQuote: true,
          userTolerancePercentage: userTolerance,
          quoteImpactPercentage: depositValueInfo.priceImpactPercentage
        })
      }

      if (!bootstrapRoute && routeSlippage === 0) {
        return
      }

      const routeForGas = bootstrapRoute && routeSlippage === 0 ? bootstrapRoute : await fetchRoute(routeSlippage)

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
  }, [
    isNativeToken,
    account,
    balance,
    decimals,
    depositToken,
    destinationToken,
    sourceChainId,
    chainId,
    slippage,
    inputTokenUsdPrice,
    assetTokenUsdPrice,
    pricePerShare,
    vaultDecimals,
    assetTokenDecimals,
    fetchRoute,
    normalizeVaultShares,
    onResult
  ])

  return {
    fetchMaxQuote,
    isFetching
  }
}
