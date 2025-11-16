import { type ComponentProps, type FC, type ReactNode, useEffect, useRef, useState } from 'react'
import {
  type UseSimulateContractReturnType,
  useAccount,
  useChains,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWriteContract,
  useSwitchChain
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
}

type ButtonState =
  | 'loading'
  | 'success'
  | 'error'
  | 'wrongChain'
  | 'default'
  | 'simulating'
  | 'approved'
  | 'notConnected'

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
  ...props
}) => {
  const writeContract = useWriteContract()
  const chains = useChains()
  const { switchChain } = useSwitchChain()
  const [ensoTxHash, setEnsoTxHash] = useState<`0x${string}` | undefined>()
  const receipt = useWaitForTransactionReceipt({ hash: writeContract.data || ensoTxHash })
  const [override, setOverride] = useState<ButtonState>()
  const client = usePublicClient()
  const ref = useRef<(number | undefined)[]>(undefined)
  const { address: account } = useAccount()

  const txChainId = prepareWrite.data?.request.chainId
  const currentChain = chains.find((chain) => chain.id === client?.chain?.id)

  const wrongNetwork = txChainId && currentChain?.id !== txChainId

  const { isSuccess: isTxSuccess, isError } = receipt
  const { isError: isSimulatedError, isFetching: isSimulating } = prepareWrite

  // For Enso orders, check if we're waiting for transaction
  const isEnsoOrder = !!(prepareWrite.data?.request as any)?.__isEnsoOrder
  const isWaitingForEnsoTx = isEnsoOrder && !!(prepareWrite.data?.request as any)?.__waitingForTx
  const isLoading = override === 'loading' || _loading || (isWaitingForEnsoTx && !!ensoTxHash)
  const isSuccess = override === 'success'

  const disabled = wrongNetwork ? false : (_disabled || !prepareWrite.isSuccess || isLoading || isSimulating || override === 'error')

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
    if (wrongNetwork) return 'wrongChain'
    if (override === 'loading' || isLoading) return 'loading'
    if (isSimulating) return 'simulating'
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
    simulating: (
      <div className="flex items-center justify-center gap-2">
        <svg
          aria-label="Loading"
          style={spinnerStyle}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span>Simulating</span>
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
          {_loading && transactionName.includes('...') ? transactionName : ensoTxHash ? 'Confirming...' : 'Signing...'}
        </span>
      </div>
    ),
    wrongChain: txChainId
      ? `Switch to ${chains.find((chain) => chain.id === txChainId)?.name || 'Unknown Chain'}`
      : 'Wrong chain'
  }

  // Determine button variant based on state
  const getVariant = (): string => {
    if (!account) return 'filled'
    if (ButtonContentType === 'error') return 'error'
    if (ButtonContentType === 'loading' || ButtonContentType === 'simulating') return 'busy'
    return 'filled'
  }

  useEffect(() => {
    if (isSuccess) {
      const type = receipt.data?.status === 'success' ? 'success' : 'error'
      addNotification?.(type, receipt?.data?.transactionHash, transactionName)
    }
  }, [receipt.data, isSuccess, transactionName, addNotification])

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

        // Handle chain switching
        if (wrongNetwork && txChainId) {
          switchChain({ chainId: txChainId })
          return
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
                  // Keep loading state - will change to success when receipt arrives
                }
              })
              .catch((error: Error) => {
                setOverride('error')
                addNotification?.('error', undefined, `Failed to submit ${transactionName}`)
                console.error('Transaction failed:', error)
              })
          } else {
            writeContract
              .writeContractAsync({ ...prepareWrite.data.request, ...overrides })
              .then((hash) => {
                addNotification?.('pending', hash, transactionName)
              })
              .catch((error) => {
                setOverride('error')
                addNotification?.('error', undefined, `Failed to submit ${transactionName}`)
                console.error('Transaction failed:', error)
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
