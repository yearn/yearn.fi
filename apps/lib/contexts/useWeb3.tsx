import { useAsyncTrigger } from '@lib/hooks/useAsyncTrigger'
import type { TAddress } from '@lib/types/address'
import { fetchClusterName, getClusterImageUrl, isAddress } from '@lib/utils'
import { isIframe } from '@lib/utils/helpers'
import { toAddress } from '@lib/utils/tools.address'
import { useAccountModal, useChainModal, useConnectModal } from '@rainbow-me/rainbowkit'
import type { ReactElement } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
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

type TWeb3Context = {
  address: TAddress | undefined
  ens: string | undefined
  lensProtocolHandle: string | undefined
  clusters: { name: string; avatar: string } | undefined
  chainID: number
  isDisconnected: boolean
  isActive: boolean
  isConnecting: boolean
  isUserConnecting: boolean
  isIdentityLoading: boolean
  isNetworkMismatch: boolean
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
  isUserConnecting: false,
  isIdentityLoading: false,
  isNetworkMismatch: false,
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

export const Web3ContextApp = (props: { children: ReactElement }): ReactElement => {
  const { address, isConnecting, isConnected, isDisconnected, connector, chain } = useAccount()
  const { connectors, connectAsync } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const { data: ensName, isLoading: isEnsLoading } = useEnsName({
    address: address,
    chainId: mainnet.id
  })
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { openAccountModal } = useAccountModal()
  const { openConnectModal } = useConnectModal()
  const { openChainModal } = useChainModal()
  const [clusters, setClusters] = useState<{ name: string; avatar: string } | undefined>(undefined)
  const [hasUserRequestedConnection, setHasUserRequestedConnection] = useState(false)
  const [isUserConnecting, setIsUserConnecting] = useState(false)
  const [isFetchingClusters, setIsFetchingClusters] = useState(false)

  const chainID = chain?.id ?? 1

  const onConnect = useCallback(async (): Promise<void> => {
    const ledgerConnector = connectors.find((c) => c.id.toLowerCase().includes('ledger'))
    if (isIframe() && ledgerConnector) {
      setHasUserRequestedConnection(true)
      await connectAsync({
        connector: ledgerConnector,
        chainId: chainID
      })
      return
    }

    if (openConnectModal) {
      setHasUserRequestedConnection(true)
      openConnectModal()
    } else if (openChainModal) {
      openChainModal()
    } else {
      console.warn('Impossible to open login modal')
    }
  }, [connectAsync, connectors, chainID, openChainModal, openConnectModal])

  const onDesactivate = useCallback((): void => {
    disconnect()
  }, [disconnect])

  const onSwitchChain = useCallback(
    (newChainID: number): void => {
      if (isConnected && switchChain && connector) {
        switchChain({ connector, chainId: newChainID })
      }
    },
    [switchChain, connector, isConnected]
  )

  const openLoginModal = useCallback(async (): Promise<void> => {
    if (isConnected && connector && address) {
      if (openAccountModal) {
        openAccountModal()
      } else if (openChainModal) {
        openChainModal()
      } else {
        console.warn('Impossible to open account modal')
      }
    } else {
      const ledgerConnector = connectors.find((c) => c.id.toLowerCase().includes('ledger'))
      if (isIframe() && ledgerConnector) {
        setHasUserRequestedConnection(true)
        await connectAsync({
          connector: ledgerConnector,
          chainId: chainID
        })
        return
      }

      if (openConnectModal) {
        setHasUserRequestedConnection(true)
        openConnectModal()
      } else if (openChainModal) {
        openChainModal()
      } else {
        console.warn('Impossible to open login modal')
      }
    }
  }, [
    address,
    connectAsync,
    connector,
    connectors,
    chainID,
    isConnected,
    openAccountModal,
    openChainModal,
    openConnectModal
  ])

  useAsyncTrigger(async (): Promise<void> => {
    if (!isAddress(address)) {
      setClusters(undefined)
      setIsFetchingClusters(false)
      return
    }
    setIsFetchingClusters(true)
    try {
      const clustersTag = await fetchClusterName(address)
      if (clustersTag) {
        const [clustersName] = clustersTag.split('/')
        const profileImage = getClusterImageUrl(clustersName)
        setClusters({ name: `${clustersTag}`, avatar: profileImage })
        return
      }
      setClusters(undefined)
    } catch (error) {
      console.error(error)
      setClusters(undefined)
    } finally {
      setIsFetchingClusters(false)
    }
  }, [address])

  useEffect(() => {
    if (isConnecting) {
      if (hasUserRequestedConnection) {
        setIsUserConnecting(true)
      }
      return
    }

    setIsUserConnecting(false)
    if (hasUserRequestedConnection) {
      setHasUserRequestedConnection(false)
    }
  }, [hasUserRequestedConnection, isConnecting])

  const isIdentityLoading = Boolean((isEnsLoading && !!address) || isFetchingClusters)

  const contextValue = useMemo(
    () => ({
      address: address ? toAddress(address) : undefined,
      isConnecting,
      isDisconnected,
      isUserConnecting,
      isIdentityLoading,
      isNetworkMismatch: false,
      ens: ensName || '',
      clusters,
      isActive: isConnected,
      isWalletSafe:
        connector?.id === 'safe' ||
        (connector as Record<string, unknown> & { _wallets?: Array<{ id?: string }> })?._wallets?.[0]?.id === 'safe',
      isWalletLedger:
        connector?.id.toLowerCase().includes('ledger') ||
        (connector as Record<string, unknown> & { _wallets?: Array<{ id?: string }> })?._wallets?.[0]?.id === 'ledger',
      lensProtocolHandle: '',
      hasProvider: !!(walletClient || publicClient),
      provider: connector,
      chainID,
      onConnect,
      onSwitchChain,
      openLoginModal,
      onDesactivate
    }),
    [
      address,
      isConnecting,
      isDisconnected,
      isUserConnecting,
      isIdentityLoading,
      ensName,
      clusters,
      isConnected,
      connector,
      walletClient,
      publicClient,
      chainID,
      onConnect,
      onSwitchChain,
      openLoginModal,
      onDesactivate
    ]
  )

  return <Web3Context.Provider value={contextValue}>{props.children}</Web3Context.Provider>
}

export const useWeb3 = (): TWeb3Context => useContext(Web3Context)
