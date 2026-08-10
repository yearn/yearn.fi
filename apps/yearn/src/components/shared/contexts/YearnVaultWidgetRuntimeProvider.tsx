'use client'

import { usePlausible } from '@hooks/usePlausible'
import { isVaultEnsoDisabled } from '@pages/vaults/constants/ensoDisabledVaults'
import { useEnsoStatus } from '@pages/vaults/contexts/useEnsoStatus'
import {
  getVaultAddress,
  getVaultChainID,
  getVaultInfo,
  getVaultStakingAddress,
  getVaultToken,
  getVaultTVL,
  type TKongVaultInput
} from '@pages/vaults/domain/kongVaultSelectors'
import { useNotificationsActions } from '@shared/contexts/useNotificationsActions'
import { useWalletActions, useWalletStatus, useWalletTokens } from '@shared/contexts/useWallet'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useYearn } from '@shared/contexts/useYearn'
import { useTokenList, useTokenListActions } from '@shared/contexts/WithTokenList'
import {
  fetchSafeTransactionDetails,
  type SafeTransactionStatus,
  type TSafeTransactionDetails
} from '@shared/hooks/useSafeTransactionDetails'
import type { TChainTokens, TToken } from '@shared/types'
import type { TNotificationType } from '@shared/types/notifications'
import { isZeroAddress } from '@shared/utils'
import {
  type VaultWidgetAnalyticsProperties,
  type VaultWidgetCatalogVault,
  type VaultWidgetNotificationInput,
  type VaultWidgetNotificationUpdate,
  type VaultWidgetRuntimeOverrides,
  VaultWidgetRuntimeProvider,
  type VaultWidgetSafeTransactionDetails,
  type VaultWidgetToken,
  type VaultWidgetTokenReference,
  type VaultWidgetWalletRuntime
} from '@yearn/vault-widget/runtime'
import { type ReactElement, type ReactNode, useCallback, useMemo } from 'react'
import { isAddressEqual, zeroAddress } from 'viem'
import { useAccount } from 'wagmi'
import {
  getCanonicalChain,
  isConnectedToExecutionChain,
  resolveCanonicalChainId,
  resolveExecutionChainId
} from '@/config/tenderly'
import { env } from '@/env'

const DEFAULT_YEARN_ASSETS_BASE_URI = 'https://cdn.jsdelivr.net/gh/yearn/tokenassets@main'
const YEARN_ASSETS_BASE_URI = env.NEXT_PUBLIC_BASE_YEARN_ASSETS_URI || DEFAULT_YEARN_ASSETS_BASE_URI

const SAFE_STATUS_BY_HOST_STATUS: Record<SafeTransactionStatus, VaultWidgetSafeTransactionDetails['status']> = {
  AWAITING_CONFIRMATIONS: 'awaiting-confirmations',
  AWAITING_EXECUTION: 'awaiting-execution',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
  SUCCESS: 'success'
}

function getTokenKey({ address, chainId }: VaultWidgetTokenReference): string {
  return `${chainId}/${address.toLowerCase()}`
}

export function toVaultWidgetToken(token: TToken): VaultWidgetToken {
  return {
    address: token.address,
    balanceRaw: token.balance.raw,
    chainId: token.chainID,
    decimals: token.decimals,
    logoUri: token.logoURI,
    name: token.name,
    symbol: token.symbol,
    usdValue: token.value
  }
}

export function toVaultWidgetTokensByChain(tokensByChain: TChainTokens): VaultWidgetWalletRuntime['tokensByChain'] {
  return Object.fromEntries(
    Object.entries(tokensByChain).map(([chainId, tokensByAddress]) => [
      Number(chainId),
      Object.fromEntries(
        Object.entries(tokensByAddress).map(([address, token]) => [address, toVaultWidgetToken(token)])
      )
    ])
  )
}

export function toVaultWidgetCatalogVault(vault: TKongVaultInput): VaultWidgetCatalogVault {
  const stakingAddress = getVaultStakingAddress(vault)

  return {
    address: getVaultAddress(vault),
    assetAddress: getVaultToken(vault).address,
    chainId: getVaultChainID(vault),
    hidden: getVaultInfo(vault).isHidden,
    ...(isAddressEqual(stakingAddress, zeroAddress) ? {} : { stakingAddress })
  }
}

export function toVaultWidgetSafeTransactionDetails(
  transaction: TSafeTransactionDetails
): VaultWidgetSafeTransactionDetails {
  return {
    executionTxHash: transaction.executionTxHash,
    safeTxHash: transaction.safeTxHash,
    status: SAFE_STATUS_BY_HOST_STATUS[transaction.txStatus]
  }
}

