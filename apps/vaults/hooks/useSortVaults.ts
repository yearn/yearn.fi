import {useCallback, useMemo} from 'react';
import {isZero, toAddress} from '@builtbymom/web3/utils';
import {deserialize, serialize} from '@wagmi/core';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {useYearn} from '@common/contexts/useYearn';
import {getVaultName} from '@common/utils';
import {numberSort, stringSort} from '@common/utils/sort';

import type {TYDaemonVaults} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TSortDirection} from '@builtbymom/web3/types';

export type TPossibleSortBy =
	| 'apr'
	| 'estAPR'
	| 'tvl'
	| 'name'
	| 'deposited'
	| 'available'
	| 'featuringScore'
	| 'score';

export function useSortVaults(
	vaultList: TYDaemonVaults,
	sortBy: TPossibleSortBy,
	sortDirection: TSortDirection
): TYDaemonVaults {
	const {getBalance, getPrice} = useYearn();

	const sortedByName = useCallback((): TYDaemonVaults => {
		if (sortBy !== 'estAPR') {
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

	const sortedByForwardAPR = useCallback((): TYDaemonVaults => {
		if (sortBy !== 'estAPR') {
			return vaultList;
		}
		return vaultList.sort((a, b): number => {
			let aAPR = 0;
			if (a.apr.forwardAPR.type === '') {
				aAPR = a.apr.extra.stakingRewardsAPR + a.apr.netAPR;
			} else if (a.chainID === 1 && a.apr.forwardAPR.composite.boost > 0 && !a.apr.extra.stakingRewardsAPR) {
				aAPR = a.apr.forwardAPR.netAPR;
			} else {
				const sumOfRewardsAPR = a.apr.extra.stakingRewardsAPR + a.apr.extra.gammaRewardAPR;
				const hasCurrentAPR = !isZero(a?.apr.forwardAPR.netAPR);
				if (sumOfRewardsAPR > 0) {
					aAPR = sumOfRewardsAPR + a.apr.forwardAPR.netAPR;
				} else if (hasCurrentAPR) {
					aAPR = a.apr.forwardAPR.netAPR;
				} else {
					aAPR = a.apr.netAPR;
				}
			}

			let bAPR = 0;
			if (b.apr.forwardAPR.type === '') {
				bAPR = b.apr.extra.stakingRewardsAPR + b.apr.netAPR;
			} else if (b.chainID === 1 && b.apr.forwardAPR.composite.boost > 0 && !b.apr.extra.stakingRewardsAPR) {
				bAPR = b.apr.forwardAPR.netAPR;
			} else {
				const sumOfRewardsAPR = b.apr.extra.stakingRewardsAPR + b.apr.extra.gammaRewardAPR;
				const hasCurrentAPR = !isZero(b?.apr.forwardAPR.netAPR);
				if (sumOfRewardsAPR > 0) {
					bAPR = sumOfRewardsAPR + b.apr.forwardAPR.netAPR;
				} else if (hasCurrentAPR) {
					bAPR = b.apr.forwardAPR.netAPR;
				} else {
					bAPR = b.apr.netAPR;
				}
			}

			return numberSort({
				a: aAPR,
				b: bAPR,
				sortDirection
			});
		});
	}, [sortDirection, vaultList, sortBy]);

	const sortedByAPR = useCallback((): TYDaemonVaults => {
		if (sortBy !== 'apr') {
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
		if (sortBy === 'estAPR') {
			return sortedByForwardAPR();
		}
		if (sortBy === 'apr') {
			return sortedByAPR();
		}
		if (sortBy === 'tvl') {
			return sortedByTVL();
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
		sortedByForwardAPR,
		sortedByAPR,
		sortedByTVL,
		sortedByDeposited,
		sortedByAvailable,
		sortedByFeaturingScore,
		sortByScore
	]);

	return sortedVaults;
}
