import React, {useCallback, useMemo, useState} from 'react';
import {ethers} from 'ethers';
import VaultListOptions from '@vaults/components/list/VaultListOptions';
import {VaultsListEmptyFactory} from '@vaults/components/list/VaultsListEmpty';
import {VaultsListRow} from '@vaults/components/list/VaultsListRow';
import {useAppSettings} from '@vaults/contexts/useAppSettings';
import {useFilteredVaults} from '@vaults/hooks/useFilteredVaults';
import {useSortVaults} from '@vaults/hooks/useSortVaults';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import ListHead from '@common/components/ListHead';
import ListHero from '@common/components/ListHero';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';
import {getVaultName} from '@common/utils';

import type {ReactElement, ReactNode} from 'react';
import type {TYearnVault} from '@common/types/yearn';
import type {TPossibleSortBy, TPossibleSortDirection} from '@vaults/hooks/useSortVaults';

function	VaultListFactory(): ReactElement {
	const	{balances} = useWallet();
	const	{vaults, isLoadingVaultList} = useYearn();
	const	[sortBy, set_sortBy] = useState<TPossibleSortBy>('apy');
	const	[sortDirection, set_sortDirection] = useState<TPossibleSortDirection>('');
	const	{shouldHideLowTVLVaults, shouldHideDust, searchValue, set_searchValue} = useAppSettings();
	const	[category, set_category] = useState('Curve Factory Vaults');

	/* 🔵 - Yearn Finance **************************************************************************
	**	It's best to memorize the filtered vaults, which saves a lot of processing time by only
	**	performing the filtering once.
	**********************************************************************************************/
	const	curveVaults = useFilteredVaults(vaults, ({category, type}): boolean => category === 'Curve' && type === 'Automated');
	const	holdingsVaults = useFilteredVaults(vaults, ({category, address, type}): boolean => {
		const	holding = balances?.[toAddress(address)];
		const	hasValidBalance = (holding?.raw || ethers.constants.Zero).gt(0);
		const	balanceValue = holding?.normalizedValue || 0;
		if (shouldHideDust && balanceValue < 0.01) {
			return false;
		} if (hasValidBalance && category === 'Curve' && type === 'Automated') {
			return true;
		}
		return false;
	});

	/* 🔵 - Yearn Finance **************************************************************************
	**	First, we need to determine in which category we are. The vaultsToDisplay function will
	**	decide which vaults to display based on the category. No extra filters are applied.
	**	The possible lists are memoized to avoid unnecessary re-renders.
	**********************************************************************************************/
	const	vaultsToDisplay = useMemo((): TYearnVault[] => {
		let	_vaultList: TYearnVault[] = [...Object.values(vaults || {})] as TYearnVault[];

		if (category === 'Curve Factory Vaults') {
			_vaultList = curveVaults;
		} else if (category === 'Holdings') {
			_vaultList = holdingsVaults;
		}

		if (shouldHideLowTVLVaults && category !== 'Holdings') {
			_vaultList = _vaultList.filter((vault): boolean => (vault?.tvl?.tvl || 0) > 10_000);
		}

		return _vaultList;
	}, [category, curveVaults, holdingsVaults, shouldHideLowTVLVaults, vaults]);

	/* 🔵 - Yearn Finance **************************************************************************
	**	Then, on the vaultsToDisplay list, we apply the search filter. The search filter is
	**	implemented as a simple string.includes() on the vault name.
	**********************************************************************************************/
	const	searchedVaults = useMemo((): TYearnVault[] => {
		const	vaultsToUse = [...vaultsToDisplay];
	
		if (searchValue === '') {
			return vaultsToUse;
		}
		return vaultsToUse.filter((vault): boolean => {
			const	searchString = getVaultName(vault);
			return searchString.toLowerCase().includes(searchValue.toLowerCase());
		});
	}, [vaultsToDisplay, searchValue]);

	/* 🔵 - Yearn Finance **************************************************************************
	**	Then, once we have reduced the list of vaults to display, we can sort them. The sorting
	**	is done via a custom method that will sort the vaults based on the sortBy and
	**	sortDirection values.
	**********************************************************************************************/
	const	sortedVaultsToDisplay = useSortVaults([...searchedVaults], sortBy, sortDirection);

	/* 🔵 - Yearn Finance **************************************************************************
	**	Callback method used to sort the vaults list.
	**	The use of useCallback() is to prevent the method from being re-created on every render.
	**********************************************************************************************/
	const	onSort = useCallback((newSortBy: string, newSortDirection: string): void => {
		performBatchedUpdates((): void => {
			set_sortBy(newSortBy as TPossibleSortBy);
			set_sortDirection(newSortDirection as TPossibleSortDirection);
		});
	}, []);

	/* 🔵 - Yearn Finance **************************************************************************
	**	The VaultList component is memoized to prevent it from being re-created on every render.
	**	It contains either the list of vaults, is some are available, or a message to the user.
	**********************************************************************************************/
	const	VaultList = useMemo((): ReactNode => {
		if (isLoadingVaultList || sortedVaultsToDisplay.length === 0) {
			return (
				<VaultsListEmptyFactory
					isLoading={isLoadingVaultList}
					sortedVaultsToDisplay={sortedVaultsToDisplay}
					currentCategory={category} />
			);	
		}
		return (
			sortedVaultsToDisplay.map((vault): ReactNode => {
				if (!vault) {
					return (null);
				}
				return <VaultsListRow key={vault.address} currentVault={vault} />;
			})
		);
	}, [category, isLoadingVaultList, sortedVaultsToDisplay]);

	return (
		<div className={'relative col-span-12 flex w-full flex-col bg-neutral-100'}>
			<div className={'absolute top-8 right-8'}>
				<VaultListOptions />
			</div>
			<ListHero
				headLabel={category}
				searchPlaceholder={'YFI Vault'}
				categories={[
					[
						{value: 'Curve Factory Vaults', label: 'Curve', isSelected: category === 'Curve Factory Vaults'},
						{value: 'Holdings', label: 'Holdings', isSelected: category === 'Holdings'}

					]
				]}
				onSelect={set_category}
				searchValue={searchValue}
				set_searchValue={set_searchValue} />

			<ListHead
				sortBy={sortBy}
				sortDirection={sortDirection}
				onSort={onSort}
				items={[
					{label: 'Token', value: 'name', sortable: true},
					{label: 'APY', value: 'apy', sortable: true, className: 'col-span-2'},
					{label: 'Available', value: 'available', sortable: true, className: 'col-span-2'},
					{label: 'Deposited', value: 'deposited', sortable: true, className: 'col-span-2'},
					{label: 'TVL', value: 'tvl', sortable: true, className: 'col-span-2'}
				]} />

			{VaultList}
		</div>
	);
}

export default VaultListFactory;
