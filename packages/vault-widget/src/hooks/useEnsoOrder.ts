import { usePublicClient } from '@yearn/vault-widget/internal/hooks/useAppWagmi'
import { useVaultWidgetRuntime } from '@yearn/vault-widget/runtime'
import type { TRawTransaction, TRawTransactionPreparation } from '@yearn/vault-widget/types'
import { useCallback, useEffect, useMemo, useState } from 'react'

export type TEnsoTransaction = TRawTransaction

interface UseEnsoOrderProps {
  getEnsoTransaction: () => TEnsoTransaction | undefined
  refreshEnsoTransaction?: () => Promise<void>
  routeError?: string
  isPreparingRoute?: boolean
  enabled?: boolean
  chainId: number
}

interface UseEnsoOrderReturn {
  prepareEnsoOrder: TRawTransactionPreparation
}

export class EnsoSimulationError extends Error {
  constructor(cause: unknown) {
    super('This route can no longer execute. The quote is refreshing; please try again.', { cause })
    this.name = 'EnsoSimulationError'
  }
}

export async function simulateEnsoOrder(
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>,
  transaction: TEnsoTransaction
): Promise<void> {
  try {
    await publicClient.call({
      account: transaction.from,
      to: transaction.to,
      data: transaction.data,
      value: BigInt(transaction.value || 0)
    })
  } catch (error) {
    throw new EnsoSimulationError(error)
  }
}

export const useEnsoOrder = ({
  getEnsoTransaction,
  refreshEnsoTransaction,
  routeError,
  isPreparingRoute = false,
  enabled = true,
  chainId
}: UseEnsoOrderProps): UseEnsoOrderReturn => {
  const runtime = useVaultWidgetRuntime()
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const executionChainId = runtime.chains.resolveExecutionChainId(chainId)
  const publicClient = usePublicClient({ chainId })

  const executeOrder = useCallback(async () => {
    setIsExecuting(true)
    setError(null)

    try {
      const ensoTx = getEnsoTransaction()
      if (!ensoTx) throw new Error('No Enso transaction data')
      if (!publicClient) throw new Error('No public client available')
      if (!executionChainId) throw new Error(`No execution chain configured for chain ${chainId}`)

      await simulateEnsoOrder(publicClient, ensoTx)
      return await runtime.execution.execute({
        account: ensoTx.from,
        request: {
          chainId,
          to: ensoTx.to,
          data: ensoTx.data,
          value: BigInt(ensoTx.value || 0)
        }
      })
    } catch (executionError) {
      setError(executionError as Error)
      throw executionError
    } finally {
      setIsExecuting(false)
    }
  }, [chainId, executionChainId, getEnsoTransaction, publicClient, runtime.execution])

  const ensoTx = getEnsoTransaction()
  const preparationError = useMemo(() => error ?? (routeError ? new Error(routeError) : null), [error, routeError])

  useEffect(() => {
    if (isExecuting) return
    setError(null)
  }, [ensoTx?.data, ensoTx?.to, ensoTx?.value, isExecuting])

  const prepareEnsoOrder = useMemo(
    (): TRawTransactionPreparation => ({
      kind: 'raw',
      transaction: ensoTx,
      chainId: executionChainId ?? chainId,
      execute: executeOrder,
      error: preparationError,
      isError: Boolean(preparationError),
      isLoading: isPreparingRoute || isExecuting,
      isSuccess: enabled && !!ensoTx && !!executionChainId && !preparationError && !isPreparingRoute && !isExecuting,
      isFetching: false,
      refetch: async () => {
        await refreshEnsoTransaction?.()
      },
      status: isPreparingRoute || isExecuting ? 'pending' : preparationError ? 'error' : 'success'
    }),
    [
      chainId,
      enabled,
      ensoTx,
      executeOrder,
      executionChainId,
      isExecuting,
      isPreparingRoute,
      preparationError,
      refreshEnsoTransaction
    ]
  )

  return { prepareEnsoOrder }
}
