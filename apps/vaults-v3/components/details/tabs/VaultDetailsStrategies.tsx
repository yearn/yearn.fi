import {useMemo} from 'react';
import {Cell, Label, Pie, PieChart, Tooltip} from 'recharts';
import {cl, formatCounterValue, toNormalizedBN} from '@builtbymom/web3/utils';
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

	const filteredVaultList = useMemo(() => {
		return [...vaultList, ...strategyList].filter(
			vault => (vault as TYDaemonVault & {details: TYDaemonVaultStrategy['details']}).details?.totalDebt !== '0'
		) as (TYDaemonVault & {
			details: TYDaemonVaultStrategy['details'];
		})[];
	}, [vaultList, strategyList]);

	/* 🔵 - Yearn Finance **************************************************************************
	 **	Then, once we have reduced the list of vaults to display, we can sort them. The sorting
	 **	is done via a custom method that will sort the vaults based on the sortBy and
	 **	sortDirection values.
	 **********************************************************************************************/
	const sortedVaultsToDisplay = useSortVaults(filteredVaultList, sortBy, sortDirection) as (TYDaemonVault & {
		details: TYDaemonVaultStrategy['details'];
	})[];

	const unallocatedPercentage =
		100 * 100 - filteredVaultList.reduce((acc, strategy) => acc + (strategy.details?.debtRatio || 0), 0);

	const allocationChartData = [
		...filteredVaultList.map(strategy => ({
			id: strategy.address,
			name: strategy.name,
			value: (strategy.details?.debtRatio || 0) / 100,
			amount: formatCounterValue(
				toNormalizedBN(strategy.details?.totalDebt || 0, strategy.token?.decimals).display,
				tokenPrice
			)
		})),
		unallocatedPercentage > 0
			? {
					id: '0x0',
					name: 'Unallocated',
					value: unallocatedPercentage / 100,
					amount: null
				}
			: null
	].filter(Boolean);

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
								{label: 'Vault', value: 'name', sortable: true, className: 'ml-20'},
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
							{sortedVaultsToDisplay.map(
								(vault): ReactElement => (
									<VaultsListStrategy
										key={`${vault?.chainID || currentVault.chainID}_${vault.address}`}
										details={vault.details}
										chainId={vault.chainID || currentVault.chainID}
										variant={'v3'}
										address={vault.address}
										name={vault.name}
										tokenAddress={vault.token?.address || currentVault.token.address}
										allocation={formatCounterValue(
											toNormalizedBN(vault.details?.totalDebt || 0, vault.token?.decimals)
												.display,
											tokenPrice
										)}
										apr={vault.apr?.forwardAPR.netAPR || vault.apr?.netAPR}
										fees={vault.apr?.fees}
									/>
								)
							)}
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
									endAngle={-270}>
									{allocationChartData.map((_, index) => (
										<Cell key={`cell-${index}`} />
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
						{/* <AllocationPercentage allocationList={filteredVaultList} /> */}
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
