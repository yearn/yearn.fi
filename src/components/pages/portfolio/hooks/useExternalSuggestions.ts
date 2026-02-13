import { EXTERNAL_TOKENS } from '@pages/portfolio/constants/externalTokens'
import { useExternalApys } from '@pages/portfolio/hooks/useExternalApys'
import { useExternalTokenBalances } from '@pages/portfolio/hooks/useExternalTokenBalances'
import { useYearn } from '@shared/contexts/useYearn'
import { getVaultKey } from '@shared/hooks/useVaultFilterUtils'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { useMemo } from 'react'

export type TExternalSuggestion = {
  vault: TYDaemonVault
  externalProtocol: string
  externalApy: number
  yearnApy: number
  underlyingSymbol: string
}

function getYearnVaultApy(vault: TYDaemonVault): number {
  return vault.apr?.forwardAPR?.netAPR || vault.apr?.netAPR || 0
}

export function useExternalSuggestions(holdingsKeySet: Set<string>): {
  suggestions: TExternalSuggestion[]
  isLoading: boolean
} {
  const balanceMap = useExternalTokenBalances()
  const { vaults } = useYearn()

  const detectedTokens = useMemo(
    () => EXTERNAL_TOKENS.filter((token) => balanceMap.has(`${token.chainId}:${token.address.toLowerCase()}`)),
    [balanceMap]
  )

  const { apyMap, isLoading } = useExternalApys(detectedTokens)

  const suggestions = useMemo(() => {
    if (detectedTokens.length === 0) return []

    const bestVaultByUnderlying = Object.values(vaults)
      .filter((vault) => {
        if (Boolean(vault.info?.isHidden) || Boolean(vault.info?.isRetired) || Boolean(vault.migration?.available))
          return false
        if ((vault.tvl?.tvl ?? 0) <= 0) return false
        if (holdingsKeySet.has(getVaultKey(vault))) return false
        return (vault.token.symbol ?? '').toUpperCase() !== ''
      })
      .reduce((acc, vault) => {
        const mapKey = `${vault.chainID}:${(vault.token.symbol ?? '').toUpperCase()}`
        const existing = acc.get(mapKey)
        if (!existing || (vault.tvl?.tvl ?? 0) > (existing.tvl?.tvl ?? 0)) {
          acc.set(mapKey, vault)
        }
        return acc
      }, new Map<string, TYDaemonVault>())

    return detectedTokens
      .flatMap((token) => {
        const externalApy = apyMap[`${token.chainId}:${token.address.toLowerCase()}`]
        if (typeof externalApy !== 'number') return []

        const symbolsToCheck =
          token.underlyingSymbol.toUpperCase() === 'WETH' ? ['WETH', 'ETH'] : [token.underlyingSymbol.toUpperCase()]

        const bestVault = symbolsToCheck
          .map((sym) => bestVaultByUnderlying.get(`${token.chainId}:${sym}`))
          .filter((v): v is TYDaemonVault => v !== undefined)
          .sort((a, b) => (b.tvl?.tvl ?? 0) - (a.tvl?.tvl ?? 0))[0]

        if (!bestVault) return []

        const yearnApy = getYearnVaultApy(bestVault)
        if (yearnApy <= externalApy) return []

        return [
          {
            vault: bestVault,
            externalProtocol: token.protocol,
            externalApy,
            yearnApy,
            underlyingSymbol: token.underlyingSymbol
          }
        ]
      })
      .sort((a, b) => b.yearnApy - b.externalApy - (a.yearnApy - a.externalApy))
      .slice(0, 2)
  }, [detectedTokens, apyMap, vaults, holdingsKeySet])

  return { suggestions, isLoading }
}
