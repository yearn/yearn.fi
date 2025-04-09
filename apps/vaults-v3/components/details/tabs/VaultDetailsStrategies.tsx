import {useMemo} from 'react';
import {cl} from '@builtbymom/web3/utils';
import {VaultDetailsStrategy} from '@vaults/components/details/tabs/VaultDetailsStrategies';
import {useSortVaults} from '@vaults/hooks/useSortVaults';
import {useQueryArguments} from '@vaults/hooks/useVaultsQueryArgs';
import {VaultsV3ListHead} from '@vaults-v3/components/list/VaultsV3ListHead';
import {VaultsV3ListStrategy} from '@vaults-v3/components/list/VaultsV3ListStrategy';
import {ALL_VAULTSV3_KINDS_KEYS} from '@vaults-v3/constants';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useYearn} from '@common/contexts/useYearn';

import type {ReactElement} from 'react';
import type {TYDaemonVault, TYDaemonVaultStrategy} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TAddress, TSortDirection} from '@builtbymom/web3/types';
import type {TPossibleSortBy} from '@vaults/hooks/useSortVaults';

/************************************************************************************************
 * AllocationPercentage Component
 * Displays a donut chart representing the allocation percentages of various strategies
 * Uses SVG to create the circular chart with gaps to match the design
 * Shows "allocation %" text in the center of the chart
 ************************************************************************************************/
function AllocationPercentage({allocationPercentage}: {allocationPercentage: {[key: TAddress]: number}}): ReactElement {
	// Calculate the segments for the circular chart
	const segments = useMemo(() => {
		const entries = Object.entries(allocationPercentage);
		let currentAngle = 0;

		// Return array of segment data with start angle, end angle, and percentage
		return entries.map(([address, percentage], index) => {
			const segmentAngle = percentage * 360;
			const startAngle = currentAngle;
			currentAngle += segmentAngle;

			return {
				address,
				percentage,
				startAngle,
				endAngle: currentAngle,
				color: `hsl(${(index * 60) % 360}, 70%, 60%)`
			};
		});
	}, [allocationPercentage]);

	// Chart dimensions
	const size = 200;
	const radius = size / 2;
	const strokeWidth = 20;
	const innerRadius = radius - strokeWidth;

	// Calculate the SVG path for each segment
	const createSegmentPath = (startAngle: number, endAngle: number): string => {
		// Convert angles to radians and calculate x,y coordinates
		const startRad = (startAngle - 90) * (Math.PI / 180);
		const endRad = (endAngle - 90) * (Math.PI / 180);

		// Calculate the arc path
		const x1 = radius + innerRadius * Math.cos(startRad);
		const y1 = radius + innerRadius * Math.sin(startRad);
		const x2 = radius + innerRadius * Math.cos(endRad);
		const y2 = radius + innerRadius * Math.sin(endRad);

		// Determine if the arc should be drawn the long way around
		const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

		// Create SVG path
		return `M ${x1} ${y1} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;
	};

	return (
		<div className={'mt-8 flex size-full flex-col items-center justify-center'}>
			<div className={'relative size-[200px]'}>
				{/* Background circle - light gray */}

				{/* Segments */}
				<svg
					width={size}
					height={size}
					className={'absolute left-0 top-0'}>
					{segments.map((segment, index) => {
						// Add a small gap between segments
						const gapAngle = 5;
						const adjustedStartAngle = segment.startAngle + gapAngle / 2;
						const adjustedEndAngle = segment.endAngle - gapAngle / 2;

						// Skip segments that are too small after adding gaps
						if (adjustedEndAngle <= adjustedStartAngle) return null;

						return (
							<path
								key={`segment-${index}`}
								d={createSegmentPath(adjustedStartAngle, adjustedEndAngle)}
								stroke={'#FFFFFF'} // White color for all segments to match design
								strokeWidth={strokeWidth}
								fill={'none'}
							/>
						);
					})}
				</svg>

				{/* Center text */}
				<div className={'absolute inset-0 flex items-center justify-center'}>
					<span className={'text-center font-normal text-white'}>{'allocation %'}</span>
				</div>
			</div>
		</div>
	);
}

export function VaultDetailsStrategies({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const {vaults} = useYearn();
	const {sortDirection, sortBy, search, onSearch, onChangeSortDirection, onChangeSortBy} = useQueryArguments({
		defaultTypes: ALL_VAULTSV3_KINDS_KEYS,
		defaultPathname: '/v3/[chainID]/[address]'
	});

	const vaultList = useMemo((): TYDaemonVault[] => {
		const _vaultList = [];
		for (const strategy of currentVault?.strategies || []) {
			_vaultList.push(vaults[strategy.address]);
		}
		return _vaultList.filter(Boolean);
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
	const sortedVaultsToDisplay = useSortVaults([...vaultList], sortBy, sortDirection);
	const isVaultListEmpty = sortedVaultsToDisplay.length === 0;

	const totalAllocation = useMemo(() => {
		return sortedVaultsToDisplay.reduce((acc, vault) => acc + vault.tvl.tvl, 0);
	}, [sortedVaultsToDisplay]);

	const allocationPercentageList = useMemo(() => {
		return sortedVaultsToDisplay.reduce((acc, vault) => {
			return {...acc, [vault.address]: vault.tvl.tvl / totalAllocation};
		}, {});
	}, [sortedVaultsToDisplay, totalAllocation]);

	return (
		<>
			<div className={cl(isVaultListEmpty ? 'hidden' : '')}>
				<div className={'grid grid-cols-1 px-8 pb-6 md:gap-6 lg:grid-cols-12'}>
					<div className={'col-span-9 mt-8 flex min-h-[240px] w-full flex-col'}>
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
								{label: 'Vault', value: 'name', sortable: true, className: 'ml-24'},
								{
									label: 'Allocation %',
									value: 'tvl',
									sortable: true,
									className: 'col-span-4'
								},
								{label: 'Allocation $', value: 'tvl', sortable: true, className: 'col-span-4'},
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
										<VaultsV3ListStrategy
											key={`${vault?.chainID}_${vault.address}`}
											allocationPercentage={
												allocationPercentageList[
													vault.address as keyof typeof allocationPercentageList
												]
											}
											currentVault={vault}
										/>
									)
								)}
						</div>
					</div>
					<div className={'col-span-3 flex min-h-[240px] w-full flex-col'}>
						<AllocationPercentage allocationPercentage={allocationPercentageList} />
					</div>
				</div>
			</div>
			{strategyList.length > 0 ? (
				<div className={'col-span-12 w-full p-4 md:px-8 md:pb-8'}>
					<div className={'w-1/2'}>
						<p className={'pb-2 text-[#757CA6]'}>{'Other strategies'}</p>
					</div>
					<div className={'col-span-1 w-full border-t border-neutral-300'}>
						{(strategyList || []).map(
							(strategy): ReactElement => (
								<VaultDetailsStrategy
									currentVault={currentVault}
									strategy={strategy}
									key={strategy.address}
								/>
							)
						)}
					</div>
				</div>
			) : null}
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
