import { useCallback, useState } from 'react'
import type { Address } from 'viem'
import { formatUnits } from 'viem'

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

  const fetchMaxQuote = useCallback(async () => {
    if (!isNativeToken || !account || !balance || !depositToken) return

    setIsFetching(true)
    try {
      const ENSO_API_BASE = 'https://api.enso.finance/api/v1'
      const ENSO_API_KEY = import.meta.env.VITE_ENSO_API_KEY

      const isCrossChain = sourceChainId !== chainId
      const params = new URLSearchParams({
        fromAddress: account,
        chainId: sourceChainId.toString(),
        tokenIn: depositToken,
        tokenOut: destinationToken,
        amountIn: balance.toString(),
        slippage: (slippage * 100).toString(),
        ...(isCrossChain && { destinationChainId: chainId.toString() }),
        receiver: account
      })

      const response = await fetch(`${ENSO_API_BASE}/shortcuts/route?${params}`, {
        headers: {
          Authorization: `Bearer ${ENSO_API_KEY}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()
      if (data.error) {
        console.error('Enso MAX quote error:', data.message)
        return
      }

      const gasEstimate = BigInt(data.gas)
      const gasPriceGwei = 20n
      const gasPrice = gasPriceGwei * 1_000_000_000n
      const gasReserve = (gasEstimate * gasPrice * 120n) / 100n

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
    onResult
  ])

  return {
    fetchMaxQuote,
    isFetching
  }
}
