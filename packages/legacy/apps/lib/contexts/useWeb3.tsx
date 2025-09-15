import { Clusters, getImageUrl } from '@clustersxyz/sdk'
import { useAccountModal, useChainModal, useConnectModal } from '@rainbow-me/rainbowkit'
import { useIsMounted, useUpdateEffect } from '@react-hookz/web'
import type { ReactElement } from 'react'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { Chain } from 'viem'
import { mainnet } from 'viem/chains'
import type { Connector } from 'wagmi'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useEnsName,
  usePublicClient,
  useSwitchChain,
  useWalletClient
} from 'wagmi'
import { useAsyncTrigger } from '../hooks/useAsyncTrigger'
import type { TAddress } from '../types/address'
import { isAddress } from '../utils'
import { isIframe } from '../utils/helpers'
import { toAddress } from '../utils/tools.address'
import { retrieveConfig } from '../utils/wagmi'

type TWeb3Context = {
  address: TAddress | undefined
  ens: string | undefined
  lensProtocolHandle: string | undefined
  clusters: { name: string; avatar: string } | undefined
  chainID: number
  isDisconnected: boolean
  isActive: boolean
  isConnecting: boolean
  isWalletSafe: boolean
  isWalletLedger: boolean
  hasProvider: boolean
  provider?: Connector
  onConnect: () => Promise<void>
  onSwitchChain: (newChainID: number) => void
  openLoginModal: () => void
  onDesactivate: () => void
}

const defaultState: TWeb3Context = {
  address: undefined,
  ens: undefined,
  lensProtocolHandle: undefined,
  clusters: undefined,
  chainID: 1,
  isDisconnected: false,
  isActive: false,
  isConnecting: false,
  isWalletSafe: false,
  isWalletLedger: false,
  hasProvider: false,
  provider: undefined,
  onConnect: async (): Promise<void> => undefined,
  onSwitchChain: (): void => undefined,
  openLoginModal: (): void => undefined,
  onDesactivate: (): void => undefined
}

