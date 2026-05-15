import { Button } from '@shared/components/Button'
import { useChainId, useSwitchChain, useWaitForTransactionReceipt } from '@shared/hooks/useAppWagmi'
import { useSafeTransactionDetails } from '@shared/hooks/useSafeTransactionDetails'
import { getApproveAbi } from '@shared/utils/approve'
import { type FC, useCallback, useEffect, useState } from 'react'
import { maxUint256 } from 'viem'
import { useAccount, useCallsStatus, useWriteContract } from 'wagmi'
import { isConnectedToExecutionChain, resolveExecutionChainId } from '@/config/tenderly'
import { InfoOverlay } from '../shared/InfoOverlay'
import { AnimatedCheckmark, ErrorIcon, Spinner } from '../shared/TransactionStateIndicators'
import { resolveExecutionTrackingHash } from '../shared/transactionOverlay.helpers'
import {
  resolveApprovalOverlayConnectedChainId,
  resolveApprovalOverlayPendingSafeState
} from './ApprovalOverlay.helpers'

type TxState = 'idle' | 'confirming' | 'pending' | 'submitted' | 'success' | 'error'

interface ApprovalOverlayProps {
  isOpen: boolean
  onClose: () => void
  tokenSymbol: string
  tokenAddress: `0x${string}`
  tokenDecimals: number
  spenderAddress: `0x${string}`
  spenderName: string
  chainId: number
  currentAllowance: string
}

