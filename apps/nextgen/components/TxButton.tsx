import { useNotificationsActions } from '@lib/contexts/useNotificationsActions'
import type { TTxButtonNotificationParams } from '@nextgen/types'
import { type ComponentProps, type FC, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import {
  type UseSimulateContractReturnType,
  useAccount,
  useChains,
  usePublicClient,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract
} from 'wagmi'
import { Button } from '../../lib/components/Button'

type Props = {
  prepareWrite: UseSimulateContractReturnType
  transactionName: string
  isApproved?: boolean
  disabled?: boolean
  loading?: boolean
  tooltip?: string // TODO: Add
  onSuccess?: () => void
  showEmojisplosion?: boolean
  additionalComponent?: ReactNode
  addNotification?: (type: string, hash?: string, transactionName?: string) => void
  notificationParams?: TTxButtonNotificationParams
}

type ButtonState = 'loading' | 'success' | 'error' | 'default' | 'simulating' | 'approved' | 'notConnected'

const spinnerStyle = {
  animation: 'spin 1s linear infinite',
  width: '16px',
  height: '16px'
}

export const TxButton: FC<Props & ComponentProps<typeof Button>> = ({
  prepareWrite,
  transactionName = 'Send',
  disabled: _disabled,
  loading: _loading,
  tooltip,
  isApproved,
  onSuccess,
  showEmojisplosion = false,
  additionalComponent,
  addNotification,
  notificationParams,
  ...props
}) => {
  const writeContract = useWriteContract()
  const chains = useChains()
  const { switchChainAsync, isPending: isChainSwitching } = useSwitchChain()
  const [ensoTxHash, setEnsoTxHash] = useState<`0x${string}` | undefined>()
  const receipt = useWaitForTransactionReceipt({ hash: writeContract.data || ensoTxHash })
  const [override, setOverride] = useState<ButtonState>()
  const [isSigning, setIsSigning] = useState(false)
  const client = usePublicClient()
  const ref = useRef<(number | undefined)[]>(undefined)
  const { address: account } = useAccount()

  // Notification system integration
  const { handleApproveNotification, handleDepositNotification, handleWithdrawNotification } = useNotificationsActions()
  const [notificationId, setNotificationId] = useState<number | undefined>()

  const txChainId = prepareWrite.data?.request.chainId
  const currentChain = chains.find((chain) => chain.id === client?.chain?.id)

  const wrongNetwork = txChainId && currentChain?.id !== txChainId

  const { isSuccess: isTxSuccess, isError } = receipt
  const { isError: isSimulatedError, isFetching: isSimulating } = prepareWrite

  // For Enso orders, check if we're waiting for transaction
  const isEnsoOrder = !!(prepareWrite.data?.request as any)?.__isEnsoOrder
  const isWaitingForEnsoTx = isEnsoOrder && !!(prepareWrite.data?.request as any)?.__waitingForTx
  const isLoading = override === 'loading' || _loading || (isWaitingForEnsoTx && !!ensoTxHash) || isChainSwitching

  const disabled =
    _disabled || (!prepareWrite.isSuccess && !wrongNetwork) || isLoading || isSimulating || override === 'error'

  // Helper to convert notification params to legacy TActionParams format
  const buildActionParamsForNotification = useCallback(() => {
    if (!notificationParams || !account) return undefined

    return {
      amount: notificationParams.actionParams.amount,
      selectedOptionFrom: notificationParams.actionParams.selectedOptionFrom,
      selectedOptionTo: notificationParams.actionParams.selectedOptionTo
    }
  }, [notificationParams, account])

  // Clear override states after timeout
  useEffect(() => {
    if (override === 'error' || override === 'success') {
      const timeout = override === 'error' ? 3000 : 2000
      const timer = setTimeout(() => {
        setOverride(undefined)
      }, timeout)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [override])
  const ButtonContentType: ButtonState | undefined = (() => {
    if (!account) return 'notConnected'
    if (override === 'loading' || isLoading || isSimulating) return 'loading'
    if (override === 'success') return 'success'
    if (override === 'error') return 'error'
    if (isApproved) return 'approved'

    // Only show transaction errors for non-custom orders
    const isCustomOrder =
      !!(prepareWrite.data?.request as any)?.__isCowswapOrder || !!(prepareWrite.data?.request as any)?.__isEnsoOrder
    if (!isCustomOrder && (isError || isSimulatedError)) return 'error'

    return 'default'
  })()

  const ButtonContent: Record<ButtonState, ReactNode> = {
    notConnected: <div className="flex items-center gap-2">Connect Wallet</div>,
    success: (
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Success!
      </div>
    ),
    default: (
      <div className="flex items-center gap-2">
        {transactionName}
        {additionalComponent}
      </div>
    ),
    error: (
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Try Again
      </div>
    ),
    simulating: (
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Simulating...
      </div>
    ),
    approved: (
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Approved
      </div>
    ),
    loading: (
      <div className="flex items-center justify-center gap-2">
        <svg style={spinnerStyle} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" color="#000000">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="text-neutral-900">
          {_loading && transactionName.includes('...')
            ? transactionName
            : ensoTxHash || writeContract.data
              ? 'Confirming...'
              : isSigning
                ? 'Signing...'
                : 'Loading...'}
        </span>
      </div>
    )
  }

  // Determine button variant based on state
  const getVariant = useCallback(() => {
    if (!account) return 'filled'
    if (ButtonContentType === 'error') return 'error'
    if (ButtonContentType === 'loading') return 'busy'
    return 'filled'
  }, [account, ButtonContentType])

  // Handle transaction receipt and update notifications
  useEffect(() => {
    if (isTxSuccess && receipt.data) {
      // Legacy notification callback (backward compatibility)
      const type = receipt.data.status === 'success' ? 'success' : 'error'
      addNotification?.(type, receipt.data.transactionHash, transactionName)

      // New notification system
      if (notificationId && notificationParams) {
        const actionParams = buildActionParamsForNotification()
        if (actionParams) {
          const status = receipt.data.status === 'success' ? 'success' : 'error'

          // Update notification based on type
          if (notificationParams.type === 'approve') {
            handleApproveNotification({
              actionParams,
              receipt: receipt.data,
              status,
              idToUpdate: notificationId
            })
          } else if (
            notificationParams.type === 'deposit' ||
            notificationParams.type === 'zap' ||
            notificationParams.type === 'deposit and stake' ||
            notificationParams.type === 'stake'
          ) {
            handleDepositNotification({
              actionParams,
              type: notificationParams.type,
              receipt: receipt.data,
              status,
              idToUpdate: notificationId
            })
          } else if (
            notificationParams.type === 'withdraw' ||
            notificationParams.type === 'crosschain zap' ||
            notificationParams.type === 'unstake'
          ) {
            handleWithdrawNotification({
              actionParams,
              type: notificationParams.type,
              receipt: receipt.data,
              status,
              idToUpdate: notificationId
            })
          }
        }
      }
    }
  }, [
    isTxSuccess,
    receipt.data,
    transactionName,
    addNotification,
    notificationId,
    notificationParams,
    buildActionParamsForNotification,
    handleApproveNotification,
    handleDepositNotification,
    handleWithdrawNotification
  ])

  useEffect(() => {
    if (isTxSuccess) {
      onSuccess?.()
      setOverride('success')
      // Clear Enso tx hash after success
      if (ensoTxHash) {
        setEnsoTxHash(undefined)
      }
    }
  }, [isTxSuccess, onSuccess, ensoTxHash])

  return (
    <Button
      variant={getVariant()}
      classNameOverride="yearn--button--nextgen w-full"
      className={props.className}
      disabled={disabled}
      onClick={async (event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
        ref.current = [event?.clientX, event?.clientY]

        // Handle chain switching automatically
        if (wrongNetwork && txChainId) {
          try {
            setOverride('loading')
            await switchChainAsync({ chainId: txChainId })
          } catch (error) {
            console.error('Failed to switch chain:', error)
            setOverride('error')
            return
          }
        }

        const overrides = await (async () => {
          if (!prepareWrite.data?.request || !client) return {}
          try {
            const gasEstimate = await client.estimateContractGas(prepareWrite.data.request as any)
            if (gasEstimate) {
              const gas = (gasEstimate * BigInt(110)) / BigInt(100) // 10% buffer
              return { gas }
            }
            return {}
          } catch (error) {
            console.error(`Failed estimation for ${prepareWrite.data.request.functionName}`, error)
            return {}
          }
        })()

        if (prepareWrite.isSuccess && prepareWrite.data?.request) {
          setOverride('loading')

          // Check if this is a Cowswap or Enso order
          if ((prepareWrite.data.request as any).__isCowswapOrder || (prepareWrite.data.request as any).__isEnsoOrder) {
            const customWriteAsync = (prepareWrite.data.request as any).writeContractAsync
            setIsSigning(true)

            // Create notification when transaction starts (if notificationParams provided)
            let createdNotificationId: number | undefined
            if (notificationParams && account) {
              const actionParams = buildActionParamsForNotification()
              if (actionParams) {
                if (notificationParams.type === 'approve') {
                  createdNotificationId = await handleApproveNotification({ actionParams })
                } else if (
                  notificationParams.type === 'deposit' ||
                  notificationParams.type === 'zap' ||
                  notificationParams.type === 'crosschain zap' ||
                  notificationParams.type === 'deposit and stake' ||
                  notificationParams.type === 'stake'
                ) {
                  createdNotificationId = await handleDepositNotification({
                    actionParams,
                    type: notificationParams.type
                  })
                } else if (notificationParams.type === 'withdraw' || notificationParams.type === 'unstake') {
                  createdNotificationId = await handleWithdrawNotification({
                    actionParams,
                    type: notificationParams.type
                  })
                }
                if (createdNotificationId) {
                  setNotificationId(createdNotificationId)
                }
              }
            }

            customWriteAsync()
              .then((result: any) => {
                if (result.orderUID) {
                  // Cowswap order
                  addNotification?.('success', result.orderUID, transactionName)
                  setOverride('success')
                } else if (result.hash) {
                  // Enso transaction - store hash for receipt monitoring
                  addNotification?.('pending', result.hash, transactionName)
                  setEnsoTxHash(result.hash)

                  // Update notification with txHash
                  if (createdNotificationId && notificationParams && account) {
                    const actionParams = buildActionParamsForNotification()
                    if (actionParams) {
                      if (notificationParams.type === 'approve') {
                        handleApproveNotification({
                          actionParams,
                          status: 'pending',
                          idToUpdate: createdNotificationId,
                          txHash: result.hash
                        })
                      } else if (
                        notificationParams.type === 'deposit' ||
                        notificationParams.type === 'zap' ||
                        notificationParams.type === 'crosschain zap' ||
                        notificationParams.type === 'deposit and stake' ||
                        notificationParams.type === 'stake'
                      ) {
                        handleDepositNotification({
                          actionParams,
                          type: notificationParams.type,
                          status: 'pending',
                          idToUpdate: createdNotificationId,
                          txHash: result.hash
                        })
                      } else if (notificationParams.type === 'withdraw' || notificationParams.type === 'unstake') {
                        handleWithdrawNotification({
                          actionParams,
                          type: notificationParams.type,
                          status: 'pending',
                          idToUpdate: createdNotificationId,
                          txHash: result.hash
                        })
                      }
                    }
                  }
                  // Keep loading state - will change to success when receipt arrives
                }
              })
              .catch((error: Error) => {
                setOverride('error')
                addNotification?.('error', undefined, `Failed to submit ${transactionName}`)

                // Update notification to error state
                if (createdNotificationId && notificationParams && account) {
                  const actionParams = buildActionParamsForNotification()
                  if (actionParams) {
                    if (notificationParams.type === 'approve') {
                      handleApproveNotification({
                        actionParams,
                        status: 'error',
                        idToUpdate: createdNotificationId
                      })
                    } else if (
                      notificationParams.type === 'deposit' ||
                      notificationParams.type === 'zap' ||
                      notificationParams.type === 'crosschain zap' ||
                      notificationParams.type === 'deposit and stake' ||
                      notificationParams.type === 'stake'
                    ) {
                      handleDepositNotification({
                        actionParams,
                        type: notificationParams.type,
                        status: 'error',
                        idToUpdate: createdNotificationId
                      })
                    } else if (notificationParams.type === 'withdraw' || notificationParams.type === 'unstake') {
                      handleWithdrawNotification({
                        actionParams,
                        type: notificationParams.type,
                        status: 'error',
                        idToUpdate: createdNotificationId
                      })
                    }
                  }
                }

                console.error('Transaction failed:', error)
              })
              .finally(() => {
                setIsSigning(false)
              })
          } else {
            setIsSigning(true)

            // Create notification when transaction starts (if notificationParams provided)
            let createdNotificationId: number | undefined
            if (notificationParams && account) {
              const actionParams = buildActionParamsForNotification()
              if (actionParams) {
                if (notificationParams.type === 'approve') {
                  createdNotificationId = await handleApproveNotification({ actionParams })
                } else if (
                  notificationParams.type === 'deposit' ||
                  notificationParams.type === 'zap' ||
                  notificationParams.type === 'deposit and stake' ||
                  notificationParams.type === 'stake'
                ) {
                  createdNotificationId = await handleDepositNotification({
                    actionParams,
                    type: notificationParams.type
                  })
                } else if (
                  notificationParams.type === 'withdraw' ||
                  notificationParams.type === 'crosschain zap' ||
                  notificationParams.type === 'unstake'
                ) {
                  createdNotificationId = await handleWithdrawNotification({
                    actionParams,
                    type: notificationParams.type
                  })
                }
                if (createdNotificationId) {
                  setNotificationId(createdNotificationId)
                }
              }
            }

            writeContract
              .writeContractAsync({ ...prepareWrite.data.request, ...overrides })
              .then((hash) => {
                addNotification?.('pending', hash, transactionName)

                // Update notification with txHash
                if (createdNotificationId && notificationParams && account) {
                  const actionParams = buildActionParamsForNotification()
                  if (actionParams) {
                    if (notificationParams.type === 'approve') {
                      handleApproveNotification({
                        actionParams,
                        status: 'pending',
                        idToUpdate: createdNotificationId,
                        txHash: hash
                      })
                    } else if (
                      notificationParams.type === 'deposit' ||
                      notificationParams.type === 'zap' ||
                      notificationParams.type === 'deposit and stake' ||
                      notificationParams.type === 'stake'
                    ) {
                      handleDepositNotification({
                        actionParams,
                        type: notificationParams.type,
                        status: 'pending',
                        idToUpdate: createdNotificationId,
                        txHash: hash
                      })
                    } else if (
                      notificationParams.type === 'withdraw' ||
                      notificationParams.type === 'crosschain zap' ||
                      notificationParams.type === 'unstake'
                    ) {
                      handleWithdrawNotification({
                        actionParams,
                        type: notificationParams.type,
                        status: 'pending',
                        idToUpdate: createdNotificationId,
                        txHash: hash
                      })
                    }
                  }
                }
              })
              .catch((error) => {
                setOverride('error')
                addNotification?.('error', undefined, `Failed to submit ${transactionName}`)

                // Update notification to error state
                if (createdNotificationId && notificationParams && account) {
                  const actionParams = buildActionParamsForNotification()
                  if (actionParams) {
                    if (notificationParams.type === 'approve') {
                      handleApproveNotification({
                        actionParams,
                        status: 'error',
                        idToUpdate: createdNotificationId
                      })
                    } else if (
                      notificationParams.type === 'deposit' ||
                      notificationParams.type === 'zap' ||
                      notificationParams.type === 'deposit and stake' ||
                      notificationParams.type === 'stake'
                    ) {
                      handleDepositNotification({
                        actionParams,
                        type: notificationParams.type,
                        status: 'error',
                        idToUpdate: createdNotificationId
                      })
                    } else if (
                      notificationParams.type === 'withdraw' ||
                      notificationParams.type === 'crosschain zap' ||
                      notificationParams.type === 'unstake'
                    ) {
                      handleWithdrawNotification({
                        actionParams,
                        type: notificationParams.type,
                        status: 'error',
                        idToUpdate: createdNotificationId
                      })
                    }
                  }
                }

                console.error('Transaction failed:', error)
              })
              .finally(() => {
                setIsSigning(false)
              })
          }
        }
      }}
      {...props}
    >
      {ButtonContent[ButtonContentType]}
    </Button>
  )
}
