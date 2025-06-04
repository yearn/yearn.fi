import {useDeepCompareMemo} from '@react-hookz/web';
import {useFetch} from '@lib/hooks/useFetch';
import {useYDaemonBaseURI} from '@lib/hooks/useYDaemonBaseURI';
import {toAddress} from '@lib/utils';
import {yDaemonVaultsSchema} from '@lib/utils/schemas/yDaemonVaultsSchemas';

import type {KeyedMutator} from 'swr';
import type {TDict} from '@lib/types';
import type {TYDaemonVault, TYDaemonVaults} from '@lib/utils/schemas/yDaemonVaultsSchemas';

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
			limit: '2500'
		})}`,
		schema: yDaemonVaultsSchema
	});

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
		if (!vaults) {
			return {};
		}
		const _vaultsObject = (vaults || []).reduce((acc: TDict<TYDaemonVault>, vault): TDict<TYDaemonVault> => {
			if (!vault.migration.available) {
				acc[toAddress(vault.address)] = vault;
			}
			return acc;
		}, {});
		return _vaultsObject;
	}, [vaults]);

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
