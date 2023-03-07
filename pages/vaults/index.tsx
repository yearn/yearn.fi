import React, {Fragment, useCallback, useMemo} from 'react';
import VaultListOptions from '@vaults/components/list/VaultListOptions';
import {VaultsListEmpty} from '@vaults/components/list/VaultsListEmpty';
import {VaultsListInternalMigrationRow} from '@vaults/components/list/VaultsListInternalMigrationRow';
import {VaultsListRow} from '@vaults/components/list/VaultsListRow';
import {useAppSettings} from '@vaults/contexts/useAppSettings';
import {useFilteredVaults} from '@vaults/hooks/useFilteredVaults';
import {useSortVaults} from '@vaults/hooks/useSortVaults';
import Wrapper from '@vaults/Wrapper';
import {useSessionStorage} from '@yearn-finance/web-lib/hooks/useSessionStorage';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import ListHead from '@common/components/ListHead';
import ListHero from '@common/components/ListHero';
import ValueAnimation from '@common/components/ValueAnimation';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';
import {useClientOnlyFn} from '@common/hooks/useClientOnlyFn';
import {getVaultName} from '@common/utils';

import type {NextRouter} from 'next/router';
import type {ReactElement, ReactNode} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TSortDirection} from '@common/types/types';
import type {TYearnVault} from '@common/types/yearn';
import type {TPossibleSortBy} from '@vaults/hooks/useSortVaults';

function	HeaderUserPosition(): ReactElement {
	const	{cumulatedValueInVaults} = useWallet();
	const	{earned} = useYearn();

	const clientOnlyFormatAmount = useClientOnlyFn({fn: formatAmount, placeholder: '0,00'});


	const	formatedYouEarned = useMemo((): string => {
		const amount = (earned?.totalUnrealizedGainsUSD || 0) > 0 ? earned?.totalUnrealizedGainsUSD || 0 : 0;
		return clientOnlyFormatAmount(amount)?.toString() ?? '';
	}, [clientOnlyFormatAmount, earned?.totalUnrealizedGainsUSD]);

	const	formatedYouHave = useMemo((): string => {
		return clientOnlyFormatAmount(cumulatedValueInVaults || 0)?.toString() ?? '';
	}, [clientOnlyFormatAmount, cumulatedValueInVaults]);

	return (
		<Fragment>
			<div className={'col-span-12 w-full md:col-span-8'}>
				<p className={'pb-2 text-lg text-neutral-900 md:pb-6 md:text-3xl'}>{'Deposited'}</p>
				<b className={'font-number text-4xl text-neutral-900 md:text-7xl'}>
					<ValueAnimation
						identifier={'youHave'}
						value={formatedYouHave}
						defaultValue={'0,00'}
						prefix={'$'} />
				</b>
			</div>
			<div className={'col-span-12 w-full md:col-span-4'}>
				<p className={'pb-2 text-lg text-neutral-900 md:pb-6 md:text-3xl'}>{'Earnings'}</p>
				<b className={'font-number text-3xl text-neutral-900 md:text-7xl'}>
					<ValueAnimation
						identifier={'youEarned'}
						value={formatedYouEarned}
						defaultValue={'0,00'}
						prefix={'$'} />
				</b>
			</div>
		</Fragment>
	);
}

