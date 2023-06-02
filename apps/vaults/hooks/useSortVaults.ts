import {useCallback, useMemo} from 'react';
import {useStakingRewards} from '@vaults/contexts/useStakingRewards';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {toBigInt, toNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {useWallet} from '@common/contexts/useWallet';
import {getVaultName} from '@common/utils';
import {numberSort, stringSort} from '@common/utils/sort';

import type {TYDaemonVaults} from '@common/schemas/yDaemonVaultsSchemas';
import type {TSortDirection} from '@common/types/types';

export type TPossibleSortBy = 'apy' | 'tvl' | 'name' | 'deposited' | 'available';

function useSortVaults(
	vaultList: TYDaemonVaults,
	sortBy: TPossibleSortBy,
	sortDirection: TSortDirection
): TYDaemonVaults {
	const {balances, balancesNonce} = useWallet();
	const {stakingRewardsByVault, positionsMap} = useStakingRewards();

	const sortedByName = useCallback((): TYDaemonVaults => (
		vaultList.sort((a, b): number => stringSort({a: getVaultName(a), b: getVaultName(b), sortDirection}))
	), [sortDirection, vaultList]);

	const sortedByAPY = useCallback((): TYDaemonVaults => (
		vaultList.sort((a, b): number => numberSort({a: a.apy?.net_apy, b: b.apy?.net_apy, sortDirection}))
	), [sortDirection, vaultList]);

	const sortedByTVL = useCallback((): TYDaemonVaults => (
		vaultList.sort((a, b): number => numberSort({a: a.tvl.tvl, b: b.tvl.tvl, sortDirection}))
	), [sortDirection, vaultList]);

	const sortedByDeposited = useCallback((): TYDaemonVaults => {
		balancesNonce; // remove warning, force deep refresh
		return (
			vaultList.sort((a, b): number => {
				const aDepositedBalance = balances[toAddress(a.address)]?.normalized || 0;
				const bDepositedBalance = balances[toAddress(b.address)]?.normalized || 0;
				const aStakedBalance = toNormalizedValue(toBigInt(positionsMap[toAddress(stakingRewardsByVault[a.address])]?.stake), a.decimals);
				const bStakedBalance = toNormalizedValue(toBigInt(positionsMap[toAddress(stakingRewardsByVault[b.address])]?.stake), b.decimals);
				if (sortDirection === 'asc') {
					return (aDepositedBalance + aStakedBalance) - (bDepositedBalance + bStakedBalance);
				}
				return (bDepositedBalance + bStakedBalance) - (aDepositedBalance + aStakedBalance);
			})
		);
	}, [balancesNonce, vaultList, balances, positionsMap, stakingRewardsByVault, sortDirection]);

	const sortedByAvailable = useCallback((): TYDaemonVaults => {
		balancesNonce; // remove warning, force deep refresh
		const chainCoinBalance = balances[ETH_TOKEN_ADDRESS]?.normalized || 0;
		return vaultList.sort((a, b): number => {
			let aBalance = (balances[toAddress(a.token.address)]?.normalized || 0);
			let bBalance = (balances[toAddress(b.token.address)]?.normalized || 0);
			if ([WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS].includes(toAddress(a.token.address))) {
				aBalance += chainCoinBalance;
			} else if ([WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS].includes(toAddress(b.token.address))) {
				bBalance += chainCoinBalance;
			}

			if (sortDirection === 'asc') {
				return (aBalance) - (bBalance);
			}
			return (bBalance) - (aBalance);
		});
	}, [balances, balancesNonce, sortDirection, vaultList]);

	const stringifiedVaultList = JSON.stringify(vaultList);
	const sortedVaults = useMemo((): TYDaemonVaults => {
		const sortResult = JSON.parse(stringifiedVaultList);
		if (sortDirection === '') {
			return sortResult;
		}
		if (sortBy === 'name') {
			return sortedByName();
		}
		if (sortBy === 'apy') {
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

		return sortResult;
	}, [sortBy, sortDirection, sortedByAPY, sortedByAvailable, sortedByDeposited, sortedByName, sortedByTVL, stringifiedVaultList]);

	return (sortedVaults);
}

export {useSortVaults};
