import { type FC, type PropsWithChildren, useEffect } from 'react'
import { useAccount, useConnect } from 'wagmi'
import { reconcileYearnIframeWallet, yearnWalletRuntime } from '@/config/wagmi'

export const IframeAutoConnect: FC<PropsWithChildren> = ({ children }) => {
  const { connector } = useAccount()
  const { connectors } = useConnect()

  useEffect(() => {
    if (yearnWalletRuntime === 'app') {
      return
    }

    void reconcileYearnIframeWallet().catch((error) => console.error(error))
  }, [connector, connectors])

  return <>{children}</>
}
