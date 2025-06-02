import {useEffect, useMemo, useState} from 'react';
import {VaultsListEmpty} from '@vaults/components/list/VaultsListEmpty';
import {ALL_VAULTS_CATEGORIES_KEYS} from '@vaults/constants';
import {useVaultFilter} from '@vaults/hooks/useFilteredVaults';
import {useSortVaults} from '@vaults/hooks/useSortVaults';
import {useQueryArguments} from '@vaults/hooks/useVaultsQueryArgs';
import {ALL_VAULTSV3_CATEGORIES_KEYS, ALL_VAULTSV3_KINDS_KEYS} from '@vaults-v3/constants';
import {Pagination} from '@common/components/Pagination';
import {SearchBar} from '@common/components/SearchBar';
import {useYearn} from '@common/contexts/useYearn';

import {VaultsListHead} from './VaultsListHead';
import {VaultsListRow} from './VaultsListRow';

import type {ReactElement, ReactNode} from 'react';
import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TSortDirection} from '@builtbymom/web3/types';
import type {TPossibleSortBy} from '@vaults/hooks/useSortVaults';

enum TFilter {
	Popular = 'Popular',
	All = 'All Vaults'
}

type TCombinedVaultList = {
	isLoading: boolean;
	isEmpty: boolean;
	allVaults: ReactNode[];
};

function mapToCombinedVaultList(sortedVaults: TYDaemonVault[], isLoadingVaultList: boolean): TCombinedVaultList {
	if (isLoadingVaultList || !sortedVaults?.length) {
		return {
			isLoading: true,
			isEmpty: true,
			allVaults: [
				<VaultsListEmpty
					key={'empty-list'}
					isLoading={isLoadingVaultList}
					sortedVaultsToDisplay={sortedVaults}
					currentSearch={''}
					currentCategories={[]}
					currentChains={[]}
					onReset={() => {}}
					defaultCategories={ALL_VAULTSV3_KINDS_KEYS}
				/>
			]
		};
	}

	const allVaults = sortedVaults.map((vault, index) => {
		const isV3 = vault.version.startsWith('3') || vault.version.startsWith('~3');
		return (
			<VaultsListRow
				key={`${vault.chainID}_${vault.address}`}
				index={index}
				currentVault={vault}
				isV2={!isV3}
			/>
		);
	});

	return {
		isLoading: false,
		isEmpty: sortedVaults.length === 0,
		allVaults
	};
}

