import {useCallback, useMemo} from 'react';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {useWallet} from '@common/contexts/useWallet';
import {getVaultName} from '@common/utils';

import type {TYearnVault} from '@common/types/yearn';

export type TPossibleSortBy = 'apy' | 'tvl' | 'name' | 'deposited' | 'available';
export type TPossibleSortDirection = 'asc' | 'desc' | '';

function	useSortVaults(
	vaultList: TYearnVault[],
	sortBy: TPossibleSortBy,
	sortDirection: TPossibleSortDirection
): TYearnVault[] {
	const	{balances, balancesNonce} = useWallet();
	
	const	sortedByName = useCallback((): TYearnVault[] => (
		vaultList.sort((a, b): number => {
			const	aName = getVaultName(a);
			const	bName = getVaultName(b);
			if (sortDirection === 'desc') {
				return aName.localeCompare(bName);
			}
			return bName.localeCompare(aName);
		})
	), [sortDirection, vaultList]);

	const	sortedByAPY = useCallback((): TYearnVault[] => (
		vaultList.sort((a, b): number => {
			if (sortDirection === 'desc') {
				return (b.apy?.net_apy || 0) - (a.apy?.net_apy || 0);
			}
			return (a.apy?.net_apy || 0) - (b.apy?.net_apy || 0);
		})
	), [sortDirection, vaultList]);

	const	sortedByTVL = useCallback((): TYearnVault[] => (
		vaultList.sort((a, b): number => {
			if (sortDirection === 'desc') {
				return (b.tvl.tvl || 0) - (a.tvl.tvl || 0);
			}
			return (a.tvl.tvl || 0) - (b.tvl.tvl || 0);
		})
	), [sortDirection, vaultList]);

	const	sortedByDeposited = useCallback((): TYearnVault[] => {
		balancesNonce; // remove warning, force deep refresh
		return (
			vaultList.sort((a, b): number => {
				if (sortDirection === 'asc') {
					return (balances[toAddress(a.address)]?.normalized || 0) - (balances[toAddress(b.address)]?.normalized || 0);
				}
				return (balances[toAddress(b.address)]?.normalized || 0) - (balances[toAddress(a.address)]?.normalized || 0);
			})
		);
	}, [balances, sortDirection, vaultList, balancesNonce]);

	const	sortedByAvailable = useCallback((): TYearnVault[] => {
		balancesNonce; // remove warning, force deep refresh
		const	chainCoinBalance = balances[ETH_TOKEN_ADDRESS]?.normalized || 0;
		return vaultList.sort((a, b): number => {
			let	aBalance = (balances[toAddress(a.token.address)]?.normalized || 0);
			let	bBalance = (balances[toAddress(b.token.address)]?.normalized || 0);
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

	const	stringifiedVaultList = JSON.stringify(vaultList);
	const	sortedVaults = useMemo((): TYearnVault[] => {
		const	sortResult = JSON.parse(stringifiedVaultList);
		if (sortDirection === '') {
			return sortResult;
		}
		if (sortBy === 'name') {
			return sortedByName();
		} if (sortBy === 'apy') {
			return sortedByAPY();
		} if (sortBy === 'tvl') {
			return sortedByTVL();
		} if (sortBy === 'deposited') {
			return sortedByDeposited();
		} if (sortBy === 'available') {
			return sortedByAvailable();
		}

		return sortResult;
	}, [sortBy, sortDirection, sortedByAPY, sortedByAvailable, sortedByDeposited, sortedByName, sortedByTVL, stringifiedVaultList]);

	return (sortedVaults);	
}

export {useSortVaults};
