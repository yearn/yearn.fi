import { useEffect } from 'react'
import { type Address, erc4626Abi } from 'viem'
import { useBlockNumber, useReadContract } from 'wagmi'

export const useTokenAllowance = ({
  account,
  token,
  spender,
  watch = false,
  chainId,
  enabled = true
}: {
  account: Address | undefined
  token: Address | undefined
  spender: Address | undefined
  watch?: boolean
  chainId?: number
  enabled?: boolean
}) => {
  const { data: blockNumber = 0n } = useBlockNumber({ watch: watch && enabled, chainId })

  const {
    data: allowance = 0n,
    refetch,
    isLoading
  } = useReadContract({
    abi: erc4626Abi,
    address: token,
    functionName: 'allowance',
    args: account && spender ? [account, spender] : undefined,
    chainId,
    query: {
      enabled: !!(account && token && spender) && enabled
    }
  })

  // biome-ignore lint/correctness/useExhaustiveDependencies: < >
  useEffect(() => {
    if (!watch || !enabled) return
    refetch()
  }, [blockNumber])

  return { allowance, refetch, isLoading }
}
