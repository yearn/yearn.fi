import {useMemo} from 'react';
import {Cell, Label, Pie, PieChart, Tooltip} from 'recharts';
import {zeroAddress} from 'viem';
import {cl, formatCounterValue, formatPercent, toNormalizedBN} from '@builtbymom/web3/utils';
import {useSortVaults} from '@vaults/hooks/useSortVaults';
import {useQueryArguments} from '@vaults/hooks/useVaultsQueryArgs';
import {VaultsV3ListHead} from '@vaults-v3/components/list/VaultsV3ListHead';
import {ALL_VAULTSV3_KINDS_KEYS} from '@vaults-v3/constants';
import {AllocationTooltip} from '@common/components/AllocationTooltip';
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
				'w-full group',
				'relative transition-all duration-300 ease-in-out',
				'text-white',
				'rounded-3xl'
			)}>
			<div
				className={cl(
					'absolute inset-0 rounded-2xl',
					'opacity-20 transition-opacity  pointer-events-none',
					'bg-[linear-gradient(80deg,_#2C3DA6,_#D21162)]'
				)}
			/>

			<div
				className={cl(
					'grid grid-cols-1 md:grid-cols-12 text-neutral-900 items-center w-full py-3 px-8 justify-between'
				)}>
				<div className={cl('col-span-5 flex flex-row items-center gap-4 z-10')}>
					<div className={'flex items-center justify-center'}>
						<button className={cl('text-sm font-bold transition-all duration-300 ease-in-out')}>
							{'●'}
						</button>
					</div>

					<strong
						title={'Unallocated'}
						className={'block truncate font-bold '}>
						{'Unallocated'}
					</strong>
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
		</div>
	);
}

