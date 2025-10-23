import _ from '@nextgen/utils/chain'
import { type Address, erc20Abi } from 'viem'
import { useReadContracts } from 'wagmi'

export interface Token {
  address?: Address
  decimals?: number
  symbol?: string
  name?: string
}

export const useTokens = (addresses: (Address | undefined)[], chainId?: number) => {
  const { data, isLoading } = useReadContracts({
    allowFailure: false,
    contracts: _.chain(addresses)
      .map((address) => [
        {
          address,
          abi: erc20Abi,
          functionName: 'decimals',
          chainId
        },
        {
          address,
          abi: erc20Abi,
          functionName: 'symbol',
          chainId
        },
        {
          address,
          abi: erc20Abi,
          functionName: 'name',
          chainId
        }
      ])
      .flatten()
      .compact()
      .value(),
    query: {
      // staleTime: 1000 * 60 * 1000, // 1000 mins
      enabled: !!addresses && addresses.length > 0
    },
    scopeKey: `useTokens.${addresses?.map((a) => a?.toLowerCase()).join('.')}.${chainId}`
  })

  const tokens: Token[] =
    addresses && data
      ? _.chunk(data, 3).map(([decimals, symbol, name], index) => ({
          address: addresses[index],
          decimals: Number(decimals),
          symbol: String(symbol),
          name: String(name)
        }))
      : []

  return { tokens, isLoading }
}