export function resolveVaultWidgetUsdPrice({
  catalogPrice,
  walletToken,
  yearnPrice
}: {
  catalogPrice?: number
  walletToken?: TToken
  yearnPrice: number
}): number {
  if (Number.isFinite(yearnPrice) && yearnPrice > 0) {
    return yearnPrice
  }

  const walletUnitPrice =
    walletToken && walletToken.balance.normalized > 0 && walletToken.value > 0
      ? walletToken.value / walletToken.balance.normalized
      : 0
  if (Number.isFinite(walletUnitPrice) && walletUnitPrice > 0) {
    return walletUnitPrice
  }

  return Number.isFinite(catalogPrice) && Number(catalogPrice) > 0 ? Number(catalogPrice) : 0
}

function getCatalogAssetPrices(allVaults: Record<string, TKongVaultInput>): Readonly<Record<string, number>> {
  return Object.fromEntries(
    Object.values(allVaults).flatMap((vault) => {
      const price = getVaultTVL(vault).price
      if (!Number.isFinite(price) || price <= 0) {
        return []
      }

      return [[getTokenKey({ address: getVaultToken(vault).address, chainId: getVaultChainID(vault) }), price] as const]
    })
  )
}

function toPlausibleProperties(properties?: VaultWidgetAnalyticsProperties): Record<string, string> {
  return Object.fromEntries(
    Object.entries(properties || {}).flatMap(([key, value]) =>
      value === null || value === undefined ? [] : [[key, String(value)]]
    )
  )
}

