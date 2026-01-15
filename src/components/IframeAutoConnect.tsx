import { useAsyncTrigger } from '@lib/hooks/useAsyncTrigger'
import { isIframe } from '@lib/utils/helpers'
import type { FC, PropsWithChildren } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'

export const IframeAutoConnect: FC<PropsWithChildren> = ({ children }) => {
  const { connector } = useAccount()
  const { connectors, connectAsync } = useConnect()
  const { disconnectAsync } = useDisconnect()

  useAsyncTrigger(async () => {
    if (typeof window === 'undefined' || !isIframe()) {
      return
    }

    try {
      const ancestorOrigin = window.location.ancestorOrigins?.[0]
      const isSafeParent = ancestorOrigin?.toString().includes('safe')

      if (connector && connector?.id !== 'safe' && !connector?.id?.toLowerCase().includes('ledger')) {
        if (!isSafeParent) {
          const ledgerConnector = connectors.find((c) => c.id.toLowerCase().includes('ledger'))
          if (ledgerConnector) {
            await disconnectAsync({ connector })
            const isAuth = await ledgerConnector.isAuthorized()
            if (!isAuth) {
              await connectAsync({ connector: ledgerConnector })
            }
          }
        }
        const safeConnector = connectors.find((c) => c.id === 'safe')
        if (safeConnector) {
          await disconnectAsync({ connector })
          const isAuth = await safeConnector.isAuthorized()
          if (!isAuth) {
            await connectAsync({ connector: safeConnector })
          }
        }
      } else if (!connector) {
        if (!isSafeParent) {
          const ledgerConnector = connectors.find((c) => c.id.toLowerCase().includes('ledger'))
          if (ledgerConnector) {
            await connectAsync({ connector: ledgerConnector })
          }
        }
        const safeConnector = connectors.find((c) => c.id === 'safe')
        if (safeConnector) {
          await connectAsync({ connector: safeConnector })
        }
      }
    } catch (error) {
      console.error(error)
    }
  }, [connectAsync, connectors, disconnectAsync, connector])

  return <>{children}</>
}
