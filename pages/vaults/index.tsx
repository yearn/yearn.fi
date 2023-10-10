import {Fragment, useCallback, useEffect, useMemo} from 'react';
import {motion, useSpring, useTransform} from 'framer-motion';
import {VaultListOptions} from '@vaults/components/list/VaultListOptions';
import {VaultsListEmpty} from '@vaults/components/list/VaultsListEmpty';
import {VaultsListInternalMigrationRow} from '@vaults/components/list/VaultsListInternalMigrationRow';
import {VaultsListRetired} from '@vaults/components/list/VaultsListRetired';
import {VaultsListRow} from '@vaults/components/list/VaultsListRow';
import {ListHero} from '@vaults/components/ListHero';
import {OPT_VAULTS_WITH_REWARDS, STACKING_TO_VAULT} from '@vaults/constants/optRewards';
import {useAppSettings} from '@vaults/contexts/useAppSettings';
import {useFilteredVaults} from '@vaults/hooks/useFilteredVaults';
import {useSortVaults} from '@vaults/hooks/useSortVaults';
import {Wrapper} from '@vaults/Wrapper';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {Renderable} from '@yearn-finance/web-lib/components/Renderable';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useSessionStorage} from '@yearn-finance/web-lib/hooks/useSessionStorage';
import {IconChain} from '@yearn-finance/web-lib/icons/IconChain';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {ListHead} from '@common/components/ListHead';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';
import {getVaultName} from '@common/utils';

