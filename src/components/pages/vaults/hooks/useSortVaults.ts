import { useWallet } from '@shared/contexts/useWallet'
import { useYearn } from '@shared/contexts/useYearn'
import type { TSortDirection } from '@shared/types'
import { toAddress, toNormalizedBN } from '@shared/utils'
import { ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS } from '@shared/utils/constants'
import { getVaultName, numberSort, stringSort } from '@shared/utils/helpers'
import type { TYDaemonVault, TYDaemonVaultStrategy, TYDaemonVaults } from '@shared/utils/schemas/yDaemonVaultsSchemas'
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

export function useSortVaults(
  vaultList: (TYDaemonVault & { details?: TYDaemonVaultStrategy['details'] })[],
  sortBy: TPossibleSortBy,
  sortDirection: TSortDirection
): TYDaemonVaults {
  const { getBalance } = useWallet()
  const { getPrice, katanaAprs } = useYearn()
  const isFeaturingScoreSortedDesc = useMemo((): boolean => {
    if (sortBy !== 'featuringScore' || sortDirection !== 'desc') {
      return false
    }
    return vaultList.every((vault, index, arr) => {
      if (index === 0) return true
      const prevScore = Number.isFinite(arr[index - 1].featuringScore) ? arr[index - 1].featuringScore : 0
      const currentScore = Number.isFinite(vault.featuringScore) ? vault.featuringScore : 0
      return currentScore <= prevScore
    })
  }, [vaultList, sortBy, sortDirection])

  const sortedVaults = useMemo((): TYDaemonVaults => {
    if (sortDirection === '' || isFeaturingScoreSortedDesc) {
      return vaultList
    }

    const getDepositedValue = (vault: TYDaemonVault): number => {
      const depositedBalance = Number(getBalance({ address: vault.address, chainID: vault.chainID })?.normalized || 0)
      const stakedBalance = vault.staking.available
        ? Number(getBalance({ address: vault.staking.address, chainID: vault.chainID })?.normalized || 0)
        : 0
      const price = getPrice({ address: vault.address, chainID: vault.chainID }).normalized || 0
      return price * (depositedBalance + stakedBalance)
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
          numberSort({
            a: calculateVaultEstimatedAPY(a, katanaAprs),
            b: calculateVaultEstimatedAPY(b, katanaAprs),
            sortDirection
          })
        )
      case 'APY':
        return vaultList.toSorted((a, b): number =>
          numberSort({
            a: a.apr?.netAPR || 0,
            b: b.apr?.netAPR || 0,
            sortDirection
          })
        )
      case 'tvl':
        return vaultList.toSorted((a, b): number => numberSort({ a: a.tvl.tvl, b: b.tvl.tvl, sortDirection }))
      case 'allocation':
        return vaultList.toSorted((a, b): number =>
          numberSort({
            a: toNormalizedBN(a.details?.totalDebt || 0, a.token?.decimals).normalized,
            b: toNormalizedBN(b.details?.totalDebt || 0, b.token?.decimals).normalized,
            sortDirection
          })
        )
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
          const aBaseBalance = Number(getBalance({ address: a.token.address, chainID: a.chainID })?.normalized || 0)
          const bBaseBalance = Number(getBalance({ address: b.token.address, chainID: b.chainID })?.normalized || 0)
          const aEthBalance = [WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS].includes(toAddress(a.token.address))
            ? Number(getBalance({ address: ETH_TOKEN_ADDRESS, chainID: a.chainID })?.normalized || 0)
            : 0
          const bEthBalance = [WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS].includes(toAddress(b.token.address))
            ? Number(getBalance({ address: ETH_TOKEN_ADDRESS, chainID: b.chainID })?.normalized || 0)
            : 0
          const aBalance = aBaseBalance + aEthBalance
          const bBalance = bBaseBalance + bEthBalance

          const direction = sortDirection === 'asc' ? 1 : -1
          return direction * (aBalance - bBalance)
        })
      case 'featuringScore':
        return vaultList.toSorted((a, b): number =>
          numberSort({ a: a.featuringScore, b: b.featuringScore, sortDirection })
        )
      case 'score':
        return vaultList.toSorted((a, b): number => {
          const aScore = a.info.riskLevel
          const bScore = b.info.riskLevel
          if (sortDirection === 'asc') {
            return aScore - bScore
          }
          return bScore - aScore
        })
      default:
        return vaultList
    }
  }, [vaultList, sortDirection, sortBy, isFeaturingScoreSortedDesc, katanaAprs, getBalance, getPrice])

  return sortedVaults
}
