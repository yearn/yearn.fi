import { useAsyncTrigger } from '@shared/hooks/useAsyncTrigger'
import { isIframe, isTrustedEmbed } from '@shared/utils/helpers'
import type { FC, PropsWithChildren } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'

export const IframeAutoConnect: FC<PropsWithChildren> = ({ children }) => {
  const { connector } = useAccount()
  const { connectors, connectAsync } = useConnect()
  const { disconnectAsync } = useDisconnect()

  useAsyncTrigger(async () => {
    if (typeof window === 'undefined' || !isIframe() || !isTrustedEmbed()) {
      return
    }

    try {
      if (connector && connector?.id !== 'safe' && !connector?.id?.toLowerCase().includes('ledger')) {
        const safeConnector = connectors.find((c) => c.id === 'safe')
        if (safeConnector) {
          await disconnectAsync({ connector })
          const isAuth = await safeConnector.isAuthorized()
          if (!isAuth) {
            await connectAsync({ connector: safeConnector })
          }
        }
      } else if (!connector) {
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
