import React, {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import {MigratableVaultListRow} from '@vaults/components/list/MigratableVaultListRow';
import {MigratableVaultsListEmpty} from '@vaults/components/list/MigratableVaultsListEmpty';
import VaultListExternalMigration from '@vaults/components/list/VaultListExternalMigration';
import {VaultsListEmpty} from '@vaults/components/list/VaultsListEmpty';
import {VaultsListMigrableRow} from '@vaults/components/list/VaultsListMigrableRow';
import {VaultsListRow} from '@vaults/components/list/VaultsListRow';
import {useVaultsMigrations} from '@vaults/contexts/useVaultsMigrations';
import {useWalletForInternalMigrations} from '@vaults/contexts/useWalletForInternalMigrations';
import {useBeefyVaults} from '@vaults/hooks/useBeefyVaults';
import {useFilteredVaults} from '@vaults/hooks/useFilteredVaults';
import {useSortVaults} from '@vaults/hooks/useSortVaults';
import Wrapper from '@vaults/Wrapper';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import ListHead from '@common/components/ListHead';
import ListHero from '@common/components/ListHero';
import ValueAnimation from '@common/components/ValueAnimation';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';
import {getVaultName} from '@common/utils';

import type {ReactElement, ReactNode} from 'react';
import type {TYearnVault} from '@common/types/yearn';
import type {TPossibleSortBy, TPossibleSortDirection} from '@vaults/hooks/useSortVaults';
import type {TMigratableVault, TVaultCategory} from './types';

function	HeaderUserPosition(): ReactElement {
	const	{cumulatedValueInVaults} = useWallet();
	const	{earned} = useYearn();

	const	formatedYouHave = useMemo((): string => formatAmount(cumulatedValueInVaults || 0), [cumulatedValueInVaults]);
	const	formatedYouEarned = useMemo((): string => formatAmount(earned?.totalUnrealizedGainsUSD || 0), [earned]);

	return (
		<Fragment>
			<div className={'col-span-12 w-full md:col-span-8'}>
				<p className={'pb-2 text-lg text-neutral-900 md:pb-6 md:text-3xl'}>{'Deposited'}</p>
				<b className={'font-number text-4xl text-neutral-900 md:text-7xl'}>
					<ValueAnimation
						identifier={'youHave'}
						value={formatedYouHave}
						defaultValue={formatAmount(0)}
						prefix={'$'} />
				</b>
			</div>
			<div className={'col-span-12 w-full md:col-span-4'}>
				<p className={'pb-2 text-lg text-neutral-900 md:pb-6 md:text-3xl'}>{'Earnings'}</p>
				<b className={'font-number text-3xl text-neutral-900 md:text-7xl'}>
					<ValueAnimation
						identifier={'youEarned'}
						value={formatedYouEarned ? formatedYouEarned : ''}
						defaultValue={formatAmount(0)}
						prefix={'$'} />
				</b>
			</div>
		</Fragment>
	);
}

function	Index(): ReactElement {
	const	{balances} = useWallet();
	const	{vaults, isLoadingVaultList} = useYearn();
	const	{possibleVaultsMigrations} = useVaultsMigrations();
	const	{balances: internalMigrationsBalances} = useWalletForInternalMigrations();
	const 	{vaults: beefyVaults, isLoading: isLoadingBeefyVaults} = useBeefyVaults();
	const	{safeChainID} = useChainID();
	const	[category, set_category] = useState<TVaultCategory>('Crypto Vaults');
	const	[searchValue, set_searchValue] = useState('');
	const	[sortBy, set_sortBy] = useState<TPossibleSortBy>('apy');
	const	[sortDirection, set_sortDirection] = useState<TPossibleSortDirection>('desc');

	/* 🔵 - Yearn Finance **************************************************************************
	**	It's best to memorize the filtered vaults, which saves a lot of processing time by only
	**	performing the filtering once.
	**********************************************************************************************/
	const	curveVaults = useFilteredVaults(vaults, ({category}): boolean => category === 'Curve');
	const	stablesVaults = useFilteredVaults(vaults, ({category}): boolean => category === 'Stablecoin');
	const	balancerVaults = useFilteredVaults(vaults, ({category}): boolean => category === 'Balancer');
	const	cryptoVaults = useFilteredVaults(vaults, ({category}): boolean => category === 'Volatile');
	const	holdingsVaults = useFilteredVaults(vaults, ({address}): boolean => (balances?.[toAddress(address)]?.raw)?.gt(0));
	const	migrableVaults = useFilteredVaults(possibleVaultsMigrations, ({address}): boolean => (internalMigrationsBalances?.[toAddress(address)]?.raw)?.gt(0));

	/* 🔵 - Yearn Finance **************************************************************************
	**	As the sidechains have a low number of vaults, we will display all of them by default.
	**********************************************************************************************/
	useEffect((): void => {
		if (safeChainID === 10 || safeChainID === 42161) {
			set_category('All Vaults');
		}
	}, [safeChainID]);
	

	/* 🔵 - Yearn Finance **************************************************************************
	**	First, we need to determine in which category we are. The vaultsToDisplay function will
	**	decide which vaults to display based on the category. No extra filters are applied.
	**	The possible lists are memoized to avoid unnecessary re-renders.
	**********************************************************************************************/
	const	vaultsToDisplay = useMemo((): TYearnVault[] => {
		if (category === 'Curve Vaults') {
			return curveVaults;
		} else if (category === 'Balancer Vaults') {
			return balancerVaults;
		} else if (category === 'Stables Vaults') {
			return stablesVaults;
		} else if (category === 'Crypto Vaults') {
			return cryptoVaults;
		} else if (category === 'Holdings') {
			return holdingsVaults;
		}
		return Object.values(vaults || {}) as TYearnVault[];
	}, [category, vaults, curveVaults, balancerVaults, stablesVaults, cryptoVaults, holdingsVaults]);

	const	migratableVaultsToDisplay = useMemo((): TMigratableVault[] => {
		return beefyVaults.reduce((migratableVaults, {tokenAddress, name}): TMigratableVault[] => {
			if (!tokenAddress) {
				return migratableVaults; 
			}
			return [...migratableVaults, {name: `${name} (beefy)`, address: tokenAddress}];
		}, [] as TMigratableVault[]);
	}, [beefyVaults]);

	const	MigratableVaultList = useMemo((): ReactNode => {
		if (isLoadingBeefyVaults || migratableVaultsToDisplay.length === 0) {
			return (
				<MigratableVaultsListEmpty
					migratableVaultsToDisplay={migratableVaultsToDisplay}
					isLoadingMigratableVaultList={isLoadingBeefyVaults} />
			);	
		}
		return (
			migratableVaultsToDisplay.map((vault): ReactNode => {
				if (!vault) {
					return (null);
				}
				return <MigratableVaultListRow key={vault.address} vault={vault} />;
			})
		);
	}, [isLoadingBeefyVaults, migratableVaultsToDisplay]);


	/* 🔵 - Yearn Finance **************************************************************************
	**	Then, on the vaultsToDisplay list, we apply the search filter. The search filter is
	**	implemented as a simple string.includes() on the vault name.
	**********************************************************************************************/
	const	searchedVaultsToDisplay = useMemo((): TYearnVault[] => {
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
	**	TODO: Refactor this to use a custom hook.
	**********************************************************************************************/
	const	sortedVaultsToDisplay = useSortVaults(searchedVaultsToDisplay, sortBy, sortDirection);

	
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
				<VaultsListEmpty
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
	}, [category, sortedVaultsToDisplay, isLoadingVaultList]);

	return (
		<section className={'mt-4 grid w-full grid-cols-12 gap-y-10 pb-10 md:mt-20 md:gap-x-10 md:gap-y-20'}>

			<HeaderUserPosition />

			<div className={'col-span-12 flex w-full flex-col bg-neutral-100'}>
				<ListHero
					headLabel={category}
					searchPlaceholder={'YFI Vault'}
					categories={[
						[
							{value: 'Crypto Vaults', label: 'Crypto', isSelected: category === 'Crypto Vaults'},
							{value: 'Stables Vaults', label: 'Stables', isSelected: category === 'Stables Vaults'},
							{value: 'Curve Vaults', label: 'Curve', isSelected: category === 'Curve Vaults'},
							{value: 'Balancer Vaults', label: 'Balancer', isSelected: category === 'Balancer Vaults'},
							{value: 'All Vaults', label: 'All', isSelected: category === 'All Vaults'}
						],
						[
							{
								value: 'Holdings',
								label: 'Holdings',
								isSelected: category === 'Holdings',
								node: (
									<Fragment>
										{'Holdings'}
										<span className={`absolute -top-1 -right-1 flex h-2 w-2 ${category === 'Holdings' || migrableVaults?.length === 0 ? 'opacity-0' : 'opacity-100'}`}>
											<span className={'absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-600 opacity-75'}></span>
											<span className={'relative inline-flex h-2 w-2 rounded-full bg-pink-500'}></span>
										</span>
									</Fragment>
								)
							}
						],
						[
							{
								value: 'Migrations',
								label: 'Migrations',
								isSelected: category === 'Migrations'
							}
						]
					]}
					onSelect={set_category}
					searchValue={searchValue}
					set_searchValue={set_searchValue} />

				{category === 'Holdings' && migrableVaults?.length > 0 ? (
					<div className={'my-4'}>
						{migrableVaults.map((vault): ReactNode => {
							if (!vault) {
								return (null);
							}
							return (
								<VaultsListMigrableRow key={vault.address} currentVault={vault} />
							);
						})}
					</div>
				) : null}

				<ListHead
					sortBy={sortBy}
					sortDirection={sortDirection}
					onSort={onSort}
					items={[
						{label: 'Token', value: 'name', sortable: true},
						...(category !== 'Migrations' ? [{label: 'APY', value: 'apy', sortable: true, className: 'col-span-2'}] : []),
						{label: 'Available', value: 'available', sortable: true, className: 'col-span-2'},
						{label: 'Deposited', value: 'deposited', sortable: true, className: 'col-span-2'},
						...(category !== 'Migrations' ? [{label: 'TVL', value: 'tvl', sortable: true, className: 'col-span-2'}] : [])
					]} />

				{category !== 'Migrations' ? VaultList : MigratableVaultList}
			</div>


			<div className={'col-span-12 flex w-full flex-col bg-neutral-100'}>
				{category === 'Holdings' ? (
					<VaultListExternalMigration />
				) : null}
			</div>
		</section>
	);
}

Index.getLayout = function getLayout(page: ReactElement): ReactElement {
	return <Wrapper>{page}</Wrapper>;
};

export default Index;
