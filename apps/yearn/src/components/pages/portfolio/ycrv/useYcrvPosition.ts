import {
  YCRV_BOOSTED_STAKER_ABI,
  YCRV_BOOSTED_STAKER_ADDRESS,
  YCRV_BOOSTED_STAKER_UTILITIES_ABI,
  YCRV_BOOSTED_STAKER_UTILITIES_ADDRESS,
  YCRV_CHAIN_ID,
  YCRV_REWARDS_DISTRIBUTOR_ABI,
  YCRV_REWARDS_DISTRIBUTOR_ADDRESS
} from '@pages/portfolio/ycrv/constants'
import { deriveYcrvPosition, deriveYcrvReward } from '@pages/portfolio/ycrv/deriveYcrvPosition'
import type { TYcrvPosition, TYcrvRawAccount, TYcrvReward } from '@pages/portfolio/ycrv/types'
import { resolveYcrvPrices, YCRV_SPOT_ENDPOINT } from '@pages/portfolio/ycrv/ycrvPrices'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { usePublicClient } from '@shared/hooks/useAppWagmi'
import { useFetch } from '@shared/hooks/useFetch'
import type { TAddress } from '@shared/types'
import { toAddress } from '@shared/utils'
import { yearnPricesSpotResponseSchema } from '@shared/utils/schemas/yearnPricesSpotSchema'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { type ContractFunctionParameters, type PublicClient, parseUnits } from 'viem'

type TUseYcrvPositionReturn = {
  position: TYcrvPosition | null
  reward: TYcrvReward | null
  isLoading: boolean
  refetch: () => Promise<void>
}

function getBigIntResult(value: unknown): bigint {
  return typeof value === 'bigint' ? value : 0n
}

function getMulticallValue<T>(
  result: { status: 'success'; result: T } | { status: 'failure'; error: unknown } | undefined
): T | null {
  return result?.status === 'success' ? result.result : null
}

function toPriceWad(price: number | null): bigint {
  return price !== null && Number.isFinite(price) && price > 0 ? parseUnits(price.toFixed(18), 18) : 0n
}

async function fetchYcrvRawAccount({
  account,
  publicClient,
  rewardPrice,
  ycrvPrice
}: {
  account: TAddress
  publicClient: PublicClient
  rewardPrice: number | null
  ycrvPrice: number | null
}): Promise<TYcrvRawAccount> {
  const contracts = [
    {
      address: YCRV_BOOSTED_STAKER_ADDRESS,
      abi: YCRV_BOOSTED_STAKER_ABI,
      functionName: 'balanceOf',
      args: [account]
    },
    {
      address: YCRV_BOOSTED_STAKER_ADDRESS,
      abi: YCRV_BOOSTED_STAKER_ABI,
      functionName: 'totalSupply'
    },
    {
      address: YCRV_BOOSTED_STAKER_UTILITIES_ADDRESS,
      abi: YCRV_BOOSTED_STAKER_UTILITIES_ABI,
      functionName: 'getUserActiveApr',
      args: [account, toPriceWad(ycrvPrice), toPriceWad(rewardPrice)]
    },
    {
      address: YCRV_BOOSTED_STAKER_UTILITIES_ADDRESS,
      abi: YCRV_BOOSTED_STAKER_UTILITIES_ABI,
      functionName: 'getUserActiveBoostMultiplier',
      args: [account]
    },
    {
      address: YCRV_REWARDS_DISTRIBUTOR_ADDRESS,
      abi: YCRV_REWARDS_DISTRIBUTOR_ABI,
      functionName: 'getClaimable',
      args: [account]
    }
  ] as const satisfies readonly ContractFunctionParameters[]
  const results = await publicClient.multicall({ contracts, allowFailure: true })
  const getRead = (index: number): unknown => getMulticallValue(results[index] as never)

  return {
    balanceRaw: getBigIntResult(getRead(0)),
    totalSupplyRaw: getBigIntResult(getRead(1)),
    userActiveAprRaw: getBigIntResult(getRead(2)),
    userActiveBoostRaw: getBigIntResult(getRead(3)),
    claimableRewardRaw: getBigIntResult(getRead(4))
  }
}

export function useYcrvPosition(enabled: boolean): TUseYcrvPositionReturn {
  const { address } = useWeb3()
  const account = address ? toAddress(address) : undefined
  const publicClient = usePublicClient({ chainId: YCRV_CHAIN_ID })
  const spotPricesQuery = useFetch({
    endpoint: YCRV_SPOT_ENDPOINT,
    schema: yearnPricesSpotResponseSchema,
    config: {
      enabled,
      cacheDuration: 120_000,
      refetchOnWindowFocus: false
    }
  })
  const { rewardPrice, ycrvPrice } = resolveYcrvPrices(spotPricesQuery.error ? undefined : spotPricesQuery.data)
  const rawQuery = useQuery({
    queryKey: ['portfolio-ycrv-position', account, ycrvPrice, rewardPrice],
    queryFn: () =>
      fetchYcrvRawAccount({
        account: account as TAddress,
        publicClient: publicClient as PublicClient,
        rewardPrice,
        ycrvPrice
      }),
    enabled: Boolean(enabled && account && publicClient),
    staleTime: 30_000,
    refetchOnWindowFocus: true
  })
  const position = useMemo(
    () => deriveYcrvPosition(rawQuery.data, ycrvPrice, rewardPrice !== null),
    [rawQuery.data, rewardPrice, ycrvPrice]
  )
  const reward = useMemo(() => deriveYcrvReward(rawQuery.data, rewardPrice), [rawQuery.data, rewardPrice])
  const refetch = useCallback(async () => {
    await rawQuery.refetch()
  }, [rawQuery.refetch])

  return {
    position,
    reward,
    isLoading: enabled && (spotPricesQuery.isLoading || rawQuery.isLoading),
    refetch
  }
}
