import type { TNormalizedBN } from '@lib/types'
import { toNormalizedBN } from '@lib/utils'
import _ from '@nextgen/utils/chain'
import { type Address, erc20Abi } from 'viem'
import { useAccount, useReadContracts } from 'wagmi'

export interface Token {
  address?: Address
  decimals?: number
  symbol?: string
  name?: string
  balance: TNormalizedBN
}

export const useTokens = (addresses: (Address | undefined)[], chainId?: number) => {
  const { address: account } = useAccount()
  const { data, isLoading, refetch } = useReadContracts({
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
        },
        ...(account
          ? [
              {
                address,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [account],
                chainId
              }
            ]
          : [])
      ])
      .flatten()
      .compact()
      .value(),
    query: {
      // staleTime: 1000 * 60 * 1000, // 1000 mins
      enabled: !!addresses && addresses.length > 0
    },
    scopeKey: `useTokens.${addresses?.map((a) => a?.toLowerCase()).join('.')}.${chainId}-${account}`
  })

  const tokens: Token[] =
    addresses && data
      ? (() => {
          const chunkSize = account ? 4 : 3 // 4 if balance included, 3 otherwise
          return _.chunk(data, chunkSize).map((chunk, index) => {
            const [decimals, symbol, name, balance] = chunk
            const tokenDecimals = Number(decimals)
            return {
              address: addresses[index],
              decimals: tokenDecimals,
              symbol: String(symbol),
              name: String(name),
              balance: balance ? toNormalizedBN(balance as bigint, tokenDecimals) : toNormalizedBN(0n, tokenDecimals)
            }
          })
        })()
      : []

  return { tokens, isLoading, refetch }
}
