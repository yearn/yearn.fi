import {Children, Fragment, useMemo, useState} from 'react';
import {motion} from 'framer-motion';
import {VaultsListEmpty} from '@vaults-v2/components/list/VaultsListEmpty';
import {useVaultFilter} from '@vaults-v2/hooks/useFilteredVaults';
import {useSortVaults} from '@vaults-v2/hooks/useSortVaults';
import {useQueryArguments} from '@vaults-v2/hooks/useVaultsQueryArgs';
import {Filters} from '@vaults-v3/components/Filters';
import {VaultsV3ListHead} from '@vaults-v3/components/list/VaultsV3ListHead';
import {VaultsV3ListRow} from '@vaults-v3/components/list/VaultsV3ListRow';
import {ALL_VAULTSV3_CATEGORIES_KEYS, ALL_VAULTSV3_KINDS_KEYS} from '@vaults-v3/constants';
import {V3Mask} from '@vaults-v3/Mark';
import {Counter} from '@lib/components/Counter';
import {useWeb3} from '@lib/contexts/useWeb3';
import {useYearn} from '@lib/contexts/useYearn';
import {cl, isZero} from '@lib/utils';

import type {ReactElement, ReactNode} from 'react';
import type {TSortDirection} from '@lib/types';
import type {TYDaemonVault} from '@lib/utils/schemas/yDaemonVaultsSchemas';
import type {TPossibleSortBy} from '@vaults-v2/hooks/useSortVaults';

