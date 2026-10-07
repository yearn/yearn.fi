import { getVaultChainID, getVaultStaking, type TKongVault } from '@pages/vaults/domain/kongVaultSelectors'
import { getStakingWithdrawableAssets } from '@pages/vaults/hooks/actions/stakingAdapter'
import type { TAddress, TDict, TNormalizedBN } from '@shared/types'
import { isZeroAddress, toAddress } from '@shared/utils'
import { type UseQueryResult, useQueries } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import type { Address } from 'viem'
import { useConfig } from 'wagmi'
import { readContract } from 'wagmi/actions'
import { resolveExecutionChainId } from '@/config/tenderly'

type TTokenAndChain = { address: TAddress; chainID: number }
type TBalanceGetter = (params: TTokenAndChain) => TNormalizedBN

type TStakingVault = {
  chainID: number
  stakingAddress: Address
  stakingSource: string
}

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

  const stakingVaults = useMemo((): TStakingVault[] => {
    const vaults: TStakingVault[] = []
    const seen = new Set<string>()

    Object.values(allVaults).forEach((vault) => {
      const staking = getVaultStaking(vault)
      if (isZeroAddress(staking.address)) {
        return
      }

      const chainID = getVaultChainID(vault)
      const stakingAddress = toAddress(staking.address)
      const key = `${chainID}/${stakingAddress}`
      if (seen.has(key)) {
        return
      }

      seen.add(key)
      vaults.push({
        chainID,
        stakingAddress,
        stakingSource: staking.source ?? ''
      })
    })

    return vaults
  }, [allVaults])

  const stakingPositions = useMemo((): TStakingPosition[] => {
    if (!userAddress || isZeroAddress(userAddress)) {
      return []
    }

    const positions = new Map<string, TStakingPosition>()

    stakingVaults.forEach(({ chainID, stakingAddress, stakingSource }) => {
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
        stakingSource,
        stakingShareBalance
      })
    })

    return [...positions.values()]
  }, [getBalance, stakingVaults, userAddress])

  // Query state changes must not invalidate holdings when the converted amounts are unchanged.
  const combine = useCallback(
    (queries: UseQueryResult<bigint | undefined>[]): Record<string, bigint> =>
      Object.fromEntries(
        queries.flatMap((query, index) => {
          const position = stakingPositions[index]
          return position && query.data !== undefined ? [[position.key, query.data]] : []
        })
      ),
    [stakingPositions]
  )

  return useQueries({
    combine,
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
        }) => {
          const executionChainId = resolveExecutionChainId(position.chainID)
          if (!executionChainId) {
            throw new Error(`No execution chain found for chainId ${position.chainID}`)
          }

          return readContract(config, {
            chainId: executionChainId,
            address: request.address,
            abi: request.abi as any,
            functionName: request.functionName as any,
            args: request.args as any
          })
        }

        return getStakingWithdrawableAssets({
          read,
          stakingAddress: position.stakingAddress,
          account: userAddress,
          stakingSource: position.stakingSource,
          stakingShareBalance: position.stakingShareBalance
        })
      },
      enabled: Boolean(userAddress && position.stakingShareBalance > 0n && resolveExecutionChainId(position.chainID)),
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false
    }))
  })
}
