import {useMemo} from 'react';
import {cl, formatCounterValue, toNormalizedBN} from '@builtbymom/web3/utils';
import {useSortVaults} from '@vaults/hooks/useSortVaults';
import {useQueryArguments} from '@vaults/hooks/useVaultsQueryArgs';
import {VaultsV3ListHead} from '@vaults-v3/components/list/VaultsV3ListHead';
import {ALL_VAULTSV3_KINDS_KEYS} from '@vaults-v3/constants';
import {AllocationPercentage} from '@common/components/AllocationPercentage';
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
	console.log('test');
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
		);
	}, [vaultList, strategyList]);

	/* 🔵 - Yearn Finance **************************************************************************
	 **	Then, once we have reduced the list of vaults to display, we can sort them. The sorting
	 **	is done via a custom method that will sort the vaults based on the sortBy and
	 **	sortDirection values.
	 **********************************************************************************************/
	const sortedVaultsToDisplay = useSortVaults(
		filteredVaultList as (TYDaemonVault & {
			details: TYDaemonVaultStrategy['details'];
		})[],
		sortBy,
		sortDirection
	) as (TYDaemonVault & {
		details: TYDaemonVaultStrategy['details'];
	})[];

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
							{sortedVaultsToDisplay
								.filter((v): boolean => Boolean(v?.chainID))
								.map(
									(vault): ReactElement => (
										<VaultsListStrategy
											key={`${vault?.chainID}_${vault.address}`}
											details={vault.details}
											chainId={vault.chainID}
											variant={'v3'}
											address={vault.address}
											name={vault.name}
											tokenAddress={vault.token.address}
											allocation={formatCounterValue(
												toNormalizedBN(vault.details?.totalDebt || 0, vault.token?.decimals)
													.display,
												tokenPrice
											)}
											apr={vault.apr.forwardAPR.netAPR || vault.apr?.netAPR}
											fees={vault.apr.fees}
										/>
									)
								)}
						</div>
					</div>
					<div className={'col-span-9 flex size-full lg:col-span-3'}>
						<AllocationPercentage allocationList={filteredVaultList} />
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
