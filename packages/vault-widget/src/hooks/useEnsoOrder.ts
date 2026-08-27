import { usePublicClient } from '@yearn/vault-widget/internal/hooks/useAppWagmi'
import { useVaultWidgetRuntime } from '@yearn/vault-widget/runtime'
import type { TRawTransaction, TRawTransactionPreparation } from '@yearn/vault-widget/types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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

type TFailedEnsoSimulation = {
  error: EnsoSimulationError
  transactionFingerprint: string
}

function getEnsoTransactionFingerprint(transaction: TEnsoTransaction): string {
  return [
    transaction.chainId,
    transaction.from.toLowerCase(),
    transaction.to.toLowerCase(),
    transaction.value,
    transaction.data
  ].join(':')
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
  const [failedSimulation, setFailedSimulation] = useState<TFailedEnsoSimulation | undefined>(undefined)
  const failedSimulationRef = useRef<TFailedEnsoSimulation | undefined>(undefined)
  const executionChainId = runtime.chains.resolveExecutionChainId(chainId)
  const publicClient = usePublicClient({ chainId })

  const executeOrder = useCallback(async () => {
    const ensoTx = getEnsoTransaction()
    if (!ensoTx) {
      const missingTransactionError = new Error('No Enso transaction data')
      setError(missingTransactionError)
      throw missingTransactionError
    }

    const transactionFingerprint = getEnsoTransactionFingerprint(ensoTx)
    const blockedSimulation = failedSimulationRef.current
    if (blockedSimulation?.transactionFingerprint === transactionFingerprint) {
      setError(blockedSimulation.error)
      throw blockedSimulation.error
    }

    setIsExecuting(true)
    setError(null)

    try {
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
      const normalizedError = executionError as Error
      setError(normalizedError)
      if (normalizedError instanceof EnsoSimulationError) {
        const failedEnsoSimulation = { error: normalizedError, transactionFingerprint }
        failedSimulationRef.current = failedEnsoSimulation
        setFailedSimulation(failedEnsoSimulation)
        await refreshEnsoTransaction?.().catch(() => undefined)
      }
      throw executionError
    } finally {
      setIsExecuting(false)
    }
  }, [chainId, executionChainId, getEnsoTransaction, publicClient, refreshEnsoTransaction, runtime.execution])

  const ensoTx = getEnsoTransaction()
  const transactionFingerprint = ensoTx ? getEnsoTransactionFingerprint(ensoTx) : undefined
  const blockedSimulation =
    transactionFingerprint && failedSimulation?.transactionFingerprint === transactionFingerprint
      ? failedSimulation
      : undefined
  const preparationError = useMemo(
    () => blockedSimulation?.error ?? error ?? (routeError ? new Error(routeError) : null),
    [blockedSimulation?.error, error, routeError]
  )

  useEffect(() => {
    if (!failedSimulation || !transactionFingerprint) return
    if (failedSimulation.transactionFingerprint === transactionFingerprint) return

    failedSimulationRef.current = undefined
    setFailedSimulation(undefined)
    setError((currentError) => (currentError === failedSimulation.error ? null : currentError))
  }, [failedSimulation, transactionFingerprint])

  useEffect(() => {
    if (isExecuting || blockedSimulation) return
    setError(null)
  }, [blockedSimulation, ensoTx?.data, ensoTx?.to, ensoTx?.value, isExecuting])

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
