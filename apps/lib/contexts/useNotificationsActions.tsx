import type {
  TCreateNotificationParams,
  TNotificationsActionsContext,
  TUpdateNotificationParams
} from '@lib/types/notifications'
import { toAddress } from '@lib/utils'
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
  const { addNotification, updateEntry } = useNotifications()
  const { address } = useWeb3()

  const createNotification = useCallback(
    async (params: TCreateNotificationParams): Promise<number> => {
      const id = await addNotification({
        address: toAddress(address),
        type: params.type,
        amount: params.amount,
        fromAddress: toAddress(params.fromAddress),
        fromTokenName: params.fromSymbol,
        chainId: params.fromChainId,
        toAddress: params.toAddress ? toAddress(params.toAddress) : undefined,
        toTokenName: params.toSymbol,
        toChainId: params.toChainId !== params.fromChainId ? params.toChainId : undefined,
        // For approve notifications, use toAddress/toSymbol as spender
        spenderAddress: params.type === 'approve' ? toAddress(params.toAddress) : undefined,
        spenderName: params.type === 'approve' ? params.toSymbol : undefined,
        status: 'pending',
        txHash: undefined,
        timeFinished: undefined,
        blockNumber: undefined
      })
      return id
    },
    [addNotification, address]
  )

  const updateNotification = useCallback(
    async (params: TUpdateNotificationParams): Promise<void> => {
      await updateEntry(
        {
          txHash: params.txHash ?? params.receipt?.transactionHash,
          timeFinished: params.receipt ? Date.now() / 1000 : undefined,
          blockNumber: params.receipt?.blockNumber,
          status: params.status
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

  return <NotificationsActionsContext.Provider value={contextValue}>{children}</NotificationsActionsContext.Provider>
}

export const useNotificationsActions = (): TNotificationsActionsContext => {
  const ctx = useContext(NotificationsActionsContext)
  if (!ctx) {
    throw new Error('NotificationsActionsContext not found')
  }
  return ctx
}
