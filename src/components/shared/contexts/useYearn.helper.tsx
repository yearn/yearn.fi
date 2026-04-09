'use client'

import {
  getVaultAddress,
  getVaultChainID,
  getVaultDecimals,
  getVaultName,
  getVaultStaking,
  getVaultSymbol,
  getVaultToken,
  type TKongVault
} from '@pages/vaults/domain/kongVaultSelectors'
import { getHoldingsAliasVaultAddress } from '@pages/vaults/domain/normalizeVault'
import { YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { useDeepCompareMemo } from '@react-hookz/web'
import { useTokenList } from '@shared/contexts/WithTokenList'
import type { TUseBalancesTokens } from '@shared/hooks/useBalances.multichains'
import { useChainID } from '@shared/hooks/useChainID'
import type { TDict } from '@shared/types'
import { isZeroAddress, toAddress } from '@shared/utils'
import { ETH_TOKEN_ADDRESS } from '@shared/utils/constants'
import { getNetwork } from '@shared/utils/wagmi'
import { useMemo } from 'react'

function mergeTokenMetadata(existing: TUseBalancesTokens, incoming: TUseBalancesTokens): TUseBalancesTokens {
  return {
    address: existing.address || incoming.address,
    chainID: existing.chainID || incoming.chainID,
    decimals: existing.decimals || incoming.decimals,
    name: existing.name || incoming.name,
    symbol: existing.symbol || incoming.symbol,
    for: existing.for || incoming.for,
    isVaultToken: Boolean(existing.isVaultToken || incoming.isVaultToken) || undefined,
    isStakingToken: Boolean(existing.isStakingToken || incoming.isStakingToken) || undefined,
    isCatalogVault:
      existing.isCatalogVault === false || incoming.isCatalogVault === false
        ? false
        : (existing.isCatalogVault ?? incoming.isCatalogVault),
    isStakingOnlyPair: Boolean(existing.isStakingOnlyPair || incoming.isStakingOnlyPair) || undefined,
    isVaultBackedStaking: Boolean(existing.isVaultBackedStaking || incoming.isVaultBackedStaking) || undefined,
    holdingsAliasVaultAddress: existing.holdingsAliasVaultAddress || incoming.holdingsAliasVaultAddress,
    pairedVaultAddress: existing.pairedVaultAddress || incoming.pairedVaultAddress,
    pairedStakingAddress: existing.pairedStakingAddress || incoming.pairedStakingAddress
  }
}

function upsertToken(tokens: TDict<TUseBalancesTokens>, key: string, incoming: TUseBalancesTokens): void {
  const existing = tokens[key]
  tokens[key] = existing ? mergeTokenMetadata(existing, incoming) : incoming
}

export function useYearnTokens({
  vaults,
  catalogVaults,
  isLoadingVaultList,
  isEnabled = true
}: {
  vaults: TDict<TKongVault>
  catalogVaults?: TDict<TKongVault>
  isLoadingVaultList: boolean
  isEnabled?: boolean
}): TUseBalancesTokens[] {
  const { currentNetworkTokenList } = useTokenList()

  const { safeChainID } = useChainID()
  const allVaults = useMemo((): TKongVault[] => {
    if (!isEnabled) {
      return []
    }
    return [...Object.values(vaults)]
  }, [isEnabled, vaults])

  const availableTokenListTokens = useDeepCompareMemo((): TUseBalancesTokens[] => {
    if (!isEnabled) {
      return []
    }
    const withTokenList = [...Object.values(currentNetworkTokenList)]
    const tokens: TUseBalancesTokens[] = []
    withTokenList.forEach((token): void => {
      tokens.push({
        address: toAddress(token.address),
        chainID: token.chainID,
        decimals: Number(token.decimals),
        name: token.name,
        symbol: token.symbol
      })
    })

    const { nativeCurrency } = getNetwork(safeChainID)
    if (nativeCurrency) {
      tokens.push({
        address: toAddress(ETH_TOKEN_ADDRESS),
        chainID: safeChainID,
        decimals: nativeCurrency.decimals,
        name: nativeCurrency.name,
        symbol: nativeCurrency.symbol
      })
    }
    return tokens
  }, [isEnabled, safeChainID, currentNetworkTokenList])

  const availableTokens = useMemo((): TDict<TUseBalancesTokens> => {
    if (!isEnabled || isLoadingVaultList) {
      return {}
    }
    const tokens: TDict<TUseBalancesTokens> = {}
    const extraTokens: TUseBalancesTokens[] = []
    extraTokens.push(
      ...[
        { chainID: 1, address: ETH_TOKEN_ADDRESS, decimals: 18, name: 'Ether', symbol: 'ETH' },
        { chainID: 10, address: ETH_TOKEN_ADDRESS, decimals: 18, name: 'Ether', symbol: 'ETH' },
        { chainID: 137, address: ETH_TOKEN_ADDRESS, decimals: 18, name: 'Matic', symbol: 'POL' },
        { chainID: 250, address: ETH_TOKEN_ADDRESS, decimals: 18, name: 'Fantom', symbol: 'FTM' },
        { chainID: 8453, address: ETH_TOKEN_ADDRESS, decimals: 18, name: 'Ether', symbol: 'ETH' },
        { chainID: 42161, address: ETH_TOKEN_ADDRESS, decimals: 18, name: 'Ether', symbol: 'ETH' },
        { chainID: 747474, address: ETH_TOKEN_ADDRESS, decimals: 18, name: 'Ether', symbol: 'ETH' },
        { chainID: YVUSD_CHAIN_ID, address: YVUSD_UNLOCKED_ADDRESS, decimals: 18, name: 'yvUSD', symbol: 'yvUSD' },
        {
          chainID: YVUSD_CHAIN_ID,
          address: YVUSD_LOCKED_ADDRESS,
          decimals: 18,
          name: 'yvUSD (Locked)',
          symbol: 'yvUSD'
        }
      ]
    )

    for (const token of extraTokens) {
      const key = `${token.chainID}/${toAddress(token.address)}`
      tokens[key] = token
    }

    const tokenListAddressSet = new Set(
      availableTokenListTokens.map((token) => `${token.chainID}/${toAddress(token.address)}`)
    )

    const vaultAddressKeys = new Set(
      allVaults.map((vault) => `${getVaultChainID(vault)}/${toAddress(getVaultAddress(vault))}`)
    )
    const catalogVaultKeys = new Set(
      Object.values(catalogVaults ?? {}).map(
        (vault) => `${getVaultChainID(vault)}/${toAddress(getVaultAddress(vault))}`
      )
    )

    allVaults.forEach((vault?: TKongVault): void => {
      if (!vault) {
        return
      }

      const chainID = getVaultChainID(vault)
      const address = toAddress(getVaultAddress(vault))
      const name = getVaultName(vault)
      const symbol = getVaultSymbol(vault)
      const decimals = getVaultDecimals(vault)
      const token = getVaultToken(vault)
      const staking = getVaultStaking(vault)
      const vaultKey = `${chainID}/${address}`
      const holdingsAliasVaultAddress = getHoldingsAliasVaultAddress(address)
      const stakingAddress = !isZeroAddress(toAddress(staking.address)) ? toAddress(staking.address) : undefined
      const hasStaking = Boolean(stakingAddress)
      const isVaultBackedStaking = hasStaking ? vaultAddressKeys.has(`${chainID}/${stakingAddress}`) : false
      const isStakingOnlyPair = hasStaking && !isVaultBackedStaking

      upsertToken(tokens, vaultKey, {
        address,
        chainID,
        symbol,
        decimals,
        name,
        for: 'vault-share',
        isVaultToken: true,
        isCatalogVault: catalogVaultKeys.has(vaultKey),
        isStakingOnlyPair: hasStaking ? isStakingOnlyPair : undefined,
        isVaultBackedStaking: hasStaking ? isVaultBackedStaking : undefined,
        holdingsAliasVaultAddress,
        pairedStakingAddress: stakingAddress
      })

      if (token.address) {
        const vaultAssetTokenKey = `${chainID}/${toAddress(token.address)}`
        if (!tokenListAddressSet.has(vaultAssetTokenKey)) {
          upsertToken(tokens, vaultAssetTokenKey, {
            address: token.address,
            chainID,
            decimals: token.decimals,
            name: token.name,
            symbol: token.symbol
          })
        }
      }

      if (stakingAddress) {
        const stakingKey = `${chainID}/${stakingAddress}`
        upsertToken(tokens, stakingKey, {
          address: stakingAddress,
          chainID,
          symbol,
          decimals,
          name,
          for: 'vault-staking',
          isStakingToken: true,
          isCatalogVault: catalogVaultKeys.has(stakingKey),
          isStakingOnlyPair,
          isVaultBackedStaking,
          holdingsAliasVaultAddress: getHoldingsAliasVaultAddress(stakingAddress),
          pairedVaultAddress: address
        })
      }
    })

    return tokens
  }, [isEnabled, isLoadingVaultList, allVaults, availableTokenListTokens, catalogVaults])

  const allTokens = useDeepCompareMemo((): TUseBalancesTokens[] => {
    if (!isEnabled || isLoadingVaultList) {
      return []
    }
    const fromAvailableTokens = Object.values(availableTokens)
    const tokens = [...fromAvailableTokens, ...availableTokenListTokens]
    return tokens
  }, [isEnabled, isLoadingVaultList, availableTokens, availableTokenListTokens])

  return allTokens
}
