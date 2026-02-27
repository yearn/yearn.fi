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
import { useDeepCompareMemo } from '@react-hookz/web'
import { useTokenList } from '@shared/contexts/WithTokenList'
import type { TUseBalancesTokens } from '@shared/hooks/useBalances.multichains'
import { useChainID } from '@shared/hooks/useChainID'
import type { TDict } from '@shared/types'
import { isZeroAddress, toAddress } from '@shared/utils'
import { ETH_TOKEN_ADDRESS } from '@shared/utils/constants'
import { getNetwork } from '@shared/utils/wagmi'
import { useMemo } from 'react'

export function useYearnTokens({
  vaults,
  isLoadingVaultList,
  isEnabled = true
}: {
  vaults: TDict<TKongVault>
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
        { chainID: 747474, address: ETH_TOKEN_ADDRESS, decimals: 18, name: 'Ether', symbol: 'ETH' }
      ]
    )

    for (const token of extraTokens) {
      const key = `${token.chainID}/${toAddress(token.address)}`
      tokens[key] = token
    }

    const vaultAddressKeys = new Set(
      allVaults.map((vault) => `${getVaultChainID(vault)}/${toAddress(getVaultAddress(vault))}`)
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
      const hasStaking = !isZeroAddress(staking.address)
      const stakingAddress = hasStaking ? toAddress(staking.address) : undefined
      const isVaultBackedStaking = hasStaking ? vaultAddressKeys.has(`${chainID}/${toAddress(staking.address)}`) : false
      const isStakingOnlyPair = hasStaking && !isVaultBackedStaking
      const vaultKey = `${chainID}/${address}`

      if (!tokens[vaultKey]) {
        tokens[vaultKey] = {
          address,
          chainID,
          symbol,
          decimals,
          name,
          for: 'vault',
          isVaultToken: true,
          isStakingOnlyPair: hasStaking ? isStakingOnlyPair : undefined,
          isVaultBackedStaking: hasStaking ? isVaultBackedStaking : undefined,
          pairedStakingAddress: stakingAddress
        }
      } else {
        const existingToken = tokens[vaultKey]

        if (existingToken) {
          if (!existingToken?.name && name) {
            tokens[vaultKey].name = name
          }
          if (!existingToken?.symbol && symbol) {
            tokens[vaultKey].symbol = symbol
          }
          if (!existingToken?.decimals && decimals) {
            tokens[vaultKey].decimals = decimals
          }
          if (!existingToken?.for) {
            tokens[vaultKey].for = 'vault'
          }
          tokens[vaultKey].isVaultToken = true
          if (!existingToken?.pairedStakingAddress && stakingAddress) {
            tokens[vaultKey].pairedStakingAddress = stakingAddress
          }
          if (isStakingOnlyPair) {
            tokens[vaultKey].isStakingOnlyPair = true
          }
          if (isVaultBackedStaking) {
            tokens[vaultKey].isVaultBackedStaking = true
          }
        }
      }

      if (token.address && !availableTokenListTokens.some((item) => item.address === token.address)) {
        tokens[`${chainID}/${toAddress(token.address)}`] = {
          address: token.address,
          chainID,
          decimals: token.decimals
        }
      }

      if (stakingAddress) {
        const stakingKey = `${chainID}/${stakingAddress}`
        if (!tokens[stakingKey]) {
          tokens[stakingKey] = {
            address: stakingAddress,
            chainID,
            symbol,
            decimals,
            name,
            for: 'staking',
            isStakingToken: true,
            isStakingOnlyPair,
            isVaultBackedStaking,
            pairedVaultAddress: address
          }
        } else {
          const existingToken = tokens[stakingKey]
          if (existingToken) {
            if (!existingToken?.name && name) {
              tokens[stakingKey].name = name
            }
            if (!existingToken?.symbol && symbol) {
              tokens[stakingKey].symbol = symbol
            }
            if (!existingToken?.decimals && decimals) {
              tokens[stakingKey].decimals = decimals
            }
            if (!existingToken?.for) {
              tokens[stakingKey].for = 'staking'
            }
            tokens[stakingKey].isStakingToken = true
            if (!existingToken?.pairedVaultAddress) {
              tokens[stakingKey].pairedVaultAddress = address
            }
            if (isStakingOnlyPair) {
              tokens[stakingKey].isStakingOnlyPair = true
            }
            if (isVaultBackedStaking) {
              tokens[stakingKey].isVaultBackedStaking = true
            }
          }
        }
      }
    })

    return tokens
  }, [isEnabled, isLoadingVaultList, allVaults, availableTokenListTokens])

  const allTokens = useDeepCompareMemo((): TUseBalancesTokens[] => {
    if (!isEnabled || isLoadingVaultList) {
      return []
    }
    const fromAvailableTokens = Object.values(availableTokens)
    return [...fromAvailableTokens, ...availableTokenListTokens]
  }, [isEnabled, isLoadingVaultList, availableTokens, availableTokenListTokens])

  function cloneForForknet(tokens: TUseBalancesTokens[]): TUseBalancesTokens[] {
    const clonedTokens: TUseBalancesTokens[] = []
    tokens.forEach((token): void => {
      clonedTokens.push({ ...token })
      if (token.chainID === 1) {
        clonedTokens.push({ ...token, chainID: 1337 })
      }
    })
    return clonedTokens
  }

  const finalTokens = useDeepCompareMemo((): TUseBalancesTokens[] => {
    const shouldEnableForknet = false
    if (shouldEnableForknet) {
      return cloneForForknet(allTokens)
    }
    return allTokens
  }, [allTokens])

  return finalTokens
}