export const ApprovalOverlay: FC<ApprovalOverlayProps> = ({
  isOpen,
  onClose,
  tokenSymbol,
  tokenAddress,
  spenderAddress,
  spenderName,
  chainId,
  currentAllowance
}) => {
  const [txState, setTxState] = useState<TxState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const { address: account, chain, connector } = useAccount()
  const currentChainId = useChainId()
  const isWalletSafe = connector?.id.toLowerCase().includes('safe') ?? false
  const connectedChainId = resolveApprovalOverlayConnectedChainId({
    accountChainId: chain?.id,
    currentChainId,
    targetChainId: chainId,
    isWalletSafe
  })
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync, data: txHash, reset } = useWriteContract()
  const safeTransactionDetails = useSafeTransactionDetails({
    safeTxHash: isWalletSafe ? txHash : undefined,
    enabled: Boolean(isWalletSafe && txHash && (txState === 'pending' || txState === 'submitted'))
  })
  const safeCallsStatus = useCallsStatus({
    id: txHash || '0x',
    query: {
      enabled: Boolean(
        isWalletSafe &&
          txHash &&
          (txState === 'pending' || txState === 'submitted') &&
          !safeTransactionDetails.data?.executionTxHash
      ),
      refetchInterval: 1500
    }
  })
  const executionTrackingHash = resolveExecutionTrackingHash({
    isWalletSafe,
    submittedTxHash: txHash,
    safeExecutionTxHash: safeTransactionDetails.data?.executionTxHash,
    callsReceiptTxHash: safeCallsStatus.data?.receipts?.[0]?.transactionHash
  })
  const receipt = useWaitForTransactionReceipt({ hash: executionTrackingHash, chainId })

  // Reset state when overlay closes
  useEffect(() => {
    if (!isOpen) {
      setTxState('idle')
      setErrorMessage('')
      reset()
    }
  }, [isOpen, reset])

  // Handle transaction success
  useEffect(() => {
    if (receipt.isSuccess && (txState === 'pending' || txState === 'submitted')) {
      setTxState('success')
      reset()
    }
  }, [receipt.isSuccess, txState, reset])

  useEffect(() => {
    const nextTxState = resolveApprovalOverlayPendingSafeState({
      txState,
      isWalletSafe,
      hasExecutionReceipt: Boolean(receipt.data?.transactionHash),
      safeTxStatus: safeTransactionDetails.data?.txStatus,
      callsStatus: safeCallsStatus.data?.status
    })

    if (nextTxState === 'submitted') {
      setTxState('submitted')
      return
    }

    if (nextTxState === 'error') {
      setTxState('error')
      setErrorMessage('Transaction failed in Safe. Please review your Safe queue and try again.')
      reset()
    }
  }, [
    txState,
    isWalletSafe,
    receipt.data?.transactionHash,
    safeTransactionDetails.data?.txStatus,
    safeCallsStatus.data?.status,
    reset
  ])

  // Handle transaction error
  useEffect(() => {
    if (receipt.isError && (txState === 'pending' || txState === 'submitted')) {
      setTxState('error')
      setErrorMessage('Transaction failed')
      reset()
    }
  }, [receipt.isError, txState, reset])

  const handleApprove = useCallback(
    async (amount: bigint) => {
      const executionChainId = resolveExecutionChainId(chainId)
      if (executionChainId === undefined) {
        setTxState('error')
        setErrorMessage('This network is not enabled for transactions')
        return
      }

      setTxState('confirming')
      setErrorMessage('')

      // Handle chain switch if needed
      if (!isConnectedToExecutionChain(connectedChainId, chainId)) {
        try {
          await switchChainAsync({ chainId })
        } catch (error: any) {
          const isUserRejection =
            error?.message?.toLowerCase().includes('rejected') ||
            error?.message?.toLowerCase().includes('denied') ||
            error?.code === 4001

          if (isUserRejection) {
            setTxState('idle')
          } else {
            setTxState('error')
            setErrorMessage(
              'Unable to switch networks for this approval. Please confirm your Safe is opened on the correct chain.'
            )
          }
          return
        }
      }

      try {
        await writeContractAsync({
          address: tokenAddress,
          abi: getApproveAbi(tokenAddress),
          functionName: 'approve',
          args: [spenderAddress, amount],
          chainId: executionChainId
        })
        setTxState('pending')
      } catch (error: any) {
        const isUserRejection =
          error?.message?.toLowerCase().includes('rejected') ||
          error?.message?.toLowerCase().includes('denied') ||
          error?.code === 4001

        if (isUserRejection) {
          setTxState('idle')
        } else {
          setTxState('error')
          setErrorMessage('Failed to submit transaction')
        }
      }
    },
    [connectedChainId, chainId, tokenAddress, spenderAddress, writeContractAsync, switchChainAsync]
  )

  const handleRevoke = useCallback(() => handleApprove(0n), [handleApprove])
  const handleSetUnlimited = useCallback(() => handleApprove(maxUint256), [handleApprove])

  const isRevokeDisabled = !account || currentAllowance === '0.00' || currentAllowance === '0'
  const isUnlimitedDisabled = !account || currentAllowance === 'Unlimited'
  const isInTransaction = txState !== 'idle'

  return (
    <InfoOverlay isOpen={isOpen} onClose={onClose} title="Token Approval" hideButton>
      <div className="flex flex-col h-full">
        {/* Idle state - show info and actions */}
        {txState === 'idle' && (
          <>
            <div className="space-y-4 flex-1">
              <div className="space-y-2">
                <p className="font-medium text-sm text-text-primary">What is this?</p>
                <p className="text-sm text-text-secondary">
                  Token approval allows a smart contract to transfer your{' '}
                  <span className="font-semibold text-text-primary">{tokenSymbol}</span> up to a set limit. This is
                  required before depositing.
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-4 mt-auto">
              <div className="space-y-2">
                <p className="text-sm text-text-secondary">
                  Hit <span className="font-semibold text-text-primary">Revoke</span> to set {spenderName} allowance to
                  zero.
                </p>
                <p className="text-sm text-text-secondary">
                  Hit <span className="font-semibold text-text-primary">Set Unlimited</span> if you don't want to
                  approve this token again for future deposits.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleRevoke}
                  variant="outlined"
                  disabled={isRevokeDisabled}
                  className="flex-1"
                  classNameOverride={`yearn--button--nextgen flex-1 ${isRevokeDisabled ? 'opacity-40' : ''}`}
                >
                  Revoke
                </Button>
                <Button
                  onClick={handleSetUnlimited}
                  variant="filled"
                  disabled={isUnlimitedDisabled}
                  className="flex-1"
                  classNameOverride="yearn--button--nextgen flex-1"
                >
                  Set Unlimited
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Transaction states - centered layout */}
        {isInTransaction && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            {txState === 'confirming' && (
              <>
                <Spinner />
                <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">Confirm in your wallet</h3>
                <p className="text-sm text-text-secondary">Approve the transaction to continue</p>
              </>
            )}

            {txState === 'pending' && (
              <>
                <Spinner />
                <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">Transaction pending</h3>
                <p className="text-sm text-text-secondary">Waiting for confirmation...</p>
              </>
            )}

            {txState === 'success' && (
              <>
                <AnimatedCheckmark isVisible />
                <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">Approval updated</h3>
                <p className="text-sm text-text-secondary mb-6">Your token allowance has been changed</p>
                <Button
                  onClick={onClose}
                  variant="filled"
                  className="w-full max-w-xs"
                  classNameOverride="yearn--button--nextgen w-full"
                >
                  Done
                </Button>
              </>
            )}

            {txState === 'submitted' && (
              <>
                <AnimatedCheckmark isVisible />
                <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">Transaction submitted</h3>
                <p className="text-sm text-text-secondary mb-6 whitespace-pre-line">
                  {`Your approval transaction has been submitted to your Safe.
Execution may happen separately after the required confirmations are collected.`}
                </p>
                <Button
                  onClick={onClose}
                  variant="filled"
                  className="w-full max-w-xs"
                  classNameOverride="yearn--button--nextgen w-full"
                >
                  Done
                </Button>
              </>
            )}

            {txState === 'error' && (
              <>
                <ErrorIcon />
                <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">Transaction failed</h3>
                <p className="text-sm text-text-secondary mb-6">{errorMessage}</p>
                <Button
                  onClick={() => setTxState('idle')}
                  variant="filled"
                  className="w-full max-w-xs"
                  classNameOverride="yearn--button--nextgen w-full"
                >
                  Try Again
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </InfoOverlay>
  )
}
