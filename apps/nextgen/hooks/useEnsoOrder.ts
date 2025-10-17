import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Address, Hash, Hex } from 'viem'
import type { UseSimulateContractReturnType } from 'wagmi'
import { usePublicClient, useWaitForTransactionReceipt, useWalletClient } from 'wagmi'

interface EnsoTransaction {
  to: Address
  data: Hex
  value: string
  from: Address
  chainId: number
}

interface UseEnsoOrderProps {
  getEnsoTransaction: () => EnsoTransaction | undefined
  enabled?: boolean
  chainId: number
}

interface UseEnsoOrderReturn {
  prepareEnsoOrder: UseSimulateContractReturnType
  receiptSuccess: boolean
  txHash: Hash | undefined
}

// This hook wraps Enso transaction execution to work like a regular contract interaction
export const useEnsoOrder = ({
  getEnsoTransaction,
  enabled = true,
  chainId
}: UseEnsoOrderProps): UseEnsoOrderReturn => {
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [txHash, setTxHash] = useState<Hash | undefined>()
  const [waitingForTx, setWaitingForTx] = useState(false)
  const publicClient = usePublicClient({ chainId })
  const { data: walletClient } = useWalletClient({ chainId })
  const {
    data: receipt,
    isLoading: isWaitingForReceipt,
    isSuccess: receiptSuccess
  } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId
  })

  const executeOrder = useCallback(async () => {
    setIsExecuting(true)
    setError(null)

    try {
      const ensoTx = getEnsoTransaction()
      if (!ensoTx) throw new Error('No Enso transaction data')
      if (!walletClient) throw new Error('No wallet client available')
      if (!publicClient) throw new Error('No public client available')

      // Send the transaction
      const hash = await walletClient.sendTransaction({
        to: ensoTx.to,
        data: ensoTx.data,
        value: BigInt(ensoTx.value || 0),
        chain: walletClient.chain
      })

      // Store hash for receipt monitoring
      setTxHash(hash)
      setIsExecuting(false)
      setWaitingForTx(true)
      return { success: true, hash, waitingForReceipt: true }
    } catch (err) {
      setError(err as Error)
      setIsExecuting(false)
      throw err
    }
  }, [getEnsoTransaction, walletClient, publicClient])

  // Clear states when transaction data changes
  const ensoTx = getEnsoTransaction()
  useEffect(() => {
    setError(null)
    setTxHash(undefined)
    setWaitingForTx(false)
  }, [ensoTx?.data, ensoTx?.to, ensoTx?.value])

  // Handle receipt
  useEffect(() => {
    if (receipt && waitingForTx) {
      setWaitingForTx(false)
      if (receipt.status === 'reverted') {
        setError(new Error('Transaction reverted'))
      }
    }
  }, [receipt, waitingForTx])

  // Create a mock simulate contract result that TxButton can understand
  const prepareEnsoOrder: UseSimulateContractReturnType = useMemo(() => {
    return {
      data:
        enabled && ensoTx
          ? {
              request: {
                // Standard contract fields for gas estimation
                address: ensoTx.to,
                abi: [] as const,
                functionName: 'execute' as any,
                args: [] as readonly unknown[],
                data: ensoTx.data,
                value: BigInt(ensoTx.value || 0),
                chainId: ensoTx.chainId,
                account: ensoTx.from,
                // Custom marker to identify this as an Enso order
                __isEnsoOrder: true,
                // Override writeContractAsync to execute our custom order
                writeContractAsync: executeOrder,
                // Pass transaction hash for monitoring
                __txHash: txHash,
                __waitingForTx: waitingForTx
              } as any,
              result: undefined
            }
          : undefined,
      error: null,
      isError: false,
      isLoading: isExecuting || waitingForTx,
      isSuccess: enabled && !!ensoTx && !isExecuting && !waitingForTx,
      isFetching: false,
      isPending: false,
      isRefetching: false,
      refetch: async () => ({ data: undefined, error: null }),
      status: isExecuting ? 'pending' : error ? 'error' : 'success',
      fetchStatus: 'idle',
      dataUpdatedAt: Date.now()
    } as UseSimulateContractReturnType
  }, [enabled, error, isExecuting, executeOrder, getEnsoTransaction])

  return {
    prepareEnsoOrder,
    receiptSuccess,
    txHash
  }
}
