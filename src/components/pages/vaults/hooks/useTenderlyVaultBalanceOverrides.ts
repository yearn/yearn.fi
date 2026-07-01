import { isYvBtcAddress, YVBTC_LOCKED_ADDRESS, YVBTC_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvBtc'
import {
  isYvUsdAddress,
  YVUSD_CHAIN_ID,
  YVUSD_DECIMALS,
  YVUSD_LOCKED_ADDRESS,
  YVUSD_UNLOCKED_ADDRESS
} from '@pages/vaults/utils/yvUsd'
import type { TAddress } from '@shared/types'
import { isZeroAddress, toAddress } from '@shared/utils'
import { useEffect, useRef } from 'react'
import type { TUseBalancesTokens } from '@/components/shared/hooks/useBalances.multichains'
import { isTenderlyModeEnabled } from '@/config/tenderly'
import type { TKongVaultView } from '../domain/kongVaultSelectors'

type TTenderlyVaultBalanceOverrideVault = Pick<
  TKongVaultView,
  'address' | 'chainID' | 'decimals' | 'name' | 'symbol'
> & {
  token: Pick<TKongVaultView['token'], 'address' | 'decimals' | 'name' | 'symbol'>
}

type TUseTenderlyVaultBalanceOverridesProps = {
  account?: TAddress
  currentVault?: TTenderlyVaultBalanceOverrideVault
  onRefresh: (tokens: TUseBalancesTokens[]) => Promise<unknown>
  stakingAddress?: TAddress
}

function addTenderlyOverrideToken(
  tokens: Map<string, TUseBalancesTokens>,
  address: string | undefined,
  chainID: number | undefined,
  metadata?: Partial<TUseBalancesTokens>
): void {
  if (!address || !Number.isInteger(chainID) || isZeroAddress(toAddress(address))) {
    return
  }

  const token = {
    address: toAddress(address),
    chainID: chainID as number,
    ...metadata
  }
  tokens.set(`${token.chainID}:${token.address}`, token)
}

export function getVaultTenderlyOverrideTokens({
  currentVault,
  stakingAddress
}: {
  currentVault: TTenderlyVaultBalanceOverrideVault
  stakingAddress?: TAddress
}): TUseBalancesTokens[] {
  const tokens = new Map<string, TUseBalancesTokens>()

  addTenderlyOverrideToken(tokens, currentVault.address, currentVault.chainID, {
    decimals: currentVault.decimals,
    name: currentVault.name,
    symbol: currentVault.symbol,
    isVaultToken: true
  })
  addTenderlyOverrideToken(tokens, currentVault.token.address, currentVault.chainID, {
    decimals: currentVault.token.decimals,
    name: currentVault.token.name,
    symbol: currentVault.token.symbol
  })
  addTenderlyOverrideToken(tokens, stakingAddress, currentVault.chainID, {
    decimals: currentVault.decimals,
    name: currentVault.name,
    symbol: currentVault.symbol,
    isStakingToken: true
  })

  if (isYvUsdAddress(currentVault.address)) {
    addTenderlyOverrideToken(tokens, YVUSD_UNLOCKED_ADDRESS, YVUSD_CHAIN_ID, {
      decimals: YVUSD_DECIMALS,
      name: 'yvUSD',
      symbol: 'yvUSD',
      isVaultToken: true
    })
    addTenderlyOverrideToken(tokens, YVUSD_LOCKED_ADDRESS, YVUSD_CHAIN_ID, {
      decimals: YVUSD_DECIMALS,
      name: 'yvUSD (Locked)',
      symbol: 'yvUSD',
      isVaultToken: true
    })
  }

  if (isYvBtcAddress(currentVault.address)) {
    addTenderlyOverrideToken(tokens, YVBTC_UNLOCKED_ADDRESS, currentVault.chainID, {
      decimals: currentVault.decimals,
      name: currentVault.name,
      symbol: currentVault.symbol,
      isVaultToken: true
    })
    addTenderlyOverrideToken(tokens, YVBTC_LOCKED_ADDRESS, currentVault.chainID, {
      decimals: currentVault.decimals,
      name: currentVault.name,
      symbol: currentVault.symbol,
      isVaultToken: true
    })
  }

  return [...tokens.values()]
}

function getTenderlyVaultOverrideRefreshKey({
  account,
  currentVault,
  stakingAddress
}: {
  account: TAddress
  currentVault: TTenderlyVaultBalanceOverrideVault
  stakingAddress?: TAddress
}): string {
  return [account, currentVault.chainID, currentVault.address, currentVault.token.address, stakingAddress ?? ''].join(
    ':'
  )
}

export function useTenderlyVaultBalanceOverrides({
  account,
  currentVault,
  onRefresh,
  stakingAddress
}: TUseTenderlyVaultBalanceOverridesProps): void {
  const refreshKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isTenderlyModeEnabled() || !account || !currentVault) {
      return
    }

    const refreshKey = getTenderlyVaultOverrideRefreshKey({ account, currentVault, stakingAddress })
    if (refreshKeyRef.current === refreshKey) {
      return
    }
    refreshKeyRef.current = refreshKey

    const tokensToRefresh = getVaultTenderlyOverrideTokens({
      currentVault,
      stakingAddress
    })
    if (tokensToRefresh.length === 0) {
      return
    }

    void onRefresh(tokensToRefresh).catch((error) => {
      console.error('Failed to refresh Tenderly vault override balances:', error)
      refreshKeyRef.current = null
    })
  }, [account, currentVault, onRefresh, stakingAddress])
}
