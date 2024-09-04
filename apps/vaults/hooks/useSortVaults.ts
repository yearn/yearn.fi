import {useCallback, useMemo} from 'react';
import {isZero, toAddress} from '@builtbymom/web3/utils';
import {deserialize, serialize} from '@wagmi/core';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {useYearn} from '@common/contexts/useYearn';
import {getVaultName} from '@common/utils';
import {numberSort, stringSort} from '@common/utils/sort';

import type {TYDaemonVaults} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TSortDirection} from '@builtbymom/web3/types';

export type TPossibleSortBy = 'APY' | 'estAPY' | 'tvl' | 'name' | 'deposited' | 'available' | 'featuringScore';

export function useSortVaults(
	vaultList: TYDaemonVaults,
	sortBy: TPossibleSortBy,
	sortDirection: TSortDirection
): TYDaemonVaults {
	const {getBalance, getPrice} = useYearn();

	const sortedByName = useCallback(
		(): TYDaemonVaults =>
			vaultList.sort((a, b): number =>
				stringSort({
					a: getVaultName(a),
					b: getVaultName(b),
					sortDirection
				})
			),
		[sortDirection, vaultList]
	);

	const sortedByForwardAPY = useCallback(
		(): TYDaemonVaults =>
			vaultList.sort((a, b): number => {
				let aAPY = 0;
				if (a.apr.forwardAPR.type === '') {
					aAPY = a.apr.extra.stakingRewardsAPR + a.apr.netAPR;
				} else if (a.chainID === 1 && a.apr.forwardAPR.composite.boost > 0 && !a.apr.extra.stakingRewardsAPR) {
					aAPY = a.apr.forwardAPR.netAPR;
				} else {
					const sumOfRewardsAPY = a.apr.extra.stakingRewardsAPR + a.apr.extra.gammaRewardAPR;
					const hasCurrentAPY = !isZero(a?.apr.forwardAPR.netAPR);
					if (sumOfRewardsAPY > 0) {
						aAPY = sumOfRewardsAPY + a.apr.forwardAPR.netAPR;
					} else if (hasCurrentAPY) {
						aAPY = a.apr.forwardAPR.netAPR;
					} else {
						aAPY = a.apr.netAPR;
					}
				}

				let bAPY = 0;
				if (b.apr.forwardAPR.type === '') {
					bAPY = b.apr.extra.stakingRewardsAPR + b.apr.netAPR;
				} else if (b.chainID === 1 && b.apr.forwardAPR.composite.boost > 0 && !b.apr.extra.stakingRewardsAPR) {
					bAPY = b.apr.forwardAPR.netAPR;
				} else {
					const sumOfRewardsAPY = b.apr.extra.stakingRewardsAPR + b.apr.extra.gammaRewardAPR;
					const hasCurrentAPY = !isZero(b?.apr.forwardAPR.netAPR);
					if (sumOfRewardsAPY > 0) {
						bAPY = sumOfRewardsAPY + b.apr.forwardAPR.netAPR;
					} else if (hasCurrentAPY) {
						bAPY = b.apr.forwardAPR.netAPR;
					} else {
						bAPY = b.apr.netAPR;
					}
				}

				return numberSort({
					a: aAPY,
					b: bAPY,
					sortDirection
				});
			}),
		[sortDirection, vaultList]
	);

	const sortedByAPY = useCallback(
		(): TYDaemonVaults =>
			vaultList.sort((a, b): number =>
				numberSort({
					a: a.apr?.netAPR || 0,
					b: b.apr?.netAPR || 0,
					sortDirection
				})
			),
		[sortDirection, vaultList]
	);

	const sortedByTVL = useCallback(
		(): TYDaemonVaults => vaultList.sort((a, b): number => numberSort({a: a.tvl.tvl, b: b.tvl.tvl, sortDirection})),
		[sortDirection, vaultList]
	);

	const sortedByDeposited = useCallback((): TYDaemonVaults => {
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
	}, [vaultList, getBalance, sortDirection, getPrice]);

	const sortedByAvailable = useCallback((): TYDaemonVaults => {
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
	}, [getBalance, sortDirection, vaultList]);

	const sortedByFeaturingScore = useCallback(
		(): TYDaemonVaults =>
			vaultList.sort((a, b): number => numberSort({a: a.featuringScore, b: b.featuringScore, sortDirection})),
		[sortDirection, vaultList]
	);

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
		if (sortBy === 'deposited') {
			return sortedByDeposited();
		}
		if (sortBy === 'available') {
			return sortedByAvailable();
		}
		if (sortBy === 'featuringScore') {
			return sortedByFeaturingScore();
		}

		return sortResult;
	}, [
		stringifiedVaultList,
		sortDirection,
		sortBy,
		sortedByName,
		sortedByForwardAPY,
		sortedByTVL,
		sortedByAPY,
		sortedByDeposited,
		sortedByAvailable,
		sortedByFeaturingScore
	]);

	return sortedVaults;
}
