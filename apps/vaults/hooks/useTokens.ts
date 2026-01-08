import type { TNormalizedBN } from '@lib/types'
import { toNormalizedBN } from '@lib/utils'
import { useQuery } from '@tanstack/react-query'
import { type Address, erc20Abi, getContract } from 'viem'
import { useConfig } from 'wagmi'
import { getClient } from 'wagmi/actions'

export interface Token {
  address?: Address
  chainID?: number
  decimals?: number
  symbol?: string
  name?: string
  balance: TNormalizedBN
}

async function fetchTokenData(config: any, addresses: Address[], chainId: number, account?: Address): Promise<Token[]> {
  const client = getClient(config, { chainId })

  if (!client) {
    throw new Error(`No client found for chainId ${chainId}`)
  }

  const results = await Promise.all(
    addresses.map(async (address) => {
      try {
        const contract = getContract({
          address,
          abi: erc20Abi,
          client
        })

        const [decimals, symbol, name, balance] = await Promise.all([
          contract.read.decimals(),
          contract.read.symbol(),
          contract.read.name(),
          account ? contract.read.balanceOf([account]) : Promise.resolve(0n)
        ])

        return {
          address,
          decimals: Number(decimals),
          symbol: String(symbol),
          name: String(name),
          chainID: chainId,
          balance: toNormalizedBN(balance, Number(decimals))
        }
      } catch (error) {
        console.error(`Failed to fetch token ${address}:`, error)
        return {
          address,
          decimals: 18,
          symbol: '???',
          name: 'Unknown',
          chainID: chainId,
          balance: toNormalizedBN(0n, 18)
        }
      }
    })
  )

  return results
}

/*******************************************************************************
 ** useTokens - Minimal hook to fetch token metadata and balances
 **
 ** This hook uses TanStack Query directly instead of wagmi's useReadContracts
 ** to prevent unnecessary refetches when the wallet's connected chain changes.
 **
 ** By avoiding wagmi hooks that subscribe to global state, we ensure that:
 ** - Tokens are only refetched when addresses, chainId, or account actually change
 ** - Network switches don't trigger refetches for tokens on different chains
 ******************************************************************************/
export const useTokens = (addresses: (Address | undefined)[], chainId?: number, account?: Address) => {
  const config = useConfig()

  const validAddresses = addresses.filter((addr): addr is Address => !!addr)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tokens', validAddresses.map((a) => a.toLowerCase()).join('.'), chainId, account],
    queryFn: () => fetchTokenData(config, validAddresses, chainId || 1, account),
    enabled: validAddresses.length > 0 && !!chainId,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  })

  const tokens: Token[] = data || []

  return { tokens, isLoading, refetch }
}
