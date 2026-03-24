import {
  getVaultAddress,
  getVaultChainID,
  getVaultStaking,
  getVaultToken,
  type TKongVaultInput
} from '@pages/vaults/domain/kongVaultSelectors'
import { YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import type { TDict, TToken } from '@shared/types'
import { isZeroAddress, toAddress } from '@shared/utils'
import type { Address } from 'viem'

export type TTokenSelectorMode = 'default' | 'deposit' | 'withdraw'

type TGetPrice = (props: { address: Address; chainID: number }) => { normalized: number }
const MIN_SELECTOR_USD_VALUE = 0.01

function toAddressSet(addresses: Array<string | undefined>): Set<string> {
  return new Set(
    addresses.flatMap((address) => {
      if (!address) {
        return []
      }

      return [toAddress(address).toLowerCase()]
    })
  )
}

export function getYearnKnownTokenAddresses({
  chainId,
  chainTokenList,
  allVaults
}: {
  chainId: number
  chainTokenList?: TDict<TToken>
  allVaults: TDict<TKongVaultInput>
}): Set<string> {
  const knownAddresses = new Set<string>(
    Object.keys(chainTokenList || {}).map((address) => toAddress(address).toLowerCase())
  )

  Object.values(allVaults).forEach((vault) => {
    if (getVaultChainID(vault) !== chainId) {
      return
    }

    knownAddresses.add(toAddress(getVaultAddress(vault)).toLowerCase())
    knownAddresses.add(toAddress(getVaultToken(vault).address).toLowerCase())

    const stakingAddress = toAddress(getVaultStaking(vault).address)
    if (!isZeroAddress(stakingAddress)) {
      knownAddresses.add(stakingAddress.toLowerCase())
    }
  })

  if (chainId === YVUSD_CHAIN_ID) {
    knownAddresses.add(YVUSD_UNLOCKED_ADDRESS.toLowerCase())
    knownAddresses.add(YVUSD_LOCKED_ADDRESS.toLowerCase())
  }

  return knownAddresses
}

export function getExplicitTokenAddresses({
  value,
  priorityTokenAddresses,
  chainExtraTokens,
  currentTokenAddresses,
  customAddress
}: {
  value?: Address
  priorityTokenAddresses?: Address[]
  chainExtraTokens?: TToken[]
  currentTokenAddresses?: Array<Address | undefined>
  customAddress?: Address
}): Set<string> {
  return toAddressSet([
    value,
    ...(priorityTokenAddresses || []),
    ...((chainExtraTokens || []).map((token) => token.address as Address) || []),
    ...(currentTokenAddresses || []),
    customAddress
  ])
}

export function getDepositMinValueExemptTokenAddresses({
  value,
  chainExtraTokens,
  assetAddress,
  selectedChainId,
  assetChainId,
  customAddress
}: {
  value?: Address
  chainExtraTokens?: TToken[]
  assetAddress?: Address
  selectedChainId: number
  assetChainId: number
  customAddress?: Address
}): Set<string> {
  return getExplicitTokenAddresses({
    value,
    chainExtraTokens,
    currentTokenAddresses: selectedChainId === assetChainId ? [assetAddress] : [],
    customAddress
  })
}

export function getDerivedTokenUsdValue({ token, getPrice }: { token: TToken; getPrice: TGetPrice }): number {
  if (Number.isFinite(token.value) && token.value > 0) {
    return token.value
  }

  if (!Number.isFinite(token.balance.normalized) || token.balance.normalized <= 0) {
    return 0
  }

  const tokenPrice = getPrice({
    address: toAddress(token.address) as Address,
    chainID: token.chainID
  }).normalized
  if (!Number.isFinite(tokenPrice) || tokenPrice <= 0) {
    return 0
  }

  return token.balance.normalized * tokenPrice
}

export function filterAndSortTokenSelectorTokens({
  tokens,
  mode,
  limitTokens,
  excludeTokens,
  searchText,
  yearnKnownTokenAddresses,
  explicitTokenAddresses,
  minValueExemptTokenAddresses,
  topTokenAddresses,
  getTokenUsdValue
}: {
  tokens: TToken[]
  mode?: TTokenSelectorMode
  limitTokens?: Address[]
  excludeTokens?: Address[]
  searchText?: string
  yearnKnownTokenAddresses?: Set<string>
  explicitTokenAddresses?: Set<string>
  minValueExemptTokenAddresses?: Set<string>
  topTokenAddresses?: Address[]
  getTokenUsdValue: (token: TToken) => number
}): TToken[] {
  const normalizedLimitTokens = toAddressSet(limitTokens || [])
  const normalizedExcludeTokens = toAddressSet(excludeTokens || [])
  const normalizedSearchText = searchText?.trim().toLowerCase() || ''
  const knownAddresses = yearnKnownTokenAddresses || new Set<string>()
  const explicitAddresses = explicitTokenAddresses || new Set<string>()
  const minValueExemptAddresses = minValueExemptTokenAddresses || explicitAddresses
  const topTokenIndex = new Map(
    (topTokenAddresses || []).map((address, index) => [toAddress(address).toLowerCase(), index] as const)
  )

  return tokens
    .map((token) => ({
      token,
      address: toAddress(token.address).toLowerCase(),
      usdValue: getTokenUsdValue(token),
      rawBalance: token.balance.raw,
      topIndex: topTokenIndex.get(toAddress(token.address).toLowerCase()) ?? Number.POSITIVE_INFINITY
    }))
    .filter(({ token, address, usdValue }) => {
      const shouldKeepKnownUnpricedDepositToken =
        mode === 'deposit' && usdValue <= 0 && token.balance.raw > 0n && knownAddresses.has(address)

      if (normalizedLimitTokens.size > 0 && !normalizedLimitTokens.has(address)) {
        return false
      }

      if (normalizedExcludeTokens.has(address)) {
        return false
      }

      if (
        (mode === 'deposit' || mode === 'withdraw') &&
        usdValue < MIN_SELECTOR_USD_VALUE &&
        !minValueExemptAddresses.has(address) &&
        !shouldKeepKnownUnpricedDepositToken
      ) {
        return false
      }

      if (mode === 'deposit' && usdValue <= 0 && !knownAddresses.has(address) && !explicitAddresses.has(address)) {
        return false
      }

      if (!normalizedSearchText) {
        return true
      }

      return (
        token.symbol?.toLowerCase().includes(normalizedSearchText) ||
        token.name?.toLowerCase().includes(normalizedSearchText) ||
        address.includes(normalizedSearchText)
      )
    })
    .sort((a, b) => {
      if (a.topIndex !== b.topIndex) {
        return a.topIndex - b.topIndex
      }

      if (a.usdValue !== b.usdValue) {
        return b.usdValue - a.usdValue
      }

      if (a.rawBalance !== b.rawBalance) {
        return a.rawBalance > b.rawBalance ? -1 : 1
      }

      return a.address.localeCompare(b.address)
    })
    .map(({ token }) => token)
}
