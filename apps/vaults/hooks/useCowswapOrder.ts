import type { OrderCreation, UnsignedOrder } from '@cowprotocol/cow-sdk'
import { OrderBookApi, OrderSigningUtils } from '@cowprotocol/cow-sdk'
import { retrieveConfig } from '@lib/utils/wagmi'
import { getEthersSigner } from '@lib/utils/wagmi/ethersAdapter'
import { useCallback, useMemo, useState } from 'react'
import type { UseSimulateContractReturnType } from 'wagmi'

const orderBookApi = new OrderBookApi({ chainId: 1 })

interface UseCowswapOrderProps {
  getCowswapOrderParams: () => Promise<OrderCreation | undefined>
  enabled?: boolean
}

interface UseCowswapOrderReturn {
  prepareCowswapOrder: UseSimulateContractReturnType
}

// This hook wraps Cowswap order execution to work like a regular contract interaction
export const useCowswapOrder = ({
  getCowswapOrderParams,
  enabled = true
}: UseCowswapOrderProps): UseCowswapOrderReturn => {
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const executeOrder = useCallback(async () => {
    setIsExecuting(true)
    setError(null)

    try {
      const orderParams = await getCowswapOrderParams()
      if (!orderParams) throw new Error('No order parameters')

      // Sign the order
      const signer = await getEthersSigner(retrieveConfig(), { chainId: 1 })
      if (!signer) throw new Error('No signer available')

      const { signature, signingScheme } = await OrderSigningUtils.signOrder(orderParams as UnsignedOrder, 1, signer)

      // Submit the order
      const orderCreation: OrderCreation = {
        ...orderParams,
        signature,
        signingScheme: signingScheme as any
      }

      const orderUID = await orderBookApi.sendOrder(orderCreation)

      // Wait for order to be executed
      const maxIterations = 100
      for (let i = 0; i < maxIterations; i++) {
        const response = await fetch(`https://api.cow.fi/mainnet/api/v1/orders/${orderUID}`)
        const order = await response.json()

        if (order?.status === 'fulfilled') {
          setIsExecuting(false)
          return { success: true, orderUID }
        }

        if (order?.status === 'cancelled' || order?.status === 'expired') {
          throw new Error('Order was cancelled or expired')
        }

        await new Promise((resolve) => setTimeout(resolve, 3000))
      }

      throw new Error('Order timed out')
    } catch (err) {
      setError(err as Error)
      setIsExecuting(false)
      throw err
    }
  }, [getCowswapOrderParams])

  // Create a mock simulate contract result that TxButton can understand
  const prepareCowswapOrder: UseSimulateContractReturnType = useMemo(() => {
    return {
      data: enabled
        ? {
            request: {
              // Custom marker to identify this as a Cowswap order
              __isCowswapOrder: true,
              // Override writeContractAsync to execute our custom order
              writeContractAsync: executeOrder
            } as any
          }
        : undefined,
      error: error,
      isError: !!error,
      isLoading: isExecuting,
      isSuccess: !error && !isExecuting && enabled,
      isFetching: false,
      isPending: false,
      isRefetching: false,
      refetch: async () => ({ data: undefined, error: null }),
      status: isExecuting ? 'pending' : error ? 'error' : 'success',
      fetchStatus: 'idle',
      dataUpdatedAt: Date.now()
    } as UseSimulateContractReturnType
  }, [enabled, error, isExecuting, executeOrder])

  return {
    prepareCowswapOrder
  }
}
