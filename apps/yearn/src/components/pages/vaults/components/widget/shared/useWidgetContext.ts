import { usePlausible } from '@hooks/usePlausible'
import { useEnsoEnabled } from '@pages/vaults/hooks/useEnsoEnabled'
import { useWalletActions, useWalletTokens } from '@shared/contexts/useWallet'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useYearn } from '@shared/contexts/useYearn'
import { useAccount } from 'wagmi'

type TUseWidgetContextParams = {
  chainId: number
  vaultAddress: `0x${string}`
}

type TWidgetContext = {
  account: `0x${string}` | undefined
  openLoginModal: (() => void) | undefined
  refreshWalletBalances: ReturnType<typeof useWalletActions>['onRefresh']
  getToken: ReturnType<typeof useWalletTokens>['getToken']
  zapSlippage: number
  isAutoStakingEnabled: boolean
  trackEvent: ReturnType<typeof usePlausible>
  ensoEnabled: boolean
  isWalletSafe: boolean
}

export function useWidgetContext({ chainId, vaultAddress }: TUseWidgetContextParams): TWidgetContext {
  const { address: account } = useAccount()
  const { openLoginModal, isWalletSafe } = useWeb3()
  const { onRefresh: refreshWalletBalances } = useWalletActions()
  const { getToken } = useWalletTokens()
  const { zapSlippage, isAutoStakingEnabled } = useYearn()
  const trackEvent = usePlausible()
  const ensoEnabled = useEnsoEnabled({ chainId, vaultAddress })

  return {
    account,
    openLoginModal,
    refreshWalletBalances,
    getToken,
    zapSlippage,
    isAutoStakingEnabled,
    trackEvent,
    ensoEnabled,
    isWalletSafe
  }
}