const Web3Context = createContext<TWeb3Context>(defaultState)
export const Web3ContextApp = (props: { children: ReactElement; defaultNetwork?: Chain }): ReactElement => {
  const { address, isConnecting, isConnected, isDisconnected, connector, chain } = useAccount()
  const { connectors, connectAsync } = useConnect()
  const { disconnect, disconnectAsync } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const { data: ensName } = useEnsName({ address: address, chainId: mainnet.id })
  const { data: walletClient } = useWalletClient()
  const [currentChainID, setCurrentChainID] = useState(chain?.id)
  const publicClient = usePublicClient()
  const isMounted = useIsMounted()
  const { openAccountModal } = useAccountModal()
  const { openConnectModal } = useConnectModal()
  const { openChainModal } = useChainModal()
  const [clusters, setClusters] = useState<{ name: string; avatar: string } | undefined>(undefined)

  const supportedChainsID = useMemo((): number[] => {
    connectors //Hard trigger re-render when connectors change
    const config = retrieveConfig()
    const noFork = config.chains.filter(({ id }): boolean => id !== 1337)
    return noFork.map(({ id }): number => id)
  }, [connectors])

  useUpdateEffect((): void => {
    setCurrentChainID(chain?.id)
  }, [chain])

  useAsyncTrigger(async () => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      if (isIframe() && connector && connector?.id !== 'safe' && !connector?.id?.toLowerCase().includes('ledger')) {
        const ancestorOrigin = window?.location.ancestorOrigins[0]
        if (!ancestorOrigin.toString().includes('safe')) {
          const ledgerConnector = connectors.find((c): boolean => c.id.toLowerCase().includes('ledger'))
          if (ledgerConnector) {
            await disconnectAsync({ connector: connector })
            const isAuth = await ledgerConnector.isAuthorized()
            if (!isAuth) {
              await connectAsync({ connector: ledgerConnector })
            }
          }
        }
        const safeConnector = connectors.find((c): boolean => c.id === 'safe')
        if (safeConnector) {
          await disconnectAsync({ connector: connector })
          const isAuth = await safeConnector.isAuthorized()
          if (!isAuth) {
            await connectAsync({ connector: safeConnector })
          }
        }
      } else if (isIframe() && !connector) {
        const ancestorOrigin = window?.location.ancestorOrigins[0]
        if (!ancestorOrigin.toString().includes('safe')) {
          const ledgerConnector = connectors.find((c): boolean => c.id.toLowerCase().includes('ledger'))
          if (ledgerConnector) {
            await connectAsync({ connector: ledgerConnector })
          }
        }
        const safeConnector = connectors.find((c): boolean => c.id === 'safe')
        if (safeConnector) {
          await connectAsync({ connector: safeConnector })
        }
      }
    } catch (error) {
      console.error(error)
    }
  }, [connectAsync, connectors, disconnectAsync, connector])

  const onConnect = useCallback(async (): Promise<void> => {
    const ledgerConnector = connectors.find((c): boolean => c.id.toLowerCase().includes('ledger'))
    if (isIframe() && ledgerConnector) {
      await connectAsync({ connector: ledgerConnector, chainId: currentChainID })
      return
    }

    if (openConnectModal) {
      openConnectModal()
    } else {
      if (openChainModal) {
        openChainModal()
        return
      }
      console.warn('Impossible to open login modal')
    }
  }, [connectAsync, connectors, currentChainID, openChainModal, openConnectModal])

  const onDesactivate = useCallback((): void => {
    disconnect()
  }, [disconnect])

  const onSwitchChain = useCallback(
    (newChainID: number): void => {
      setCurrentChainID(newChainID)
      if (isConnected) {
        if (!switchChain || !connector) {
          throw new Error('Switch network function is not defined')
        }
        switchChain?.({ connector, chainId: newChainID })
      }
    },
    [switchChain, connector, isConnected]
  )

  const openLoginModal = useCallback(async (): Promise<void> => {
    if (isConnected && connector && address) {
      if (openAccountModal) {
        openAccountModal()
      } else {
        if (openChainModal) {
          openChainModal()
          return
        }
        console.warn('Impossible to open account modal')
      }
    } else {
      const ledgerConnector = connectors.find((c): boolean => c.id.toLowerCase().includes('ledger'))
      if (isIframe() && ledgerConnector) {
        await connectAsync({ connector: ledgerConnector, chainId: currentChainID })
        return
      }

      if (openConnectModal) {
        openConnectModal()
      } else {
        if (openChainModal) {
          openChainModal()
          return
        }
        console.warn('Impossible to open login modal')
      }
    }
  }, [
    address,
    connectAsync,
    connector,
    connectors,
    currentChainID,
    isConnected,
    openAccountModal,
    openChainModal,
    openConnectModal
  ])

  useAsyncTrigger(async (): Promise<void> => {
    if (isAddress(address)) {
      const clusters = new Clusters()
      const clustersTag = await clusters.getName(address)
      if (clustersTag) {
        const [clustersName] = String(clustersTag).split('/')
        const profileImage = getImageUrl(clustersName)
        setClusters({ name: `${clustersName}/`, avatar: profileImage })
        return
      }
    }
    setClusters(undefined)
  }, [address])

  const contextValue = {
    address: address ? toAddress(address) : undefined,
    isConnecting,
    isDisconnected,
    ens: ensName || '',
    clusters,
    isActive: isConnected && [...supportedChainsID, 1337].includes(chain?.id || -1) && isMounted(),
    isWalletSafe:
      connector?.id === 'safe' ||
      (connector as Record<string, unknown> & { _wallets?: Array<{ id?: string }> })?._wallets?.[0]?.id === 'safe',
    isWalletLedger:
      connector?.id.toLowerCase().includes('ledger') ||
      (connector as Record<string, unknown> & { _wallets?: Array<{ id?: string }> })?._wallets?.[0]?.id === 'ledger',
    lensProtocolHandle: '',
    hasProvider: !!(walletClient || publicClient),
    provider: connector,
    chainID: isConnected
      ? Number(chain?.id || props.defaultNetwork?.id || 1)
      : Number(currentChainID || props.defaultNetwork?.id || 1),
    onConnect,
    onSwitchChain,
    openLoginModal,
    onDesactivate: onDesactivate
  }

  return <Web3Context.Provider value={contextValue}>{props.children}</Web3Context.Provider>
}

export const useWeb3 = (): TWeb3Context => useContext(Web3Context)
