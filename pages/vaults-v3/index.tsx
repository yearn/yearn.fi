import {Fragment, useEffect, useMemo} from 'react';
import {QueryParamProvider} from 'use-query-params';
import {motion, useSpring, useTransform} from 'framer-motion';
import {VaultListOptions} from '@vaults/components/list/VaultListOptions';
import {VaultsListEmpty} from '@vaults/components/list/VaultsListEmpty';
import {VaultsListInternalMigrationRow} from '@vaults/components/list/VaultsListInternalMigrationRow';
import {VaultsListRetired} from '@vaults/components/list/VaultsListRetired';
import {VaultsListRow} from '@vaults/components/list/VaultsListRow';
import {ListHero} from '@vaults/components/ListHero';
import {useVaultFilter} from '@vaults/hooks/useFilteredVaults';
import {useSortVaults} from '@vaults/hooks/useSortVaults';
import {useQueryArguments} from '@vaults/hooks/useVaultsQueryArgs';
import {Wrapper} from '@vaults/Wrapper';
import {V3Mask} from '@vaults-v3/Mark';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {Renderable} from '@yearn-finance/web-lib/components/Renderable';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
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
			<div className={'col-span-12 w-full rounded-3xl bg-neutral-0 p-6 md:col-span-6'}>
				<strong
					className={'block pb-2 text-lg font-black text-neutral-900 md:pb-6 md:text-4xl md:leading-[48px]'}>
					{'Portfolio'}
				</strong>
				<div className={'flex flex-row gap-32'}>
					<div>
						<p className={'pb-2 text-[#757CA6]'}>{'Deposited'}</p>
						<b className={'font-number text-3xl text-neutral-900 md:text-3xl'}>
							<Counter value={Number(formatedYouHave)} />
						</b>
					</div>
					<div>
						<p className={'pb-2 text-[#757CA6]'}>{'Earnings'}</p>
						<b className={'font-number text-3xl text-neutral-900 md:text-3xl'}>
							<Counter value={Number(formatedYouEarned)} />
						</b>
					</div>
				</div>
			</div>
			<div className={'col-span-12 w-full md:col-span-6'}>
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
	} = useQueryArguments();
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
			const splitted =
				`${vault.name} ${vault.symbol} ${vault.token.name} ${vault.token.symbol} ${vault.address} ${vault.token.address}`
					.toLowerCase()
					.split(' ');
			return splitted.some((word): boolean => word.startsWith(lowercaseSearch));
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
		const filteredByChains = sortedVaultsToDisplay.filter(({chainID}): boolean => chains.includes(chainID));

		if (isLoadingVaultList || isZero(filteredByChains.length) || chains.length === 0) {
			return (
				<VaultsListEmpty
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
		<div
			className={
				'relative col-span-12 flex min-h-[240px] w-full flex-col overflow-x-hidden bg-neutral-100 md:overflow-x-visible'
			}>
			<div className={'absolute right-5 top-3 md:right-8 md:top-8'}>
				<VaultListOptions />
			</div>
			<ListHero
				categories={categories}
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

			{VaultList}
		</div>
	);
}

function Index(): ReactElement {
	return (
		<div>
			<div className={'mx-auto grid max-w-6xl grid-cols-75 bg-neutral-0'}>
				<div
					className={'col-span-46 h-full rounded-3xl px-10 pb-8 pt-10'}
					style={{background: 'linear-gradient(73deg, #D21162 24.91%, #2C3DA6 99.66%)'}}>
					<h1 className={'mb-8 text-[96px] font-black leading-[104px] text-neutral-900'}>
						{'BRAND NEW VAULTS'}
					</h1>
					<p className={'mb-8 text-xl text-[#F2B7D0]'}>
						{'Corn asked for new pretty design for this page, so hope you like it mates <3'}
					</p>
					<div>
						<button className={'rounded-3xl bg-white px-12 py-2 font-bold text-[#CE1364]'}>
							{'Explore more'}
						</button>
					</div>
				</div>
				<div className={'col-span-29 ml-6'}>
					<div className={'flex w-full flex-col gap-y-6'}>
						<div className={'relative h-[248px] rounded-3xl bg-neutral-200'}>
							<V3Mask className={'absolute bottom-6 right-4'} />
						</div>
						<div className={'rounded-3xl bg-neutral-200 p-6 pb-10'}>
							<strong className={'mb-2 block text-4xl font-black leading-[48px] text-neutral-900'}>
								{'TVL'}
							</strong>
							<b className={'font-number block text-4xl font-bold text-neutral-900'}>
								{formatAmount(420420690, 0, 0)}
							</b>
						</div>
					</div>
				</div>
			</div>
			<section className={'relative mt-20 w-full bg-neutral-100'}>
				<div className={'absolute inset-x-0 top-0 flex w-full items-center justify-center'}>
					<div className={'relative z-50 -mt-8 flex justify-center rounded-t-3xl'}>
						<svg
							xmlns={'http://www.w3.org/2000/svg'}
							width={'113'}
							height={'32'}
							viewBox={'0 0 113 32'}
							fill={'none'}>
							<path
								d={'M0 32C37.9861 32 20.9837 0 56 0C91.0057 0 74.388 32 113 32H0Z'}
								fill={'#000520'}
							/>
						</svg>
						<div className={'absolute mt-2 flex justify-center'}>
							<svg
								xmlns={'http://www.w3.org/2000/svg'}
								width={'24'}
								height={'24'}
								viewBox={'0 0 24 24'}
								fill={'none'}>
								<path
									fill-rule={'evenodd'}
									clip-rule={'evenodd'}
									d={
										'M4.34151 16.7526C3.92587 16.3889 3.88375 15.7571 4.24744 15.3415L11.2474 7.34148C11.4373 7.12447 11.7117 6.99999 12 6.99999C12.2884 6.99999 12.5627 7.12447 12.7526 7.34148L19.7526 15.3415C20.1163 15.7571 20.0742 16.3889 19.6585 16.7526C19.2429 17.1162 18.6111 17.0741 18.2474 16.6585L12 9.51858L5.75259 16.6585C5.38891 17.0741 4.75715 17.1162 4.34151 16.7526Z'
									}
									fill={'white'}
								/>
							</svg>
						</div>
					</div>
				</div>

				<div className={'mx-auto grid w-full max-w-6xl grid-cols-12 gap-6 pt-6'}>
					<HeaderUserPosition />
				</div>

				<div
					className={
						'mx-auto mt-4 grid w-full max-w-6xl grid-cols-12 gap-y-10 pb-10 pt-6 md:mt-20 md:gap-x-10 md:gap-y-20'
					}>
					<QueryParamProvider
						adapter={NextQueryParamAdapter}
						options={{removeDefaultsFromUrl: true}}>
						<ListOfVaults />
					</QueryParamProvider>
				</div>
			</section>
		</div>
	);
}

Index.getLayout = function getLayout(page: ReactElement, router: NextRouter): ReactElement {
	return <Wrapper router={router}>{page}</Wrapper>;
};

export default Index;
