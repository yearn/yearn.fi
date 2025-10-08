import { OrderBookApi, OrderQuoteSideKindSell } from '@cowprotocol/cow-sdk'
import type { OrderQuoteResponse, OrderCreation, SigningScheme } from '@cowprotocol/cow-sdk'
import { isZeroAddress, toBigInt, toNormalizedBN } from '@lib/utils'
import { SOLVER_COW_VAULT_RELAYER_ADDRESS } from '@lib/utils/constants'
import type { TNormalizedBN } from '@lib/types'
import type { Address } from 'viem'
import { type UseSimulateContractReturnType, useSimulateContract } from 'wagmi'
import { useTokenAllowance } from '../useTokenAllowance'
import { erc20Abi } from 'viem'
import { useCallback, useState } from 'react'

const orderBookApi = new OrderBookApi({ chainId: 1 })

interface UseSolverCowswapProps {
  sellToken: Address
  buyToken: Address
  amount: bigint
  account?: Address
  chainId?: number
  enabled?: boolean
  decimals?: number
}

interface UseSolverCowswapReturn {
  actions: {
    prepareApprove: UseSimulateContractReturnType
  }
  periphery: {
    prepareApproveEnabled: boolean
    expectedOut: TNormalizedBN
    allowance: bigint
    quote: OrderQuoteResponse | undefined
    isLoadingQuote: boolean
  }
  getQuote: () => Promise<void>
  getCowswapOrderParams: () => Promise<OrderCreation | undefined>
}

export const useSolverCowswap = ({
  sellToken,
  buyToken,
  amount,
  account,
  chainId = 1,
  decimals = 18,
  enabled = true
}: UseSolverCowswapProps): UseSolverCowswapReturn => {
  const [quote, setQuote] = useState<OrderQuoteResponse | undefined>()
  const [isLoadingQuote, setIsLoadingQuote] = useState(false)
  
  const { allowance = 0n } = useTokenAllowance({
    account,
    token: sellToken,
    spender: SOLVER_COW_VAULT_RELAYER_ADDRESS,
    watch: true,
    chainId
  })

  const getQuote = useCallback(async () => {
    if (!enabled || chainId !== 1 || !account || amount <= 0n) return
    
    if (isZeroAddress(sellToken) || isZeroAddress(buyToken)) return

    setIsLoadingQuote(true)
    try {
      const YEARN_APP_DATA = '0x5d22bf49b708de1d2d9547a6cca9faccbdc2b162012e8573811c07103b163d4b'
      const quoteRequest = {
        from: account,
        sellToken: sellToken,
        buyToken: buyToken,
        receiver: account,
        appData: YEARN_APP_DATA,
        kind: OrderQuoteSideKindSell.SELL,
        partiallyFillable: false,
        validTo: Math.round(new Date().setMinutes(new Date().getMinutes() + 10) / 1000),
        sellAmountBeforeFee: toBigInt(amount).toString()
      }

      const result = await orderBookApi.getQuote(quoteRequest)
      setQuote(result)
    } catch (error) {
      console.error('Failed to get Cowswap quote:', error)
      setQuote(undefined)
    } finally {
      setIsLoadingQuote(false)
    }
  }, [sellToken, buyToken, amount, account, chainId, enabled])

  const getCowswapOrderParams = useCallback(async (): Promise<OrderCreation | undefined> => {
    if (!quote || !account) return undefined

    try {
      // This will be called when the user wants to execute the order
      // It returns the order parameters needed for Cowswap
      const buyAmount = toBigInt(quote.quote.buyAmount)
      const buyAmountWithSlippage = buyAmount - (buyAmount * BigInt(1)) / 100n

      const orderCreation: OrderCreation = {
        ...quote.quote,
        from: account,
        feeAmount: '0',
        buyAmount: buyAmountWithSlippage.toString(),
        sellAmount: (toBigInt(quote.quote.sellAmount) + toBigInt(quote.quote.feeAmount)).toString(),
        quoteId: quote.id,
        // Signature will be added by the custom hook
        signature: '',
        signingScheme: 'eip712' as SigningScheme
      }

      return orderCreation
    } catch (error) {
      console.error('Failed to prepare Cowswap order:', error)
      return undefined
    }
  }, [quote, account])

  const isValidInput = amount > 0n && chainId === 1
  const isAllowanceSufficient = allowance >= amount
  const prepareApproveEnabled = !isAllowanceSufficient && isValidInput && enabled

  const prepareApprove: UseSimulateContractReturnType = useSimulateContract({
    abi: erc20Abi,
    functionName: 'approve',
    address: sellToken,
    args: [SOLVER_COW_VAULT_RELAYER_ADDRESS, amount],
    chainId,
    query: { enabled: prepareApproveEnabled }
  })

  const expectedOut = quote?.quote 
    ? toNormalizedBN(toBigInt(quote.quote.buyAmount), decimals)
    : toNormalizedBN(0n, decimals)

  return {
    actions: {
      prepareApprove
    },
    periphery: {
      prepareApproveEnabled,
      expectedOut,
      allowance,
      quote,
      isLoadingQuote
    },
    getQuote,
    getCowswapOrderParams
  }
}