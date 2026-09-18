import { usePlausible } from '@hooks/usePlausible'
import type { TAddress } from '@shared/types/address'
import { fetchClusterName, getClusterImageUrl, isAddress, isSafeConnectorId } from '@shared/utils'
import { isIframe } from '@shared/utils/helpers'
import { PLAUSIBLE_EVENTS } from '@shared/utils/plausible'
import { toAddress } from '@shared/utils/tools.address'
import { useWalletDrawer } from '@yearn/wallet-ui'
import { useWalletDisconnect } from '@yearn/wallet-ui/useWalletDisconnect'
import type { ReactElement } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { mainnet } from 'viem/chains'
import { useAccount, useConnect, useEnsName } from 'wagmi'
import { AGENT_WALLET_ID, shouldAutoConnectAgentWallet } from '@/config/agentWallet'
import { resolveConnectedCanonicalChainId, resolveExecutionChainId } from '@/config/tenderly'

type TWeb3Context = {
  address: TAddress | undefined
  ens: string | undefined
  clusters: { name: string; avatar: string } | undefined
  chainID: number
  isActive: boolean
  isWalletSafe: boolean
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
  isUserConnecting: false,
  isIdentityLoading: false,
  openLoginModal: (): void => undefined,
  onDesactivate: (): void => undefined
}

const Web3Context = createContext<TWeb3Context>(defaultState)

