import {Children, Fragment, useEffect, useMemo, useState} from 'react';
import {VaultListOptions} from '@vaults-v2/components/list/VaultListOptions';
import {VaultsListEmpty} from '@vaults-v2/components/list/VaultsListEmpty';
import {VaultsListInternalMigrationRow} from '@vaults-v2/components/list/VaultsListInternalMigrationRow';
import {VaultsListRetired} from '@vaults-v2/components/list/VaultsListRetired';
import {VaultsListRow} from '@vaults-v2/components/list/VaultsListRow';
import {ListHero} from '@vaults-v2/components/ListHero';
import {ALL_VAULTS_CATEGORIES, ALL_VAULTS_CATEGORIES_KEYS} from '@vaults-v2/constants';
import {useSortVaults} from '@vaults-v2/hooks/useSortVaults';
import {useQueryArguments} from '@vaults-v2/hooks/useVaultsQueryArgs';
import {Button} from '@lib/components/Button';
import {Counter} from '@lib/components/Counter';
import {ListHead} from '@lib/components/ListHead';
import {Pagination} from '@lib/components/Pagination';
import {Renderable} from '@lib/components/Renderable';
import {useWeb3} from '@lib/contexts/useWeb3';
import {useWallet} from '@lib/contexts/useWallet';
import {useYearn} from '@lib/contexts/useYearn';
import {useVaultFilter} from '@lib/hooks/useFilteredVaults';
import {IconChain} from '@lib/icons/IconChain';
import {toAddress, toNormalizedBN} from '@lib/utils';

import type {ReactElement, ReactNode} from 'react';
import type {TSortDirection} from '@lib/types';
import type {TYDaemonVault, TYDaemonVaults} from '@lib/utils/schemas/yDaemonVaultsSchemas';
import type {TPossibleSortBy} from '@vaults-v2/hooks/useSortVaults';

