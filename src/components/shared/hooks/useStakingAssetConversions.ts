'use client'

import { getVaultChainID, getVaultStaking, type TKongVault } from '@pages/vaults/domain/kongVaultSelectors'
import { getStakingWithdrawableAssets } from '@pages/vaults/hooks/actions/stakingAdapter'
import { useDeepCompareMemo } from '@react-hookz/web'
import type { TAddress, TDict, TNormalizedBN } from '@shared/types'
import { isZeroAddress, toAddress } from '@shared/utils'
import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { Address } from 'viem'
import { useConfig } from 'wagmi'
import { readContract } from 'wagmi/actions'

type TTokenAndChain = { address: TAddress; chainID: number }
type TBalanceGetter = (params: TTokenAndChain) => TNormalizedBN

type TStakingPosition = {
  key: string
  chainID: number
  stakingAddress: Address
  stakingSource: string
  stakingShareBalance: bigint
}

export function useStakingAssetConversions({
  allVaults,
  getBalance,
  userAddress
}: {
  allVaults: TDict<TKongVault>
  getBalance: TBalanceGetter
  userAddress?: Address
}): Record<string, bigint> {
  const config = useConfig()

  const stakingPositions = useDeepCompareMemo((): TStakingPosition[] => {
    if (!userAddress || isZeroAddress(userAddress)) {
      return []
    }

    const positions = new Map<string, TStakingPosition>()

    Object.values(allVaults).forEach((vault) => {
      const chainID = getVaultChainID(vault)
      const staking = getVaultStaking(vault)
      if (isZeroAddress(staking.address)) {
        return
      }

      const stakingAddress = toAddress(staking.address)
      const stakingShareBalance = getBalance({ address: stakingAddress, chainID }).raw
      if (stakingShareBalance <= 0n) {
        return
      }

      const key = `${chainID}/${stakingAddress}`
      if (positions.has(key)) {
        return
      }

      positions.set(key, {
        key,
        chainID,
        stakingAddress,
        stakingSource: staking.source ?? '',
        stakingShareBalance
      })
    })

    return [...positions.values()]
  }, [allVaults, getBalance, userAddress])

  const queries = useQueries({
    queries: stakingPositions.map((position) => ({
      queryKey: [
        'walletStakingConvertedAssets',
        userAddress?.toLowerCase(),
        position.chainID,
        position.stakingAddress.toLowerCase(),
        position.stakingSource,
        position.stakingShareBalance.toString()
      ],
      queryFn: async () => {
        if (!userAddress) {
          return undefined
        }

        const read = (request: {
          address: Address
          abi: readonly unknown[]
          functionName: string
          args?: readonly unknown[]
        }) =>
          readContract(config, {
            chainId: position.chainID,
            address: request.address,
            abi: request.abi as any,
            functionName: request.functionName as any,
            args: request.args as any
          })

        return getStakingWithdrawableAssets({
          read,
          stakingAddress: position.stakingAddress,
          account: userAddress,
          stakingSource: position.stakingSource,
          stakingShareBalance: position.stakingShareBalance
        })
      },
      enabled: Boolean(userAddress && position.stakingShareBalance > 0n),
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false
    }))
  })

  return useMemo(() => {
    const conversions: Record<string, bigint> = {}

    queries.forEach((query, index) => {
      const position = stakingPositions[index]
      if (!position || query.data === undefined) {
        return
      }

      conversions[position.key] = query.data
    })

    return conversions
  }, [queries, stakingPositions])
}
