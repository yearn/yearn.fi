import {useMemo, useRef, useState} from 'react';
import {useRouter} from 'next/router';
import {cl} from '@builtbymom/web3/utils';

import type {MouseEvent, ReactElement} from 'react';
import type {TYDaemonVaultStrategy} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TAddress} from '@builtbymom/web3/types';
/************************************************************************************************
 * AllocationPercentage Component
 * Displays a donut chart representing the allocation percentages of various strategies
 * Uses SVG arcs for visual rendering with improved mouse position tracking
 * Shows "allocation %" text in the center of the chart
 * Displays vault name in a tooltip when hovering over a segment
 ************************************************************************************************/
export function AllocationPercentage({allocationList}: {allocationList: TYDaemonVaultStrategy[]}): ReactElement {
	const router = useRouter();
	const isV3Page = router.pathname.startsWith(`/v3`);

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
		let cumulativePercentage = 0;

		return allocationList.map(vault => {
			const startPercentage = cumulativePercentage;
			cumulativePercentage += (vault.details?.debtRatio || 0) / 10000;
			return {
				address: vault.address as TAddress,
				name: vault.name,
				percentage: (vault.details?.debtRatio || 0) / 10000,
				startPercentage,
				endPercentage: cumulativePercentage
			};
		});
	}, [allocationList]);

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
		<div className={'flex size-full flex-col items-center justify-start'}>
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
								fill={'currentColor'}
								className={isV3Page ? 'text-white' : 'text-[#000838] dark:text-white'}
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
						<span className={'text-center font-normal text-neutral-900'}>{'allocation %'}</span>
					</div>
				</div>

				{/* Tooltip */}
				{hoveredSegment && (
					<div
						className={cl(
							'pointer-events-none absolute z-10 rounded px-3 py-2 text-xs text-white shadow-lg',
							isV3Page ? 'bg-neutral-300' : 'bg-neutral-900 dark:bg-neutral-300'
						)}
						style={{
							bottom: -hoveredSegment.y + 200,
							left: hoveredSegment.x,
							right: -hoveredSegment.x
						}}>
						<ul className={'flex flex-col gap-1'}>
							<li className={'flex items-center gap-2'}>
								<div className={'size-1.5 min-w-1.5 shrink-0 rounded-full bg-white'} />
								<p className={'max-w-[200px] font-medium'}>{hoveredSegment.name}</p>
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
