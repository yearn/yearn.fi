import {Children, Fragment, useEffect, useMemo, useState} from 'react';
import {motion, useSpring, useTransform} from 'framer-motion';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {cl, formatAmount, isZero} from '@builtbymom/web3/utils';
import {VaultsListEmpty} from '@vaults/components/list/VaultsListEmpty';
import {useVaultFilter} from '@vaults/hooks/useFilteredVaults';
import {useSortVaults} from '@vaults/hooks/useSortVaults';
import {useQueryArguments} from '@vaults/hooks/useVaultsQueryArgs';
import {Filters} from '@vaults-v3/components/Filters';
import {VaultsV3ListHead} from '@vaults-v3/components/list/VaultsV3ListHead';
import {VaultsV3ListRow} from '@vaults-v3/components/list/VaultsV3ListRow';
import {ALL_VAULTSV3_CATEGORIES_KEYS} from '@vaults-v3/constants';
import {V3Mask} from '@vaults-v3/Mark';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useYearn} from '@yearn-finance/web-lib/contexts/useYearn';
import {useYearnWallet} from '@yearn-finance/web-lib/contexts/useYearnWallet';
import {Switch} from '@common/components/Switch';

import type {ReactElement, ReactNode} from 'react';
import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TSortDirection} from '@builtbymom/web3/types';
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
						'mb-2 md:mb-4 lg:mb-10 font-black text-neutral-900',
						'text-[48px] lg:text-[56px] lg:leading-[64px] leading-[48px]',
						'whitespace-break-spaces uppercase'
					)}>
					{'A brave new\nworld for Yield'}
				</h1>
				<p className={'mb-4 whitespace-break-spaces text-base text-[#F2B7D0] md:text-lg'}>
					{
						'Yearn v3 is a new yield paradigm offering better automation,\ncomposability and flexibility. Enjoy!'
					}
				</p>
			</div>
			<Background />
		</div>
	);
}
function V3Card(): ReactElement {
	return (
		<div className={'col-span-75 mb-4 mr-0 hidden md:col-span-29 md:mb-0 md:mr-6 md:block'}>
			<div
				className={cl(
					'flex h-full w-full flex-col items-center justify-center',
					'gap-y-0 rounded-3xl bg-neutral-200 md:gap-y-6 p-2'
				)}>
				<V3Mask className={'size-[90%]'} />
			</div>
		</div>
	);
}

