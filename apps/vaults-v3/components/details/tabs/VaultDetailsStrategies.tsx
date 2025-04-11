import {useMemo} from 'react';
import {cl, formatCounterValue, toNormalizedBN} from '@builtbymom/web3/utils';
import {useSortVaults} from '@vaults/hooks/useSortVaults';
import {useQueryArguments} from '@vaults/hooks/useVaultsQueryArgs';
import {VaultsV3ListHead} from '@vaults-v3/components/list/VaultsV3ListHead';
import {ALL_VAULTSV3_KINDS_KEYS} from '@vaults-v3/constants';
import {Button} from '@yearn-finance/web-lib/components/Button';
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
	const {sortDirection, sortBy, search, onSearch, onChangeSortDirection, onChangeSortBy} = useQueryArguments({
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

	/* 🔵 - Yearn Finance **************************************************************************
	 **	Then, once we have reduced the list of vaults to display, we can sort them. The sorting
	 **	is done via a custom method that will sort the vaults based on the sortBy and
	 **	sortDirection values.
	 **********************************************************************************************/
	const sortedVaultsToDisplay = useSortVaults([...vaultList], sortBy, sortDirection) as (TYDaemonVault & {
		details: TYDaemonVaultStrategy['details'];
	})[];
	const isVaultListEmpty = sortedVaultsToDisplay.length === 0;

	const allocationList = [...vaultList, ...strategyList];

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
					<div
						className={
							'col-span-9 row-span-2 my-auto flex size-full min-h-[240px] flex-col items-center lg:col-span-3'
						}>
						<AllocationPercentage allocationList={allocationList} />
					</div>
					<div className={'col-span-9 flex min-h-[240px] w-full flex-col'}>
						{strategyList.length > 0 ? (
							<div className={'col-span-12 w-full md:pb-8'}>
								<div className={'w-1/2'}>
									<p className={'pb-2 text-[#757CA6]'}>{'Other strategies'}</p>
								</div>
								<div className={'col-span-1 w-full border-t border-neutral-300'}></div>
							</div>
						) : null}
						<div className={'grid gap-4'}>
							{(strategyList || []).map(
								(strategy): ReactElement => (
									<VaultsListStrategy
										key={`${currentVault?.chainID}_${strategy.address}`}
										details={strategy.details}
										variant={'v3'}
										chainId={currentVault.chainID}
										address={strategy.address}
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
				</div>
			</div>

			<div className={cl(isVaultListEmpty && search === null ? '' : 'hidden')}>
				<div className={'mx-auto flex h-96 w-full flex-col items-center justify-center px-10 py-2 md:w-3/4'}>
					<b className={'text-center text-lg'}>{'This vault IS the strategy'}</b>
					<p className={'text-center text-neutral-600'}>
						{"Surprise! This vault doesn't have any strategies. It is the strategy. #brainexplosion"}
					</p>
				</div>
			</div>
			<div className={cl(isVaultListEmpty && search ? '' : 'hidden')}>
				<div className={'mx-auto flex h-96 w-full flex-col items-center justify-center px-10 py-2 md:w-3/4'}>
					<b className={'text-center text-lg'}>{'No vaults found'}</b>
					<p className={'text-center text-neutral-600'}>{'Try another search term'}</p>
					<Button
						className={'mt-4 w-full md:w-48'}
						onClick={(): void => onSearch('')}>
						{'Clear Search'}
					</Button>
				</div>
			</div>
		</>
	);
}
