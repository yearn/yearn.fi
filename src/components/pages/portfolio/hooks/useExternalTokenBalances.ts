import { EXTERNAL_TOKENS } from '@pages/portfolio/constants/externalTokens'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useMemo } from 'react'
import { erc20Abi } from 'viem'
import { useReadContracts } from 'wagmi'

export function useExternalTokenBalances(): Map<string, bigint> {
  const { address, isActive } = useWeb3()

  const contracts = useMemo(
    () =>
      EXTERNAL_TOKENS.map((token) => ({
        abi: erc20Abi,
        address: token.address as `0x${string}`,
        functionName: 'balanceOf' as const,
        args: address ? [address] : undefined,
        chainId: token.chainId
      })),
    [address]
  )

  const { data } = useReadContracts({
    contracts,
    query: {
      enabled: isActive && !!address,
      staleTime: 60_000
    }
  })

  return useMemo(() => {
    const map = new Map<string, bigint>()
    if (!data) return map

    for (let i = 0; i < EXTERNAL_TOKENS.length; i++) {
      const result = data[i]
      if (result?.status !== 'success') continue
      const balance = result.result as bigint
      if (balance > 0n) {
        const token = EXTERNAL_TOKENS[i]
        map.set(`${token.chainId}:${token.address.toLowerCase()}`, balance)
      }
    }

    return map
  }, [data])
}
