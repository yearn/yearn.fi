import type { FC, PropsWithChildren } from 'react'
import { useMemo } from 'react'
import { useLocation } from 'react-router'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { supportedChains, type TSupportedChainId } from '@/config/supportedChains'
import { chainsContext, type TChainsContext } from '@/context/chainsContext'

const DEFAULT_CHAIN_ID = 1 as TSupportedChainId

function getSupportedChain(chainId: number) {
  return supportedChains.find((chain: { id: number }) => chain.id === chainId)
}

export const ChainsProvider: FC<PropsWithChildren> = ({ children }) => {
  const chainId = useChainId()
  const { pathname } = useLocation()
  const account = useAccount()
  const { switchChain } = useSwitchChain()

  const chainIdParam = useMemo(() => {
    const param = Number(pathname.split('/')[2])
    return Number.isNaN(param) ? undefined : param
  }, [pathname])

  const contextValue = useMemo((): TChainsContext => {
    const isConnectedChainValid = !!(account.chain?.id && getSupportedChain(account.chain.id))
    const chainIdIntent = (chainIdParam || chainId || DEFAULT_CHAIN_ID) as TSupportedChainId

    return {
      chains: supportedChains,
      chainId: (chainId || DEFAULT_CHAIN_ID) as TSupportedChainId,
      chainIdIntent,
      getChainFromId: getSupportedChain,
      switchNetwork: (newChainId: number) => {
        switchChain?.({ chainId: newChainId })
      },
      isConnectedChainValid,
      isConnected: !!account.address
    }
  }, [chainId, chainIdParam, account.chain?.id, account.address, switchChain])

  return <chainsContext.Provider value={contextValue}>{children}</chainsContext.Provider>
}