function HeaderUserPosition(): ReactElement {
	const {cumulatedValueInV2Vaults} = useYearn();
	const {isActive, address, openLoginModal, onSwitchChain} = useWeb3();

	if (!isActive) {
		return (
			<Fragment>
				<div className={'col-span-12 h-auto w-full md:col-span-8 md:h-[136px]'}>
					<p className={'pb-2 text-lg text-neutral-900 md:pb-6 md:text-3xl'}>{'Wallet not connected'}</p>
					<Button
						onClick={(): void => {
							if (!isActive && address) {
								onSwitchChain(1);
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
					{'$'}
					<Counter
						value={Number(cumulatedValueInV2Vaults)}
						decimals={2}
					/>
				</b>
			</div>
		</Fragment>
	);
}

function ListOfRetiredVaults({retiredVaults}: {retiredVaults: TYDaemonVaults}): ReactElement {
	return (
		<Renderable shouldRender={retiredVaults?.length > 0}>
			<div>
				{retiredVaults
					.filter((vault): boolean => !!vault)
					.filter(
						({address}): boolean =>
							toAddress(address) !== toAddress('0x5b977577eb8a480f63e11fc615d6753adb8652ae') ||
							toAddress(address) !== toAddress('0xad17a225074191d5c8a37b50fda1ae278a2ee6a2')
					)
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
	);
}

function ListOfMigratableVaults({migratableVaults}: {migratableVaults: TYDaemonVaults}): ReactElement {
	return (
		<Renderable shouldRender={migratableVaults?.length > 0}>
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
	);
}

function ListOfVaults(): ReactElement {
	const {getBalance} = useWallet();
	const {isLoadingVaultList, getPrice} = useYearn();
	const {
		search,
		types,
		chains,
		sortDirection,
		sortBy,
		onSearch,
		onChangeTypes,
		onChangeChains,
		onChangeSortDirection,
		onChangeSortBy,
		onReset
	} = useQueryArguments({
		defaultTypes: ALL_VAULTS_CATEGORIES_KEYS,
		defaultPathname: '/vaults'
	});
	const {activeVaults, migratableVaults, retiredVaults} = useVaultFilter(types, chains);
	const [page, set_page] = useState(0);

	/* 🔵 - Yearn Finance **************************************************************************
	 **	Enhanced search filter implementation that performs case-insensitive partial matching
	 **	on multiple vault properties. The search supports multi-word queries and handles special
	 **	characters intelligently to improve matching quality.
	 **********************************************************************************************/
	const searchedVaultsToDisplay = useMemo((): TYDaemonVault[] => {
		if (!search) {
			return activeVaults;
		}

		const searchResults = activeVaults.filter((vault: TYDaemonVault): boolean => {
			const lowercaseSearch = search.toLowerCase().trim();
			// If searching for a specific address
			if (
				lowercaseSearch.length > 30 &&
				(vault.address.toLowerCase().includes(lowercaseSearch) ||
					vault.token.address.toLowerCase().includes(lowercaseSearch))
			) {
				return true;
			}

			// Normalize search terms
			const allSearchWords = lowercaseSearch
				.split(' ')
				.filter(word => word.length > 0)
				.map(word => word.trim());

			if (allSearchWords.length === 0) {
				return false;
			}

			// Create a normalized string containing all searchable vault properties
			const vaultInfoString = `${vault.name} ${vault.symbol} ${vault.token.name} ${vault.token.symbol}`
				.toLowerCase()
				.replaceAll('-', ' ')
				.replaceAll('_', ' ')
				.replaceAll('.', ' ')
				.replaceAll(',', ' ')
				.replaceAll('+', ' ')
				.replaceAll('/', ' ');

			// More flexible matching based on search term count
			if (allSearchWords.length === 1) {
				// For single word searches, just check if it appears anywhere
				return vaultInfoString.includes(allSearchWords[0]);
			}
			// For multi-word searches, try both OR and AND logic based on what makes more sense
			const isAllWordsMatch = allSearchWords.every(word => vaultInfoString.includes(word));
			const isAnyWordMatches = allSearchWords.some(word => vaultInfoString.includes(word));

			// If all words match, this is clearly a good result
			if (isAllWordsMatch) {
				return true;
			}

			// If any word matches and it's a significant portion of the search, return it
			const fullSearchString = allSearchWords.join(' ');
			if (isAnyWordMatches && vaultInfoString.includes(fullSearchString)) {
				return true;
			}

			return isAnyWordMatches;
		});

		return searchResults;
	}, [activeVaults, search]);

	const sortedVaultsToDisplay = useSortVaults([...searchedVaultsToDisplay], sortBy, sortDirection);

	const VaultList = useMemo((): [ReactNode, ReactNode, ReactNode, ReactNode] | ReactNode => {
		const filteredByChains = sortedVaultsToDisplay.filter(
			({chainID}): boolean => chains?.includes(chainID) || false
		);

		if (isLoadingVaultList || !chains || chains.length === 0) {
			return (
				<VaultsListEmpty
					isLoading={isLoadingVaultList}
					sortedVaultsToDisplay={filteredByChains}
					currentSearch={search || ''}
					currentCategories={types}
					currentChains={chains}
					onReset={onReset}
					defaultCategories={ALL_VAULTS_CATEGORIES_KEYS}
				/>
			);
		}

		const holdings: ReactNode[] = [];
		const all: ReactNode[] = [];
		for (const vault of filteredByChains) {
			const balance = getBalance({address: vault.address, chainID: vault.chainID});
			const stakingBalance = getBalance({address: vault.staking.address, chainID: vault.chainID});
			const price = getPrice({address: vault.address, chainID: vault.chainID});

			const holdingsValue =
				toNormalizedBN(balance.raw + stakingBalance.raw, vault.decimals).normalized * price.normalized;

			if (holdingsValue > 0.001) {
				holdings.push(
					<VaultsListRow
						key={`${vault.chainID}_${vault.address}`}
						currentVault={vault}
					/>
				);
				continue;
			}

			all.push(
				<VaultsListRow
					key={`${vault.chainID}_${vault.address}`}
					currentVault={vault}
				/>
			);
		}

		return [holdings, all];
	}, [sortedVaultsToDisplay, isLoadingVaultList, chains, search, types, onReset, getBalance, getPrice]);

	const possibleLists = VaultList as [ReactNode, ReactNode];
	const hasHoldings = Children.count(possibleLists[0]) > 0;
	const totalVaults = Children.count(possibleLists[1]);
	const pageSize = 20;

	/* 🔵 - Yearn Finance **************************************************************************
	 **	This effect ensures that the pagination resets properly when search results change,
	 **	especially when a search returns fewer results than would fill the current page.
	 **********************************************************************************************/
	useEffect(() => {
		const totalPages = Math.ceil(Children.count(possibleLists[1]) / pageSize);

		// If current page is beyond available pages, reset to first page
		if (page >= totalPages && totalPages > 0) {
			set_page(0);
		}
	}, [searchedVaultsToDisplay, page, possibleLists]);

	return (
		<div
			className={
				'relative col-span-12 flex min-h-[240px] w-full flex-col overflow-x-hidden bg-neutral-100 md:overflow-x-visible'
			}>
			<div className={'absolute right-5 top-3 md:right-8 md:top-8'}>
				<VaultListOptions />
			</div>
			<ListHero
				categories={types}
				possibleCategories={ALL_VAULTS_CATEGORIES}
				searchValue={search || ''}
				chains={chains}
				onChangeChains={onChangeChains}
				onChangeCategories={onChangeTypes}
				onSearch={onSearch}
			/>

			<ListOfRetiredVaults retiredVaults={retiredVaults} />
			<ListOfMigratableVaults migratableVaults={migratableVaults} />

			<div className={'mt-4'} />
			<ListHead
				dataClassName={'grid-cols-10'}
				sortBy={sortBy}
				sortDirection={sortDirection}
				onSort={(newSortBy: string, newSortDirection: TSortDirection): void => {
					onChangeSortBy(newSortBy as TPossibleSortBy);
					onChangeSortDirection(newSortDirection as TSortDirection);
				}}
				items={[
					{label: <IconChain />, value: 'chain', sortable: false, className: 'col-span-1'},
					{label: 'Token', value: 'name', sortable: true},
					{label: 'Est. APY', value: 'estAPY', sortable: true, className: 'col-span-2'},
					{label: 'Hist. APY', value: 'APY', sortable: true, className: 'col-span-2'},
					{label: 'Available', value: 'available', sortable: true, className: 'col-span-2'},
					{label: 'Holdings', value: 'deposited', sortable: true, className: 'col-span-2'},
					{label: 'Deposits', value: 'tvl', sortable: true, className: 'col-span-2'}
				]}
			/>

			<div className={'grid gap-0'}>
				<Fragment>
					{hasHoldings && (
						<div className={'relative grid h-fit'}>
							<p className={'absolute -left-20 top-1/2 -rotate-90 text-xs text-neutral-400'}>
								&nbsp;&nbsp;&nbsp;{'Your holdings'}&nbsp;&nbsp;&nbsp;
							</p>
							{possibleLists[0]}
						</div>
					)}
					{Children.count(possibleLists[0]) > 0 && Children.count(possibleLists[1]) > 0 ? (
						<div className={'h-1 rounded-lg bg-neutral-200'} />
					) : null}
					{((possibleLists[1] || []) as ReactNode[]).slice(page * pageSize, (page + 1) * pageSize)}
				</Fragment>
			</div>

			<div className={'mt-4'}>
				<div className={'border-t border-neutral-200/60 p-4'}>
					<Pagination
						range={[0, totalVaults]}
						pageCount={totalVaults / pageSize}
						numberOfItems={totalVaults}
						currentPage={page}
						onPageChange={(newPage): void => set_page(newPage.selected)}
					/>
				</div>
			</div>
		</div>
	);
}

function Index(): ReactElement {
	return (
		<div className={'mx-auto my-0 max-w-6xl pt-4 md:mb-0 md:mt-16'}>
			<section className={'mt-16 grid w-full grid-cols-12 gap-y-10 pb-10 md:mt-20 md:gap-x-10 md:gap-y-20'}>
				<HeaderUserPosition />
				<ListOfVaults />
			</section>
		</div>
	);
}

export default Index;
