import {useEffect, useState} from 'react';
import {VaultsListEmpty} from '@vaults/components/list/VaultsListEmpty';
import {ALL_VAULTS_CATEGORIES_KEYS} from '@vaults/constants';
import {useVaultFilter} from '@vaults/hooks/useFilteredVaults';
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

type TCombinedVaultList = {
	isLoading: boolean;
	isEmpty: boolean;
	allVaults: ReactNode[];
};

function mapToCombinedVaultList(
	v2Vaults: TYDaemonVault[],
	v3Vaults: TYDaemonVault[],
	chains: number[],
	search: string,
	typesV3: string[],
	isLoadingVaultList: boolean
): TCombinedVaultList {
	const filteredV2ByChains = v2Vaults.filter(({chainID}) => chains?.includes(chainID));
	const filteredV3ByChains = v3Vaults.filter(({chainID}) => chains?.includes(chainID));

	if (isLoadingVaultList || !chains?.length) {
		return {
			isLoading: true,
			isEmpty: true,
			allVaults: [
				<VaultsListEmpty
					key={'empty-list'}
					isLoading={isLoadingVaultList}
					sortedVaultsToDisplay={[...filteredV2ByChains, ...filteredV3ByChains]}
					currentSearch={search || ''}
					currentCategories={typesV3}
					currentChains={chains}
					onReset={() => {}}
					defaultCategories={ALL_VAULTSV3_KINDS_KEYS}
				/>
			]
		};
	}

	const processedV2Vaults = filteredV2ByChains.map(vault => (
		<VaultsListRow
			currentVault={vault}
			isV2={true}
		/>
	));
	const processedV3Vaults = filteredV3ByChains.map(vault => (
		<VaultsListRow
			currentVault={vault}
			isV2={false}
		/>
	));

	const combined = [...processedV3Vaults, ...processedV2Vaults];

	return {
		isLoading: false,
		isEmpty: combined.length === 0,
		allVaults: combined
	};
}

function CombinedVaultsTable(): ReactElement {
	const {isLoadingVaultList} = useYearn();
	const [page, set_page] = useState(0);
	const [activeFilter, set_activeFilter] = useState('Popular');

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
		onChangeSortBy: onChangeSortByV3
	} = useQueryArguments({
		defaultTypes: [ALL_VAULTSV3_KINDS_KEYS[0]],
		defaultCategories: ALL_VAULTSV3_CATEGORIES_KEYS,
		defaultPathname: `/v3`
	});

	const search = searchV3 ?? '';
	const chains = chainsV3 ?? [];
	const sortDirection = sortDirectionV3;
	const sortBy = sortByV3;
	const onChangeSortDirection = onChangeSortDirectionV3;
	const onChangeSortBy = onChangeSortByV3;

	// Get active vaults for both V2 and V3
	const {activeVaults: activeVaultsV2} = useVaultFilter(typesV2, chains);
	const {activeVaults: activeVaultsV3} = useVaultFilter(typesV3, chains, true);

	// Setup pagination
	const combinedVaults = mapToCombinedVaultList(
		activeVaultsV2,
		activeVaultsV3,
		chains,
		search,
		typesV3 ?? [],
		isLoadingVaultList
	);
	const totalVaults = combinedVaults.allVaults.length;
	const pageSize = 10;

	// Reset pagination when search results change
	useEffect(() => {
		const totalPages = Math.ceil(totalVaults / pageSize);
		if (page >= totalPages && totalPages > 0) {
			set_page(0);
		}
	}, [totalVaults, page]);

	// Handle filter click
	const handleFilterClick = (filter: string): void => {
		set_activeFilter(filter);
		set_page(0);
	};

	if (combinedVaults.isLoading || combinedVaults.isEmpty) {
		return (
			<div className={'col-span-12 flex min-h-[240px] w-full flex-col'}>
				<div className={'my-4 flex flex-wrap items-center gap-2'}>
					{['All', 'Stables', 'ETH', 'Curve', 'Balancer'].map(filter => (
						<button
							key={filter}
							onClick={() => handleFilterClick(filter)}
							className={`rounded-full px-4 py-2 text-sm `}>
							{filter}
						</button>
					))}
				</div>

				<VaultsListHead
					sortBy={sortBy}
					sortDirection={sortDirection}
					onSort={(newSortBy: string, newSortDirection: TSortDirection): void => {
						if (newSortDirection === '') {
							onChangeSortBy('featuringScore');
							onChangeSortDirection('');
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
				<div className={'grid gap-1'}>{combinedVaults.allVaults}</div>
			</div>
		);
	}

	return (
		<div>
			<div className={'mb-4 flex w-full flex-row items-center justify-between gap-2'}>
				<div className={'flex w-full flex-row flex-wrap items-center gap-2'}>
					{['Popular', 'New', 'Inactive'].map(filter => (
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
						onSearch={() => {}}
					/>
				</div>
			</div>

			<div className={'col-span-12 flex min-h-[240px] w-full flex-col'}>
				<VaultsListHead
					sortBy={sortBy}
					sortDirection={sortDirection}
					onSort={(newSortBy: string, newSortDirection: TSortDirection): void => {
						if (newSortDirection === '') {
							onChangeSortBy('featuringScore');
							onChangeSortDirection('');
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
				<div className={'grid gap-1'}>
					{combinedVaults.allVaults.slice(page * pageSize, (page + 1) * pageSize)}
				</div>
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
