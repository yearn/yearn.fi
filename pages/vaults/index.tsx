import {Fragment, useEffect, useMemo} from 'react';
import {QueryParamProvider} from 'use-query-params';
import {motion, useSpring, useTransform} from 'framer-motion';
import {VaultListOptions} from '@vaults/components/list/VaultListOptions';
import {VaultsListEmpty} from '@vaults/components/list/VaultsListEmpty';
import {VaultsListInternalMigrationRow} from '@vaults/components/list/VaultsListInternalMigrationRow';
import {VaultsListRetired} from '@vaults/components/list/VaultsListRetired';
import {VaultsListRow} from '@vaults/components/list/VaultsListRow';
import {ListHero} from '@vaults/components/ListHero';
import {ALL_VAULTS_CATEGORIES, ALL_VAULTS_CATEGORIES_KEYS} from '@vaults/constants';
import {useVaultFilter} from '@vaults/hooks/useFilteredVaults';
import {useSortVaults} from '@vaults/hooks/useSortVaults';
import {useQueryArguments} from '@vaults/hooks/useVaultsQueryArgs';
import {Wrapper} from '@vaults/Wrapper';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {Renderable} from '@yearn-finance/web-lib/components/Renderable';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {IconChain} from '@yearn-finance/web-lib/icons/IconChain';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {ListHead} from '@common/components/ListHead';
import {Pagination} from '@common/components/Pagination';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';
import {usePagination} from '@common/hooks/usePagination';
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
	const {cumulatedValueInV2Vaults} = useWallet();
	const {earned} = useYearn();
	const {options, isActive, address, openLoginModal, onSwitchChain} = useWeb3();

	const formatedYouEarned = useMemo((): string => {
		const amount = (earned?.totalUnrealizedGainsUSD || 0) > 0 ? earned?.totalUnrealizedGainsUSD || 0 : 0;
		return formatAmount(amount) ?? '';
	}, [earned?.totalUnrealizedGainsUSD]);

	const formatedYouHave = useMemo((): string => {
		return formatAmount(cumulatedValueInV2Vaults || 0) ?? '';
	}, [cumulatedValueInV2Vaults]);

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

function ListOfVaults(): ReactElement {
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
	} = useQueryArguments({defaultCategories: ALL_VAULTS_CATEGORIES_KEYS});
	const {activeVaults, migratableVaults, retiredVaults} = useVaultFilter(categories, chains);

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

	const filteredByChains = useMemo((): TYDaemonVault[] => {
		return sortedVaultsToDisplay.filter(({chainID}): boolean => chains.includes(chainID));
	}, [chains, sortedVaultsToDisplay]);

	const {currentItems, paginationProps} = usePagination<TYDaemonVault>({
		data: filteredByChains,
		itemsPerPage: 60 || sortedVaultsToDisplay.length
	});

	return (
		<div
			className={
				'relative col-span-12 flex min-h-[240px] w-full flex-col overflow-x-hidden bg-neutral-100 md:overflow-x-visible'
			}>
			<div className={'absolute right-5 top-3 md:right-8 md:top-8'}>
				<VaultListOptions />
			</div>
			<ListHero
				categories={categories}
				possibleCategories={ALL_VAULTS_CATEGORIES}
				searchValue={search || ''}
				chains={chains}
				onChangeChains={onChangeChains}
				onChangeCategories={onChangeCategories}
				onSearch={onSearch}
			/>

			<Renderable shouldRender={(categories || []).includes('holdings') && retiredVaults?.length > 0}>
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

			<Renderable shouldRender={(categories || []).includes('holdings') && migratableVaults?.length > 0}>
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
					{label: 'Deposited', value: 'deposited', sortable: true, className: 'col-span-2'},
					{label: 'TVL', value: 'tvl', sortable: true, className: 'col-span-2'}
				]}
			/>

			{isLoadingVaultList || isZero(filteredByChains.length) || chains.length === 0 ? (
				<VaultsListEmpty
					isLoading={isLoadingVaultList}
					sortedVaultsToDisplay={filteredByChains}
					currentSearch={search || ''}
					currentCategories={categories}
					currentChains={chains}
					onChangeCategories={onChangeCategories}
					onChangeChains={onChangeChains}
				/>
			) : (
				currentItems.map((vault): ReactNode => {
					if (!vault) {
						return null;
					}
					return (
						<VaultsListRow
							key={`${vault.chainID}_${vault.address}`}
							currentVault={vault}
						/>
					);
				})
			)}

			<div className={'mt-4'}>
				<div className={'border-t border-neutral-200/60 p-4'}>
					<Pagination {...paginationProps} />
				</div>
			</div>
		</div>
	);
}

function Index(): ReactElement {
	return (
		<section className={'mt-4 grid w-full grid-cols-12 gap-y-10 pb-10 md:mt-20 md:gap-x-10 md:gap-y-20'}>
			<HeaderUserPosition />
			<QueryParamProvider
				adapter={NextQueryParamAdapter}
				options={{removeDefaultsFromUrl: true}}>
				<ListOfVaults />
			</QueryParamProvider>
		</section>
	);
}

Index.getLayout = function getLayout(page: ReactElement, router: NextRouter): ReactElement {
	return <Wrapper router={router}>{page}</Wrapper>;
};

export default Index;
