import { usePlausible } from '@hooks/usePlausible'
import { useEnsoEnabled } from '@pages/vaults/hooks/useEnsoEnabled'
import { useWallet } from '@shared/contexts/useWallet'
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
  refreshWalletBalances: ReturnType<typeof useWallet>['onRefresh']
  getToken: ReturnType<typeof useWallet>['getToken']
  zapSlippage: number
  isAutoStakingEnabled: boolean
  getPrice: ReturnType<typeof useYearn>['getPrice']
  trackEvent: ReturnType<typeof usePlausible>
  ensoEnabled: boolean
}

export function useWidgetContext({ chainId, vaultAddress }: TUseWidgetContextParams): TWidgetContext {
  const { address: account } = useAccount()
  const { openLoginModal } = useWeb3()
  const { onRefresh: refreshWalletBalances, getToken } = useWallet()
  const { zapSlippage, isAutoStakingEnabled, getPrice } = useYearn()
  const trackEvent = usePlausible()
  const ensoEnabled = useEnsoEnabled({ chainId, vaultAddress })

  return {
    account,
    openLoginModal,
    refreshWalletBalances,
    getToken,
    zapSlippage,
    isAutoStakingEnabled,
    getPrice,
    trackEvent,
    ensoEnabled
  }
}
