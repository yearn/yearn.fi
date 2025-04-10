import {useMemo, useRef, useState} from 'react';
import {cl} from '@builtbymom/web3/utils';
import {VaultDetailsStrategy} from '@vaults/components/details/tabs/VaultDetailsStrategies';
import {useSortVaults} from '@vaults/hooks/useSortVaults';
import {useQueryArguments} from '@vaults/hooks/useVaultsQueryArgs';
import {VaultsV3ListHead} from '@vaults-v3/components/list/VaultsV3ListHead';
import {VaultsV3ListStrategy} from '@vaults-v3/components/list/VaultsV3ListStrategy';
import {ALL_VAULTSV3_KINDS_KEYS} from '@vaults-v3/constants';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useYearn} from '@common/contexts/useYearn';

import type {MouseEvent, ReactElement} from 'react';
import type {TYDaemonVault, TYDaemonVaultStrategy} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TAddress, TSortDirection} from '@builtbymom/web3/types';
import type {TPossibleSortBy} from '@vaults/hooks/useSortVaults';

/************************************************************************************************
 * AllocationPercentage Component
 * Displays a donut chart representing the allocation percentages of various strategies
 * Uses SVG arcs for visual rendering with improved mouse position tracking
 * Shows "allocation %" text in the center of the chart
 * Displays vault name in a tooltip when hovering over a segment
 ************************************************************************************************/
