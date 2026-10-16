import type { TTransactionLifecycle } from '@yearn/vault-widget/lifecycle'
import { createContext, useContext } from 'react'

export const TransactionLifecycleContext = createContext<TTransactionLifecycle | undefined>(undefined)
export const useYearnTransactionLifecycle = () => useContext(TransactionLifecycleContext)