function PortfolioCard({
	shouldGoHardcore,
	set_shouldGoHardcore
}: {
	shouldGoHardcore: boolean;
	set_shouldGoHardcore: (v: boolean) => void;
}): ReactElement {
	const {cumulatedValueInV3Vaults} = useYearnWallet();
	const {isActive, address, openLoginModal, onSwitchChain} = useWeb3();

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
									onSwitchChain(1);
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
		<>
			<div className={'col-span-12 w-full rounded-3xl bg-neutral-100 p-6 md:col-span-6'}>
				<strong
					className={'block pb-2 text-3xl font-black text-neutral-900 md:pb-4 md:text-4xl md:leading-[48px]'}>
					{'Portfolio'}
				</strong>
				<div className={'flex flex-col gap-4 md:flex-row md:gap-32'}>
					<div>
						<p className={'pb-0 text-[#757CA6] md:pb-2'}>{'Deposited'}</p>
						<b className={'font-number text-xl text-neutral-900 md:text-3xl'}>
							<Counter value={Number(formatedYouHave)} />
						</b>
					</div>
				</div>
				<div className={'mt-6 border-t border-neutral-200 pt-4'}>
					<div
						className={
							'flex cursor-pointer items-center justify-between transition-colors hover:bg-neutral-100/40'
						}>
						<div>
							<p className={'text-sm'}>{'Danger Mode'}</p>
							<small className={'text-xs text-neutral-400'}>{'This will enable dead-only vaults'}</small>
						</div>
						<Switch
							isEnabled={shouldGoHardcore}
							onSwitch={(): void => set_shouldGoHardcore(!shouldGoHardcore)}
						/>
					</div>
				</div>
			</div>
		</>
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
		onChangeSortBy,
		onReset
	} = useQueryArguments({defaultCategories: [ALL_VAULTSV3_CATEGORIES_KEYS[0]]});
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
	const VaultList = useMemo((): [ReactNode, ReactNode, ReactNode] | ReactNode => {
		const filteredByChains = sortedVaultsToDisplay.filter(
			({chainID}): boolean => chains?.includes(chainID) || false
		);

		if (isLoadingVaultList || isZero(filteredByChains.length) || !chains || chains.length === 0) {
			return (
				<VaultsListEmpty
					isLoading={isLoadingVaultList}
					sortedVaultsToDisplay={filteredByChains}
					currentSearch={search || ''}
					currentCategories={categories}
					currentChains={chains}
					onReset={onReset}
					defaultCategories={ALL_VAULTSV3_CATEGORIES_KEYS}
				/>
			);
		}

		const multi: ReactNode[] = [];
		const single: ReactNode[] = [];
		const all: ReactNode[] = [];
		for (const vault of filteredByChains) {
			if (vault.kind === 'Multi Strategy') {
				multi.push(
					<VaultsV3ListRow
						key={`${vault.chainID}_${vault.address}`}
						currentVault={vault}
					/>
				);
			}
			if (vault.kind === 'Single Strategy') {
				single.push(
					<VaultsV3ListRow
						key={`${vault.chainID}_${vault.address}`}
						currentVault={vault}
					/>
				);
			}
			all.push(
				<VaultsV3ListRow
					key={`${vault.chainID}_${vault.address}`}
					currentVault={vault}
				/>
			);
		}

		return [multi, single, all];
	}, [categories, chains, isLoadingVaultList, onReset, search, sortedVaultsToDisplay]);

	function renderVaultList(): ReactNode {
		if (Children.count(VaultList) === 1) {
			return VaultList as ReactNode;
		}
		const possibleLists = VaultList as [ReactNode, ReactNode, ReactNode];

		if (sortBy !== 'featuringScore' && possibleLists[2]) {
			return possibleLists[2];
		}
		return (
			<Fragment>
				{possibleLists[0]}
				{Children.count(possibleLists[0]) > 0 && Children.count(possibleLists[1]) > 0 ? (
					<div className={'h-px bg-neutral-100'} />
				) : null}
				{possibleLists[1]}
			</Fragment>
		);
	}

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
			<div
				className={
					'relative col-span-12 flex w-full flex-col overflow-hidden rounded-3xl bg-[linear-gradient(80deg,_#D21162,_#2C3DA6)]'
				}>
				<div className={'relative z-10 w-full rounded-3xl p-6 text-neutral-900'}>
					<b className={'text-lg'}>{'“Oh my god Becky… look at that yield.”'}</b>
					<p className={'mt-2'}>
						{
							'Yep, many V3 Vaults are currently being boosted by auto compounding rewards. So just sit back, relax, and enjoy that APY.'
						}
					</p>
				</div>
			</div>

			<div className={'col-span-12 flex min-h-[240px] w-full flex-col'}>
				<VaultsV3ListHead
					sortBy={sortBy}
					sortDirection={sortDirection}
					onSort={(newSortBy: string, newSortDirection: string): void => {
						if (newSortDirection === '') {
							onChangeSortBy('featuringScore');
							onChangeSortDirection('');
							return;
						}
						onChangeSortBy(newSortBy as TPossibleSortBy);
						onChangeSortDirection(newSortDirection as TSortDirection);
					}}
					items={[
						{label: 'Vault', value: 'name', sortable: true, className: 'col-span-2'},
						{label: 'Est. APR', value: 'estAPR', sortable: true, className: 'col-span-2'},
						{label: 'Hist. APR', value: 'apr', sortable: true, className: 'col-span-2'},
						{label: 'Available', value: 'available', sortable: true, className: 'col-span-2'},
						{label: 'Holdings', value: 'deposited', sortable: true, className: 'col-span-2'},
						{label: 'Deposits', value: 'tvl', sortable: true, className: 'col-span-2'}
					]}
				/>
				<div className={'grid gap-4'}>{renderVaultList()}</div>
			</div>
		</Fragment>
	);
}