function CombinedVaultsTable(): ReactElement {
	const {isLoadingVaultList} = useYearn();
	const [page, set_page] = useState(0);
	const [activeFilter, set_activeFilter] = useState(TFilter.Popular);
	const [hasUserSelectedSort, set_hasUserSelectedSort] = useState(false);

	// v2
	const {types: typesV2} = useQueryArguments({
		defaultTypes: ALL_VAULTS_CATEGORIES_KEYS,
		defaultPathname: '/vaults'
	});

	// v3
	const {
		search: searchV3,
		types: typesV3,
		chains: chainsV3,
		sortDirection: sortDirectionV3,
		sortBy: sortByV3,
		onChangeSortDirection: onChangeSortDirectionV3,
		onChangeSortBy: onChangeSortByV3,
		onSearch
	} = useQueryArguments({
		defaultTypes: [ALL_VAULTSV3_KINDS_KEYS[0]],
		defaultCategories: ALL_VAULTSV3_CATEGORIES_KEYS,
		defaultSortBy: 'tvl',
		defaultPathname: `/v3`
	});

	const search = searchV3 ?? '';
	const chains = chainsV3 ?? [];
	const sortDirection = sortDirectionV3 || 'desc';
	const sortBy = sortByV3 || 'tvl';
	const onChangeSortDirection = onChangeSortDirectionV3;
	const onChangeSortBy = onChangeSortByV3;

	// Get active vaults for both V2 and V3
	const {activeVaults: activeVaultsV2} = useVaultFilter(typesV2, chains);
	const {activeVaults: activeVaultsV3} = useVaultFilter(typesV3, chains, true);

	// Filter by chains and combine vaults
	const filteredV2ByChains = activeVaultsV2.filter(({chainID}) => chains?.includes(chainID));
	const filteredV3ByChains = activeVaultsV3.filter(({chainID}) => chains?.includes(chainID));

	const combinedVaults = useMemo(() => {
		return [...filteredV3ByChains, ...filteredV2ByChains];
	}, [filteredV3ByChains, filteredV2ByChains]);

	const searchedVaults = useMemo((): TYDaemonVault[] => {
		if (!search) return combinedVaults;
		const filtered = combinedVaults.filter((vault: TYDaemonVault): boolean => {
			const lowercaseSearch = search.toLowerCase();
			const searchableFields =
				`${vault.name} ${vault.symbol} ${vault.token.name} ${vault.token.symbol} ${vault.address} ${vault.token.address}`
					.toLowerCase()
					.split(' ');
			return searchableFields.some((word): boolean => word.includes(lowercaseSearch));
		});
		return filtered;
	}, [combinedVaults, search]);

	// Apply filtering & sorting based on active filter button
	const filteredVaults =
		activeFilter === TFilter.Popular
			? [...searchedVaults].sort((a, b) => (b.tvl.tvl || 0) - (a.tvl.tvl || 0)).slice(0, 30)
			: searchedVaults;

	const actualSortBy =
		activeFilter === TFilter.All && !hasUserSelectedSort
			? 'featuringScore'
			: activeFilter === TFilter.Popular
				? 'tvl'
				: sortBy;
	const actualSortDirection =
		activeFilter === TFilter.All && !hasUserSelectedSort
			? 'desc'
			: activeFilter === TFilter.Popular
				? 'desc'
				: sortDirection;
	const sortedVaults = useSortVaults(filteredVaults, actualSortBy, actualSortDirection);

	// Setup pagination
	const vaultList = mapToCombinedVaultList(sortedVaults, isLoadingVaultList);
	const totalVaults = vaultList.allVaults.length;
	const pageSize = 10;

	// Reset pagination when search results change
	useEffect(() => {
		const totalPages = Math.ceil(totalVaults / pageSize);
		if (page >= totalPages && totalPages > 0) {
			set_page(0);
		}
	}, [totalVaults, page]);

	const handleFilterClick = (filter: TFilter): void => {
		set_activeFilter(filter);
		set_page(0);
		// Reset user sort selection when changing filters
		set_hasUserSelectedSort(false);
	};

	if (vaultList.isLoading || vaultList.isEmpty) {
		return (
			<div className={'col-span-12 flex min-h-[240px] w-full flex-col'}>
				<VaultsListHead
					sortBy={
						activeFilter === TFilter.All && !hasUserSelectedSort
							? 'name'
							: activeFilter === TFilter.Popular
								? 'tvl'
								: sortBy
					}
					sortDirection={
						activeFilter === TFilter.All && !hasUserSelectedSort
							? 'desc'
							: activeFilter === TFilter.Popular
								? 'desc'
								: sortDirection
					}
					onSort={(newSortBy: string, newSortDirection: TSortDirection): void => {
						set_hasUserSelectedSort(true);
						if (newSortDirection === '') {
							onChangeSortBy('tvl');
							onChangeSortDirection('desc');
							return;
						}
						onChangeSortBy(newSortBy as TPossibleSortBy);
						onChangeSortDirection(newSortDirection as TSortDirection);
					}}
					items={[
						{label: 'Vault', value: 'name', sortable: true, className: 'col-span-6'},
						{label: 'Est. APY', value: 'estAPY', sortable: true, className: 'col-span-3'},
						{
							label: 'Risk',
							value: 'score',
							sortable: true,
							className: 'col-span-3 whitespace-nowrap'
						},
						{label: 'Vault Type', value: 'vaultType', sortable: true, className: 'col-span-3'},
						{label: 'TVL', value: 'tvl', sortable: true, className: 'col-span-3 justify-end'}
					]}
				/>
				<div className={'grid gap-1'}>{vaultList.allVaults}</div>
			</div>
		);
	}

	return (
		<div>
			<div className={'mb-4 flex w-full flex-row items-center justify-between gap-2'}>
				<div className={'flex w-full flex-row flex-wrap items-center gap-2'}>
					{Object.values(TFilter).map(filter => (
						<button
							key={filter}
							onClick={() => handleFilterClick(filter)}
							className={`rounded-full ${activeFilter === filter ? 'bg-white/10' : ''} px-3 py-2 text-sm`}>
							{filter}
						</button>
					))}
				</div>
				<div>
					<SearchBar
						className={'max-w-none rounded-lg border-none bg-white/5 text-neutral-900 md:w-full'}
						iconClassName={'text-neutral-900 font-[12px]'}
						searchPlaceholder={'Search'}
						searchValue={search}
						onSearch={onSearch}
					/>
				</div>
			</div>

			<div className={'col-span-12 flex min-h-[240px] w-full flex-col'}>
				<VaultsListHead
					sortBy={
						activeFilter === TFilter.All && !hasUserSelectedSort
							? 'name'
							: activeFilter === TFilter.Popular
								? 'tvl'
								: sortBy
					}
					sortDirection={
						activeFilter === TFilter.All && !hasUserSelectedSort
							? 'desc'
							: activeFilter === TFilter.Popular
								? 'desc'
								: sortDirection
					}
					onSort={(newSortBy: string, newSortDirection: TSortDirection): void => {
						set_hasUserSelectedSort(true);
						if (newSortDirection === '') {
							onChangeSortBy('tvl');
							onChangeSortDirection('desc');
							return;
						}
						onChangeSortBy(newSortBy as TPossibleSortBy);
						onChangeSortDirection(newSortDirection as TSortDirection);
					}}
					items={[
						{label: 'Vault', value: 'name', sortable: true, className: 'col-span-6'},
						{label: 'Est. APY', value: 'estAPY', sortable: true, className: 'col-span-3'},
						{
							label: 'Risk',
							value: 'score',
							sortable: true,
							className: 'col-span-3 whitespace-nowrap'
						},
						{label: 'Vault Type', value: 'vaultType', sortable: true, className: 'col-span-3'},
						{label: 'TVL', value: 'tvl', sortable: true, className: 'col-span-3 justify-end'}
					]}
				/>
				<div className={'grid gap-1'}>{vaultList.allVaults.slice(page * pageSize, (page + 1) * pageSize)}</div>
				{totalVaults > 0 && (
					<div className={'mt-4'}>
						<div className={'border-t border-neutral-200/60 p-4'}>
							<Pagination
								range={[0, totalVaults]}
								pageCount={totalVaults / pageSize}
								numberOfItems={totalVaults}
								onPageChange={(newPage): void => set_page(newPage.selected)}
							/>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

export default CombinedVaultsTable;
