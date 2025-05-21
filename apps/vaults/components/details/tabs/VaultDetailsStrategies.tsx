import {useMemo, useState} from 'react';
import {zeroAddress} from 'viem';
import {AnimatePresence, motion} from 'framer-motion';
import {cl, formatCounterValue, formatPercent, toNormalizedBN} from '@builtbymom/web3/utils';
import {useSortVaults} from '@vaults/hooks/useSortVaults';
import {useQueryArguments} from '@vaults/hooks/useVaultsQueryArgs';
import {VaultsV3ListHead} from '@vaults-v3/components/list/VaultsV3ListHead';
import {AllocationChart} from '@common/components/AllocationChart';
import {VaultsListStrategy} from '@common/components/VaultsListStrategy';
import {useYearn} from '@common/contexts/useYearn';
import {useYearnTokenPrice} from '@common/hooks/useYearnTokenPrice';

import type {ReactElement} from 'react';
import type {TYDaemonVault, TYDaemonVaultStrategy} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TSortDirection} from '@builtbymom/web3/types';
import type {TPossibleSortBy} from '@vaults/hooks/useSortVaults';

function UnallocatedStrategy({
	unallocatedPercentage,
	unallocatedValue
}: {
	unallocatedPercentage: number;
	unallocatedValue: string;
}): ReactElement {
	return (
		<div
			className={cl(
				'grid grid-cols-1 md:grid-cols-12 text-neutral-900 items-center w-full py-3 px-8 justify-between',
				'border-t border-[#606770]'
			)}>
			<div className={cl('col-span-5 flex flex-row items-center gap-4 z-10')}>
				<div className={'flex items-center justify-center'}>
					<button className={cl('text-sm font-bold transition-all duration-300 ease-in-out')}>{'●'}</button>
				</div>

				<strong className={'block truncate font-bold '}>{'Unallocated'}</strong>
			</div>

			<div className={cl('md:col-span-7 z-10', 'grid grid-cols-3 md:grid-cols-12 gap-4', 'mt-4 md:mt-0')}>
				<div
					className={'flex-row md:col-span-3 md:flex-col md:text-right'}
					datatype={'number'}>
					<p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'Allocation %'}</p>
					<p>{formatPercent(unallocatedPercentage / 100, 0)}</p>
				</div>
				<div
					className={'mr-[-20px] flex-row md:col-span-4 md:flex-col md:text-right'}
					datatype={'number'}>
					<p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'Allocation $'}</p>
					<p>{unallocatedValue}</p>
				</div>
			</div>
		</div>
	);
}

