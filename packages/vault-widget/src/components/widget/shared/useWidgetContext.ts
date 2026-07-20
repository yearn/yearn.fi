import { useVaultWidgetRuntime, type VaultWidgetAnalyticsProperties } from '@yearn/vault-widget/runtime'
import type { TAddress, TToken } from '@yearn/vault-widget/types'
import { useCallback } from 'react'
import { formatUnits } from 'viem'

type TUseWidgetContextParams = {
  chainId: number
  vaultAddress: TAddress
}

type TLegacyTokenReference = {
  address: TAddress
  chainId: number
}

type TTrackEventPayload = {
  props?: VaultWidgetAnalyticsProperties
}

type TWidgetContext = {
  account: TAddress | undefined
  openLoginModal: () => void
  refreshWalletBalances: (tokens?: readonly TLegacyTokenReference[]) => Promise<unknown>
  getToken: (token: TLegacyTokenReference) => TToken | undefined
  zapSlippage: number
  isAutoStakingEnabled: boolean
  trackEvent: (event: string, payload?: TTrackEventPayload) => void
  ensoEnabled: boolean
  isWalletSafe: boolean
}

export function useWidgetContext({ chainId, vaultAddress }: TUseWidgetContextParams): TWidgetContext {
  const runtime = useVaultWidgetRuntime()

  const openLoginModal = useCallback(() => {
    void runtime.wallet.open()
  }, [runtime.wallet])

  const refreshWalletBalances = useCallback(
    (tokens?: readonly TLegacyTokenReference[]) =>
      runtime.wallet.refresh(tokens?.map(({ address, chainId }) => ({ address, chainId: chainId }))),
    [runtime.wallet]
  )

  const getToken = useCallback(
    ({ address, chainId }: TLegacyTokenReference): TToken | undefined => {
      const token = runtime.wallet.getToken({ address, chainId: chainId })
      if (!token) return undefined

      const display = formatUnits(token.balanceRaw, token.decimals)
      return {
        address: token.address,
        chainId: token.chainId,
        decimals: token.decimals,
        symbol: token.symbol,
        name: token.name,
        balance: {
          raw: token.balanceRaw,
          normalized: Number(display),
          display,
          decimals: token.decimals
        },
        logoURI: token.logoUri,
        value: token.usdValue ?? 0
      }
    },
    [runtime.wallet]
  )

  const trackEvent = useCallback(
    (event: string, payload?: TTrackEventPayload) => runtime.analytics.track(event, payload?.props),
    [runtime.analytics]
  )

  return {
    account: runtime.wallet.address,
    openLoginModal,
    refreshWalletBalances,
    getToken,
    zapSlippage: runtime.settings.slippagePercent,
    isAutoStakingEnabled: runtime.settings.autoStake,
    trackEvent,
    ensoEnabled: runtime.routing.isEnsoEnabled({ chainId, vaultAddress }),
    isWalletSafe: runtime.safe.isSafe
  }
}