function AllocationPercentage({
	allocationPercentage
}: {
	allocationPercentage: {[key: TAddress]: {percentage: number; name: string}};
}): ReactElement {
	const [hoveredSegment, set_hoveredSegment] = useState<{
		address: TAddress;
		name: string;
		percentage: number;
		x: number;
		y: number;
	} | null>(null);

	const chartRef = useRef<HTMLDivElement>(null);

	// Calculate the segments for the pie chart
	const segments = useMemo(() => {
		const entries = Object.entries(allocationPercentage);
		let cumulativePercentage = 0;

		return entries.map(([address, {percentage, name}]) => {
			const startPercentage = cumulativePercentage;
			cumulativePercentage += percentage;

			return {
				address: address as TAddress,
				name,
				percentage,
				startPercentage,
				endPercentage: cumulativePercentage
			};
		});
	}, [allocationPercentage]);

	// Handle mouse movement over the chart area
	const handleMouseMove = (event: MouseEvent): void => {
		if (!chartRef.current) return;

		const rect = chartRef.current.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;

		// Calculate the center point of the chart
		const centerX = rect.width / 2;
		const centerY = rect.height / 2;

		// Calculate distance from center (to check if within donut ring)
		const distanceFromCenter = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));

		// Chart radius and donut thickness
		const radius = rect.width / 2;
		const innerRadius = radius * 0.7; // 70% for inner hole

		// Check if cursor is within the donut ring
		if (distanceFromCenter > innerRadius && distanceFromCenter < radius) {
			// Calculate angle in radians, then convert to percentage around the circle
			let angle = Math.atan2(y - centerY, x - centerX);

			// Convert angle to 0-360 degrees, starting from top (negative Y axis)
			angle = angle * (180 / Math.PI); // Convert to degrees
			if (angle < 0) angle += 360; // Convert to 0-360 range
			angle = (angle + 90) % 360; // Rotate to start from top

			// Find which segment this angle belongs to
			const percentage = angle / 360;

			// Find the segment containing this percentage
			for (const segment of segments) {
				if (percentage >= segment.startPercentage && percentage <= segment.endPercentage) {
					set_hoveredSegment({
						address: segment.address,
						name: segment.name,
						percentage: segment.percentage,
						x,
						y
					});
					return;
				}
			}
		}

		// Not over any segment
		set_hoveredSegment(null);
	};

	const handleMouseLeave = (): void => {
		set_hoveredSegment(null);
	};

	// SVG path generation
	const createArcPath = (
		startPercentage: number,
		endPercentage: number,
		radius: number,
		thickness: number
	): string => {
		// Add small gap between segments
		const gapAngle = 0.005; // 0.5% gap
		const adjustedStartPercentage = startPercentage + gapAngle;
		const adjustedEndPercentage = endPercentage - gapAngle;

		// Skip tiny segments
		if (adjustedEndPercentage <= adjustedStartPercentage) return '';

		const startAngle = adjustedStartPercentage * Math.PI * 2 - Math.PI / 2;
		const endAngle = adjustedEndPercentage * Math.PI * 2 - Math.PI / 2;

		const innerRadius = radius - thickness;
		const outerRadius = radius;

		// Calculate points
		const startOuterX = 100 + outerRadius * Math.cos(startAngle);
		const startOuterY = 100 + outerRadius * Math.sin(startAngle);
		const endOuterX = 100 + outerRadius * Math.cos(endAngle);
		const endOuterY = 100 + outerRadius * Math.sin(endAngle);

		const startInnerX = 100 + innerRadius * Math.cos(startAngle);
		const startInnerY = 100 + innerRadius * Math.sin(startAngle);
		const endInnerX = 100 + innerRadius * Math.cos(endAngle);
		const endInnerY = 100 + innerRadius * Math.sin(endAngle);

		// Determine if the arc is more than 180 degrees
		const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

		// Create path
		return `
			M ${startOuterX} ${startOuterY}
			A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${endOuterX} ${endOuterY}
			L ${endInnerX} ${endInnerY}
			A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${startInnerX} ${startInnerY}
			Z
		`;
	};

	return (
		<div className={'flex size-full flex-col items-center justify-center'}>
			<div
				ref={chartRef}
				className={'relative size-[200px]'}
				onMouseMove={handleMouseMove}
				onMouseLeave={handleMouseLeave}>
				{/* SVG donut chart */}
				<svg
					className={'pointer-events-none size-full'}
					viewBox={'0 0 200 200'}>
					{segments.map((segment, index) => {
						const arcPath = createArcPath(segment.startPercentage, segment.endPercentage, 90, 20);
						if (!arcPath) return null;

						return (
							<path
								key={`segment-${index}`}
								d={arcPath}
								fill={'white'}
							/>
						);
					})}
				</svg>

				{/* Donut hole */}
				<div
					className={
						'pointer-events-none absolute left-1/2 top-1/2 size-[140px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent'
					}>
					{/* Center text */}
					<div className={'flex size-full items-center justify-center'}>
						<span className={'text-center font-normal text-white'}>{'allocation %'}</span>
					</div>
				</div>

				{/* Tooltip */}
				{hoveredSegment && (
					<div
						className={
							'pointer-events-none absolute z-10 rounded bg-neutral-300 px-3 py-2 text-xs text-white shadow-lg'
						}
						style={{
							bottom: -hoveredSegment.y + 200,
							left: hoveredSegment.x,
							right: -hoveredSegment.x
						}}>
						<ul className={'flex flex-col gap-1'}>
							<li className={'flex items-center gap-2'}>
								<div className={'size-1.5 min-w-1.5 shrink-0 rounded-full bg-white'} />
								<p className={'max-w-[200px]  font-medium'}>{hoveredSegment.name}</p>
							</li>
							<li className={'flex items-center gap-2'}>
								<div className={'size-1.5 min-w-1.5 shrink-0 rounded-full bg-white'} />
								<p>
									{(hoveredSegment.percentage * 100).toFixed(2)}
									{'%'}
								</p>
							</li>
						</ul>
					</div>
				)}
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
	const sortedVaultsToDisplay = useSortVaults([...vaultList], sortBy, sortDirection);
	const isVaultListEmpty = sortedVaultsToDisplay.length === 0;

	const totalAllocation = useMemo(() => {
		return sortedVaultsToDisplay.reduce((acc, vault) => acc + vault.tvl.tvl, 0);
	}, [sortedVaultsToDisplay]);

	const allocationPercentageList = useMemo(() => {
		return sortedVaultsToDisplay.reduce((acc, vault) => {
			return {...acc, [vault.address]: {percentage: vault.tvl.tvl / totalAllocation, name: vault.name}};
		}, {});
	}, [sortedVaultsToDisplay, totalAllocation]);

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
								{label: 'Vault', value: 'name', sortable: true, className: 'ml-24'},
								{
									label: 'Allocation %',
									value: 'allocationPercentage',
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
											currentVault={
												vault as TYDaemonVault & {details: TYDaemonVaultStrategy['details']}
											}
										/>
									)
								)}
						</div>
					</div>
					<div
						className={
							'col-span-9 my-auto flex size-full min-h-[240px] flex-col items-center lg:col-span-3'
						}>
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
