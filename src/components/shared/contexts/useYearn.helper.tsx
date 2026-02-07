import { useDeepCompareMemo } from '@react-hookz/web'
import { useTokenList } from '@shared/contexts/WithTokenList'
import type { TUseBalancesTokens } from '@shared/hooks/useBalances.multichains'
import { useChainID } from '@shared/hooks/useChainID'
import type { TDict } from '@shared/types'
import { isZeroAddress, toAddress } from '@shared/utils'
import { ETH_TOKEN_ADDRESS } from '@shared/utils/constants'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { getNetwork } from '@shared/utils/wagmi'
import { useMemo } from 'react'

export function useYearnTokens({
  vaults,
  isLoadingVaultList,
  isEnabled = true
}: {
  vaults: TDict<TYDaemonVault>
  isLoadingVaultList: boolean
  isEnabled?: boolean
}): TUseBalancesTokens[] {
  const { currentNetworkTokenList } = useTokenList()

  const { safeChainID } = useChainID()
  const allVaults = useMemo((): TYDaemonVault[] => {
    if (!isEnabled) {
      return []
    }
    return [...Object.values(vaults)]
  }, [isEnabled, vaults])

  /**************************************************************************
   ** Define the list of available tokens. This list is retrieved from the
   ** tokenList context and filtered to only keep the tokens of the current
   ** network.
   **************************************************************************/
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

  //List available tokens
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

    const vaultAddressKeys = new Set(allVaults.map((vault) => `${vault.chainID}/${toAddress(vault.address)}`))

    allVaults.forEach((vault?: TYDaemonVault): void => {
      if (!vault) {
        return
      }

      const chainID = vault.chainID
      const address = toAddress(vault.address)
      const name = vault.name
      const symbol = vault.symbol
      const decimals = vault.decimals
      const vaultKey = `${chainID}/${address}`
      const stakingAddress = !isZeroAddress(toAddress(vault.staking.address)) ? toAddress(vault.staking.address) : undefined
      const hasStaking = Boolean(stakingAddress)
      const isVaultBackedStaking = hasStaking ? vaultAddressKeys.has(`${chainID}/${stakingAddress}`) : false
      const isStakingOnlyPair = hasStaking && !isVaultBackedStaking

      if (!tokens[vaultKey]) {
        const newToken = {
          address,
          chainID,
          symbol,
          decimals,
          name,
          for: 'vault-share',
          isVaultToken: true,
          isStakingOnlyPair: hasStaking ? isStakingOnlyPair : undefined,
          isVaultBackedStaking: hasStaking ? isVaultBackedStaking : undefined,
          pairedStakingAddress: stakingAddress
        }

        tokens[vaultKey] = newToken
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
            tokens[vaultKey].for = 'vault-share'
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

      // Add vaults tokens
      if (vault?.token?.address && !availableTokenListTokens.some((token) => token.address === vault.token.address)) {
        const newToken = {
          address: vault.token.address,
          chainID: vault.chainID,
          decimals: vault.token.decimals
        }

        tokens[`${vault.chainID}/${toAddress(vault?.token.address)}`] = newToken
      }

      // Add staking token
      if (stakingAddress && !tokens[`${chainID}/${stakingAddress}`]) {
        const newToken = {
          address: stakingAddress,
          chainID,
          symbol,
          decimals,
          name,
          for: 'vault-staking',
          isStakingToken: true,
          isStakingOnlyPair,
          isVaultBackedStaking,
          pairedVaultAddress: address
        }
        tokens[`${chainID}/${stakingAddress}`] = newToken
      } else if (stakingAddress) {
        const existingToken = tokens[`${chainID}/${stakingAddress}`]
        if (existingToken) {
          if (!existingToken?.name && name) {
            tokens[`${chainID}/${stakingAddress}`].name = name
          }
          if (!existingToken?.symbol && symbol) {
            tokens[`${chainID}/${stakingAddress}`].symbol = symbol
          }
          if (!existingToken?.decimals && decimals) {
            tokens[`${chainID}/${stakingAddress}`].decimals = decimals
          }
          if (!existingToken?.for) {
            tokens[`${chainID}/${stakingAddress}`].for = 'vault-staking'
          }
          tokens[`${chainID}/${stakingAddress}`].isStakingToken = true
          if (!existingToken?.pairedVaultAddress) {
            tokens[`${chainID}/${stakingAddress}`].pairedVaultAddress = address
          }
          if (isStakingOnlyPair) {
            tokens[`${chainID}/${stakingAddress}`].isStakingOnlyPair = true
          }
          if (isVaultBackedStaking) {
            tokens[`${chainID}/${stakingAddress}`].isVaultBackedStaking = true
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
    const tokens = [...fromAvailableTokens, ...availableTokenListTokens]
    return tokens
  }, [isEnabled, isLoadingVaultList, availableTokens, availableTokenListTokens])

  /**************************************************************************************************
   ** The following function can be used to clone the tokens list for the forknet. This is useful
   ** for debuging purpose and should not be used in production.
   *************************************************************************************************/
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

  // Use deep compare memo for the final result to ensure stability
  const finalTokens = useDeepCompareMemo((): TUseBalancesTokens[] => {
    const shouldEnableForknet = false
    if (shouldEnableForknet) {
      return cloneForForknet(allTokens)
    }
    // console.log('useYearnTokens returning tokens, count:', allTokens.length)
    return allTokens
  }, [allTokens])

  return finalTokens
}
