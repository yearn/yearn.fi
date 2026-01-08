import { Button } from '@lib/components/Button'
import { toast } from '@lib/components/yToast'
import { useNotificationsActions } from '@lib/contexts/useNotificationsActions'
import type { TCreateNotificationParams } from '@lib/types/notifications'
import { type ComponentProps, type FC, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import {
  type UseSimulateContractReturnType,
  useAccount,
  useChainId,
  usePublicClient,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract
} from 'wagmi'

type Props = {
  prepareWrite: UseSimulateContractReturnType
  transactionName: string
  disabled?: boolean
  loading?: boolean
  onSuccess?: () => void
  notification?: TCreateNotificationParams
}

export const TxButton: FC<Props & ComponentProps<typeof Button>> = ({
  prepareWrite,
  transactionName = 'Send',
  disabled: _disabled,
  loading: _loading,
  onSuccess,
  notification,
  ...props
}) => {
  const writeContract = useWriteContract()
  const currentChainId = useChainId()
  const { switchChainAsync, isPending: isChainSwitching } = useSwitchChain()
  const [ensoTxHash, setEnsoTxHash] = useState<`0x${string}` | undefined>()
  const receipt = useWaitForTransactionReceipt({ hash: writeContract.data || ensoTxHash })
  const [isSigning, setIsSigning] = useState(false)
  const client = usePublicClient()
  const lastToastedTxHash = useRef<string | undefined>(undefined)
  const { address: account } = useAccount()

  // Track pending execution after chain switch (to wait for React state to update)
  const [pendingChainExecution, setPendingChainExecution] = useState<number | null>(null)

  // Notification system integration
  const { createNotification, updateNotification } = useNotificationsActions()
  const [notificationId, setNotificationId] = useState<number | undefined>()

  const txChainId = prepareWrite.data?.request.chainId
  const wrongNetwork = txChainId && currentChainId !== txChainId

  const { isSuccess: isTxSuccess, isError } = receipt
  const { isFetching: isSimulating } = prepareWrite

  // For Enso orders, check if we're waiting for transaction
  const isEnsoOrder = !!(prepareWrite.data?.request as any)?.__isEnsoOrder
  // Loading state: external loading, chain switching, pending chain execution, signing, or waiting for receipt confirmation
  const isLoading = _loading || isChainSwitching || !!pendingChainExecution || isSigning || receipt.isFetching

  const disabled = _disabled || (!prepareWrite.isSuccess && !wrongNetwork) || isLoading || isSimulating

  // Create notification with txHash (called after signing succeeds)
  const handleCreateNotification = useCallback(
    async (txHash: `0x${string}`, status: 'pending' | 'submitted' = 'pending'): Promise<number | undefined> => {
      if (!notification || !account) return undefined

      try {
        const id = await createNotification(notification)
        setNotificationId(id)
        // Immediately update with txHash
        await updateNotification({ id, txHash, status })
        return id
      } catch (error) {
        console.error('Failed to create notification:', error)
        return undefined
      }
    },
    [notification, account, createNotification, updateNotification]
  )

  // Update notification with new status/receipt
  const handleUpdateNotification = useCallback(
    async (params: { status?: 'pending' | 'success' | 'error'; receipt?: any }) => {
      if (!notificationId) return

      try {
        await updateNotification({
          id: notificationId,
          status: params.status,
          receipt: params.receipt
        })
      } catch (error) {
        console.error('Failed to update notification:', error)
      }
    },
    [notificationId, updateNotification]
  )

  // Handle chain switching
  const handleChainSwitch = useCallback(async (): Promise<boolean> => {
    if (!wrongNetwork || !txChainId) return true
    try {
      await switchChainAsync({ chainId: txChainId })
      return true
    } catch (error) {
      console.error('Failed to switch chain:', error)
      toast({ content: 'Failed to switch network', type: 'error' })
      return false
    }
  }, [wrongNetwork, txChainId, switchChainAsync])

  // Estimate gas with buffer
  const estimateGas = useCallback(async (): Promise<{ gas?: bigint }> => {
    if (!prepareWrite.data?.request || !client) return {}
    try {
      const gasEstimate = await client.estimateContractGas(prepareWrite.data.request as any)
      if (gasEstimate) {
        return { gas: (gasEstimate * BigInt(110)) / BigInt(100) }
      }
      return {}
    } catch (error) {
      console.error(`Failed gas estimation for ${prepareWrite.data.request.functionName}`, error)
      return {}
    }
  }, [prepareWrite.data?.request, client])

  // Execute Enso transaction
  const executeEnsoTransaction = useCallback(async () => {
    const customWriteAsync = (prepareWrite.data?.request as any).writeContractAsync
    const isCrossChain = notification?.type === 'crosschain zap'

    try {
      const result = await customWriteAsync()

      if (result.hash) {
        // Create notification after signing succeeds (with txHash)
        await handleCreateNotification(result.hash, isCrossChain ? 'submitted' : 'pending')

        if (isCrossChain) {
          // Cross-chain: Don't wait for receipt, show toast and complete
          toast({ content: 'Transaction submitted', type: 'info' })
          onSuccess?.()
          setNotificationId(undefined)
        } else {
          // Same-chain: Store hash and wait for receipt
          setEnsoTxHash(result.hash)
        }
      }
    } catch (error: any) {
      setEnsoTxHash(undefined)
      writeContract.reset()

      const isUserRejection =
        error?.message?.toLowerCase().includes('rejected') ||
        error?.message?.toLowerCase().includes('denied') ||
        error?.code === 4001

      if (!isUserRejection) {
        toast({ content: 'Transaction failed', type: 'error' })
      }
      console.error('Enso transaction failed:', error)
    }
  }, [prepareWrite.data?.request, notification?.type, handleCreateNotification, onSuccess, writeContract])

  // Execute regular transaction
  const executeRegularTransaction = useCallback(
    async (gasOverrides: { gas?: bigint }) => {
      if (!prepareWrite.data?.request) return

      try {
        const hash = await writeContract.writeContractAsync({
          ...prepareWrite.data.request,
          ...gasOverrides
        })

        // Create notification after signing succeeds (with txHash)
        await handleCreateNotification(hash)
      } catch (error: any) {
        writeContract.reset()

        const isUserRejection =
          error?.message?.toLowerCase().includes('rejected') ||
          error?.message?.toLowerCase().includes('denied') ||
          error?.code === 4001

        if (!isUserRejection) {
          toast({ content: 'Transaction failed', type: 'error' })
        }
        console.error('Transaction failed:', error)
      }
    },
    [prepareWrite.data?.request, writeContract, handleCreateNotification]
  )

  // Core transaction execution logic
  const executeTransaction = useCallback(async () => {
    if (!prepareWrite.isSuccess || !prepareWrite.data?.request) return

    setIsSigning(true)

    try {
      const gasOverrides = await estimateGas()

      if (isEnsoOrder) {
        await executeEnsoTransaction()
      } else {
        await executeRegularTransaction(gasOverrides)
      }
    } finally {
      setIsSigning(false)
    }
  }, [
    prepareWrite.isSuccess,
    prepareWrite.data?.request,
    estimateGas,
    isEnsoOrder,
    executeEnsoTransaction,
    executeRegularTransaction
  ])

  // Keep a ref to the latest executeTransaction to avoid stale closures in effects
  const executeTransactionRef = useRef(executeTransaction)
  executeTransactionRef.current = executeTransaction

  // Main click handler
  const handleClick = useCallback(async () => {
    // If on wrong network, switch chain and queue execution for after React updates
    if (wrongNetwork && txChainId) {
      const chainSwitched = await handleChainSwitch()
      if (chainSwitched) {
        // Queue execution for when chain state updates
        setPendingChainExecution(txChainId)
      }
      return
    }

    // Already on correct chain, execute immediately
    await executeTransaction()
  }, [wrongNetwork, txChainId, handleChainSwitch, executeTransaction])

  // Execute pending transaction after chain switch propagates to React state
  useEffect(() => {
    if (!pendingChainExecution || currentChainId !== pendingChainExecution) {
      return
    }

    // Delay to ensure all wagmi hooks (walletClient, publicClient) have updated
    // Use ref to call the latest version of executeTransaction
    const timeout = setTimeout(() => {
      setPendingChainExecution(null)
      executeTransactionRef.current()
    }, 150)

    return () => clearTimeout(timeout)
  }, [pendingChainExecution, currentChainId])

  // Handle transaction success
  useEffect(() => {
    if (isTxSuccess && receipt.data?.transactionHash) {
      // Prevent duplicate toasts
      if (lastToastedTxHash.current !== receipt.data.transactionHash) {
        lastToastedTxHash.current = receipt.data.transactionHash
        toast({ content: 'Transaction successful!', type: 'success' })
      }

      // Update notification to success
      handleUpdateNotification({ receipt: receipt.data, status: 'success' })

      onSuccess?.()

      // Clear state for next transaction
      if (ensoTxHash) setEnsoTxHash(undefined)
      setNotificationId(undefined)
    }
  }, [isTxSuccess, receipt.data, onSuccess, ensoTxHash, handleUpdateNotification])

  // Handle transaction errors
  useEffect(() => {
    if (isError && receipt.error) {
      const txHash = writeContract.data || ensoTxHash

      console.error('Transaction failed:', receipt.error)
      writeContract.reset()

      // Prevent duplicate toasts
      if (txHash && lastToastedTxHash.current !== txHash) {
        lastToastedTxHash.current = txHash
        toast({ content: 'Transaction failed', type: 'error' })
      }

      // Update notification to error
      handleUpdateNotification({ status: 'error' })

      // Clear state for next transaction
      if (ensoTxHash) setEnsoTxHash(undefined)
      setNotificationId(undefined)
    }
  }, [isError, receipt.error, writeContract, ensoTxHash, handleUpdateNotification])

  // Determine button content
  const getButtonContent = (): ReactNode => {
    if (!account) {
      return 'Connect Wallet'
    }

    if (isLoading || isSimulating) {
      if (_loading && transactionName.includes('...')) {
        return transactionName
      }
      if (ensoTxHash || writeContract.data) {
        return 'Confirming...'
      }
      if (isSigning) {
        return 'Signing...'
      }
    }

    return transactionName
  }

  // Determine button variant
  const getVariant = (): 'filled' | 'busy' => {
    if (!account) return 'filled'
    if (isLoading) return 'busy'
    return 'filled'
  }

  return (
    <Button
      variant={getVariant()}
      classNameOverride="yearn--button--nextgen w-full"
      className={props.className}
      isBusy={isLoading}
      disabled={disabled}
      onClick={handleClick}
      {...props}
    >
      {getButtonContent()}
    </Button>
  )
}