function Index(): ReactElement {
	const [isCollapsed, set_isCollapsed] = useState(true);
	const [shouldGoHardcore, set_shouldGoHardcore] = useState(false);

	function onClick(): void {
		set_isCollapsed(!isCollapsed);
	}

	return (
		<>
			<div
				onClick={(): void => set_shouldGoHardcore(!shouldGoHardcore)}
				className={cl(
					'fixed inset-0 z-[1000] flex size-full items-start justify-center bg-red-900/70 backdrop-blur-sm',
					'pt-[20%] transition-all cursor-no-drop',
					shouldGoHardcore ? 'opacity-100' : 'opacity-0 pointer-events-none'
				)}>
				<div
					onClick={(e): void => e.stopPropagation()}
					className={'mx-auto w-full max-w-2xl cursor-default rounded-lg bg-white p-4'}>
					<h2 className={'text-2xl font-bold text-neutral-0'}>{'You are about to enter the DANGER AREA'}</h2>
					<p className={'pb-6 pt-10 text-base text-neutral-200'}>
						{
							'The Danger Vaults are a collection of high risk, high reward strategies. These vaults are not for the faint of heart. They are not recommended for the average user. You have been warned.'
						}
					</p>
					<p className={'text-base text-neutral-200'}>
						{
							'You might lose all your money. You might lose more than all your money. You might lose your house. You might lose your wife. You might lose your kids. You might lose your dog. You might lose your dignity. You might lose your sanity. You might lose your life. You might lose your soul. You might lose your mind. You might lose your will to live. You might lose your will to die'
						}
					</p>
					<Button
						className={'button mt-10 rounded-lg'}
						variant={'v3'}>
						{'I understand, let me in'}
					</Button>
				</div>
			</div>
			<div className={'z-50 w-full bg-neutral-100 pt-20'}>
				<div className={'relative mx-auto w-full max-w-6xl'}>
					<div className={'absolute inset-x-0 top-0 w-full px-4 pt-6 md:pt-16'}>
						<div className={'grid grid-cols-75'}>
							<V3Card />
							<BrandNewVaultCard />
						</div>
					</div>
				</div>

				<div
					className={cl(
						'relative pb-8 bg-neutral-0 z-50',
						'min-h-screen',
						'transition-transform duration-300',
						isCollapsed
							? 'translate-y-[354px] md:translate-y-[464px]'
							: 'translate-y-[24px] md:translate-y-[40px]'
					)}>
					<div className={'mx-auto w-full max-w-6xl'}>
						<div
							onClick={onClick}
							className={
								'absolute inset-x-0 top-0 flex w-full cursor-pointer items-center justify-center'
							}>
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

						<div className={'pt-6'}>
							<div
								className={'rounded-3xl border border-[#D21162] bg-[#14051A] px-6 py-4 text-[#FF1678]'}>
								<b className={'text-lg'}>{'Ape carefully anon!'}</b>
								<p>
									{
										'V3 is a truly flexible yield protocol offering everything from the usual Up Only Vaults to all new risky degen strategies.'
									}
								</p>
							</div>
						</div>

						<div className={'grid grid-cols-12 gap-4 pt-6 md:gap-6'}>
							<PortfolioCard
								shouldGoHardcore={shouldGoHardcore}
								set_shouldGoHardcore={set_shouldGoHardcore}
							/>
							<ListOfVaults />
						</div>
					</div>
				</div>
			</div>
		</>
	);
}

export default Index;
