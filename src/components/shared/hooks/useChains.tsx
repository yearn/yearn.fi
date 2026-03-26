import { useCustomCompareMemo, useDeepCompareMemo } from '@react-hookz/web'
import type { TMultiSelectOptionProps } from '@shared/components/MultiSelectDropdown'
import { SUPPORTED_NETWORKS } from '@shared/utils/constants'
import type { Chain } from 'viem'
import type { Connector } from 'wagmi'
import { useConnect } from 'wagmi'

export function useChainOptions(chains: number[] | null): TMultiSelectOptionProps[] {
  const { connectors } = useConnect()

  const injectedChains = useCustomCompareMemo(
    (): Chain[] | undefined => {
      connectors //Hard trigger re-render when connectors change
      return SUPPORTED_NETWORKS as Chain[]
    },
    [[...connectors]],
    (savedDeps: [Connector[]], deps: [Connector[]]): boolean => {
      for (const savedDep of savedDeps[0]) {
        if (!deps[0].find((dep): boolean => dep.id === savedDep.id)) {
          return false
        }
      }
      return true
    }
  )

  const options = useDeepCompareMemo((): TMultiSelectOptionProps[] => {
    const _options = []
    for (const chain of injectedChains || []) {
      _options.push({
        label: chain.name,
        value: chain.id,
        isSelected: chains?.includes(chain.id) || false,
        icon: (
          <img src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/chains/${chain.id}/logo-128.png`} alt={chain.name} />
        )
      })
    }
    return _options
  }, [injectedChains, chains])

  return options
}
