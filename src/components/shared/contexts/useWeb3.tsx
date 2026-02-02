import { usePlausible } from '@hooks/usePlausible'
import { useAccountModal, useChainModal, useConnectModal } from '@rainbow-me/rainbowkit'
import { useAsyncTrigger } from '@shared/hooks/useAsyncTrigger'
import type { TAddress } from '@shared/types/address'
import { fetchClusterName, getClusterImageUrl, isAddress } from '@shared/utils'
import { isIframe } from '@shared/utils/helpers'
import { PLAUSIBLE_EVENTS } from '@shared/utils/plausible'
import { toAddress } from '@shared/utils/tools.address'
import type { ReactElement } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { mainnet } from 'viem/chains'
import { useAccount, useConnect, useDisconnect, useEnsName } from 'wagmi'

type TWeb3Context = {
  address: TAddress | undefined
  ens: string | undefined
  clusters: { name: string; avatar: string } | undefined
  chainID: number
  isActive: boolean
  isWalletSafe: boolean
  isWalletLedger: boolean
  isUserConnecting: boolean
  isIdentityLoading: boolean
  openLoginModal: () => void
  onDesactivate: () => void
}

const defaultState: TWeb3Context = {
  address: undefined,
  ens: undefined,
  clusters: undefined,
  chainID: 1,
  isActive: false,
  isWalletSafe: false,
  isWalletLedger: false,
  isUserConnecting: false,
  isIdentityLoading: false,
  openLoginModal: (): void => undefined,
  onDesactivate: (): void => undefined
}

const Web3Context = createContext<TWeb3Context>(defaultState)

export const Web3ContextApp = (props: { children: ReactElement }): ReactElement => {
  const { address, isConnecting, isConnected, connector, chain } = useAccount()
  const { connectors, connectAsync } = useConnect()
  const { disconnect } = useDisconnect()
  const { data: ensName, isLoading: isEnsLoading } = useEnsName({
    address: isConnected ? address : undefined,
    chainId: mainnet.id
  })
  const { openAccountModal } = useAccountModal()
  const { openConnectModal } = useConnectModal()
  const { openChainModal } = useChainModal()
  const trackEvent = usePlausible()
  const [clusters, setClusters] = useState<{ name: string; avatar: string } | undefined>(undefined)
  const [isUserConnecting, setIsUserConnecting] = useState(false)
  const [isFetchingClusters, setIsFetchingClusters] = useState(false)
  const wasConnectedRef = useRef(false)
  const previousChainIDRef = useRef<number | undefined>(undefined)
  const hasUserRequestedConnectionRef = useRef(false)

  const chainID = chain?.id ?? 1

  useEffect(() => {
    if (!wasConnectedRef.current && isConnected && hasUserRequestedConnectionRef.current) {
      trackEvent(PLAUSIBLE_EVENTS.CONNECT_WALLET, {
        props: { address: address ?? '', connector: connector?.name ?? '', chainID }
      })
      hasUserRequestedConnectionRef.current = false
    }
    wasConnectedRef.current = isConnected
  }, [isConnected, address, connector, chainID, trackEvent])

  useEffect(() => {
    if (isConnected && previousChainIDRef.current !== undefined && previousChainIDRef.current !== chainID) {
      trackEvent(PLAUSIBLE_EVENTS.CHANGE_NETWORK, {
        props: { fromChainID: previousChainIDRef.current, toChainID: chainID }
      })
    }
    if (isConnected) {
      previousChainIDRef.current = chainID
    } else {
      previousChainIDRef.current = undefined
    }
  }, [isConnected, chainID, trackEvent])

  const onDesactivate = useCallback((): void => {
    trackEvent(PLAUSIBLE_EVENTS.DISCONNECT_WALLET, {
      props: { address: address ?? '', chainID }
    })
    disconnect()
  }, [disconnect, trackEvent, address, chainID])

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
        hasUserRequestedConnectionRef.current = true
        await connectAsync({
          connector: ledgerConnector,
          chainId: chainID
        })
        return
      }

      if (openConnectModal) {
        hasUserRequestedConnectionRef.current = true
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
    if (!isConnected || !isAddress(address)) {
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
  }, [address, isConnected])

  useEffect(() => {
    if (isConnecting) {
      if (hasUserRequestedConnectionRef.current) {
        setIsUserConnecting(true)
      }
      return
    }

    setIsUserConnecting(false)
  }, [isConnecting])

  const isIdentityLoading = Boolean((isEnsLoading && !!address) || isFetchingClusters)
  const isWalletSafe = connector?.id.toLowerCase().includes('safe') ?? false
  const isWalletLedger = connector?.id.toLowerCase().includes('ledger') ?? false

  const contextValue = useMemo(
    () => ({
      address: isConnected && address ? toAddress(address) : undefined,
      ens: isConnected && ensName ? ensName : undefined,
      clusters: isConnected ? clusters : undefined,
      chainID,
      isActive: isConnected,
      isWalletSafe,
      isWalletLedger,
      isUserConnecting,
      isIdentityLoading,
      openLoginModal,
      onDesactivate
    }),
    [
      address,
      ensName,
      clusters,
      chainID,
      isConnected,
      isWalletSafe,
      isWalletLedger,
      isUserConnecting,
      isIdentityLoading,
      openLoginModal,
      onDesactivate
    ]
  )

  return <Web3Context.Provider value={contextValue}>{props.children}</Web3Context.Provider>
}

export const useWeb3 = (): TWeb3Context => useContext(Web3Context)
