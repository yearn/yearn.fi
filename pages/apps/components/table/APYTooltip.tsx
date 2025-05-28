import {formatAmount} from '@builtbymom/web3/utils';
import {RenderAmount} from '@common/components/RenderAmount';

import type {FC} from 'react';

type TAPYTooltipProps = {
	baseAPY: number;
	rewardsAPY?: number;
	boost?: number;
	range?: [number, number];
	hasPendleArbRewards?: boolean;
	hasKelpNEngenlayer?: boolean;
	hasKelp?: boolean;
};

export const APYTooltip: FC<TAPYTooltipProps> = ({
	baseAPY,
	rewardsAPY,
	boost,
	range,
	hasPendleArbRewards,
	hasKelpNEngenlayer,
	hasKelp
}) => {
	return (
		<span className={'tooltipLight bottom-full mb-1'}>
			<div
				className={
					'font-number w-fit border border-neutral-300 bg-neutral-100 p-1 px-2 text-center text-xxs text-neutral-900'
				}>
				<div className={'flex flex-col items-start justify-start text-left'}>
					<div
						className={
							'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
						}>
						<p>{'• Base APY '}</p>
						<RenderAmount
							shouldHideTooltip
							value={baseAPY}
							symbol={'percent'}
							decimals={6}
						/>
					</div>

					{rewardsAPY ? (
						<div
							className={
								'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
							}>
							<p>{'• Rewards APY '}</p>
							<RenderAmount
								shouldHideTooltip
								value={rewardsAPY}
								symbol={'percent'}
								decimals={6}
							/>
						</div>
					) : null}

					{boost ? (
						<div
							className={
								'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
							}>
							<p>{'• Boost '}</p>
							<p>{`${formatAmount(boost, 2, 2)} x`}</p>
						</div>
					) : null}

					{range ? (
						<div
							className={
								'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
							}>
							<p>{'• Rewards APY '}</p>
							<div>
								<RenderAmount
									shouldHideTooltip
									value={range[0]}
									symbol={'percent'}
									decimals={6}
								/>
								&nbsp;&rarr;&nbsp;
								<RenderAmount
									shouldHideTooltip
									value={range[1]}
									symbol={'percent'}
									decimals={6}
								/>
							</div>
						</div>
					) : null}

					{hasPendleArbRewards ? (
						<div
							className={
								'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
							}>
							<p>{'• Extra ARB '}</p>
							<p>{`2 500/week`}</p>
						</div>
					) : null}

					{hasKelp ? (
						<div
							className={
								'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
							}>
							<p>{'• Extra Kelp Miles '}</p>
							<p>{`1x`}</p>
						</div>
					) : null}

					{hasKelpNEngenlayer ? (
						<>
							<div
								className={
									'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
								}>
								<p>{'• Extra Kelp Miles '}</p>
								<p>{`1x`}</p>
							</div>
							<div
								className={
									'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
								}>
								<p>{'• Extra EigenLayer Points '}</p>
								<p>{`1x`}</p>
							</div>
						</>
					) : null}
				</div>
			</div>
		</span>
	);
};
