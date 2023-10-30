import {Fragment, useEffect, useMemo, useState} from 'react';
import {motion, useSpring, useTransform} from 'framer-motion';
import {VaultsListEmpty} from '@vaults/components/list/VaultsListEmpty';
import {useVaultFilter} from '@vaults/hooks/useFilteredVaults';
import {useSortVaults} from '@vaults/hooks/useSortVaults';
import {useQueryArguments} from '@vaults/hooks/useVaultsQueryArgs';
import {Filters} from '@vaults-v3/components/Filters';
import {VaultsV3ListHead} from '@vaults-v3/components/list/VaultsV3ListHead';
import {VaultsV3ListRow} from '@vaults-v3/components/list/VaultsV3ListRow';
import {ALL_CATEGORIES_KEYS} from '@vaults-v3/constants';
import {V3Mask} from '@vaults-v3/Mark';
import {Wrapper} from '@vaults-v3/Wrapper';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';

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

function Background(): ReactElement {
	return (
		<motion.div
			transition={{duration: 10, delay: 0, repeat: Infinity, ease: 'linear'}}
			animate={{
				background: [
					`linear-gradient(0deg, #D21162 24.91%, #2C3DA6 99.66%)`,
					`linear-gradient(360deg, #D21162 24.91%, #2C3DA6 99.66%)`
				]
			}}
			className={cl('absolute inset-0', 'pointer-events-none')}
		/>
	);
}
function BrandNewVaultCard(): ReactElement {
	return (
		<div
			className={cl(
				'h-full rounded-3xl relative overflow-hidden',
				'pr-2 pl-4 pb-4 pt-6 md:p-10',
				'col-span-75 md:col-span-46'
			)}>
			<div className={'relative z-10'}>
				<h1
					className={cl(
						'mb-2 md:mb-10 font-black text-neutral-900',
						'text-[48px] md:text-[56px] md:leading-[64px] leading-[56px]',
						'whitespace-break-spaces uppercase'
					)}>
					{'Discover brand\nnew vaults'}
				</h1>
				<p className={'mb-4 whitespace-break-spaces text-base text-[#F2B7D0] md:text-lg'}>
					{
						'Yearn v3 is a new yield paradigm offering better automation,\ncomposability and flexibility. Enjoy!'
					}
				</p>
				<div>
					<button className={'rounded-3xl bg-white px-12 py-2 font-bold text-[#CE1364]'}>
						{'Explore more'}
					</button>
				</div>
			</div>
			<Background />
		</div>
	);
}
function V3TVLCard(): ReactElement {
	return (
		<div className={'col-span-75 ml-0 mt-4 md:col-span-29 md:ml-6 md:mt-0'}>
			<div className={'flex w-full flex-col gap-y-0 md:gap-y-6'}>
				<div className={'relative hidden h-[203px] rounded-3xl bg-neutral-200 md:block'}>
					<V3Mask className={'absolute bottom-8 left-10'} />
				</div>
				<div className={'rounded-3xl bg-neutral-200 p-6 md:px-8 md:py-4'}>
					<strong className={'mb-2 block text-4xl font-black leading-[48px] text-neutral-900'}>
						{'TVL'}
					</strong>
					<b
						suppressHydrationWarning
						className={'font-number block text-3xl font-bold text-neutral-900 md:text-4xl'}>
						{formatAmount(420420690, 0, 0)}
					</b>
				</div>
			</div>
		</div>
	);
}
function PortfolioCard(): ReactElement {
	const {cumulatedValueInV3Vaults} = useWallet();
	const {earned} = useYearn();
	const {options, isActive, address, openLoginModal, onSwitchChain} = useWeb3();

	const formatedYouEarned = useMemo((): string => {
		const amount = (earned?.totalUnrealizedGainsUSD || 0) > 0 ? earned?.totalUnrealizedGainsUSD || 0 : 0;
		return formatAmount(amount) ?? '';
	}, [earned?.totalUnrealizedGainsUSD]);

	const formatedYouHave = useMemo((): string => {
		return formatAmount(cumulatedValueInV3Vaults || 0) ?? '';
	}, [cumulatedValueInV3Vaults]);

	if (!isActive) {
		return (
			<div className={'col-span-12 w-full rounded-3xl bg-neutral-100 p-6 md:col-span-6'}>
				<strong
					className={'block pb-2 text-3xl font-black text-neutral-900 md:pb-4 md:text-4xl md:leading-[48px]'}>
					{'Portfolio'}
				</strong>
				<div className={'flex'}>
					<div>
						<p className={'pb-0 text-[#757CA6] md:pb-2'}>
							{'Looks like you need to connect your wallet. And call your mum. Always important.'}
						</p>
						<button
							className={cl(
								'rounded-lg overflow-hidden flex',
								'px-[42px] py-2 mt-16',
								'relative group',
								'border-none'
							)}
							onClick={(): void => {
								if (!isActive && address) {
									onSwitchChain(options?.defaultChainID || 1);
								} else {
									openLoginModal();
								}
							}}>
							<div
								className={cl(
									'absolute inset-0',
									'opacity-80 transition-opacity group-hover:opacity-100 pointer-events-none',
									'bg-[linear-gradient(80deg,_#D21162,_#2C3DA6)]'
								)}
							/>
							<p className={'z-10 text-neutral-900'}>{'Connect Wallet'}</p>
						</button>
					</div>
				</div>
			</div>
		);
	}
	return (
		<div className={'col-span-12 w-full rounded-3xl bg-neutral-100 p-6 md:col-span-6'}>
			<strong className={'block pb-2 text-3xl font-black text-neutral-900 md:pb-4 md:text-4xl md:leading-[48px]'}>
				{'Portfolio'}
			</strong>
			<div className={'flex flex-col gap-4 md:flex-row md:gap-32'}>
				<div>
					<p className={'pb-0 text-[#757CA6] md:pb-2'}>{'Deposited'}</p>
					<b className={'font-number text-xl text-neutral-900 md:text-3xl'}>
						<Counter value={Number(formatedYouHave)} />
					</b>
				</div>
				<div>
					<p className={'pb-0 text-[#757CA6] md:pb-2'}>{'Earnings'}</p>
					<b className={'font-number text-xl text-neutral-900 md:text-3xl'}>
						<Counter value={Number(formatedYouEarned)} />
					</b>
				</div>
			</div>
		</div>
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
	} = useQueryArguments({defaultCategories: ALL_CATEGORIES_KEYS});
	const {activeVaults} = useVaultFilter(categories, chains, true);

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
				<VaultsV3ListRow
					key={`${vault.chainID}_${vault.address}`}
					currentVault={vault}
				/>
			);
		});
	}, [categories, chains, isLoadingVaultList, onChangeCategories, onChangeChains, search, sortedVaultsToDisplay]);

	return (
		<Fragment>
			<Filters
				categories={categories}
				searchValue={search || ''}
				chains={chains}
				onChangeChains={onChangeChains}
				onChangeCategories={onChangeCategories}
				onSearch={onSearch}
			/>

			<div className={'col-span-12 flex min-h-[240px] w-full flex-col'}>
				<VaultsV3ListHead
					sortBy={sortBy}
					sortDirection={sortDirection}
					onSort={(newSortBy: string, newSortDirection: string): void => {
						onChangeSortBy(newSortBy as TPossibleSortBy);
						onChangeSortDirection(newSortDirection as TSortDirection);
					}}
					items={[
						{label: 'Vault', value: 'name', sortable: true, className: 'col-span-2'},
						{label: 'Est. APR', value: 'estAPR', sortable: true, className: 'col-span-2'},
						{label: 'Hist. APR', value: 'apr', sortable: true, className: 'col-span-2'},
						{label: 'Available', value: 'available', sortable: true, className: 'col-span-2'},
						{label: 'Deposited', value: 'deposited', sortable: true, className: 'col-span-2'},
						{label: 'TVL', value: 'tvl', sortable: true, className: 'col-span-2'}
					]}
				/>
				<div className={'grid gap-4'}>{VaultList}</div>
			</div>
		</Fragment>
	);
}

