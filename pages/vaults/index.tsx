import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import {QueryParamProvider, StringParam, useQueryParams} from 'use-query-params';
import {motion, useSpring, useTransform} from 'framer-motion';
import {VaultListOptions} from '@vaults/components/list/VaultListOptions';
import {VaultsListEmpty} from '@vaults/components/list/VaultsListEmpty';
import {VaultsListInternalMigrationRow} from '@vaults/components/list/VaultsListInternalMigrationRow';
import {VaultsListRetired} from '@vaults/components/list/VaultsListRetired';
import {VaultsListRow} from '@vaults/components/list/VaultsListRow';
import {ListHero} from '@vaults/components/ListHero';
import {useAppSettings} from '@vaults/contexts/useAppSettings';
import {useVaultFilter} from '@vaults/hooks/useFilteredVaults';
import {useSortVaults} from '@vaults/hooks/useSortVaults';
import {Wrapper} from '@vaults/Wrapper';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {Renderable} from '@yearn-finance/web-lib/components/Renderable';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useSessionStorage} from '@yearn-finance/web-lib/hooks/useSessionStorage';
import {IconChain} from '@yearn-finance/web-lib/icons/IconChain';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {ListHead} from '@common/components/ListHead';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';
import {NextQueryParamAdapter} from '@common/utils/QueryParamsProvider';

import type {NextRouter} from 'next/router';
import type {ReactElement, ReactNode} from 'react';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';
import type {TSortDirection} from '@common/types/types';
import type {TPossibleSortBy} from '@vaults/hooks/useSortVaults';

function Counter({value}: {value: number}): ReactElement {
	const v = useSpring(value, {mass: 1, stiffness: 75, damping: 15});
	const display = useTransform(v, (current): string => `$${formatAmount(current)}`);

	useEffect((): void => {
		v.set(value);
	}, [v, value]);

	return <motion.span>{display}</motion.span>;
}

function HeaderUserPosition(): ReactElement {
	const {cumulatedValueInVaults} = useWallet();
	const {earned} = useYearn();
	const {options, isActive, address, openLoginModal, onSwitchChain} = useWeb3();

	const formatedYouEarned = useMemo((): string => {
		const amount = (earned?.totalUnrealizedGainsUSD || 0) > 0 ? earned?.totalUnrealizedGainsUSD || 0 : 0;
		return formatAmount(amount) ?? '';
	}, [earned?.totalUnrealizedGainsUSD]);

	const formatedYouHave = useMemo((): string => {
		return formatAmount(cumulatedValueInVaults || 0) ?? '';
	}, [cumulatedValueInVaults]);

	if (!isActive) {
		return (
			<Fragment>
				<div className={'col-span-12 h-auto w-full md:col-span-8 md:h-[136px]'}>
					<p className={'pb-2 text-lg text-neutral-900 md:pb-6 md:text-3xl'}>{'Wallet not connected'}</p>
					<Button
						onClick={(): void => {
							if (!isActive && address) {
								onSwitchChain(options?.defaultChainID || 1);
							} else {
								openLoginModal();
							}
						}}>
						{'Connect Wallet'}
					</Button>
				</div>
			</Fragment>
		);
	}
	return (
		<Fragment>
			<div className={'col-span-12 w-full md:col-span-8'}>
				<p className={'pb-2 text-lg text-neutral-900 md:pb-6 md:text-3xl'}>{'Deposited'}</p>
				<b className={'font-number text-4xl text-neutral-900 md:text-7xl'}>
					<Counter value={Number(formatedYouHave)} />
				</b>
			</div>
			<div className={'col-span-12 w-full md:col-span-4'}>
				<p className={'pb-2 text-lg text-neutral-900 md:pb-6 md:text-3xl'}>{'Earnings'}</p>
				<b className={'font-number text-3xl text-neutral-900 md:text-7xl'}>
					<Counter value={Number(formatedYouEarned)} />
				</b>
			</div>
		</Fragment>
	);
}

