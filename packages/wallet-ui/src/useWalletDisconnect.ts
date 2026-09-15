'use client'

import { cancelWalletReconnect } from '@yearn/wallet-ui/WalletProvider'
import { useCallback } from 'react'
import { useConfig, useDisconnect } from 'wagmi'
import { getConnections } from 'wagmi/actions'

export function useWalletDisconnect() {
  const config = useConfig()
  const { disconnectAsync: disconnectConnector, ...state } = useDisconnect()
  const disconnectAsync = useCallback(async () => {
    cancelWalletReconnect(config)
    // Wagmi otherwise selects a remaining connection. Remove this session's
    // connections sequentially, since each disconnect updates the same store.
    await getConnections(config).reduce(
      (pending, { connector }) => pending.then(() => disconnectConnector({ connector })),
      Promise.resolve()
    )
  }, [config, disconnectConnector])
  const disconnect = useCallback(() => {
    void disconnectAsync().catch(() => undefined)
  }, [disconnectAsync])

  return { ...state, disconnect, disconnectAsync }
}
