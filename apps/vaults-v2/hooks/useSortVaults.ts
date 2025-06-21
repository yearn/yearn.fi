import {useCallback, useMemo} from 'react';
import {deserialize, serialize} from 'wagmi';
import {useYearn} from '@lib/contexts/useYearn';
import {useWallet} from '@lib/contexts/useWallet';
import {isZero, toAddress, toNormalizedBN} from '@lib/utils';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS} from '@lib/utils/constants';
import {getVaultName, numberSort, stringSort} from '@lib/utils/helpers';

import type {TSortDirection} from '@lib/types';
import type {TYDaemonVault, TYDaemonVaults, TYDaemonVaultStrategy} from '@lib/utils/schemas/yDaemonVaultsSchemas';

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
	| 'score';

export function useSortVaults(
	vaultList: (TYDaemonVault & {details?: TYDaemonVaultStrategy['details']})[],
	sortBy: TPossibleSortBy,
	sortDirection: TSortDirection
): TYDaemonVaults {
	const {getBalance} = useWallet();
	const {getPrice} = useYearn();

	const sortedByName = useCallback((): TYDaemonVaults => {
		if (sortBy !== 'estAPY') {
			return vaultList;
		}
		return vaultList.sort((a, b): number =>
			stringSort({
				a: getVaultName(a),
				b: getVaultName(b),
				sortDirection
			})
		);
	}, [sortBy, sortDirection, vaultList]);

	const sortedByForwardAPY = useCallback((): TYDaemonVaults => {
		if (sortBy !== 'estAPY') {
			return vaultList;
		}
		return vaultList.sort((a, b): number => {
			let aAPY = 0;
			if (a.apr?.forwardAPR.type === '') {
				aAPY = a.apr.extra.stakingRewardsAPR + a.apr.netAPR;
			} else if (a.chainID === 1 && a.apr.forwardAPR.composite.boost > 0 && !a.apr.extra.stakingRewardsAPR) {
				aAPY = a.apr.forwardAPR.netAPR;
			} else {
				const sumOfRewardsAPY = a.apr?.extra.stakingRewardsAPR + a.apr?.extra.gammaRewardAPR;
				const hasCurrentAPY = !isZero(a?.apr?.forwardAPR.netAPR);
				if (sumOfRewardsAPY > 0) {
					aAPY = sumOfRewardsAPY + a.apr?.forwardAPR.netAPR;
				} else if (hasCurrentAPY) {
					aAPY = a.apr?.forwardAPR.netAPR;
				} else {
					aAPY = a.apr?.netAPR;
				}
			}

			let bAPY = 0;
			if (b.apr?.forwardAPR.type === '') {
				bAPY = b.apr?.extra.stakingRewardsAPR + b.apr?.netAPR;
			} else if (b.chainID === 1 && b.apr?.forwardAPR.composite.boost > 0 && !b.apr?.extra.stakingRewardsAPR) {
				bAPY = b.apr?.forwardAPR.netAPR;
			} else {
				const sumOfRewardsAPY = b.apr?.extra.stakingRewardsAPR + b.apr?.extra.gammaRewardAPR;
				const hasCurrentAPY = !isZero(b?.apr?.forwardAPR.netAPR);
				if (sumOfRewardsAPY > 0) {
					bAPY = sumOfRewardsAPY + b.apr?.forwardAPR.netAPR;
				} else if (hasCurrentAPY) {
					bAPY = b.apr?.forwardAPR.netAPR;
				} else {
					bAPY = b.apr?.netAPR;
				}
			}

			return numberSort({
				a: aAPY,
				b: bAPY,
				sortDirection
			});
		});
	}, [sortDirection, vaultList, sortBy]);

	const sortedByAPY = useCallback((): TYDaemonVaults => {
		if (sortBy !== 'APY') {
			return vaultList;
		}
		return vaultList.sort((a, b): number =>
			numberSort({
				a: a.apr?.netAPR || 0,
				b: b.apr?.netAPR || 0,
				sortDirection
			})
		);
	}, [sortDirection, vaultList, sortBy]);

	const sortedByTVL = useCallback((): TYDaemonVaults => {
		if (sortBy !== 'tvl') {
			return vaultList;
		}
		return vaultList.sort((a, b): number => numberSort({a: a.tvl.tvl, b: b.tvl.tvl, sortDirection}));
	}, [sortDirection, vaultList, sortBy]);

	const sortedByAllocation = useCallback((): TYDaemonVaults => {
		if (sortBy !== 'allocation') {
			return vaultList;
		}
		return vaultList.sort((a, b): number =>
			numberSort({
				a: toNormalizedBN(a.details?.totalDebt || 0, a.token?.decimals).normalized,
				b: toNormalizedBN(b.details?.totalDebt || 0, b.token?.decimals).normalized,
				sortDirection
			})
		);
	}, [sortDirection, vaultList, sortBy]);

	const sortedByAllocationPercentage = useCallback((): TYDaemonVaults => {
		if (sortBy !== 'allocationPercentage') {
			return vaultList;
		}
		return vaultList.sort((a, b): number =>
			numberSort({a: a.details?.debtRatio, b: b.details?.debtRatio, sortDirection})
		);
	}, [sortDirection, vaultList, sortBy]);

	const sortedByDeposited = useCallback((): TYDaemonVaults => {
		if (sortBy !== 'deposited') {
			return vaultList;
		}
		return vaultList.sort((a, b): number => {
			const aDepositedBalance = Number(getBalance({address: a.address, chainID: a.chainID})?.normalized || 0);
			const bDepositedBalance = Number(getBalance({address: b.address, chainID: b.chainID})?.normalized || 0);
			let aStakedBalance = 0;
			let bStakedBalance = 0;

			let aStakedValue = 0;
			let bStakedValue = 0;

			if (a.staking.available) {
				aStakedBalance = Number(getBalance({address: a.staking.address, chainID: a.chainID})?.normalized || 0);
			}
			if (b.staking.available) {
				bStakedBalance = Number(getBalance({address: b.staking.address, chainID: b.chainID})?.normalized || 0);
			}

			if (aStakedBalance) {
				const aPrice = getPrice({address: a.address, chainID: a.chainID}).normalized || 0;
				aStakedValue = aPrice * (aDepositedBalance + aStakedBalance);
			}

			if (bStakedBalance) {
				const bPrice = getPrice({address: b.address, chainID: b.chainID}).normalized || 0;
				bStakedValue = bPrice * (bDepositedBalance + bStakedBalance);
			}

			if (sortDirection === 'asc') {
				return aStakedValue - bStakedValue;
			}
			return bStakedValue - aStakedValue;
		});
	}, [vaultList, getBalance, sortDirection, getPrice, sortBy]);

	const sortedByAvailable = useCallback((): TYDaemonVaults => {
		if (sortBy !== 'available') {
			return vaultList;
		}
		return vaultList.sort((a, b): number => {
			let aBalance = Number(getBalance({address: a.token.address, chainID: a.chainID})?.normalized || 0);
			let bBalance = Number(getBalance({address: b.token.address, chainID: b.chainID})?.normalized || 0);
			if ([WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS].includes(toAddress(a.token.address))) {
				aBalance += Number(getBalance({address: ETH_TOKEN_ADDRESS, chainID: a.chainID})?.normalized || 0);
			} else if ([WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS].includes(toAddress(b.token.address))) {
				bBalance += Number(getBalance({address: ETH_TOKEN_ADDRESS, chainID: b.chainID})?.normalized || 0);
			}

			if (sortDirection === 'asc') {
				return aBalance - bBalance;
			}
			return bBalance - aBalance;
		});
	}, [getBalance, sortBy, sortDirection, vaultList]);

	const sortedByFeaturingScore = useCallback((): TYDaemonVaults => {
		if (sortBy !== 'featuringScore') {
			return vaultList;
		}
		return vaultList.sort((a, b): number => numberSort({a: a.featuringScore, b: b.featuringScore, sortDirection}));
	}, [sortBy, sortDirection, vaultList]);

	const sortByScore = useCallback((): TYDaemonVaults => {
		if (sortBy !== 'score') {
			return vaultList;
		}
		return vaultList.sort((a, b): number => {
			const aScore = a.info.riskLevel;
			const bScore = b.info.riskLevel;
			if (sortDirection === 'asc') {
				return aScore - bScore;
			}
			return bScore - aScore;
		});
	}, [sortBy, sortDirection, vaultList]);

	const stringifiedVaultList = serialize(vaultList);
	const sortedVaults = useMemo((): TYDaemonVaults => {
		const sortResult = deserialize(stringifiedVaultList) as TYDaemonVaults;

		if (sortDirection === '') {
			return sortResult;
		}
		if (sortBy === 'name') {
			return sortedByName();
		}
		if (sortBy === 'estAPY') {
			return sortedByForwardAPY();
		}
		if (sortBy === 'APY') {
			return sortedByAPY();
		}
		if (sortBy === 'tvl') {
			return sortedByTVL();
		}
		if (sortBy === 'allocation') {
			return sortedByAllocation();
		}
		if (sortBy === 'allocationPercentage') {
			return sortedByAllocationPercentage();
		}
		if (sortBy === 'deposited') {
			return sortedByDeposited();
		}
		if (sortBy === 'available') {
			return sortedByAvailable();
		}
		if (sortBy === 'featuringScore') {
			return sortedByFeaturingScore();
		}
		if (sortBy === 'score') {
			return sortByScore();
		}

		return sortResult;
	}, [
		stringifiedVaultList,
		sortDirection,
		sortBy,
		sortedByName,
		sortedByForwardAPY,
		sortedByAPY,
		sortedByTVL,
		sortedByAllocation,
		sortedByAllocationPercentage,
		sortedByDeposited,
		sortedByAvailable,
		sortedByFeaturingScore,
		sortByScore
	]);

	return sortedVaults;
}
