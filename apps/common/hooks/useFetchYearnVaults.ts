import {useEffect, useState} from 'react';
import {useFetch} from '@builtbymom/web3/hooks/useFetch';
import {toAddress} from '@builtbymom/web3/utils';
import {useDeepCompareMemo} from '@react-hookz/web';
import {useYDaemonBaseURI} from '@yearn-finance/web-lib/hooks/useYDaemonBaseURI';
import {yDaemonVaultsSchema} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';

import type {KeyedMutator} from 'swr';
import type {TYDaemonVault, TYDaemonVaults} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TDict} from '@builtbymom/web3/types';

/************************************************************************************************
 ** Constants and Types for the useFetchYearnVaults hook
 ** These values are used to configure the pagination and API requests
 ************************************************************************************************/
const ITEMS_PER_PAGE = 200;
const DEFAULT_CHAIN_IDS = [1, 10, 137, 250, 8453, 42161];

type TUseFetchYearnVaultsProps = {
	chainIDs?: number[];
	shouldFetchMigrations?: boolean;
	shouldFetchRetired?: boolean;
};

type TUseFetchYearnVaultsReturn = {
	vaults: TDict<TYDaemonVault>;
	vaultsMigrations: TDict<TYDaemonVault>;
	vaultsRetired: TDict<TYDaemonVault>;
	isLoading: boolean;
	error: Error | null;
	mutate: KeyedMutator<TYDaemonVaults>;
};

/************************************************************************************************
 ** Helper function to create the URL parameters for the vaults API request
 ** This ensures consistency in how we build our API URLs
 ************************************************************************************************/
function getVaultsURLParams({chainIDs, page, limit}: {chainIDs: number[]; page: number; limit: number}): string {
	return new URLSearchParams({
		hideAlways: 'true',
		orderBy: 'featuringScore',
		orderDirection: 'desc',
		strategiesDetails: 'withDetails',
		strategiesCondition: 'inQueue',
		chainIDs: chainIDs.join(','),
		limit: limit.toString(),
		page: page.toString()
	}).toString();
}

/************************************************************************************************
 ** The useFetchYearnVaults hook fetches vault data from the yDaemon API
 ** It handles pagination and provides access to active, migrating, and retired vaults
 ** The hook now includes proper error handling and optional fetching of migrations/retired vaults
 ************************************************************************************************/
function useFetchYearnVaults({
	chainIDs = DEFAULT_CHAIN_IDS,
	shouldFetchMigrations = true,
	shouldFetchRetired = true
}: TUseFetchYearnVaultsProps = {}): TUseFetchYearnVaultsReturn {
	const {yDaemonBaseUri: baseUri} = useYDaemonBaseURI();
	const [allVaults, set_allVaults] = useState<TYDaemonVaults>([]);
	const [currentPage, set_currentPage] = useState<number>(1);
	const [error, set_error] = useState<Error | null>(null);
	const [isLoadingMore, set_isLoadingMore] = useState<boolean>(false);

	// Fetch active vaults with pagination
	const {
		data: currentPageVaults,
		isLoading: isLoadingCurrentPage,
		mutate,
		error: currentPageError
	} = useFetch<TYDaemonVaults>({
		endpoint: `${baseUri}/vaults?${getVaultsURLParams({
			chainIDs,
			page: currentPage,
			limit: ITEMS_PER_PAGE
		})}`,
		schema: yDaemonVaultsSchema
	});

	// Handle pagination and vault accumulation
	useEffect(() => {
		if (currentPageError) {
			set_error(currentPageError);
			return;
		}

		if (!currentPageVaults || isLoadingMore) {
			return;
		}

		set_isLoadingMore(true);
		set_allVaults(prev => [...prev, ...currentPageVaults]);

		const hasMore = currentPageVaults.length === ITEMS_PER_PAGE;
		if (hasMore) {
			set_currentPage(prev => prev + 1);
		}
		set_isLoadingMore(false);
	}, [currentPageVaults, currentPageError, isLoadingMore]);

	// Fetch migration vaults if enabled
	const {data: vaultsMigrations} = useFetch<TYDaemonVaults>({
		endpoint: shouldFetchMigrations
			? `${baseUri}/vaults?${new URLSearchParams({
					chainIDs: chainIDs.join(','),
					migratable: 'nodust'
				})}`
			: null,
		schema: yDaemonVaultsSchema
	});

	// Fetch retired vaults if enabled
	const {data: vaultsRetired} = useFetch<TYDaemonVaults>({
		endpoint: shouldFetchRetired ? `${baseUri}/vaults/retired` : null,
		schema: yDaemonVaultsSchema
	});

	// Process active vaults into dictionary
	const vaultsObject = useDeepCompareMemo((): TDict<TYDaemonVault> => {
		if (!allVaults?.length) {
			return {};
		}
		return allVaults.reduce((acc: TDict<TYDaemonVault>, vault): TDict<TYDaemonVault> => {
			if (!vault.migration.available) {
				acc[toAddress(vault.address)] = vault;
			}
			return acc;
		}, {});
	}, [allVaults]);

	// Process migration vaults into dictionary
	const vaultsMigrationsObject = useDeepCompareMemo((): TDict<TYDaemonVault> => {
		if (!vaultsMigrations?.length) {
			return {};
		}
		return vaultsMigrations.reduce((acc: TDict<TYDaemonVault>, vault): TDict<TYDaemonVault> => {
			if (toAddress(vault.address) !== toAddress(vault.migration.address)) {
				acc[toAddress(vault.address)] = vault;
			}
			return acc;
		}, {});
	}, [vaultsMigrations]);

	// Process retired vaults into dictionary
	const vaultsRetiredObject = useDeepCompareMemo((): TDict<TYDaemonVault> => {
		if (!vaultsRetired?.length) {
			return {};
		}
		return vaultsRetired.reduce((acc: TDict<TYDaemonVault>, vault): TDict<TYDaemonVault> => {
			acc[toAddress(vault.address)] = vault;
			return acc;
		}, {});
	}, [vaultsRetired]);

	return {
		vaults: vaultsObject,
		vaultsMigrations: vaultsMigrationsObject,
		vaultsRetired: vaultsRetiredObject,
		isLoading: isLoadingCurrentPage || isLoadingMore,
		error,
		mutate
	};
}

export {useFetchYearnVaults};
export type {TUseFetchYearnVaultsProps, TUseFetchYearnVaultsReturn};