export function VaultDetailsStrategies({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const {vaults} = useYearn();
	const {sortDirection, sortBy, onChangeSortDirection, onChangeSortBy} = useQueryArguments({
		defaultSortBy: 'allocationPercentage',
		defaultPathname: '/vaults/[chainID]/[address]'
	});

	const [shouldShowUnallocated, set_shouldShowUnallocated] = useState(false);

	const tokenPrice = useYearnTokenPrice({address: currentVault.token.address, chainID: currentVault.chainID});

	const strategyList = useMemo((): TYDaemonVaultStrategy[] => {
		const _stratList = [];
		for (const strategy of currentVault?.strategies || []) {
			if (!vaults[strategy.address]) {
				_stratList.push(strategy);
			}
		}
		return _stratList;
	}, [vaults, currentVault]);

	const unallocatedPercentage =
		100 * 100 - strategyList.reduce((acc, strategy) => acc + (strategy.details?.debtRatio || 0), 0);

	const filteredStrategyList = useMemo(() => {
		const strategies = strategyList.filter(vault => vault.details?.totalDebt !== '0') as (TYDaemonVault & {
			details: TYDaemonVaultStrategy['details'];
		})[];

		const unallocatedValue =
			Number(currentVault.tvl.totalAssets) -
			strategyList.reduce((acc, strategy) => acc + Number(strategy.details?.totalDebt || 0), 0);

		if (unallocatedPercentage > 0) {
			strategies.push({
				address: zeroAddress,
				name: 'Unallocated',
				details: {
					debtRatio: unallocatedPercentage,
					totalDebt: unallocatedValue
				}
			} as unknown as TYDaemonVault & {details: TYDaemonVaultStrategy['details']});
		}

		return strategies;
	}, [currentVault.tvl.totalAssets, strategyList, unallocatedPercentage]);

	/* 🔵 - Yearn Finance **************************************************************************
	 **	Then, once we have reduced the list of vaults to display, we can sort them. The sorting
	 **	is done via a custom method that will sort the vaults based on the sortBy and
	 **	sortDirection values.
	 **********************************************************************************************/
	const sortedVaultsToDisplay = useSortVaults(filteredStrategyList, sortBy, sortDirection) as (TYDaemonVault & {
		details: TYDaemonVaultStrategy['details'];
	})[];

	const allocationChartData = useMemo(
		() =>
			[
				...filteredStrategyList.map(strategy => ({
					id: strategy.address,
					name: strategy.name,
					value: (strategy.details?.debtRatio || 0) / 100,
					amount: formatCounterValue(
						toNormalizedBN(strategy.details?.totalDebt || 0, strategy.token?.decimals).display,
						tokenPrice
					)
				}))
			].filter(Boolean),
		[filteredStrategyList, tokenPrice]
	);

	const unallocatedVaults = useMemo(() => {
		return strategyList.filter(vault => !vault.details?.debtRatio || vault.details?.totalDebt === '0');
	}, [strategyList]);

	const isVaultListEmpty = strategyList.length === 0;
	const isFilteredVaultListEmpty = filteredStrategyList.length === 0;

	const chartColors = [
		'fill-neutral-700',
		'fill-neutral-600',
		'fill-neutral-500',
		'fill-neutral-400',
		'fill-neutral-300',
		'fill-neutral-200'
	];

	return (
		<>
			<div className={cl(isVaultListEmpty ? 'hidden ' : 'flex md:p-8 lg:pr-0 p-4 ')}>
				<div
					className={
						'grid w-full grid-cols-1 place-content-start md:gap-x-6 lg:max-w-[846px] lg:grid-cols-9'
					}>
					<div className={'col-span-9 w-full border border-fallback'}>
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
								{label: 'Vault', value: 'name', sortable: false, className: 'ml-20'},
								{
									label: 'Allocation %',
									value: 'allocationPercentage',
									sortable: true,
									className: 'col-span-4'
								},
								{
									label: 'Allocation $',
									value: 'allocation',
									sortable: true,
									className: 'col-span-4'
								},
								{
									label: 'Est. APY',
									value: 'estAPY',
									sortable: true,
									className: 'col-span-4 justify-end'
								}
							]}
						/>
						<div className={'grid'}>
							{(sortedVaultsToDisplay || []).map(
								(strategy): ReactElement =>
									strategy.address === zeroAddress ? (
										<UnallocatedStrategy
											key={'unallocated'}
											unallocatedPercentage={unallocatedPercentage}
											unallocatedValue={formatCounterValue(
												toNormalizedBN(
													strategy.details?.totalDebt || 0,
													strategy.token?.decimals || currentVault.token?.decimals
												).display,
												tokenPrice
											)}
										/>
									) : (
										<VaultsListStrategy
											key={`${currentVault?.chainID || currentVault.chainID}_${strategy.address}`}
											details={strategy.details}
											chainId={currentVault.chainID || currentVault.chainID}
											address={strategy.address}
											variant={'v2'}
											name={strategy.name}
											tokenAddress={strategy.token?.address || currentVault.token.address}
											allocation={formatCounterValue(
												toNormalizedBN(
													strategy.details?.totalDebt || 0,
													strategy.token?.decimals || currentVault.token?.decimals
												).display,
												tokenPrice
											)}
											apr={
												strategy.apr?.forwardAPR?.netAPR ||
												strategy.apr?.netAPR ||
												(strategy as {netAPR?: number}).netAPR
											}
											fees={{
												performance: strategy.details?.performanceFee || 0,
												withdrawal: 0,
												management: 0
											}}
										/>
									)
							)}
						</div>
					</div>
					{!isVaultListEmpty && (
						<div className={'col-span-9 mt-4 flex items-center justify-center lg:hidden'}>
							<AllocationChart
								allocationChartData={allocationChartData}
								colors={chartColors}
								textColor={'fill-neutral-900'}
							/>
						</div>
					)}
					{unallocatedVaults.length > 0 && (
						<div
							className={cl(
								'col-span-9 border border-fallback max-lg:row-start-3 lg:border-t-0',
								isFilteredVaultListEmpty ? 'border-t-0' : 'max-lg:mt-4'
							)}>
							<button
								className={'flex w-full items-center justify-start'}
								onClick={() => set_shouldShowUnallocated(!shouldShowUnallocated)}>
								<div className={'flex items-center px-4 py-3 text-left text-sm font-bold md:px-8'}>
									<p
										className={cl(
											'transition-all duration-300 ease-in-out mr-4',
											shouldShowUnallocated ? '' : 'rotate-[-90deg]'
										)}>
										{'▼'}
									</p>
									{shouldShowUnallocated ? 'Hide' : 'Show'} {'inactive strategies'}
								</div>
							</button>

							<AnimatePresence>
								{shouldShowUnallocated && (
									<motion.div
										initial={{opacity: 0}}
										animate={{opacity: 1}}
										transition={{duration: 0.2}}>
										{unallocatedVaults.map((strategy, index): ReactElement => {
											return (
												<motion.div
													key={`${currentVault?.chainID || currentVault.chainID}_${strategy.address}`}
													initial={{opacity: 0, x: -20}}
													animate={{opacity: 1, x: 0}}
													transition={{
														duration: 0.2,
														delay: index * 0.05,
														ease: 'easeOut'
													}}>
													<VaultsListStrategy
														isUnallocated={true}
														details={strategy.details}
														chainId={currentVault.chainID || currentVault.chainID}
														address={strategy.address}
														variant={'v2'}
														name={strategy.name}
														tokenAddress={currentVault.token.address}
														allocation={formatCounterValue(
															toNormalizedBN(
																strategy.details?.totalDebt || 0,
																currentVault.token?.decimals
															).display,
															tokenPrice
														)}
														apr={undefined}
														fees={{
															performance: strategy.details?.performanceFee || 0,
															withdrawal: 0,
															management: 0
														}}
													/>
												</motion.div>
											);
										})}
									</motion.div>
								)}
							</AnimatePresence>
						</div>
					)}
				</div>

				{!isVaultListEmpty && (
					<div className={'mx-auto flex items-start justify-center max-lg:hidden'}>
						<AllocationChart
							allocationChartData={allocationChartData}
							colors={chartColors}
							textColor={'fill-neutral-900'}
							strokeColor={'fill-neutral-900'}
						/>
					</div>
				)}
			</div>

			<div className={cl(isVaultListEmpty ? '' : 'hidden')}>
				<div className={'mx-auto flex h-96 w-full flex-col items-center justify-center px-10 py-2 md:w-3/4'}>
					<b className={'text-center text-lg'}>
						{isVaultListEmpty ? 'This vault IS the strategy' : 'No strategies found'}
					</b>
					<p className={'text-center text-neutral-600'}>
						{isVaultListEmpty
							? "Surprise! This vault doesn't have any strategies. It is the strategy. #brainexplosion"
							: "Surprise! This vault doesn't have any strategies."}
					</p>
				</div>
			</div>
		</>
	);
}