function	Index(): ReactElement {
	const	{balances, balancesNonce} = useWallet();
	const	{vaults, vaultsMigrations, isLoadingVaultList} = useYearn();
	const 	[sort, set_sort] = useSessionStorage<{sortBy: TPossibleSortBy, sortDirection: TSortDirection}>(
		'yVaultsSorting', {sortBy: 'apy', sortDirection: 'desc'}
	);
	const	{shouldHideDust, shouldHideLowTVLVaults, category, searchValue, set_category, set_searchValue} = useAppSettings();

	const	filterHoldingsCallback = useCallback((address: TAddress): boolean => {
		balancesNonce;
		const	holding = balances?.[toAddress(address)];
		const	hasValidBalance = formatBN(holding?.raw).gt(0);
		const	balanceValue = holding?.normalizedValue || 0;
		if (shouldHideDust && balanceValue < 0.01) {
			return false;
		}
		if (hasValidBalance) {
			return true;
		}
		return false;
	}, [balances, shouldHideDust, balancesNonce]);

	const	filterMigrationCallback = useCallback((address: TAddress): boolean => {
		balancesNonce;
		const	holding = balances?.[toAddress(address)];
		const	hasValidPrice = formatBN(holding?.rawPrice).gt(0);
		const	hasValidBalance = formatBN(holding?.raw).gt(0);
		if (hasValidBalance && (hasValidPrice ? (holding?.normalizedValue || 0) >= 0.01 : true)) {
			return true;
		}
		return false;
	}, [balances, balancesNonce]);

	/* 🔵 - Yearn Finance **************************************************************************
	**	It's best to memorize the filtered vaults, which saves a lot of processing time by only
	**	performing the filtering once.
	**********************************************************************************************/
	const	curveVaults = useFilteredVaults(vaults, ({category}): boolean => category === 'Curve');
	const	stablesVaults = useFilteredVaults(vaults, ({category}): boolean => category === 'Stablecoin');
	const	balancerVaults = useFilteredVaults(vaults, ({category}): boolean => category === 'Balancer');
	const	cryptoVaults = useFilteredVaults(vaults, ({category}): boolean => category === 'Volatile');
	const	holdingsVaults = useFilteredVaults(vaults, ({address}): boolean => filterHoldingsCallback(address));
	const	migratableVaults = useFilteredVaults(vaultsMigrations, ({address}): boolean => filterMigrationCallback(address));

	/* 🔵 - Yearn Finance **************************************************************************
	**	First, we need to determine in which category we are. The vaultsToDisplay function will
	**	decide which vaults to display based on the category. No extra filters are applied.
	**	The possible lists are memoized to avoid unnecessary re-renders.
	**********************************************************************************************/
	const	vaultsToDisplay = useMemo((): TYearnVault[] => {
		let	_vaultList: TYearnVault[] = [...Object.values(vaults || {})] as TYearnVault[];

		if (category === 'Curve Vaults') {
			_vaultList = curveVaults;
		} else if (category === 'Balancer Vaults') {
			_vaultList = balancerVaults;
		} else if (category === 'Stables Vaults') {
			_vaultList = stablesVaults;
		} else if (category === 'Crypto Vaults') {
			_vaultList = cryptoVaults;
		} else if (category === 'Holdings') {
			_vaultList = holdingsVaults;
		} else if (category === 'Featured Vaults') {
			_vaultList.sort((a, b): number => ((b.tvl.tvl || 0) * (b?.apy?.net_apy || 0)) - ((a.tvl.tvl || 0) * (a?.apy?.net_apy || 0)));
			_vaultList = _vaultList.slice(0, 10);
		}

		if (shouldHideLowTVLVaults && category !== 'Holdings') {
			_vaultList = _vaultList.filter((vault): boolean => (vault?.tvl?.tvl || 0) > 10_000);
		}

		return _vaultList;
	}, [vaults, category, shouldHideLowTVLVaults, curveVaults, balancerVaults, stablesVaults, cryptoVaults, holdingsVaults]);

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
	**********************************************************************************************/
	const	sortedVaultsToDisplay = useSortVaults([...searchedVaultsToDisplay], sort.sortBy, sort.sortDirection);

	/* 🔵 - Yearn Finance **************************************************************************
	**	Callback method used to sort the vaults list.
	**	The use of useCallback() is to prevent the method from being re-created on every render.
	**********************************************************************************************/
	const	onSort = useCallback((newSortBy: string, newSortDirection: string): void => {
		set_sort({sortBy: newSortBy as TPossibleSortBy, sortDirection: newSortDirection as TSortDirection});
	}, [set_sort]);

	/* 🔵 - Yearn Finance **************************************************************************
	**	The VaultList component is memoized to prevent it from being re-created on every render.
	**	It contains either the list of vaults, is some are available, or a message to the user.
	**********************************************************************************************/
	const	VaultList = useMemo((): ReactNode => {
		if (isLoadingVaultList && category === 'Holdings') {
			return (
				<VaultsListEmpty
					isLoading={isLoadingVaultList}
					sortedVaultsToDisplay={sortedVaultsToDisplay}
					currentCategory={category} />
			);
		}
		if (isLoadingVaultList || sortedVaultsToDisplay.length === 0) {
			return (
				<VaultsListEmpty
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
		<section className={'mt-4 grid w-full grid-cols-12 gap-y-10 pb-10 md:mt-20 md:gap-x-10 md:gap-y-20'}>

			<HeaderUserPosition />

			<div className={'relative col-span-12 flex w-full flex-col bg-neutral-100'}>
				<div className={'absolute top-8 right-8'}>
					<VaultListOptions />
				</div>
				<ListHero
					headLabel={category}
					searchLabel={`Search ${category}`}
					searchPlaceholder={'YFI Vault'}
					categories={[
						[
							{value: 'Featured Vaults', label: 'Featured', isSelected: category === 'Featured Vaults'},
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
										<span className={`absolute -top-1 -right-1 flex h-2 w-2 ${category === 'Holdings' || migratableVaults?.length === 0 ? 'opacity-0' : 'opacity-100'}`}>
											<span className={'absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-600 opacity-75'}></span>
											<span className={'relative inline-flex h-2 w-2 rounded-full bg-pink-500'}></span>
										</span>
									</Fragment>
								)
							}
						]
					]}
					onSelect={set_category}
					searchValue={searchValue}
					set_searchValue={set_searchValue} />

				{category === 'Holdings' && migratableVaults?.length > 0 ? (
					<div className={'my-4'}>
						{migratableVaults.map((vault): ReactNode => {
							if (!vault) {
								return (null);
							}
							return (
								<VaultsListInternalMigrationRow key={vault.address} currentVault={vault} />
							);
						})}
					</div>
				) : null}

				<ListHead
					sortBy={sort.sortBy}
					sortDirection={sort.sortDirection}
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

		</section>
	);
}

Index.getLayout = function getLayout(page: ReactElement, router: NextRouter): ReactElement {
	return <Wrapper router={router}>{page}</Wrapper>;
};

export default Index;
