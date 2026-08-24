import {
  isCrossChainNotificationType,
  shouldSetNotificationFinishedAt
} from '@shared/contexts/notificationActions.helpers'
import { TransactionTrackingCoordinator } from '@shared/hooks/useTransactionTrackingCoordinator'
import type {
  TCreateNotificationParams,
  TNotificationsActionsContext,
  TUpdateNotificationParams
} from '@shared/types/notifications'
import { toAddress } from '@shared/utils'
import type React from 'react'
import { createContext, useCallback, useContext, useMemo } from 'react'

import { useNotifications } from './useNotifications'
import { useWeb3 } from './useWeb3'

const defaultProps: TNotificationsActionsContext = {
  createNotification: async (): Promise<number> => 0,
  updateNotification: async (): Promise<void> => undefined
}

const NotificationsActionsContext = createContext<TNotificationsActionsContext>(defaultProps)

export const WithNotificationsActions = ({ children }: { children: React.ReactElement }): React.ReactElement => {
  const { addNotification, cachedEntries, updateEntry } = useNotifications()
  const { address } = useWeb3()

  const createNotification = useCallback(
    async (params: TCreateNotificationParams): Promise<number> => {
      const isCrossChain = isCrossChainNotificationType(params.type)
      const id = await addNotification({
        address: toAddress(address),
        type: params.type,
        amount: params.amount,
        fromAddress: toAddress(params.fromAddress),
        fromTokenName: params.fromSymbol,
        chainId: params.fromChainId,
        executionChainId: params.executionChainId ?? params.fromChainId,
        toAddress: params.toAddress ? toAddress(params.toAddress) : undefined,
        toTokenName: params.toSymbol,
        toAmount: params.toAmount,
        toChainId: params.toChainId !== params.fromChainId ? params.toChainId : undefined,
        // For approve notifications, use toAddress/toSymbol as spender
        spenderAddress: params.type === 'approve' ? toAddress(params.toAddress) : undefined,
        spenderName: params.type === 'approve' ? params.toSymbol : undefined,
        status: 'pending',
        txHash: undefined,
        createdAt: Date.now() / 1000,
        timeFinished: undefined,
        blockNumber: undefined,
        awaitingExecution: false,
        bridgeProtocol: params.bridgeProtocol,
        bridgeTrackingState: isCrossChain ? (params.bridgeProtocol ? 'active' : 'unavailable') : undefined,
        bridgeError:
          isCrossChain && !params.bridgeProtocol
            ? 'Automatic bridge tracking is unavailable for this route. Check the source transaction for progress.'
            : undefined
      })
      return id
    },
    [addNotification, address]
  )

  const updateNotification = useCallback(
    async (params: TUpdateNotificationParams): Promise<void> => {
      const shouldSetTimeFinished = shouldSetNotificationFinishedAt(params)

      await updateEntry(
        {
          txHash: params.txHash ?? params.receipt?.transactionHash,
          timeFinished: shouldSetTimeFinished ? Date.now() / 1000 : undefined,
          blockNumber: params.receipt?.blockNumber,
          ...(params.receipt && params.bridgeStatus === 'pending' ? { sourceConfirmedAt: Date.now() / 1000 } : {}),
          status: params.status,
          awaitingExecution:
            params.receipt || params.status === 'success' || params.status === 'error'
              ? false
              : params.awaitingExecution,
          ...(params.bridgeStatus !== undefined ? { bridgeStatus: params.bridgeStatus } : {})
        },
        params.id
      )
    },
    [updateEntry]
  )

  const contextValue = useMemo(
    (): TNotificationsActionsContext => ({
      createNotification,
      updateNotification
    }),
    [createNotification, updateNotification]
  )

  return (
    <NotificationsActionsContext.Provider value={contextValue}>
      <TransactionTrackingCoordinator notifications={cachedEntries} />
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
