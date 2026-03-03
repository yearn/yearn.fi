import { KATANA_CHAIN_ID, SPLITTER_ROUTES } from '@pages/vaults/constants/addresses'
import { yieldSplitterAbi } from '@pages/vaults/contracts/yieldSplitter.abi'
import type { TSplitterPosition, TSplitterWantToken } from '@pages/vaults/types/splitter'
import { useYearn } from '@shared/contexts/useYearn'
import { useMemo } from 'react'
import { type Address, formatUnits } from 'viem'
import { useAccount, useChainId, useReadContracts } from 'wagmi'
import { useSplitterRoutes } from './useSplitterRoutes'

export const useSplitterPositions = () => {
  const { address: account } = useAccount()
  const chainId = useChainId()
  const { getPrice } = useYearn()
  const isKatana = chainId === KATANA_CHAIN_ID

  // Get all want tokens across all vaults
  const allVaultAddresses = [...new Set(SPLITTER_ROUTES.map((r) => r.vault))]
  const routesForFirstVault = useSplitterRoutes(allVaultAddresses[0] as Address)
  const routesForSecondVault = useSplitterRoutes(allVaultAddresses[1] as Address)
  const routesForThirdVault = useSplitterRoutes(allVaultAddresses[2] as Address)

  const allWantTokens = useMemo(
    () => ({
      ...routesForFirstVault.wantTokens,
      ...routesForSecondVault.wantTokens,
      ...routesForThirdVault.wantTokens
    }),
    [routesForFirstVault.wantTokens, routesForSecondVault.wantTokens, routesForThirdVault.wantTokens]
  )

  const { data: positionData, isLoading } = useReadContracts({
    contracts: SPLITTER_ROUTES.flatMap((route) => [
      {
        abi: yieldSplitterAbi,
        address: route.strategy as Address,
        functionName: 'maxWithdraw',
        args: [account as Address],
        chainId: KATANA_CHAIN_ID
      },
      {
        abi: yieldSplitterAbi,
        address: route.strategy as Address,
        functionName: 'earned',
        args: [account as Address, route.want as Address],
        chainId: KATANA_CHAIN_ID
      }
    ]),
    query: {
      enabled: isKatana && !!account,
      staleTime: 0
    }
  })

  const positions = useMemo(() => {
    if (!positionData) return {} as Record<Address, TSplitterPosition>

    const result: Record<Address, TSplitterPosition> = {}
    for (let i = 0; i < SPLITTER_ROUTES.length; i++) {
      const route = SPLITTER_ROUTES[i]
      const balance = (positionData[i * 2]?.result as unknown as bigint) || 0n
      const earned = (positionData[i * 2 + 1]?.result as unknown as bigint) || 0n

      if (balance > 0n) {
        const wantToken = allWantTokens[route.want as Address]
        const vaultPrice = getPrice({ address: route.vault as Address, chainID: KATANA_CHAIN_ID })
        const balanceUsd = Number(formatUnits(balance, 18)) * vaultPrice.normalized

        result[route.strategy as Address] = {
          strategyAddress: route.strategy as Address,
          vaultAddress: route.vault as Address,
          wantToken:
            wantToken ||
            ({ address: route.want as Address, symbol: '???', decimals: 18, name: '' } as TSplitterWantToken),
          balance,
          balanceUsd,
          earned
        }
      }
    }
    return result
  }, [positionData, allWantTokens, getPrice])

  return { positions, isLoading }
}
