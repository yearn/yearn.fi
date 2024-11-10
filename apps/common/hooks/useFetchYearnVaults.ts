import {useEffect, useState} from 'react';
import {useFetch} from '@builtbymom/web3/hooks/useFetch';
import {toAddress} from '@builtbymom/web3/utils';
import {useDeepCompareMemo} from '@react-hookz/web';
import {useYDaemonBaseURI} from '@yearn-finance/web-lib/hooks/useYDaemonBaseURI';
import {yDaemonVaultsSchema} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';

import type {KeyedMutator} from 'swr';
import type {TYDaemonVault, TYDaemonVaults} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TDict} from '@builtbymom/web3/types';

/******************************************************************************
 ** The useFetchYearnVaults hook is used to fetch the vaults from the yDaemon
 ** API.
 ** It will fetch 3 kinds of vaults:
 ** - The active vaults
 ** - The vaults that are in the migration process
 ** - The retired vaults
 *****************************************************************************/
function useFetchYearnVaults(chainIDs?: number[] | undefined): {
	vaults: TDict<TYDaemonVault>;
	vaultsMigrations: TDict<TYDaemonVault>;
	vaultsRetired: TDict<TYDaemonVault>;
	isLoading: boolean;
	mutate: KeyedMutator<TYDaemonVaults>;
} {
	const {yDaemonBaseUri: yDaemonBaseUriWithoutChain} = useYDaemonBaseURI();
	const [allVaults, set_allVaults] = useState<TYDaemonVaults>([]);
	const [currentPage, set_currentPage] = useState<number>(1);
	const limit = 200;

	const {
		data: vaults,
		isLoading,
		mutate
	} = useFetch<TYDaemonVaults>({
		endpoint: `${yDaemonBaseUriWithoutChain}/vaults?${new URLSearchParams({
			hideAlways: 'true',
			orderBy: 'featuringScore',
			orderDirection: 'desc',
			strategiesDetails: 'withDetails',
			strategiesCondition: 'inQueue',
			chainIDs: chainIDs ? chainIDs.join(',') : [1, 10, 137, 250, 8453, 42161].join(','),
			limit: limit.toString(),
			page: currentPage.toString()
		})}`,
		schema: yDaemonVaultsSchema
	});

	useEffect(() => {
		let hasMore = true;
		if (vaults) {
			if (vaults.length < limit) {
				hasMore = false;
			}
			set_allVaults(prev => [...prev, ...vaults]);
			if (hasMore) {
				set_currentPage(prev => prev + 1);
			}
		}
	}, [vaults]);

	// const vaultsMigrations: TYDaemonVaults = useMemo(() => [], []);
	const {data: vaultsMigrations} = useFetch<TYDaemonVaults>({
		endpoint: `${yDaemonBaseUriWithoutChain}/vaults?${new URLSearchParams({
			chainIDs: chainIDs ? chainIDs.join(',') : [1, 10, 137, 250, 8453, 42161].join(','),
			migratable: 'nodust'
		})}`,
		schema: yDaemonVaultsSchema
	});

	// const vaultsRetired: TYDaemonVaults = useMemo(() => [], []);
	const {data: vaultsRetired} = useFetch<TYDaemonVaults>({
		endpoint: `${yDaemonBaseUriWithoutChain}/vaults/retired`,
		schema: yDaemonVaultsSchema
	});

	const vaultsObject = useDeepCompareMemo((): TDict<TYDaemonVault> => {
		if (!allVaults) {
			return {};
		}
		const _vaultsObject = (allVaults || []).reduce((acc: TDict<TYDaemonVault>, vault): TDict<TYDaemonVault> => {
			if (!vault.migration.available) {
				acc[toAddress(vault.address)] = vault;
			}
			return acc;
		}, {});
		return _vaultsObject;
	}, [allVaults]);

	const vaultsMigrationsObject = useDeepCompareMemo((): TDict<TYDaemonVault> => {
		if (!vaultsMigrations) {
			return {};
		}
		const _migratableVaultsObject = (vaultsMigrations || []).reduce(
			(acc: TDict<TYDaemonVault>, vault): TDict<TYDaemonVault> => {
				if (toAddress(vault.address) !== toAddress(vault.migration.address)) {
					acc[toAddress(vault.address)] = vault;
				}
				return acc;
			},
			{}
		);
		return _migratableVaultsObject;
	}, [vaultsMigrations]);

	const vaultsRetiredObject = useDeepCompareMemo((): TDict<TYDaemonVault> => {
		if (!vaultsRetired) {
			return {};
		}
		const _retiredVaultsObject = (vaultsRetired || []).reduce(
			(acc: TDict<TYDaemonVault>, vault): TDict<TYDaemonVault> => {
				acc[toAddress(vault.address)] = vault;
				return acc;
			},
			{}
		);
		return _retiredVaultsObject;
	}, [vaultsRetired]);

	return {
		vaults: vaultsObject,
		vaultsMigrations: vaultsMigrationsObject,
		vaultsRetired: vaultsRetiredObject,
		isLoading,
		mutate
	};
}

export {useFetchYearnVaults};
