import {useCallback, useMemo} from 'react';
import {useStakingRewards} from '@vaults/contexts/useStakingRewards';
import {deserialize, serialize} from '@wagmi/core';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {toBigInt, toNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {useWallet} from '@common/contexts/useWallet';
import {getVaultName} from '@common/utils';
import {numberSort, stringSort} from '@common/utils/sort';

import type {TYDaemonVaults} from '@common/schemas/yDaemonVaultsSchemas';
import type {TSortDirection} from '@common/types/types';

export type TPossibleSortBy = 'apr' | 'forwardAPR' | 'tvl' | 'name' | 'deposited' | 'available' | 'featuringScore';

export function useSortVaults(
	vaultList: TYDaemonVaults,
	sortBy: TPossibleSortBy,
	sortDirection: TSortDirection
): TYDaemonVaults {
	const {getBalance} = useWallet();
	const {stakingRewardsByVault, positionsMap} = useStakingRewards();

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

	const sortedByForwardAPR = useCallback(
		(): TYDaemonVaults =>
			vaultList.sort((a, b): number =>
				numberSort({
					a:
						a.apr?.forwardAPR?.type === ''
							? (a.apr?.netAPR || 0) + (a.apr?.extra?.stakingRewardsAPR || 0)
							: (a.apr?.forwardAPR?.netAPR || 0) + (a.apr?.extra?.stakingRewardsAPR || 0),
					b:
						b.apr?.forwardAPR?.type === ''
							? (b.apr?.netAPR || 0) + (b.apr?.extra?.stakingRewardsAPR || 0)
							: (b.apr?.forwardAPR?.netAPR || 0) + (b.apr?.extra?.stakingRewardsAPR || 0),
					sortDirection
				})
			),
		[sortDirection, vaultList]
	);

	const sortedByAPR = useCallback(
		(): TYDaemonVaults =>
			vaultList.sort((a, b): number =>
				numberSort({
					a: (a.apr?.netAPR || 0) + (a.apr?.extra?.stakingRewardsAPR || 0),
					b: (b.apr?.netAPR || 0) + (b.apr?.extra?.stakingRewardsAPR || 0),
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
			const aStakedBalance = toNormalizedValue(
				toBigInt(positionsMap[toAddress(stakingRewardsByVault[a.address])]?.stake),
				a.decimals
			);
			const bStakedBalance = toNormalizedValue(
				toBigInt(positionsMap[toAddress(stakingRewardsByVault[b.address])]?.stake),
				b.decimals
			);
			if (sortDirection === 'asc') {
				return aDepositedBalance + aStakedBalance - (bDepositedBalance + bStakedBalance);
			}
			return bDepositedBalance + bStakedBalance - (aDepositedBalance + aStakedBalance);
		});
	}, [vaultList, getBalance, positionsMap, stakingRewardsByVault, sortDirection]);

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
		const sortResult = deserialize(stringifiedVaultList);
		if (sortDirection === '') {
			return sortResult;
		}
		if (sortBy === 'name') {
			return sortedByName();
		}
		if (sortBy === 'forwardAPR') {
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

		return sortResult;
	}, [
		stringifiedVaultList,
		sortDirection,
		sortBy,
		sortedByName,
		sortedByForwardAPR,
		sortedByTVL,
		sortedByAPR,
		sortedByDeposited,
		sortedByAvailable,
		sortedByFeaturingScore
	]);

	return sortedVaults;
}
