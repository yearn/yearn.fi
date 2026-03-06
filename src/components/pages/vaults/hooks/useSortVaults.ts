import {
  getVaultAPR,
  getVaultChainID,
  getVaultFeaturingScore,
  getVaultInfo,
  getVaultName,
  getVaultToken,
  getVaultTVL,
  type TKongVaultInput,
  type TKongVaultStrategy
} from '@pages/vaults/domain/kongVaultSelectors'
import { useWallet } from '@shared/contexts/useWallet'
import type { TSortDirection } from '@shared/types'
import { normalizeApyDisplayValue, toAddress, toNormalizedBN } from '@shared/utils'
import { ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS } from '@shared/utils/constants'
import { numberSort, stringSort } from '@shared/utils/helpers'
import { calculateVaultEstimatedAPY } from '@shared/utils/vaultApy'
import { useMemo } from 'react'

export type TPossibleSortBy =
  | 'APY'
  | 'estAPY'
  | 'tvl'
  | 'allocationPercentage'
  | 'name'
  | 'deposited'
  | 'available'
  | 'featuringScore'
  | 'allocation'
  | 'score'

export function useSortVaults<TVault extends TKongVaultInput & { details?: TKongVaultStrategy['details'] }>(
  vaultList: TVault[],
  sortBy: TPossibleSortBy,
  sortDirection: TSortDirection
): TVault[] {
  const { getBalance, getVaultHoldingsUsd } = useWallet()
  const isFeaturingScoreSortedDesc = useMemo((): boolean => {
    if (sortBy !== 'featuringScore' || sortDirection !== 'desc') {
      return false
    }
    return vaultList.every((vault, index, arr) => {
      if (index === 0) return true
      const prevScore = Number.isFinite(getVaultFeaturingScore(arr[index - 1]))
        ? getVaultFeaturingScore(arr[index - 1])
        : 0
      const currentScore = Number.isFinite(getVaultFeaturingScore(vault)) ? getVaultFeaturingScore(vault) : 0
      return currentScore <= prevScore
    })
  }, [vaultList, sortBy, sortDirection])

  const sortedVaults = useMemo((): TVault[] => {
    if (sortDirection === '' || isFeaturingScoreSortedDesc) {
      return vaultList
    }

    const getDepositedValue = (vault: TKongVaultInput): number => {
      return getVaultHoldingsUsd(vault)
    }

    const getAvailableValue = (vault: TKongVaultInput): number => {
      const token = getVaultToken(vault)
      const chainID = getVaultChainID(vault)
      const baseBalance = Number(getBalance({ address: token.address, chainID }).normalized || 0)
      const nativeBalance = [WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS].includes(toAddress(token.address))
        ? Number(getBalance({ address: ETH_TOKEN_ADDRESS, chainID }).normalized || 0)
        : 0
      return baseBalance + nativeBalance
    }

    const depositedValueByVault = new Map<TVault, number>()
    if (sortBy === 'deposited') {
      vaultList.forEach((vault) => {
        depositedValueByVault.set(vault, getDepositedValue(vault))
      })
    }

    const availableValueByVault = new Map<TVault, number>()
    if (sortBy === 'available') {
      vaultList.forEach((vault) => {
        availableValueByVault.set(vault, getAvailableValue(vault))
      })
    }

    switch (sortBy) {
      case 'name':
        return vaultList.toSorted((a, b): number =>
          stringSort({
            a: getVaultName(a),
            b: getVaultName(b),
            sortDirection
          })
        )
      case 'estAPY':
        return vaultList.toSorted((a, b): number =>
          sortWithFallback(
            normalizeApyDisplayValue(calculateVaultEstimatedAPY(a)),
            normalizeApyDisplayValue(calculateVaultEstimatedAPY(b)),
            calculateVaultEstimatedAPY(a),
            calculateVaultEstimatedAPY(b),
            sortDirection
          )
        )
      case 'APY':
        return vaultList.toSorted((a, b): number => {
          const aprA = getVaultAPR(a).netAPR || 0
          const aprB = getVaultAPR(b).netAPR || 0
          return sortWithFallback(
            normalizeApyDisplayValue(aprA),
            normalizeApyDisplayValue(aprB),
            aprA,
            aprB,
            sortDirection
          )
        })
      case 'tvl':
        return vaultList.toSorted((a, b): number =>
          numberSort({ a: getVaultTVL(a).tvl, b: getVaultTVL(b).tvl, sortDirection })
        )
      case 'allocation':
        return vaultList.toSorted((a, b): number => {
          const aDecimals = getVaultToken(a).decimals
          const bDecimals = getVaultToken(b).decimals
          return numberSort({
            a: toNormalizedBN(a.details?.totalDebt || 0, aDecimals).normalized,
            b: toNormalizedBN(b.details?.totalDebt || 0, bDecimals).normalized,
            sortDirection
          })
        })
      case 'allocationPercentage':
        return vaultList.toSorted((a, b): number =>
          numberSort({ a: a.details?.debtRatio, b: b.details?.debtRatio, sortDirection })
        )
      case 'deposited':
        return vaultList.toSorted((a, b): number =>
          numberSort({
            a: depositedValueByVault.get(a) || 0,
            b: depositedValueByVault.get(b) || 0,
            sortDirection
          })
        )
      case 'available':
        return vaultList.toSorted((a, b): number => {
          const aValue = availableValueByVault.get(a) || 0
          const bValue = availableValueByVault.get(b) || 0
          return numberSort({ a: aValue, b: bValue, sortDirection })
        })
      case 'featuringScore':
        return vaultList.toSorted((a, b): number =>
          numberSort({ a: getVaultFeaturingScore(a), b: getVaultFeaturingScore(b), sortDirection })
        )
      case 'score':
        return vaultList.toSorted((a, b): number => {
          const aScore = getVaultInfo(a).riskLevel
          const bScore = getVaultInfo(b).riskLevel
          if (sortDirection === 'asc') {
            return aScore - bScore
          }
          return bScore - aScore
        })
      default:
        return vaultList
    }
  }, [vaultList, sortDirection, sortBy, isFeaturingScoreSortedDesc, getBalance, getVaultHoldingsUsd])

  return sortedVaults
}

function sortWithFallback(
  displayA: number,
  displayB: number,
  rawA: number,
  rawB: number,
  sortDirection: TSortDirection
): number {
  const displaySort = numberSort({ a: displayA, b: displayB, sortDirection })
  if (displaySort !== 0) {
    return displaySort
  }
  return numberSort({ a: rawA, b: rawB, sortDirection })
}
