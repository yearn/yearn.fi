import type { FC, PropsWithChildren } from 'react'
import { useMemo } from 'react'
import { useLocation } from 'react-router'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { supportedAppChains, type TSupportedChainId } from '@/config/supportedChains'
import { getCanonicalChain, resolveConnectedCanonicalChainId, resolveExecutionChainId } from '@/config/tenderly'
import { chainsContext, type TChainsContext } from '@/context/chainsContext'

const DEFAULT_CHAIN_ID = 1 as TSupportedChainId

export const ChainsProvider: FC<PropsWithChildren> = ({ children }) => {
  const rawChainId = useChainId()
  const { pathname } = useLocation()
  const account = useAccount()
  const { switchChain } = useSwitchChain()

  const chainIdParam = useMemo(() => {
    const param = Number(pathname.split('/')[2])
    return Number.isNaN(param) ? undefined : param
  }, [pathname])

  const contextValue = useMemo((): TChainsContext => {
    const connectedCanonicalChainId = resolveConnectedCanonicalChainId(account.chain?.id)
    const resolvedCanonicalChainId = resolveConnectedCanonicalChainId(rawChainId) ?? DEFAULT_CHAIN_ID
    const chainIdIntent = (
      chainIdParam && getCanonicalChain(chainIdParam)?.id ? chainIdParam : resolvedCanonicalChainId
    ) as TSupportedChainId
    const executionChainId = resolveExecutionChainId(chainIdIntent) ?? resolveExecutionChainId(resolvedCanonicalChainId)

    return {
      chains: supportedAppChains,
      chainId: resolvedCanonicalChainId,
      chainIdIntent,
      executionChainId: executionChainId ?? resolvedCanonicalChainId,
      getChainFromId: getCanonicalChain,
      getExecutionChainId: resolveExecutionChainId,
      switchNetwork: (newChainId: number) => {
        const nextExecutionChainId = resolveExecutionChainId(newChainId)
        if (nextExecutionChainId === undefined) {
          console.warn(`Chain ${newChainId} is not enabled for execution`)
          return
        }
        switchChain?.({ chainId: nextExecutionChainId })
      },
      isConnectedChainValid: Boolean(connectedCanonicalChainId),
      isConnected: !!account.address
    }
  }, [rawChainId, chainIdParam, account.chain?.id, account.address, switchChain])

  return <chainsContext.Provider value={contextValue}>{children}</chainsContext.Provider>
}
