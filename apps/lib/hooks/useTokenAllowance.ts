import { useEffect } from 'react'
import { type Address, erc4626Abi } from 'viem'
import { useBlockNumber, useReadContract } from 'wagmi'

export const useTokenAllowance = ({
  account,
  token,
  spender,
  watch = false
}: {
  account: Address | undefined
  token: Address | undefined
  spender: Address | undefined
  watch?: boolean
}) => {
  const { data: blockNumber = 0n } = useBlockNumber({ watch })

  const { data: allowance = 0n, refetch } = useReadContract({
    abi: erc4626Abi,
    address: token,
    functionName: 'allowance',
    args: account && spender ? [account, spender] : undefined,
    query: {
      enabled: !!(account && token && spender)
    }
  })

  // biome-ignore lint/correctness/useExhaustiveDependencies: < >
  useEffect(() => {
    if (!watch) return
    refetch()
  }, [blockNumber])

  return { allowance, refetch }
}