function Background(): ReactElement {
	return (
		<motion.div
			transition={{duration: 10, delay: 0, repeat: Infinity, ease: 'linear'}}
			animate={{
				background: [
					'linear-gradient(0deg, #D21162 24.91%, #2C3DA6 99.66%)',
					'linear-gradient(360deg, #D21162 24.91%, #2C3DA6 99.66%)'
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

function PortfolioCard(): ReactElement {
	const {cumulatedValueInV3Vaults} = useYearn();
	const {isActive, address, openLoginModal, onSwitchChain} = useWeb3();

	if (!isActive) {
		return (
			<div className={'col-span-12 w-full rounded-3xl bg-neutral-100 p-6 md:col-span-4'}>
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
		<div className={'col-span-12 w-full rounded-3xl bg-neutral-100 p-6 md:col-span-4'}>
			<strong className={'block pb-2 text-3xl font-black text-neutral-900 md:pb-4 md:text-4xl md:leading-[48px]'}>
				{'Portfolio'}
			</strong>
			<div className={'flex flex-col gap-4 md:flex-row md:gap-32'}>
				<div>
					<p className={'pb-0 text-[#757CA6] md:pb-2'}>{'Deposited'}</p>
					<b className={'font-number text-xl text-neutral-900 md:text-3xl'}>
						{'$'}
						<Counter
							value={cumulatedValueInV3Vaults}
							decimals={2}
						/>
					</b>
				</div>
			</div>
		</div>
	);
}
function ListOfVaults(): ReactElement {
	const {getBalance} = useYearn();
	const {isLoadingVaultList} = useYearn();
	const {
		search,
		types,
		chains,
		categories,
		sortDirection,
		sortBy,
		onSearch,
		onChangeTypes,
		onChangeCategories,
		onChangeChains,
		onChangeSortDirection,
		onChangeSortBy,
		onReset
	} = useQueryArguments({
		defaultTypes: [ALL_VAULTSV3_KINDS_KEYS[0]],
		defaultCategories: ALL_VAULTSV3_CATEGORIES_KEYS,
		defaultPathname: '/v3'
	});
	const {activeVaults, retiredVaults, migratableVaults} = useVaultFilter(types, chains, true);

	/**********************************************************************************************
	 **	Then, on the activeVaults list, we apply the search filter. The search filter is
	 **	implemented as a simple string.includes() on the vault name.
	 *********************************************************************************************/
	const searchedVaultsToDisplay = useMemo((): TYDaemonVault[] => {
		if (!search) {
			return activeVaults;
		}
		const filtered = activeVaults.filter((vault: TYDaemonVault): boolean => {
			const lowercaseSearch = search.toLowerCase();
			const searchableFields =
				`${vault.name} ${vault.symbol} ${vault.token.name} ${vault.token.symbol} ${vault.address} ${vault.token.address}`
					.toLowerCase()
					.split(' ');
			return searchableFields.some((word): boolean => word.includes(lowercaseSearch));
		});
		return filtered;
	}, [activeVaults, search]);

	/**********************************************************************************************
	 **	Then, once we have reduced the list of vaults to display, we can sort them. The sorting
	 **	is done via a custom method that will sort the vaults based on the sortBy and
	 **	sortDirection values.
	 *********************************************************************************************/
	const sortedVaultsToDisplay = useSortVaults([...searchedVaultsToDisplay], sortBy, sortDirection);

	/**********************************************************************************************
	 **	The VaultList component is memoized to prevent it from being re-created on every render.
	 **	It contains either the list of vaults, is some are available, or a message to the user.
	 *********************************************************************************************/
	const VaultList = useMemo((): [ReactNode, ReactNode, ReactNode, ReactNode] | ReactNode => {
		const filteredByChains = sortedVaultsToDisplay.filter(
			({chainID}): boolean => chains?.includes(chainID) || false
		);
		const filteredByCategories = filteredByChains.filter(
			({category}): boolean => categories?.includes(category) || false
		);

		const holdings: ReactNode[] = [];
		const multi: ReactNode[] = [];
		const single: ReactNode[] = [];
		const all: ReactNode[] = [];
		const processedForHoldings = new Set<string>();

		// Add migratable vaults to holdings (guaranteed to have balance)
		for (const vault of migratableVaults) {
			const key = `${vault.chainID}_${vault.address}`;
			const balance = getBalance({address: vault.address, chainID: vault.chainID});
			const stakingBalance = getBalance({address: vault.staking.address, chainID: vault.chainID});
			const hasBalance = balance.raw > 0n;
			const hasStakingBalance = stakingBalance.raw > 0n;
			if (hasBalance || hasStakingBalance) {
				holdings.push(
					<VaultsV3ListRow
						key={key}
						currentVault={vault}
					/>
				);
				processedForHoldings.add(key);
			}
		}

		// Add retired vaults to holdings (guaranteed to have balance)
		for (const vault of retiredVaults) {
			const key = `${vault.chainID}_${vault.address}`;
			if (!processedForHoldings.has(key)) {
				// Avoid duplicates
				const hasBalance = getBalance({address: vault.address, chainID: vault.chainID}).raw > 0n;
				const hasStakingBalance = getBalance({address: vault.staking.address, chainID: vault.chainID}).raw > 0n;
				if (hasBalance || hasStakingBalance) {
					holdings.push(
						<VaultsV3ListRow
							key={key}
							currentVault={vault}
						/>
					);
					processedForHoldings.add(key);
				}
			}
		}

		for (const vault of filteredByCategories) {
			// Process active vaults
			const key = `${vault.chainID}_${vault.address}`;

			if (processedForHoldings.has(key)) {
				// This vault was already added to holdings from migratable/retired lists.
				// Skip adding to multi, single, or all.
				continue;
			}

			const hasBalance = getBalance({address: vault.address, chainID: vault.chainID}).raw > 0n;
			const hasStakingBalance = getBalance({address: vault.staking.address, chainID: vault.chainID}).raw > 0n;
			if (hasBalance || hasStakingBalance) {
				holdings.push(
					<VaultsV3ListRow
						key={key}
						currentVault={vault}
					/>
				);
				// No need to add to processedForHoldings here again as `continue` prevents further processing for this vault.
				continue;
			}

			// If not a holding, categorize into multi, single, and all
			if (vault.kind === 'Multi Strategy') {
				multi.push(
					<VaultsV3ListRow
						key={key}
						currentVault={vault}
					/>
				);
			}
			if (vault.kind === 'Single Strategy') {
				single.push(
					<VaultsV3ListRow
						key={key}
						currentVault={vault}
					/>
				);
			}
			all.push(
				// `all` contains active, non-holding vaults
				<VaultsV3ListRow
					key={key}
					currentVault={vault}
				/>
			);
		}

		const shouldShowEmptyState =
			isLoadingVaultList || !chains || chains.length === 0 || (isZero(holdings.length) && isZero(all.length)); // Show empty if no holdings and no other active vaults

		if (shouldShowEmptyState) {
			return (
				<VaultsListEmpty
					isLoading={isLoadingVaultList}
					sortedVaultsToDisplay={filteredByCategories} // Represents the set of vaults filters were applied to
					currentSearch={search || ''}
					currentCategories={types}
					currentChains={chains}
					onReset={onReset}
					defaultCategories={ALL_VAULTSV3_KINDS_KEYS}
				/>
			);
		}

		return [holdings, multi, single, all];
	}, [
		types,
		categories,
		chains,
		getBalance,
		isLoadingVaultList,
		onReset,
		search,
		sortedVaultsToDisplay,
		migratableVaults,
		retiredVaults
	]);

	function renderVaultList(): ReactNode {
		if (Children.count(VaultList) === 1) {
			return VaultList as ReactNode;
		}
		const possibleLists = VaultList as [ReactNode, ReactNode, ReactNode, ReactNode];
		const hasHoldings = Children.count(possibleLists[0]) > 0;

		if (sortBy !== 'featuringScore' && possibleLists[3]) {
			return (
				<Fragment>
					{hasHoldings && (
						<div className={'relative grid h-fit gap-4'}>
							<p className={'absolute -left-20 top-1/2 -rotate-90 text-xs text-neutral-400'}>
								&nbsp;&nbsp;&nbsp;{'Your holdings'}&nbsp;&nbsp;&nbsp;
							</p>
							{possibleLists[0]}
						</div>
					)}
					{Children.count(possibleLists[0]) > 0 && Children.count(possibleLists[3]) > 0 ? (
						<div className={'my-2 h-1 rounded-lg bg-neutral-200'} />
					) : null}
					{possibleLists[3]}
				</Fragment>
			);
		}
		return (
			<Fragment>
				{hasHoldings && (
					<div className={'relative grid h-fit gap-4'}>
						<p className={'absolute -left-20 top-1/2 -rotate-90 text-xs text-neutral-400'}>
							&nbsp;&nbsp;&nbsp;{'Your holdings'}&nbsp;&nbsp;&nbsp;
						</p>
						{possibleLists[0]}
					</div>
				)}
				{Children.count(possibleLists[0]) > 0 && Children.count(possibleLists[1]) > 0 ? (
					<div className={'my-2 h-1 rounded-lg bg-neutral-200'} />
				) : null}
				{possibleLists[1]}
				{Children.count(possibleLists[1]) > 1 && Children.count(possibleLists[2]) > 0 ? (
					<div className={'my-2 h-1 rounded-lg bg-neutral-200'} />
				) : null}
				{possibleLists[2]}
			</Fragment>
		);
	}

	return (
		<Fragment>
			<Filters
				types={types}
				categories={categories}
				searchValue={search || ''}
				chains={chains}
				onChangeChains={onChangeChains}
				onChangeTypes={onChangeTypes}
				onChangeCategories={onChangeCategories}
				onSearch={onSearch}
			/>

			<div className={'col-span-12 flex min-h-[240px] w-full flex-col'}>
				<VaultsV3ListHead
					sortBy={sortBy}
					sortDirection={sortDirection}
					onSort={(newSortBy: string, newSortDirection: TSortDirection): void => {
						if (newSortDirection === '') {
							onChangeSortBy('featuringScore');
							onChangeSortDirection('');
							return;
						}
						onChangeSortBy(newSortBy as TPossibleSortBy);
						onChangeSortDirection(newSortDirection as TSortDirection);
					}}
					items={[
						{label: 'Vault', value: 'name', sortable: true, className: 'col-span-4'},
						{label: 'Est. APY', value: 'estAPY', sortable: true, className: 'col-span-2'},
						{label: 'Hist. APY', value: 'APY', sortable: true, className: 'col-span-2'},
						{
							label: 'Risk Level',
							value: 'score',
							sortable: true,
							className: 'col-span-2 whitespace-nowrap'
						},
						{label: 'Available', value: 'available', sortable: true, className: 'col-span-2'},
						{label: 'Holdings', value: 'deposited', sortable: true, className: 'col-span-2'},
						{label: 'Deposits', value: 'tvl', sortable: true, className: 'col-span-2 justify-end'}
					]}
				/>
				<div className={'grid gap-4'}>{renderVaultList()}</div>
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

export default Index;
