import { useTokenList } from '@lib/contexts/WithTokenList'
import type { TUseBalancesTokens } from '@lib/hooks/useBalances.multichains'
import { useChainID } from '@lib/hooks/useChainID'
import type { TDict } from '@lib/types'
import { toAddress } from '@lib/utils'
import { ETH_TOKEN_ADDRESS } from '@lib/utils/constants'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { getNetwork } from '@lib/utils/wagmi'
import { useDeepCompareMemo } from '@react-hookz/web'
import { useMemo, useState } from 'react'

export function useYearnTokens({
  vaults,
  vaultsMigrations,
  vaultsRetired,
  isLoadingVaultList
}: {
  vaults: TDict<TYDaemonVault>
  vaultsMigrations: TDict<TYDaemonVault>
  vaultsRetired: TDict<TYDaemonVault>
  isLoadingVaultList: boolean
}): TUseBalancesTokens[] {
  const { currentNetworkTokenList } = useTokenList()

  const { safeChainID } = useChainID()
  const [isReady, setIsReady] = useState(false)
  const allVaults = useMemo(
    (): TYDaemonVault[] => [
      ...Object.values(vaults),
      ...Object.values(vaultsMigrations),
      ...Object.values(vaultsRetired)
    ],
    [vaults, vaultsMigrations, vaultsRetired]
  )

  /**************************************************************************
   ** Define the list of available tokens. This list is retrieved from the
   ** tokenList context and filtered to only keep the tokens of the current
   ** network.
   **************************************************************************/
  const availableTokenListTokens = useDeepCompareMemo((): TUseBalancesTokens[] => {
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
  }, [safeChainID, currentNetworkTokenList])

  //List available tokens
  const availableTokens = useMemo((): TDict<TUseBalancesTokens> => {
    if (isLoadingVaultList) {
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

    allVaults.forEach((vault?: TYDaemonVault): void => {
      if (!vault) {
        return
      }

      if (vault?.address && !tokens[`${vault.chainID}/${toAddress(vault.address)}`]) {
        const newToken = {
          address: vault.address,
          chainID: vault.chainID,
          symbol: vault.symbol,
          decimals: vault.decimals,
          name: vault.name
        }

        tokens[`${vault.chainID}/${toAddress(vault.address)}`] = newToken
      } else {
        const existingToken = tokens[`${vault.chainID}/${toAddress(vault.address)}`]

        if (existingToken) {
          if (!existingToken?.name && vault.name) {
            tokens[`${vault.chainID}/${toAddress(vault.address)}`].name = vault.name
          }
          if (!existingToken?.symbol && vault.symbol) {
            tokens[`${vault.chainID}/${toAddress(vault.address)}`].symbol = vault.symbol
          }
          if (!existingToken?.decimals && vault.decimals) {
            tokens[`${vault.chainID}/${toAddress(vault.address)}`].decimals = vault.decimals
          }
        }
      }

      // Add vaults tokens
      if (vault?.token?.address && !availableTokenListTokens.some((token) => token.address === vault.token.address)) {
        const newToken = {
          address: vault.token.address,
          chainID: vault.chainID,

          decimals: vault.decimals
        }

        tokens[`${vault.chainID}/${toAddress(vault?.token.address)}`] = newToken
      }

      // Add staking token
      if (vault?.staking?.available && !tokens[`${vault.chainID}/${toAddress(vault?.staking.address)}`]) {
        const newToken = {
          address: toAddress(vault?.staking?.address),
          chainID: vault.chainID,
          symbol: vault.symbol,
          decimals: vault.decimals,
          name: vault.name
        }
        tokens[`${vault.chainID}/${toAddress(vault?.staking.address)}`] = newToken
      } else {
        const existingToken = tokens[`${vault.chainID}/${toAddress(vault?.staking.address)}`]
        if (existingToken) {
          if (!existingToken?.name && vault.name) {
            tokens[`${vault.chainID}/${toAddress(vault?.staking.address)}`].name = vault.name
          }
          if (!existingToken?.symbol && vault.symbol) {
            tokens[`${vault.chainID}/${toAddress(vault?.staking.address)}`].symbol = vault.symbol
          }
          if (!existingToken?.decimals && vault.decimals) {
            tokens[`${vault.chainID}/${toAddress(vault?.staking.address)}`].decimals = vault.decimals
          }
        }
      }
    })

    setIsReady(true)
    return tokens
  }, [isLoadingVaultList, allVaults, availableTokenListTokens])

  const allTokens = useDeepCompareMemo((): TUseBalancesTokens[] => {
    if (!isReady) {
      return []
    }
    const fromAvailableTokens = Object.values(availableTokens)
    const tokens = [...fromAvailableTokens, ...availableTokenListTokens]
    return tokens
  }, [isReady, availableTokens, availableTokenListTokens])

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