export const Web3ContextApp = (props: { children: ReactElement }): ReactElement => {
  const { address, isConnecting, isConnected, connector, chain } = useAccount()
  const { connectors, connectAsync } = useConnect()
  const { disconnect } = useWalletDisconnect()
  const { data: ensName, isLoading: isEnsLoading } = useEnsName({
    address: isConnected ? address : undefined,
    chainId: mainnet.id
  })
  const { openWalletDrawer, closeWalletDrawer, isConnecting: isDrawerConnecting } = useWalletDrawer()
  const trackEvent = usePlausible()
  const [clusters, setClusters] = useState<{ name: string; avatar: string } | undefined>(undefined)
  const [isFetchingClusters, setIsFetchingClusters] = useState(false)
  const wasConnectedRef = useRef(false)
  const previousChainIDRef = useRef<number | undefined>(undefined)
  const hasUserRequestedConnectionRef = useRef(false)
  const hasAutoConnectedAgentWalletRef = useRef(false)

  const chainID = resolveConnectedCanonicalChainId(chain?.id) ?? (isConnected ? 0 : 1)

  // Wagmi publishes connection changes outside our UI event handlers.
  useEffect(() => {
    if (!wasConnectedRef.current && isConnected && hasUserRequestedConnectionRef.current) {
      trackEvent(PLAUSIBLE_EVENTS.CONNECT_WALLET, {
        props: { connector: connector?.name ?? '', chainID: String(chainID) }
      })
      hasUserRequestedConnectionRef.current = false
    }
    wasConnectedRef.current = isConnected
  }, [isConnected, connector, chainID, trackEvent])

  // Preserve network analytics for wallet-initiated chain changes.
  useEffect(() => {
    if (isConnected && previousChainIDRef.current !== undefined && previousChainIDRef.current !== chainID) {
      trackEvent(PLAUSIBLE_EVENTS.CHANGE_NETWORK, {
        props: { fromChainID: String(previousChainIDRef.current), toChainID: String(chainID) }
      })
    }
    if (isConnected) {
      previousChainIDRef.current = chainID
    } else {
      previousChainIDRef.current = undefined
    }
  }, [isConnected, chainID, trackEvent])

  // The development connector appears after browser hydration.
  useEffect(() => {
    if (hasAutoConnectedAgentWalletRef.current || isConnected || isConnecting || !shouldAutoConnectAgentWallet()) {
      return
    }

    const agentConnector = connectors.find((eachConnector) => eachConnector.id === AGENT_WALLET_ID)
    if (!agentConnector) {
      return
    }

    hasAutoConnectedAgentWalletRef.current = true
    hasUserRequestedConnectionRef.current = true
    void connectAsync({
      connector: agentConnector,
      chainId: resolveExecutionChainId(chainID) ?? chainID
    }).catch((error) => {
      hasAutoConnectedAgentWalletRef.current = false
      hasUserRequestedConnectionRef.current = false
      console.error(error)
    })
  }, [chainID, connectAsync, connectors, isConnected, isConnecting])

  const onDesactivate = useCallback((): void => {
    trackEvent(PLAUSIBLE_EVENTS.DISCONNECT_WALLET, {
      props: { chainID: String(chainID) }
    })
    hasUserRequestedConnectionRef.current = false
    closeWalletDrawer()
    disconnect()
  }, [closeWalletDrawer, disconnect, trackEvent, chainID])

  const openLoginModal = useCallback(async (): Promise<void> => {
    if (isConnected) return

    const ledgerConnector = connectors.find((c) => c.id.toLowerCase().includes('ledger'))
    if (isIframe() && ledgerConnector) {
      hasUserRequestedConnectionRef.current = true
      await connectAsync({
        connector: ledgerConnector,
        chainId: resolveExecutionChainId(chainID) ?? chainID
      })
      return
    }

    // The shared picker owns analytics for its scoped connection attempts.
    hasUserRequestedConnectionRef.current = false
    openWalletDrawer()
  }, [connectAsync, connectors, chainID, isConnected, openWalletDrawer])

  useEffect(() => {
    if (!isConnected || !isAddress(address)) {
      setClusters(undefined)
      setIsFetchingClusters(false)
      return undefined
    }

    if (ensName) {
      setClusters(undefined)
      setIsFetchingClusters(false)
      return undefined
    }

    let isCancelled = false
    let timeoutId: number | undefined
    let idleId: number | undefined
    const supportsIdleCallback =
      typeof window !== 'undefined' && 'requestIdleCallback' in window && 'cancelIdleCallback' in window

    const run = async (): Promise<void> => {
      setIsFetchingClusters(true)
      try {
        const clustersTag = await fetchClusterName(address)
        if (isCancelled) {
          return
        }

        if (clustersTag) {
          const [clustersName] = clustersTag.split('/')
          const profileImage = getClusterImageUrl(clustersName)
          setClusters({ name: `${clustersTag}`, avatar: profileImage })
          return
        }

        setClusters(undefined)
      } catch (error) {
        console.error(error)
        if (!isCancelled) {
          setClusters(undefined)
        }
      } finally {
        if (!isCancelled) {
          setIsFetchingClusters(false)
        }
      }
    }

    if (supportsIdleCallback) {
      const idleWindow = window as Window & {
        requestIdleCallback: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
        cancelIdleCallback: (handle: number) => void
      }
      idleId = idleWindow.requestIdleCallback(
        () => {
          void run()
        },
        { timeout: 2000 }
      )
    } else {
      timeoutId = window.setTimeout(() => {
        void run()
      }, 400)
    }

    return () => {
      isCancelled = true
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
      }
      if (idleId !== undefined && supportsIdleCallback) {
        const idleWindow = window as Window & {
          cancelIdleCallback: (handle: number) => void
        }
        idleWindow.cancelIdleCallback(idleId)
      }
    }
  }, [address, ensName, isConnected])

  const isUserConnecting = isDrawerConnecting

  const isIdentityLoading = Boolean((isEnsLoading && !!address) || isFetchingClusters)
  const isWalletSafe = isSafeConnectorId(connector?.id)

  const contextValue = useMemo(
    () => ({
      address: isConnected && address ? toAddress(address) : undefined,
      ens: isConnected && ensName ? ensName : undefined,
      clusters: isConnected ? clusters : undefined,
      chainID,
      isActive: isConnected,
      isWalletSafe,
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
      isUserConnecting,
      isIdentityLoading,
      openLoginModal,
      onDesactivate
    ]
  )

  return <Web3Context.Provider value={contextValue}>{props.children}</Web3Context.Provider>
}

export const useWeb3 = (): TWeb3Context => useContext(Web3Context)
