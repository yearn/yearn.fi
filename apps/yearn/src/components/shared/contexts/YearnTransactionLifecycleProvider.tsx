'use client'

import { TransactionLifecycleContext } from '@shared/contexts/transactionLifecycleContext'
import { projectLifecycleNotification } from '@shared/contexts/transactionLifecycleProjection'
import {
  coordinateTransactionObservation,
  createTransactionLifecycleStorage
} from '@shared/contexts/transactionLifecycleStorage'
import { useNotificationAssetRefresh } from '@shared/hooks/useNotificationAssetRefresh'
import { getTransactionConfirmations } from '@yearn/vault-widget/headless'
import { createTransactionLifecycle } from '@yearn/vault-widget/lifecycle'
import { createWagmiVaultWidgetExecutionAdapter } from '@yearn/vault-widget/wagmi'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useAccount, useConfig } from 'wagmi'
import { resolveExecutionChainId } from '@/config/tenderly'

export function YearnTransactionLifecycleProvider({ children }: { children: ReactNode }) {
  const config = useConfig()
  const { address, chainId } = useAccount()
  const refresh = useNotificationAssetRefresh()
  const execution = useMemo(
    () =>
      createWagmiVaultWidgetExecutionAdapter({
        config,
        resolveExecutionChainId,
        resolveConfirmations: getTransactionConfirmations,
        receiptTimeoutMs: 30_000
      }),
    [config]
  )
  const current = useRef({ address, chainId, execution, refresh })
  current.current = { address, chainId, execution, refresh }
  const [service] = useState(() =>
    createTransactionLifecycle({
      execution: () => current.current.execution,
      executionChainId: resolveExecutionChainId,
      wallet: () => current.current,
      persistence: createTransactionLifecycleStorage(),
      coordinate: coordinateTransactionObservation,
      refresh: (record) => current.current.refresh(projectLifecycleNotification(record))
    })
  )
  // The provider owns external observation and persistence subscriptions, independently of overlays/routes.
  useEffect(() => service.connect(), [service])
  return <TransactionLifecycleContext.Provider value={service}>{children}</TransactionLifecycleContext.Provider>
}
