import { useWeb3 } from '@lib/contexts/useWeb3'
import type { TNormalizedBN } from '@lib/types'
import { toNormalizedBN } from '@lib/utils'
import { useEffect } from 'react'
import { type Address, erc20Abi } from 'viem'
import { useBlockNumber, useReadContracts } from 'wagmi'

export const useTokenBalance = ({
  token,
  watch = false,
  chainId
}: {
  token?: Address
  watch?: boolean
  chainId?: number
}): { balance: TNormalizedBN; isLoading: boolean; refetch: () => void } => {
  const { address } = useWeb3()
  const { data: blockNumber = 0n } = useBlockNumber({ watch })

  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      {
        abi: erc20Abi,
        address: token,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        chainId
      },
      {
        abi: erc20Abi,
        address: token,
        functionName: 'decimals',
        chainId
      }
    ],
    query: {
      enabled: !!(address && token),
      select: (data) => {
        const balance = data?.[0]?.result as bigint
        const decimals = data?.[1]?.result as number
        return { balance, decimals }
      }
    },
    scopeKey: ['useTokenBalance', token, address, chainId].join('.')
  })

  const { balance, decimals } = data ?? { balance: 0n, decimals: 18 }

  // biome-ignore lint/correctness/useExhaustiveDependencies: <do not worry>
  useEffect(() => {
    if (!watch) return

    refetch()
  }, [blockNumber])

  return { balance: toNormalizedBN(balance, decimals), isLoading, refetch }
}