export function YearnVaultWidgetRuntimeProvider({ children }: { children: ReactNode }): ReactElement {
  const { chainId: connectedExecutionChainId } = useAccount()
  const trackEvent = usePlausible()
  const { isEnsoFailed } = useEnsoStatus()
  const { createNotification, updateNotification } = useNotificationsActions()
  const { onRefresh } = useWalletActions()
  const { hasCompletedBalanceLoad, isLoading: isWalletLoading } = useWalletStatus()
  const { balances, getToken } = useWalletTokens()
  const { address, isActive, isUserConnecting, isWalletSafe, openLoginModal } = useWeb3()
  const {
    allVaults,
    enableVaultListFetch,
    getPrice,
    isAutoStakingEnabled,
    isLoadingVaultList,
    setIsAutoStakingEnabled,
    setZapSlippage,
    zapSlippage
  } = useYearn()
  const { isInitialized: isTokenListInitialized, tokenLists } = useTokenList()
  const { enableTokenListFetch } = useTokenListActions()

  const walletTokensByChain = useMemo(() => toVaultWidgetTokensByChain(balances), [balances])
  const tokenListsByChain = useMemo(() => toVaultWidgetTokensByChain(tokenLists), [tokenLists])
  const knownVaults = useMemo(() => Object.values(allVaults).map(toVaultWidgetCatalogVault), [allVaults])
  const catalogAssetPrices = useMemo(() => getCatalogAssetPrices(allVaults), [allVaults])

  const enableCatalog = useCallback((): void => {
    enableTokenListFetch()
    enableVaultListFetch()
  }, [enableTokenListFetch, enableVaultListFetch])

  const getRuntimeToken = useCallback(
    ({ address: tokenAddress, chainId: tokenChainId }: VaultWidgetTokenReference): VaultWidgetToken | undefined => {
      const token = getToken({ address: tokenAddress, chainID: tokenChainId })
      if (isZeroAddress(token.address) || token.address.toLowerCase() !== tokenAddress.toLowerCase()) {
        return undefined
      }

      return toVaultWidgetToken(token)
    },
    [getToken]
  )

  const refreshWallet = useCallback(
    (tokens?: readonly VaultWidgetTokenReference[]) =>
      onRefresh(
        tokens?.map(({ address: tokenAddress, chainId: tokenChainId }) => ({
          address: tokenAddress,
          chainID: tokenChainId
        }))
      ),
    [onRefresh]
  )

  const getUsdPrice = useCallback(
    (token: VaultWidgetTokenReference): number => {
      const walletToken = getToken({ address: token.address, chainID: token.chainId })
      return resolveVaultWidgetUsdPrice({
        catalogPrice: catalogAssetPrices[getTokenKey(token)],
        walletToken: isZeroAddress(walletToken.address) ? undefined : walletToken,
        yearnPrice: getPrice({ address: token.address, chainID: token.chainId }).normalized
      })
    },
    [catalogAssetPrices, getPrice, getToken]
  )

  const getChain = useCallback((requestedChainId: number) => {
    const canonicalChainId = resolveCanonicalChainId(requestedChainId)
    const chain = canonicalChainId ? getCanonicalChain(canonicalChainId) : undefined
    if (!chain) {
      return undefined
    }

    return {
      blockExplorerUrl: chain.blockExplorers?.default.url,
      iconUrl: `${YEARN_ASSETS_BASE_URI}/chains/${chain.id}/logo.svg`,
      id: chain.id,
      name: chain.name
    }
  }, [])

  const isEnsoEnabled = useCallback(
    ({ chainId: targetChainId, vaultAddress }: { chainId: number; vaultAddress?: `0x${string}` }): boolean =>
      env.NEXT_PUBLIC_ENSO_DISABLED !== 'true' && !isEnsoFailed && !isVaultEnsoDisabled(targetChainId, vaultAddress),
    [isEnsoFailed]
  )

  const createRuntimeNotification = useCallback(
    async (notification: VaultWidgetNotificationInput) => {
      const notificationId = await createNotification({
        amount: notification.amount,
        executionChainId: notification.executionChainId,
        fromAddress: notification.fromAddress,
        fromChainId: notification.fromChainId,
        fromSymbol: notification.fromSymbol,
        toAddress: notification.toAddress,
        toAmount: notification.toAmount,
        toChainId: notification.toChainId,
        toSymbol: notification.toSymbol,
        type: notification.type as TNotificationType
      })

      return notificationId >= 0 ? notificationId : undefined
    },
    [createNotification]
  )

  const updateRuntimeNotification = useCallback(
    async (notification: VaultWidgetNotificationUpdate) => {
      if (typeof notification.id !== 'number') {
        throw new TypeError('The Yearn notification store requires numeric notification IDs')
      }

      await updateNotification({
        awaitingExecution: notification.awaitingExecution,
        id: notification.id,
        receipt: notification.receipt,
        status: notification.status,
        txHash: notification.txHash
      })
    },
    [updateNotification]
  )

  const getSafeTransactionDetails = useCallback(async (safeTxHash: `0x${string}`) => {
    const transaction = await fetchSafeTransactionDetails(safeTxHash)
    return transaction ? toVaultWidgetSafeTransactionDetails(transaction) : undefined
  }, [])

  const track = useCallback(
    (event: string, properties?: VaultWidgetAnalyticsProperties): void => {
      trackEvent(event, { props: toPlausibleProperties(properties) })
    },
    [trackEvent]
  )

  const runtime = useMemo<VaultWidgetRuntimeOverrides>(
    () => ({
      analytics: { track },
      assets: {
        baseUri: YEARN_ASSETS_BASE_URI,
        isDevelopment: env.DEV
      },
      catalog: {
        enableTokenList: enableCatalog,
        isLoading: isLoadingVaultList || !isTokenListInitialized,
        knownVaults,
        tokenListsByChain
      },
      chains: {
        getChain,
        isConnectedToExecutionChain,
        resolveCanonicalChainId,
        resolveExecutionChainId
      },
      notifications: {
        create: createRuntimeNotification,
        update: updateRuntimeNotification
      },
      prices: {
        getUsdPrice,
        spotPriceEndpoint: '/api/prices/spot'
      },
      routing: {
        ensoRouteEndpoint: '/api/enso/route',
        isEnsoEnabled
      },
      safe: {
        getTransactionDetails: getSafeTransactionDetails,
        isSafe: isWalletSafe
      },
      settings: {
        autoStake: isAutoStakingEnabled,
        setAutoStake: setIsAutoStakingEnabled,
        setSlippagePercent: setZapSlippage,
        slippagePercent: zapSlippage
      },
      wallet: {
        address,
        chainId: connectedExecutionChainId,
        connected: isActive,
        connecting: isUserConnecting,
        getToken: getRuntimeToken,
        hasCompletedLoad: hasCompletedBalanceLoad,
        isLoading: isWalletLoading,
        open: openLoginModal,
        refresh: refreshWallet,
        tokensByChain: walletTokensByChain
      }
    }),
    [
      address,
      connectedExecutionChainId,
      createRuntimeNotification,
      enableCatalog,
      getChain,
      getRuntimeToken,
      getSafeTransactionDetails,
      getUsdPrice,
      hasCompletedBalanceLoad,
      isActive,
      isAutoStakingEnabled,
      isEnsoEnabled,
      isLoadingVaultList,
      isTokenListInitialized,
      isUserConnecting,
      isWalletLoading,
      isWalletSafe,
      knownVaults,
      openLoginModal,
      refreshWallet,
      setIsAutoStakingEnabled,
      setZapSlippage,
      tokenListsByChain,
      track,
      updateRuntimeNotification,
      walletTokensByChain,
      zapSlippage
    ]
  )

  return <VaultWidgetRuntimeProvider value={runtime}>{children}</VaultWidgetRuntimeProvider>
}
