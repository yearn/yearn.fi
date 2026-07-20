import { useQuery } from '@tanstack/react-query'
import { isZeroAddress, toNormalizedBN } from '@yearn/vault-widget/internal/utils'
import { useVaultWidgetRuntime } from '@yearn/vault-widget/runtime'
import type { Token } from '@yearn/vault-widget/types'
import { type Address, erc20Abi, getContract } from 'viem'
import { useConfig } from 'wagmi'
import { getClient } from 'wagmi/actions'

async function fetchTokenData(
  config: any,
  addresses: Address[],
  canonicalChainId: number,
  executionChainId: number,
  account?: Address
): Promise<Token[]> {
  const client = getClient(config, { chainId: executionChainId })

  if (!client) {
    throw new Error(`No client found for chainId ${canonicalChainId}`)
  }

  const results = await Promise.all(
    addresses.map(async (address) => {
      try {
        const contract = getContract({
          address,
          abi: erc20Abi,
          client
        })
        const [balanceResult, decimalsResult, symbolResult, nameResult] = await Promise.allSettled([
          account ? contract.read.balanceOf([account]) : Promise.resolve(0n),
          contract.read.decimals(),
          contract.read.symbol(),
          contract.read.name()
        ])

        const balance = balanceResult.status === 'fulfilled' ? balanceResult.value : 0n
        const decimals = decimalsResult.status === 'fulfilled' ? Number(decimalsResult.value) : 18
        const symbol = symbolResult.status === 'fulfilled' ? String(symbolResult.value) : '???'
        const name = nameResult.status === 'fulfilled' ? String(nameResult.value) : 'Unknown'

        return {
          address,
          decimals,
          symbol,
          name,
          chainId: canonicalChainId,
          balance: toNormalizedBN(balance, decimals)
        }
      } catch (error) {
        console.error(`Failed to fetch token ${address}:`, error)
        return {
          address,
          decimals: 18,
          symbol: '???',
          name: 'Unknown',
          chainId: canonicalChainId,
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
  const runtime = useVaultWidgetRuntime()
  const executionChainId = runtime.chains.resolveExecutionChainId(chainId)

  const validAddresses = addresses.filter((addr): addr is Address => !isZeroAddress(addr))

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tokens', validAddresses.map((a) => a.toLowerCase()).join('.'), chainId, executionChainId, account],
    queryFn: () => fetchTokenData(config, validAddresses, chainId || 1, executionChainId || 1, account),
    enabled: validAddresses.length > 0 && !!chainId && !!executionChainId,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  })

  const tokens: Token[] = data || []

  return { tokens, isLoading, refetch }
}