export function VaultDetailsStrategies({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const {vaults} = useYearn();
	const {sortDirection, sortBy, onChangeSortDirection, onChangeSortBy} = useQueryArguments({
		defaultSortBy: 'allocationPercentage',
		defaultTypes: ALL_VAULTSV3_KINDS_KEYS,
		defaultPathname: '/v3/[chainID]/[address]'
	});

	const tokenPrice = useYearnTokenPrice({address: currentVault.token.address, chainID: currentVault.chainID});

	const vaultList = useMemo((): TYDaemonVault[] => {
		const _vaultList = [];
		for (const strategy of currentVault?.strategies || []) {
			_vaultList.push({...vaults[strategy.address], details: strategy.details});
		}
		return _vaultList.filter(vault => !!vault.address);
	}, [vaults, currentVault]);

	const strategyList = useMemo((): TYDaemonVaultStrategy[] => {
		const _stratList = [];
		for (const strategy of currentVault?.strategies || []) {
			if (!vaults[strategy.address]) {
				_stratList.push(strategy);
			}
		}
		return _stratList;
	}, [vaults, currentVault]);

	const mergedList = useMemo(
		() => [...vaultList, ...strategyList] as (TYDaemonVault & {details: TYDaemonVaultStrategy['details']})[],
		[vaultList, strategyList]
	);

	const unallocatedPercentage =
		100 * 100 - mergedList.reduce((acc, strategy) => acc + (strategy.details?.debtRatio || 0), 0);

	const filteredVaultList = useMemo(() => {
		const strategies = mergedList.filter(vault => vault.details?.totalDebt !== '0') as (TYDaemonVault & {
			details: TYDaemonVaultStrategy['details'];
		})[];

		const unallocatedValue =
			Number(currentVault.tvl.totalAssets) -
			mergedList.reduce((acc, strategy) => acc + Number(strategy.details?.totalDebt || 0), 0);

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
	}, [currentVault.tvl.totalAssets, mergedList, unallocatedPercentage]);

	/* 🔵 - Yearn Finance **************************************************************************
	 **	Then, once we have reduced the list of vaults to display, we can sort them. The sorting
	 **	is done via a custom method that will sort the vaults based on the sortBy and
	 **	sortDirection values.
	 **********************************************************************************************/
	const sortedVaultsToDisplay = useSortVaults(filteredVaultList, sortBy, sortDirection) as (TYDaemonVault & {
		details: TYDaemonVaultStrategy['details'];
	})[];

	const allocationChartData = useMemo(
		() =>
			[
				...filteredVaultList.map(strategy => ({
					id: strategy.address,
					name: strategy.name,
					value: (strategy.details?.debtRatio || 0) / 100,
					amount: formatCounterValue(
						toNormalizedBN(strategy.details?.totalDebt || 0, strategy.token?.decimals).display,
						tokenPrice
					)
				}))
			].filter(Boolean),
		[filteredVaultList, tokenPrice]
	);

	const pieColors = ['#ff6ba5', '#ffb3d1', '#ff8fbb', '#ffd6e7', '#d21162', '#ff4d94'];

	const isVaultListEmpty = [...vaultList, ...strategyList].length === 0;
	const isFilteredVaultListEmpty = filteredVaultList.length === 0;

	return (
		<>
			<div className={cl(isVaultListEmpty ? 'hidden' : '')}>
				<div className={'grid grid-cols-1 px-8 pb-6 pt-8 md:gap-6 lg:grid-cols-12'}>
					<div className={'col-span-9 flex min-h-[240px] w-full flex-col'}>
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
								{label: 'Allocation $', value: 'allocation', sortable: true, className: 'col-span-4'},
								{
									label: 'Est. APY',
									value: 'estAPY',
									sortable: true,
									className: 'col-span-4 justify-end'
								}
							]}
						/>
						<div className={'grid gap-4'}>
							{sortedVaultsToDisplay.map((vault): ReactElement => {
								return vault.address === zeroAddress ? (
									<UnallocatedStrategy
										key={'unallocated'}
										unallocatedPercentage={unallocatedPercentage}
										unallocatedValue={formatCounterValue(
											toNormalizedBN(
												vault.details?.totalDebt || 0,
												vault.token?.decimals || currentVault.token?.decimals
											).display,
											tokenPrice
										)}
									/>
								) : (
									<VaultsListStrategy
										key={`${vault?.chainID || currentVault.chainID}_${vault.address}`}
										details={vault.details}
										chainId={vault.chainID || currentVault.chainID}
										variant={'v3'}
										address={vault.address}
										name={vault.name}
										tokenAddress={vault.token?.address || currentVault.token.address}
										allocation={formatCounterValue(
											toNormalizedBN(
												vault.details?.totalDebt || 0,
												vault.token?.decimals || currentVault.token?.decimals
											).display,
											tokenPrice
										)}
										apr={vault.apr?.forwardAPR.netAPR || vault.apr?.netAPR}
										fees={vault.apr?.fees}
									/>
								);
							})}
						</div>
					</div>
					<div className={'col-span-9 mt-4 flex size-full lg:col-span-3'}>
						<div className={'flex size-full flex-col items-center justify-start'}>
							<PieChart
								width={200}
								height={200}>
								<Pie
									data={allocationChartData}
									dataKey={'value'}
									nameKey={'name'}
									cx={'50%'}
									cy={'50%'}
									innerRadius={80}
									outerRadius={100}
									paddingAngle={5}
									fill={'white'}
									stroke={'hsl(231, 100%, 11%)'}
									startAngle={90}
									minAngle={3}
									endAngle={-270}>
									{allocationChartData.map((_, index) => (
										<Cell
											key={`cell-${index}`}
											fill={pieColors[index % pieColors.length]}
										/>
									))}
									<Label
										content={() => (
											<text
												x={100}
												y={100}
												textAnchor={'middle'}
												dominantBaseline={'middle'}
												className={'fill-white text-sm font-medium'}>
												{'allocation %'}
											</text>
										)}
									/>
								</Pie>
								<Tooltip
									content={({active, payload}) => (
										<AllocationTooltip
											active={active || false}
											payload={payload}
										/>
									)}
								/>
							</PieChart>
						</div>
					</div>
				</div>
			</div>

			<div className={cl(isFilteredVaultListEmpty ? '' : 'hidden')}>
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
