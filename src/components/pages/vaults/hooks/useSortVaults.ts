import {
  getVaultAddress,
  getVaultAPR,
  getVaultChainID,
  getVaultFeaturingScore,
  getVaultInfo,
  getVaultName,
  getVaultStaking,
  getVaultToken,
  getVaultTVL,
  type TKongVaultInput,
  type TKongVaultStrategy
} from '@pages/vaults/domain/kongVaultSelectors'
import { useYvUsdVaults } from '@pages/vaults/hooks/useYvUsdVaults'
import {
  getYvUsdSharePrice,
  isYvUsdVault,
  YVUSD_CHAIN_ID,
  YVUSD_LOCKED_ADDRESS,
  YVUSD_UNLOCKED_ADDRESS
} from '@pages/vaults/utils/yvUsd'
import { useWallet } from '@shared/contexts/useWallet'
import type { TSortDirection } from '@shared/types'
import { isZeroAddress, normalizeApyDisplayValue, toAddress, toNormalizedBN } from '@shared/utils'
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
  const { getBalance, getToken } = useWallet()
  const { unlockedVault: yvUsdUnlockedVault, lockedVault: yvUsdLockedVault, metrics: yvUsdMetrics } = useYvUsdVaults()
  const yvUsdDepositedValue = useMemo((): number => {
    const unlockedBalance = getBalance({ address: YVUSD_UNLOCKED_ADDRESS, chainID: YVUSD_CHAIN_ID }).normalized
    const lockedBalance = getBalance({ address: YVUSD_LOCKED_ADDRESS, chainID: YVUSD_CHAIN_ID }).normalized
    const unlockedSharePrice = getYvUsdSharePrice(yvUsdUnlockedVault)
    const lockedSharePrice = getYvUsdSharePrice(yvUsdLockedVault)
    return unlockedBalance * unlockedSharePrice + lockedBalance * lockedSharePrice
  }, [getBalance, yvUsdLockedVault, yvUsdUnlockedVault])

  const yvUsdDisplayedApy = useMemo((): number => {
    const lockedApy = yvUsdMetrics.locked.apy
    if (lockedApy > 0 || yvUsdMetrics.unlocked.apy === 0) {
      return lockedApy
    }
    return yvUsdMetrics.unlocked.apy
  }, [yvUsdMetrics.locked.apy, yvUsdMetrics.unlocked.apy])

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

  const sortedVaults = useMemo(() => {
    if (sortDirection === '' || isFeaturingScoreSortedDesc) {
      return vaultList
    }

    const getDepositedValue = (vault: TKongVaultInput): number => {
      if (isYvUsdVault(vault)) {
        return yvUsdDepositedValue
      }

      const chainID = getVaultChainID(vault)
      const address = getVaultAddress(vault)
      const staking = getVaultStaking(vault)

      const vaultToken = getToken({ address, chainID })
      const vaultValue = vaultToken.value || 0

      const stakingValue = !isZeroAddress(toAddress(staking?.address))
        ? getToken({ address: staking.address, chainID }).value || 0
        : 0

      return vaultValue + stakingValue
    }

    const getApySortValue = (vault: TKongVaultInput): number => {
      if (isYvUsdVault(vault)) {
        return yvUsdDisplayedApy
      }
      return getVaultAPR(vault).netAPR || 0
    }

    const getEstimatedApySortValue = (vault: TKongVaultInput): number => {
      if (isYvUsdVault(vault)) {
        return yvUsdDisplayedApy
      }
      return calculateVaultEstimatedAPY(vault)
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
            normalizeApyDisplayValue(getEstimatedApySortValue(a)),
            normalizeApyDisplayValue(getEstimatedApySortValue(b)),
            getEstimatedApySortValue(a),
            getEstimatedApySortValue(b),
            sortDirection
          )
        )
      case 'APY': {
        return vaultList.toSorted((a, b): number => {
          const aprA = getApySortValue(a)
          const aprB = getApySortValue(b)
          return sortWithFallback(
            normalizeApyDisplayValue(aprA),
            normalizeApyDisplayValue(aprB),
            aprA,
            aprB,
            sortDirection
          )
        })
      }
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
            a: getDepositedValue(a),
            b: getDepositedValue(b),
            sortDirection
          })
        )
      case 'available':
        return vaultList.toSorted((a, b): number => {
          const tokenA = getVaultToken(a)
          const tokenB = getVaultToken(b)
          const chainA = getVaultChainID(a)
          const chainB = getVaultChainID(b)

          const aBaseBalance = Number(getBalance({ address: tokenA.address, chainID: chainA })?.normalized || 0)
          const bBaseBalance = Number(getBalance({ address: tokenB.address, chainID: chainB })?.normalized || 0)
          const aEthBalance = [WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS].includes(toAddress(tokenA.address))
            ? Number(getBalance({ address: ETH_TOKEN_ADDRESS, chainID: chainA })?.normalized || 0)
            : 0
          const bEthBalance = [WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS].includes(toAddress(tokenB.address))
            ? Number(getBalance({ address: ETH_TOKEN_ADDRESS, chainID: chainB })?.normalized || 0)
            : 0
          const aBalance = aBaseBalance + aEthBalance
          const bBalance = bBaseBalance + bEthBalance

          const direction = sortDirection === 'asc' ? 1 : -1
          return direction * (aBalance - bBalance)
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
  }, [
    vaultList,
    sortDirection,
    sortBy,
    isFeaturingScoreSortedDesc,
    getBalance,
    getToken,
    yvUsdDepositedValue,
    yvUsdDisplayedApy
  ])

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
