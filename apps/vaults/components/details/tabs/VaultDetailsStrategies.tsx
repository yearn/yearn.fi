import {useMemo} from 'react';
import {cl, formatCounterValue, toNormalizedBN} from '@builtbymom/web3/utils';
import {useSortVaults} from '@vaults/hooks/useSortVaults';
import {useQueryArguments} from '@vaults/hooks/useVaultsQueryArgs';
import {VaultsV3ListHead} from '@vaults-v3/components/list/VaultsV3ListHead';
import {AllocationPercentage} from '@common/components/AllocationPercentage';
import {VaultsListStrategy} from '@common/components/VaultsListStraregy';
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
		defaultPathname: '/vaults/[chainID]/[address]'
	});

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

	const filteredStrategyList = useMemo(() => {
		return strategyList.filter(strategy => strategy.details?.totalDebt !== '0') as (TYDaemonVault & {
			details: TYDaemonVaultStrategy['details'];
		})[];
	}, [strategyList]);

	/* 🔵 - Yearn Finance **************************************************************************
	 **	Then, once we have reduced the list of vaults to display, we can sort them. The sorting
	 **	is done via a custom method that will sort the vaults based on the sortBy and
	 **	sortDirection values.
	 **********************************************************************************************/
	const sortedVaultsToDisplay = useSortVaults(filteredStrategyList, sortBy, sortDirection) as (TYDaemonVault & {
		details: TYDaemonVaultStrategy['details'];
	})[];

	const isVaultListEmpty = strategyList.length === 0;
	const isFilteredVaultListEmpty = filteredStrategyList.length === 0;

	return (
		<>
			<div className={cl(isFilteredVaultListEmpty ? 'hidden ' : '')}>
				<div className={'grid grid-cols-1 px-8 pb-6 pt-8 md:gap-6 lg:grid-cols-12 '}>
					<div className={'col-span-9 flex w-full flex-col self-start rounded-[4px] border border-fallback'}>
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
						<div className={'grid'}>
							{(sortedVaultsToDisplay || []).map(
								(strategy): ReactElement => (
									<VaultsListStrategy
										key={`${currentVault?.chainID}_${strategy.address}`}
										details={strategy.details}
										chainId={currentVault.chainID}
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
								)
							)}
						</div>
					</div>
					<div className={'col-span-9 flex size-full lg:col-span-3'}>
						<AllocationPercentage allocationList={strategyList} />
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