function Index(): ReactElement {
	const [isCollapsed, set_isCollapsed] = useState(true);

	function onClick(): void {
		set_isCollapsed(!isCollapsed);
	}

	return (
		<div className={'z-50 w-full bg-neutral-100 pt-20'}>
			<div className={'relative mx-auto w-full max-w-6xl'}>
				<div className={'absolute inset-x-0 top-0 w-full px-4 pt-2 md:pt-16'}>
					<div className={'grid grid-cols-75'}>
						<BrandNewVaultCard />
						<V3TVLCard />
					</div>
				</div>
			</div>

			<div
				className={cl(
					'relative pb-8 bg-neutral-0 z-50',
					'min-h-screen',
					'transition-transform duration-300',
					isCollapsed ? 'translate-y-[512px]' : 'translate-y-0'
				)}>
				<div className={'mx-auto w-full max-w-6xl'}>
					<div
						onClick={onClick}
						className={'absolute inset-x-0 top-0 flex w-full cursor-pointer items-center justify-center'}>
						<div className={'relative -mt-8 flex justify-center rounded-t-3xl'}>
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
							<div
								className={`absolute mt-2 flex justify-center transition-transform ${
									isCollapsed ? '' : '-rotate-180'
								}`}>
								<svg
									xmlns={'http://www.w3.org/2000/svg'}
									width={'24'}
									height={'24'}
									viewBox={'0 0 24 24'}
									fill={'none'}>
									<path
										fillRule={'evenodd'}
										clipRule={'evenodd'}
										d={
											'M4.34151 16.7526C3.92587 16.3889 3.88375 15.7571 4.24744 15.3415L11.2474 7.34148C11.4373 7.12447 11.7117 6.99999 12 6.99999C12.2884 6.99999 12.5627 7.12447 12.7526 7.34148L19.7526 15.3415C20.1163 15.7571 20.0742 16.3889 19.6585 16.7526C19.2429 17.1162 18.6111 17.0741 18.2474 16.6585L12 9.51858L5.75259 16.6585C5.38891 17.0741 4.75715 17.1162 4.34151 16.7526Z'
										}
										fill={'white'}
									/>
								</svg>
							</div>
						</div>
					</div>

					<div className={'grid grid-cols-12 gap-4 pt-6 md:gap-6'}>
						<PortfolioCard />
						<ListOfVaults />
					</div>
				</div>
			</div>
		</div>
	);
}

Index.getLayout = function getLayout(page: ReactElement, router: NextRouter): ReactElement {
	return <Wrapper router={router}>{page}</Wrapper>;
};

export default Index;
