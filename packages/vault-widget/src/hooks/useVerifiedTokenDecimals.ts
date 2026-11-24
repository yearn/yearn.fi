import { useReadContract } from '@yearn/vault-widget/internal/hooks/useAppWagmi'
import { toAddress } from '@yearn/vault-widget/internal/utils'
import { ETH_TOKEN_ADDRESS } from '@yearn/vault-widget/internal/utils/constants'
import {
  getVerifiedTokenDecimals,
  type TVerifiedTokenDecimals
} from '@yearn/vault-widget/internal/utils/verifiedTokenDecimals'
import { type Address, erc20Abi } from 'viem'

export const useVerifiedTokenDecimals = ({
  token,
  chainId
}: {
  token?: { address: Address; decimals?: number }
  chainId?: number
}): TVerifiedTokenDecimals => {
  const isNativeToken = !!token && toAddress(token.address) === toAddress(ETH_TOKEN_ADDRESS)
  const { data, isLoading, isError } = useReadContract({
    address: token?.address,
    abi: erc20Abi,
    functionName: 'decimals',
    chainId,
    query: {
      enabled: !!token && !isNativeToken,
      // decimals() is immutable for any sane ERC20, keep it for the session
      staleTime: Number.POSITIVE_INFINITY,
      gcTime: Number.POSITIVE_INFINITY
    }
  })

  if (!token) {
    return {}
  }

  return getVerifiedTokenDecimals({
    listedDecimals: token?.decimals,
    onChainDecimals: data,
    isNativeToken,
    isLoading,
    isError
  })
}
