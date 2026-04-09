'use client'

import { useCustomCompareMemo, useDeepCompareMemo } from '@react-hookz/web'
import type { TMultiSelectOptionProps } from '@shared/components/MultiSelectDropdown'

import type { Chain } from 'viem'
import type { Connector } from 'wagmi'
import { useConfig, useConnect } from 'wagmi'

export function useChainOptions(chains: number[] | null): TMultiSelectOptionProps[] {
  const { connectors } = useConnect()
  const config = useConfig()

  const injectedChains = useCustomCompareMemo(
    (): Chain[] | undefined => {
      connectors //Hard trigger re-render when connectors change
      return [...config.chains]
    },
    [[...connectors], config],
    (savedDeps: [Connector[], typeof config], deps: [Connector[], typeof config]): boolean => {
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
          <img src={`${process.env.NEXT_PUBLIC_BASE_YEARN_ASSETS_URI}/chains/${chain.id}/logo-128.png`} alt={chain.name} />
        )
      })
    }
    return _options
  }, [injectedChains, chains])

  return options
}
