import {Children, Fragment, useMemo, useState} from 'react';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {toAddress} from '@builtbymom/web3/utils';
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
import {Button} from '@yearn-finance/web-lib/components/Button';
import {Renderable} from '@yearn-finance/web-lib/components/Renderable';
import {IconChain} from '@yearn-finance/web-lib/icons/IconChain';
import {Counter} from '@common/components/Counter';
import {ListHead} from '@common/components/ListHead';
import {Pagination} from '@common/components/Pagination';
import {useYearn} from '@common/contexts/useYearn';

import type {ReactElement, ReactNode} from 'react';
import type {TYDaemonVault, TYDaemonVaults} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TSortDirection} from '@builtbymom/web3/types';
import type {TPossibleSortBy} from '@vaults/hooks/useSortVaults';

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
							toAddress(address) !== toAddress(`0x5b977577eb8a480f63e11fc615d6753adb8652ae`) ||
							toAddress(address) !== toAddress(`0xad17a225074191d5c8a37b50fda1ae278a2ee6a2`)
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
	const {getBalance, isLoadingVaultList} = useYearn();
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
	const [page, set_page] = useState(1);

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
			const hasBalance = getBalance({address: vault.address, chainID: vault.chainID}).raw > 0n;
			const hasStakingBalance = getBalance({address: vault.staking.address, chainID: vault.chainID}).raw > 0n;
			if (hasBalance || hasStakingBalance) {
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
	}, [types, chains, getBalance, isLoadingVaultList, onReset, search]);

	const possibleLists = VaultList as [ReactNode, ReactNode];
	const hasHoldings = Children.count(possibleLists[0]) > 0;
	const totalVaults = Children.count(possibleLists[1]);
	const pageSize = 20;

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
			<section className={'mt-4 grid w-full grid-cols-12 gap-y-10 pb-10 md:mt-20 md:gap-x-10 md:gap-y-20'}>
				<HeaderUserPosition />
				<ListOfVaults />
			</section>
		</div>
	);
}

export default Index;
