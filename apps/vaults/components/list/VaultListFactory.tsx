import {useMemo} from 'react';
import {VaultListOptions} from '@vaults/components/list/VaultListOptions';
import {VaultsListRow} from '@vaults/components/list/VaultsListRow';
import {ListHero} from '@vaults/components/ListHero';
import {ALL_VAULTS_FACTORY_CATEGORIES, ALL_VAULTS_FACTORY_CATEGORIES_KEYS} from '@vaults/constants';
import {useVaultFilter} from '@vaults/hooks/useFilteredVaults';
import {useSortVaults} from '@vaults/hooks/useSortVaults';
import {useQueryArguments} from '@vaults/hooks/useVaultsQueryArgs';
import {IconChain} from '@yearn-finance/web-lib/icons/IconChain';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {ListHead} from '@common/components/ListHead';
import {useYearn} from '@common/contexts/useYearn';

import {VaultsListEmptyFactory} from './VaultsListEmpty';

import type {ReactElement, ReactNode} from 'react';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';
import type {TSortDirection} from '@common/types/types';
import type {TPossibleSortBy} from '@vaults/hooks/useSortVaults';

export function VaultListFactory(): ReactElement {
	const {isLoadingVaultList} = useYearn();
	const {
		search,
		categories,
		chains,
		sortDirection,
		sortBy,
		onSearch,
		onChangeCategories,
		onChangeChains,
		onChangeSortDirection,
		onChangeSortBy
	} = useQueryArguments({defaultCategories: ALL_VAULTS_FACTORY_CATEGORIES_KEYS});
	const {activeVaults} = useVaultFilter(categories, chains);

	/* 🔵 - Yearn Finance **************************************************************************
	 **	Then, on the activeVaults list, we apply the search filter. The search filter is
	 **	implemented as a simple string.includes() on the vault name.
	 **********************************************************************************************/
	const searchedVaultsToDisplay = useMemo((): TYDaemonVault[] => {
		if (!search) {
			return activeVaults;
		}
		return activeVaults.filter((vault: TYDaemonVault): boolean => {
			const lowercaseSearch = search.toLowerCase();
			const allSearchWords = lowercaseSearch.split(' ');
			const currentVaultInfo =
				`${vault.name} ${vault.symbol} ${vault.token.name} ${vault.token.symbol} ${vault.address} ${vault.token.address}`
					.replaceAll('-', ' ')
					.toLowerCase()
					.split(' ');
			return allSearchWords.every((word): boolean => currentVaultInfo.some((v): boolean => v.startsWith(word)));
		});
	}, [activeVaults, search]);

	/* 🔵 - Yearn Finance **************************************************************************
	 **	Then, once we have reduced the list of vaults to display, we can sort them. The sorting
	 **	is done via a custom method that will sort the vaults based on the sortBy and
	 **	sortDirection values.
	 **********************************************************************************************/
	const sortedVaultsToDisplay = useSortVaults([...searchedVaultsToDisplay], sortBy, sortDirection);

	/* 🔵 - Yearn Finance **************************************************************************
	 **	The VaultList component is memoized to prevent it from being re-created on every render.
	 **	It contains either the list of vaults, is some are available, or a message to the user.
	 **********************************************************************************************/
	const VaultList = useMemo((): ReactNode => {
		const filteredByChains = sortedVaultsToDisplay.filter(
			({chainID}): boolean => chains?.includes(chainID) || false
		);

		if (isLoadingVaultList || isZero(filteredByChains.length) || !chains || chains.length === 0) {
			return (
				<VaultsListEmptyFactory
					isLoading={isLoadingVaultList}
					sortedVaultsToDisplay={filteredByChains}
					currentSearch={search || ''}
					currentCategories={categories}
					currentChains={chains}
					onChangeCategories={onChangeCategories}
					onChangeChains={onChangeChains}
				/>
			);
		}
		return filteredByChains.map((vault): ReactNode => {
			if (!vault) {
				return null;
			}
			return (
				<VaultsListRow
					key={`${vault.chainID}_${vault.address}`}
					currentVault={vault}
				/>
			);
		});
	}, [categories, chains, isLoadingVaultList, onChangeCategories, onChangeChains, search, sortedVaultsToDisplay]);

	return (
		<div className={'relative col-span-12 flex w-full flex-col bg-neutral-100'}>
			<div className={'absolute right-8 top-8'}>
				<VaultListOptions />
			</div>
			<div className={'flex flex-col px-4 pb-0 pt-4 md:px-10 md:pt-10'}>
				<h2 className={'text-3xl font-bold'}>{'Curve Factory Vaults'}</h2>
			</div>
			<ListHero
				categories={categories}
				possibleCategories={ALL_VAULTS_FACTORY_CATEGORIES}
				searchValue={search || ''}
				chains={chains}
				onChangeChains={onChangeChains}
				onChangeCategories={onChangeCategories}
				onSearch={onSearch}
			/>

			<ListHead
				dataClassName={'grid-cols-10'}
				sortBy={sortBy}
				sortDirection={sortDirection}
				onSort={(newSortBy: string, newSortDirection: string): void => {
					onChangeSortBy(newSortBy as TPossibleSortBy);
					onChangeSortDirection(newSortDirection as TSortDirection);
				}}
				items={[
					{label: <IconChain />, value: 'chain', sortable: false, className: 'col-span-1'},
					{label: 'Token', value: 'name', sortable: true},
					{label: 'Est. APR', value: 'estAPR', sortable: true, className: 'col-span-2'},
					{label: 'Hist. APR', value: 'apr', sortable: true, className: 'col-span-2'},
					{label: 'Available', value: 'available', sortable: true, className: 'col-span-2'},
					{label: 'Holdings', value: 'deposited', sortable: true, className: 'col-span-2'},
					{label: 'Deposits', value: 'tvl', sortable: true, className: 'col-span-2'}
				]}
			/>

			{VaultList}
		</div>
	);
}
