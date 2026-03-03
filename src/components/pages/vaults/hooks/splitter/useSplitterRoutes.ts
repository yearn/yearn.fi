import { getSplitterRoutesForVault, isSplitterVault, KATANA_CHAIN_ID } from '@pages/vaults/constants/addresses'
import type { TSplitterWantToken } from '@pages/vaults/types/splitter'
import { useMemo } from 'react'
import { type Address, erc20Abi } from 'viem'
import { useReadContracts } from 'wagmi'

export const useSplitterRoutes = (vaultAddress: Address) => {
  const isEnabled = isSplitterVault(vaultAddress)
  const routes = useMemo(() => getSplitterRoutesForVault(vaultAddress), [vaultAddress])

  const wantAddresses = useMemo(() => [...new Set(routes.map((r) => r.want))], [routes])

  const { data: tokenData, isLoading } = useReadContracts({
    contracts: wantAddresses.flatMap((addr) => [
      { abi: erc20Abi, address: addr as Address, functionName: 'symbol', chainId: KATANA_CHAIN_ID },
      { abi: erc20Abi, address: addr as Address, functionName: 'decimals', chainId: KATANA_CHAIN_ID },
      { abi: erc20Abi, address: addr as Address, functionName: 'name', chainId: KATANA_CHAIN_ID }
    ]),
    query: {
      enabled: isEnabled && wantAddresses.length > 0,
      staleTime: 60_000
    }
  })

  const wantTokens = useMemo(() => {
    if (!tokenData) return {} as Record<Address, TSplitterWantToken>

    const result: Record<Address, TSplitterWantToken> = {}
    for (let i = 0; i < wantAddresses.length; i++) {
      const addr = wantAddresses[i] as Address
      const symbol = tokenData[i * 3]?.result as string
      const decimals = tokenData[i * 3 + 1]?.result as number
      const name = tokenData[i * 3 + 2]?.result as string
      if (symbol && decimals !== undefined) {
        result[addr] = { address: addr, symbol, decimals, name: name || symbol }
      }
    }
    return result
  }, [tokenData, wantAddresses])

  return { routes, wantTokens, isLoading, isEnabled }
}
