import type {
  TNotificationStatus,
  TNotificationsActionsContext,
  TNotificationType
} from '@lib/types/notifications'
import { formatTAmount, toAddress } from '@lib/utils'
import type { TActionParams } from '@vaults-v2/contexts/useActionFlow'
import type React from 'react'
import { createContext, useCallback, useContext, useMemo } from 'react'

import type { Hash, TransactionReceipt } from 'viem'
import { useNotifications } from './useNotifications'
import { useWeb3 } from './useWeb3'

const defaultProps: TNotificationsActionsContext = {
  handleApproveNotification: async (): Promise<number> => 0,
  handleDepositNotification: async (): Promise<number> => 0,
  handleWithdrawNotification: async (): Promise<number> => 0,
  handleStakeNotification: async (): Promise<number> => 0,
  handleUnstakeNotification: async (): Promise<number> => 0,
  handleClaimNotification: async (): Promise<number> => 0
}

const NotificationsActionsContext = createContext<TNotificationsActionsContext>(defaultProps)
export const WithNotificationsActions = ({
  children
}: {
  children: React.ReactElement
}): React.ReactElement => {
  const { addNotification, updateEntry } = useNotifications()
  const { address } = useWeb3()

  const handleApproveNotification = useCallback(
    async ({
      actionParams,
      receipt,
      status,
      idToUpdate,
      txHash
    }: {
      actionParams: Partial<TActionParams>
      receipt?: TransactionReceipt
      status?: TNotificationStatus
      idToUpdate?: number
      txHash?: Hash
    }): Promise<number> => {
      if (idToUpdate) {
        await updateEntry(
          {
            txHash: txHash ? txHash : receipt?.transactionHash,
            timeFinished: receipt ? Date.now() / 1000 : undefined,
            blockNumber: receipt?.blockNumber,
            status
          },
          idToUpdate
        )

        return idToUpdate
      }
      const createdId = await addNotification({
        address: toAddress(address),
        chainId: actionParams.selectedOptionFrom?.chainID || 1,
        txHash: undefined,
        timeFinished: undefined,
        blockNumber: undefined,
        status: 'pending',
        type: 'approve',
        fromAddress: toAddress(actionParams.selectedOptionFrom?.value),
        fromTokenName: actionParams.selectedOptionFrom?.symbol || '',
        spenderAddress: toAddress(actionParams.selectedOptionTo?.value),
        spenderName: actionParams.selectedOptionTo?.symbol || '',
        amount: formatTAmount({
          value: actionParams.amount?.normalized || 0,
          decimals: actionParams.selectedOptionFrom?.decimals || 18
        })
      })
      return createdId
    },
    [addNotification, address, updateEntry]
  )

  const handleDepositNotification = useCallback(
    async ({
      actionParams,
      type,
      receipt,
      status,
      idToUpdate,
      txHash
    }: {
      actionParams: Partial<TActionParams>
      txHash?: Hash
      type?: TNotificationType
      receipt?: TransactionReceipt
      status?: TNotificationStatus
      idToUpdate?: number
    }): Promise<number> => {
      if (idToUpdate) {
        await updateEntry(
          {
            txHash: txHash ? txHash : receipt?.transactionHash,
            timeFinished: receipt ? Date.now() / 1000 : undefined,
            blockNumber: receipt?.blockNumber,
            status
          },
          idToUpdate
        )

        return idToUpdate
      }

      const createdId = await addNotification({
        address: toAddress(address),
        fromAddress: toAddress(actionParams.selectedOptionFrom?.value),
        fromTokenName: actionParams.selectedOptionFrom?.symbol || '',
        toAddress: toAddress(actionParams.selectedOptionTo?.value),
        toTokenName: actionParams.selectedOptionTo?.symbol || '',
        chainId: actionParams.selectedOptionFrom?.chainID || 1,
        txHash: undefined,
        timeFinished: undefined,
        blockNumber: undefined,
        status: 'pending',
        type: type || 'deposit',
        amount: formatTAmount({
          value: actionParams.amount?.normalized || 0,
          decimals: actionParams.selectedOptionFrom?.decimals || 18
        })
      })
      return createdId
    },
    [addNotification, updateEntry, address]
  )

  const handleWithdrawNotification = useCallback(
    async ({
      actionParams,
      type,
      receipt,
      status,
      idToUpdate,
      txHash
    }: {
      actionParams: Partial<TActionParams>
      type?: TNotificationType
      receipt?: TransactionReceipt
      status?: TNotificationStatus
      idToUpdate?: number
      txHash?: Hash
    }): Promise<number> => {
      if (idToUpdate) {
        await updateEntry(
          {
            txHash: txHash ? txHash : receipt?.transactionHash,
            timeFinished: receipt ? Date.now() / 1000 : undefined,
            blockNumber: receipt?.blockNumber,
            status
          },
          idToUpdate
        )

        return idToUpdate
      }

      const createdId = await addNotification({
        address: toAddress(address),
        fromAddress: toAddress(actionParams.selectedOptionFrom?.value),
        fromTokenName: actionParams.selectedOptionFrom?.symbol || '',
        toAddress: toAddress(actionParams.selectedOptionTo?.value),
        toTokenName: actionParams.selectedOptionTo?.symbol || '',
        chainId: actionParams.selectedOptionFrom?.chainID || 1,
        txHash: undefined,
        timeFinished: undefined,
        blockNumber: undefined,
        status: 'pending',
        type: type || 'withdraw',
        amount: formatTAmount({
          value: actionParams.amount?.normalized || 0,
          decimals: actionParams.selectedOptionFrom?.decimals || 18
        })
      })
      return createdId
    },
    [addNotification, updateEntry, address]
  )

  const handleStakeNotification = useCallback(
    async ({
      actionParams,
      type,
      receipt,
      status,
      idToUpdate,
      txHash
    }: {
      actionParams: Partial<TActionParams>
      type?: TNotificationType
      receipt?: TransactionReceipt
      status?: TNotificationStatus
      idToUpdate?: number
      txHash?: Hash
    }): Promise<number> => {
      if (idToUpdate) {
        await updateEntry(
          {
            txHash: txHash ? txHash : receipt?.transactionHash,
            timeFinished: receipt ? Date.now() / 1000 : undefined,
            blockNumber: receipt?.blockNumber,
            status
          },
          idToUpdate
        )

        return idToUpdate
      }

      const createdId = await addNotification({
        address: toAddress(address),
        fromAddress: toAddress(actionParams.selectedOptionFrom?.value),
        fromTokenName: actionParams.selectedOptionFrom?.symbol || '',
        toAddress: toAddress(actionParams.selectedOptionTo?.value),
        toTokenName: actionParams.selectedOptionTo?.symbol || '',
        chainId: actionParams.selectedOptionFrom?.chainID || 1,
        txHash: undefined,
        timeFinished: undefined,
        blockNumber: undefined,
        status: 'pending',
        type: type || 'stake',
        amount: formatTAmount({
          value: actionParams.amount?.normalized || 0,
          decimals: actionParams.selectedOptionFrom?.decimals || 18
        })
      })
      return createdId
    },
    [addNotification, updateEntry, address]
  )

  const handleUnstakeNotification = useCallback(
    async ({
      actionParams,
      type,
      receipt,
      status,
      idToUpdate,
      txHash
    }: {
      actionParams: Partial<TActionParams>
      type?: TNotificationType
      receipt?: TransactionReceipt
      status?: TNotificationStatus
      idToUpdate?: number
      txHash?: Hash
    }): Promise<number> => {
      if (idToUpdate) {
        await updateEntry(
          {
            txHash: txHash ? txHash : receipt?.transactionHash,
            timeFinished: receipt ? Date.now() / 1000 : undefined,
            blockNumber: receipt?.blockNumber,
            status
          },
          idToUpdate
        )

        return idToUpdate
      }

      const createdId = await addNotification({
        address: toAddress(address),
        fromAddress: toAddress(actionParams.selectedOptionFrom?.value),
        fromTokenName: actionParams.selectedOptionFrom?.symbol || '',
        toAddress: toAddress(actionParams.selectedOptionTo?.value),
        toTokenName: actionParams.selectedOptionTo?.symbol || '',
        chainId: actionParams.selectedOptionFrom?.chainID || 1,
        txHash: undefined,
        timeFinished: undefined,
        blockNumber: undefined,
        status: 'pending',
        type: type || 'unstake',
        amount: formatTAmount({
          value: actionParams.amount?.normalized || 0,
          decimals: actionParams.selectedOptionFrom?.decimals || 18
        })
      })
      return createdId
    },
    [addNotification, updateEntry, address]
  )

  const handleClaimNotification = useCallback(
    async ({
      actionParams,
      type,
      receipt,
      status,
      idToUpdate,
      txHash
    }: {
      actionParams: Partial<TActionParams>
      type?: TNotificationType
      receipt?: TransactionReceipt
      status?: TNotificationStatus
      idToUpdate?: number
      txHash?: Hash
    }): Promise<number> => {
      if (idToUpdate) {
        await updateEntry(
          {
            txHash: txHash ? txHash : receipt?.transactionHash,
            timeFinished: receipt ? Date.now() / 1000 : undefined,
            blockNumber: receipt?.blockNumber,
            status
          },
          idToUpdate
        )

        return idToUpdate
      }

      const createdId = await addNotification({
        address: toAddress(address),
        fromAddress: toAddress(actionParams.selectedOptionFrom?.value),
        fromTokenName: actionParams.selectedOptionFrom?.symbol || '',
        chainId: actionParams.selectedOptionFrom?.chainID || 1,
        txHash: undefined,
        timeFinished: undefined,
        blockNumber: undefined,
        status: 'pending',
        type: type || 'claim',
        amount: formatTAmount({
          value: actionParams.amount?.normalized || 0,
          decimals: actionParams.selectedOptionFrom?.decimals || 18
        })
      })
      return createdId
    },
    [addNotification, updateEntry, address]
  )

  /**************************************************************************
   * Context value that is passed to all children of this component.
   *************************************************************************/
  const contextValue = useMemo(
    (): TNotificationsActionsContext => ({
      handleApproveNotification,
      handleDepositNotification,
      handleWithdrawNotification,
      handleStakeNotification,
      handleUnstakeNotification,
      handleClaimNotification
    }),
    [
      handleApproveNotification,
      handleDepositNotification,
      handleWithdrawNotification,
      handleStakeNotification,
      handleUnstakeNotification,
      handleClaimNotification
    ]
  )

  return (
    <NotificationsActionsContext.Provider value={contextValue}>
      {children}
    </NotificationsActionsContext.Provider>
  )
}

export const useNotificationsActions = (): TNotificationsActionsContext => {
  const ctx = useContext(NotificationsActionsContext)
  if (!ctx) {
    throw new Error('NotificationsActionsContext not found')
  }
  return ctx
}