import type {NextRouter} from 'next/router';
import type {ReactElement, ReactNode} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/types';
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
	const {getToken} = useWallet();
	const {vaults, vaultsMigrations, vaultsRetired, isLoadingVaultList} = useYearn();
	const [sort, set_sort] = useSessionStorage<{
		sortBy: TPossibleSortBy;
		sortDirection: TSortDirection;
	}>('yVaultsSorting', {sortBy: 'featuringScore', sortDirection: 'desc'});
	const {shouldHideDust, shouldHideLowTVLVaults, category, searchValue, selectedChains, set_category, set_searchValue, set_selectedChains} = useAppSettings();
	const chainsFromJSON = JSON.parse(selectedChains || '[]') as number[];
	const categoriesFromJSON = JSON.parse(category || '[]') as string[];

	const filterHoldingsCallback = useCallback(
		(address: TAddress, chainID: number): boolean => {
			const holding = getToken({address, chainID});

			// [Optimism] Check if staked vaults have holdings
			if (chainsFromJSON.includes(10)) {
				const stakedVaultAddress = STACKING_TO_VAULT[toAddress(address)];
				const stakedHolding = getToken({address: stakedVaultAddress, chainID});
				const hasValidStakedBalance = stakedHolding.balance.raw > 0n;
				const stakedBalanceValue = stakedHolding.value || 0;
				if (hasValidStakedBalance && !(shouldHideDust && stakedBalanceValue < 0.01)) {
					return true;
				}
			}

			const hasValidBalance = holding.balance.raw > 0n;
			const balanceValue = holding.value || 0;
			if (shouldHideDust && balanceValue < 0.01) {
				return false;
			}
			if (hasValidBalance) {
				return true;
			}
			return false;
		},
		[getToken, chainsFromJSON, shouldHideDust]
	);

	const filterMigrationCallback = useCallback(
		(address: TAddress, chainID: number): boolean => {
			const holding = getToken({address, chainID});
			const hasValidPrice = holding.price.raw > 0n;
			const hasValidBalance = holding.balance.raw > 0n;
			if (hasValidBalance && (hasValidPrice ? (holding?.value || 0) >= 0.01 : true)) {
				return true;
			}
			return false;
		},
		[getToken]
	);

	/* 🔵 - Yearn Finance **************************************************************************
	 **	It's best to memorize the filtered vaults, which saves a lot of processing time by only
	 **	performing the filtering once.
	 **********************************************************************************************/
	const curveVaults = useFilteredVaults(vaults, ({category}): boolean => category === 'Curve');
	const boostedVaults = useFilteredVaults(vaults, ({address}): boolean => {
		if (chainsFromJSON.includes(10)) {
			return false;
		}
		return OPT_VAULTS_WITH_REWARDS.some((token): boolean => token === address);
	});
	const velodromeVaults = useFilteredVaults(vaults, ({category}): boolean => category === 'Velodrome');
	const stablesVaults = useFilteredVaults(vaults, ({category}): boolean => category === 'Stablecoin');
	const balancerVaults = useFilteredVaults(vaults, ({category}): boolean => category === 'Balancer');
	const cryptoVaults = useFilteredVaults(vaults, ({category}): boolean => category === 'Volatile');
	const holdingsVaults = useFilteredVaults(vaults, ({address, chainID}): boolean => filterHoldingsCallback(address, chainID));
	const migratableVaults = useFilteredVaults(vaultsMigrations, ({address, chainID}): boolean => filterMigrationCallback(address, chainID));
	const retiredVaults = useFilteredVaults(vaultsRetired, ({address, chainID}): boolean => filterMigrationCallback(address, chainID));

	/* 🔵 - Yearn Finance **************************************************************************
	 **	First, we need to determine in which category we are. The vaultsToDisplay function will
	 **	decide which vaults to display based on the category. No extra filters are applied.
	 **	The possible lists are memoized to avoid unnecessary re-renders.
	 **********************************************************************************************/
	const vaultsToDisplay = useMemo((): TYDaemonVault[] => {
		let _vaultList: TYDaemonVault[] = [];

		if (categoriesFromJSON.includes('Featured Vaults')) {
			_vaultList.sort((a, b): number => (b.tvl.tvl || 0) * (b?.apr?.netAPR || 0) - (a.tvl.tvl || 0) * (a?.apr?.netAPR || 0));
			_vaultList = _vaultList.slice(0, 10);
		}
		if (categoriesFromJSON.includes('Curve Vaults')) {
			_vaultList = [..._vaultList, ...curveVaults];
		}
		if (categoriesFromJSON.includes('Balancer Vaults')) {
			_vaultList = [..._vaultList, ...balancerVaults];
		}
		if (categoriesFromJSON.includes('Velodrome Vaults')) {
			_vaultList = [..._vaultList, ...velodromeVaults];
		}
		if (categoriesFromJSON.includes('Boosted Vaults')) {
			_vaultList = [..._vaultList, ...boostedVaults];
		}
		if (categoriesFromJSON.includes('Stables Vaults')) {
			_vaultList = [..._vaultList, ...stablesVaults];
		}
		if (categoriesFromJSON.includes('Crypto Vaults')) {
			_vaultList = [..._vaultList, ...cryptoVaults];
		}
		if (categoriesFromJSON.includes('Holdings')) {
			_vaultList = [..._vaultList, ...holdingsVaults];
		}

		//remove duplicates
		_vaultList = _vaultList.filter((vault, index, self): boolean => index === self.findIndex((v): boolean => v.address === vault.address));

		return _vaultList;
	}, [vaults, categoriesFromJSON, shouldHideLowTVLVaults, curveVaults, balancerVaults, velodromeVaults, boostedVaults, stablesVaults, cryptoVaults, holdingsVaults]);

	/* 🔵 - Yearn Finance **************************************************************************
	 **	Then, on the vaultsToDisplay list, we apply the search filter. The search filter is
	 **	implemented as a simple string.includes() on the vault name.
	 **********************************************************************************************/
	const searchedVaultsToDisplay = useMemo((): TYDaemonVault[] => {
		if (searchValue === '') {
			return vaultsToDisplay;
		}
		return vaultsToDisplay.filter((vault: TYDaemonVault): boolean => {
			const vaultName = getVaultName(vault).toLowerCase();
			const vaultSymbol = vault.symbol.toLowerCase();
			return [vaultName, vaultSymbol].some((attribute): boolean => attribute.includes(searchValue.toLowerCase()));
		});
	}, [vaultsToDisplay, searchValue]);

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
		const filteredByChains = sortedVaultsToDisplay.filter((vault): boolean => chainsFromJSON.includes(vault.chainID));

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
	}, [category, isLoadingVaultList, sortedVaultsToDisplay]);

	return (
		<section className={'mt-4 grid w-full grid-cols-12 gap-y-10 pb-10 md:mt-20 md:gap-x-10 md:gap-y-20'}>
			<HeaderUserPosition />

			<div className={'relative col-span-12 flex min-h-[240px] w-full flex-col overflow-x-hidden bg-neutral-100 md:overflow-x-visible'}>
				<div className={'absolute right-5 top-3 md:right-8 md:top-8'}>
					<VaultListOptions />
				</div>
				<ListHero
					categories={category}
					set_categories={set_category}
					searchValue={searchValue}
					selectedChains={selectedChains}
					set_selectedChains={set_selectedChains}
					set_searchValue={set_searchValue}
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
	return <Wrapper router={router}>{page}</Wrapper>;
};

export default Index;