function Index(): ReactElement {
	const {isLoadingVaultList} = useYearn();
	const [sort, set_sort] = useSessionStorage<{
		sortBy: TPossibleSortBy;
		sortDirection: TSortDirection;
	}>('yVaultsSorting', {sortBy: 'featuringScore', sortDirection: 'desc'});
	const {category, selectedChains, set_category, set_selectedChains} = useAppSettings();
	const chainsFromJSON = useMemo((): number[] => JSON.parse(selectedChains || '[]') as number[], [selectedChains]);
	const categoriesFromJSON = useMemo((): string[] => JSON.parse(category || '[]') as string[], [category]);
	const {activeVaults, migratableVaults, retiredVaults} = useVaultFilter();
	const [searchParam, set_searchParam] = useQueryParams({search: StringParam});
	const [search, set_search] = useState(searchParam?.search);

	/** 🔵 - Yearn *********************************************************************************
	 **	This useEffect hook is used to synchronize the search state with the query parameter
	 **	It checks if the search state and the search query parameter are the same, if they are,
	 ** it does nothing.
	 **	If the search state is undefined and the search query parameter is not, it sets the search
	 ** state to the value of the search query parameter.
	 **	If the search state is not undefined, it updates the search query parameter to match the
	 ** search state.
	 **	If the search state is undefined, it removes the search query parameter.
	 *********************************************************************************************/
	useEffect((): void => {
		// If the search state and the search query parameter are the same, do nothing
		if (searchParam.search === search) {
			return;
		}
		// If the search state is undefined and the search query parameter is not, set the search
		// state to the value of the search query parameter
		if (search === undefined && searchParam.search !== undefined) {
			set_search(searchParam.search);
			return;
		}
		// If the search state is not undefined, update the search query parameter to match
		// the search state
		if (!search) {
			set_searchParam({}, 'push');
		} else {
			set_searchParam({search: search}, 'push');
		}
	}, [searchParam, search, set_searchParam]);

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
			return (
				vault.name.toLowerCase().startsWith(lowercaseSearch) ||
				vault.symbol.toLowerCase().startsWith(lowercaseSearch) ||
				vault.token.name.toLowerCase().startsWith(lowercaseSearch) ||
				vault.token.symbol.toLowerCase().startsWith(lowercaseSearch) ||
				vault.address.toLowerCase().startsWith(lowercaseSearch) ||
				vault.token.address.toLowerCase().startsWith(lowercaseSearch)
			);
		});
	}, [activeVaults, search]);

	/* 🔵 - Yearn Finance **************************************************************************
	 **	Then, once we have reduced the list of vaults to display, we can sort them. The sorting
	 **	is done via a custom method that will sort the vaults based on the sortBy and
	 **	sortDirection values.
	 **********************************************************************************************/
	const sortedVaultsToDisplay = useSortVaults([...searchedVaultsToDisplay], sort.sortBy, sort.sortDirection);

	/* 🔵 - Yearn Finance **************************************************************************
	 **	Callback method used to sort the vaults list.
	 **	The use of useCallback() is to prevent the method from being re-created on every render.
	 **********************************************************************************************/
	const onSort = useCallback(
		(newSortBy: string, newSortDirection: string): void => {
			set_sort({
				sortBy: newSortBy as TPossibleSortBy,
				sortDirection: newSortDirection as TSortDirection
			});
		},
		[set_sort]
	);

	/* 🔵 - Yearn Finance **************************************************************************
	 **	The VaultList component is memoized to prevent it from being re-created on every render.
	 **	It contains either the list of vaults, is some are available, or a message to the user.
	 **********************************************************************************************/
	const VaultList = useMemo((): ReactNode => {
		const filteredByChains = sortedVaultsToDisplay.filter((vault): boolean =>
			chainsFromJSON.includes(vault.chainID)
		);

		if (isLoadingVaultList && categoriesFromJSON.includes('Holdings')) {
			return (
				<VaultsListEmpty
					isLoading={isLoadingVaultList}
					sortedVaultsToDisplay={filteredByChains}
					currentCategories={categoriesFromJSON}
					currentChains={chainsFromJSON}
				/>
			);
		}
		if (isLoadingVaultList || isZero(filteredByChains.length) || chainsFromJSON.length === 0) {
			return (
				<VaultsListEmpty
					isLoading={isLoadingVaultList}
					sortedVaultsToDisplay={filteredByChains}
					currentCategories={categoriesFromJSON}
					currentChains={chainsFromJSON}
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
	}, [categoriesFromJSON, chainsFromJSON, isLoadingVaultList, sortedVaultsToDisplay]);

	return (
		<section className={'mt-4 grid w-full grid-cols-12 gap-y-10 pb-10 md:mt-20 md:gap-x-10 md:gap-y-20'}>
			<HeaderUserPosition />

			<div
				className={
					'relative col-span-12 flex min-h-[240px] w-full flex-col overflow-x-hidden bg-neutral-100 md:overflow-x-visible'
				}>
				<div className={'absolute right-5 top-3 md:right-8 md:top-8'}>
					<VaultListOptions />
				</div>
				<ListHero
					categories={category}
					set_categories={set_category}
					searchValue={search || ''}
					selectedChains={selectedChains}
					set_selectedChains={set_selectedChains}
					onSearch={(value: string): void => set_search(value)}
				/>

				<Renderable shouldRender={category === 'Holdings' && retiredVaults?.length > 0}>
					<div>
						{retiredVaults
							.filter((vault): boolean => !!vault)
							.map(
								(vault): ReactNode => (
									<VaultsListRetired
										key={`${vault.chainID}_${vault.address}`}
										currentVault={vault}
									/>
								)
							)}
					</div>
				</Renderable>

				<Renderable shouldRender={category === 'Holdings' && migratableVaults?.length > 0}>
					<div>
						{migratableVaults
							.filter((vault): boolean => !!vault)
							.map(
								(vault): ReactNode => (
									<VaultsListInternalMigrationRow
										key={`${vault.chainID}_${vault.address}`}
										currentVault={vault}
									/>
								)
							)}
					</div>
				</Renderable>

				<div className={'mt-4'} />
				<ListHead
					sortBy={sort.sortBy}
					sortDirection={sort.sortDirection}
					onSort={onSort}
					dataClassName={'grid-cols-10'}
					items={[
						{label: <IconChain />, value: 'chain', sortable: false, className: 'col-span-1'},
						{label: 'Token', value: 'name', sortable: true},
						{label: 'Est. APR', value: 'forwardAPR', sortable: true, className: 'col-span-2'},
						{label: 'Hist. APR', value: 'apr', sortable: true, className: 'col-span-2'},
						{label: 'Available', value: 'available', sortable: true, className: 'col-span-2'},
						{label: 'Deposited', value: 'deposited', sortable: true, className: 'col-span-2'},
						{label: 'TVL', value: 'tvl', sortable: true, className: 'col-span-2'}
					]}
				/>

				{VaultList}
			</div>
		</section>
	);
}

Index.getLayout = function getLayout(page: ReactElement, router: NextRouter): ReactElement {
	return (
		<Wrapper router={router}>
			<QueryParamProvider adapter={NextQueryParamAdapter}>{page}</QueryParamProvider>
		</Wrapper>
	);
};

export default Index;
