'use client'

import { createContext, useContext } from 'react'

export type TWalletDrawerContext = {
  dialogId: string
  isConnecting: boolean
  isOpen: boolean
  openWalletDrawer: () => void
  toggleWalletDrawer: () => void
}

export const DEFAULT_WALLET_DRAWER_ID = 'wallet-picker'

export const WalletDrawerContext = createContext<TWalletDrawerContext | undefined>(undefined)

export function useWalletDrawer(): TWalletDrawerContext {
  const context = useContext(WalletDrawerContext)

  if (!context) {
    throw new Error('useWalletDrawer must be used within WalletDrawerProvider')
  }

  return context
}
