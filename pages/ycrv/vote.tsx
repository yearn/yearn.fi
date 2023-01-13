import React, {useState} from 'react';
import Balancer from 'react-wrap-balancer';
import Wrapper from '@vaults/Wrapper';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {YCRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {HeroTimer} from '@common/components/HeroTimer';
import GaugeList from '@yCRV/components/list/GaugeList';
import {QuickActions} from '@yCRV/components/QuickActions';
import {useVLyCRV} from '@yCRV/hooks/useVLyCRV';

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';
import type {TYearnGauge} from '@common/types/yearn';

export const MOCK_GAUGE: TYearnGauge = {
	name: 'Gauge',
	address: '0x',
	category: 'Foo',
	token: {
		address: '0x000000000000000000000000000000000000dEaD'
	},
	votes: 0
};

function Vote(): ReactElement {
	const {isActive} = useWeb3();
	const {nextPeriod} = useVLyCRV();
	const [isLocking, set_isLocking] = useState(true);

	console.log({YCRV_TOKEN_ADDRESS});
	
	const fromSelect = {
		label: `From ${isLocking ? 'wallet' : 'vault'}`,
		legend: 'You have 420 000.69',
		options: [],
		balanceSource: {},
		onSelect: (): void => undefined,
		selected: undefined
	};

	const fromInput = {
		onChange: (): void => undefined,
		value: 0,
		onSetMaxAmount: (): void => undefined,
		label: 'Amount',
		legend: '$23,344.55',
		isDisabled: !isActive
	};

	const switchProps = {
		tooltipText: isLocking ? 'Withdraw' : 'Lock',
		onSwitchFromTo: (): void => set_isLocking((prev): boolean => !prev)
	};
	
	const toSelect = {
		label: `To ${isLocking ? 'vault' : 'wallet'}`,
		legend: 'APY 69%',
		options: [],
		onSelect: (): void => undefined,
		selected: undefined
	};

	const toInput = {
		onChange: (): void => undefined,
		value: 0,
		label: 'You will get',
		legend: '$23,344.55',
		isDisabled: true
	};

	return (
		<>
			<HeroTimer endTime={nextPeriod} />
			<div className={'mt-8 mb-10 w-full max-w-6xl text-center'}>
				<div className={'mb-10 md:mb-14'}>
					<b className={'text-center text-lg md:text-2xl'}>{'Time left till next period'}</b>
				</div>
				<div className={'grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-12'}>
					<div className={'flex flex-col items-center justify-center space-y-1 md:space-y-2'}>
						<b className={'font-number text-lg md:text-3xl'} suppressHydrationWarning>
							{'420 000'}
						</b>
						<legend className={'font-number text-xxs text-neutral-600 md:text-xs'} suppressHydrationWarning>
							{'Total Value Locked'}
						</legend>
					</div>

					<div className={'flex flex-col items-center justify-center space-y-1 md:space-y-2'}>
						<b className={'font-number text-lg md:text-3xl'} suppressHydrationWarning>
							{'69 000'}
						</b>
						<legend className={'text-xxs text-neutral-600 md:text-xs'}>{'Total X Stacked'}</legend>
					</div>

					<div className={'flex flex-col items-center justify-center space-y-1 md:space-y-2'}>
						<b className={'font-number text-lg md:text-3xl'} suppressHydrationWarning>
							{'12 Jan 2023'}
						</b>
						<legend className={'font-number text-xxs text-neutral-600 md:text-xs'} suppressHydrationWarning>
							{'Last vote'}
						</legend>
					</div>
				</div>
			</div>
			<section className={'mt-10 grid w-full grid-cols-12 pb-10 md:mt-0'}>
				<div
					aria-label={'Quick Actions'}
					className={'col-span-12 mb-4 bg-neutral-200'}>
					<div className={'p-4 pb-0 md:p-8 md:pb-0'}>
						<Balancer>
							<h2 suppressHydrationWarning className={'pb-2 text-lg font-bold md:pb-4 md:text-3xl'}>{'Get your vote on.'}</h2>
							<p>{'Deposit vanilla yCRV for vote locked yCRV (vl-yCRV) and gain vote power for Curve voting. Each vote period lasts for two weeks, and your tokens cannot be withdrawn until the end of the following period.\nPlease note, vl-yCRV does not generate yield but maintains a 1:1 exchange rate with yCRV (so if yCRV increases in value, so will your vl-yCRV). '}</p>
						</Balancer>
					</div>
					<div className={'col-span-12 flex flex-col space-x-0 space-y-2 p-4 md:flex-row md:space-x-4 md:space-y-0 md:p-8'}>
						<QuickActions label={'voteFrom'}>
							<QuickActions.Select {...fromSelect} />
							<QuickActions.Input {...fromInput} />
						</QuickActions>
						<QuickActions.Switch {...switchProps} />
						<QuickActions label={'voteTo'}>
							<QuickActions.Select {...toSelect} />
							<QuickActions.Input {...toInput} />
						</QuickActions>
					</div>
				</div>
				<GaugeList />
			</section>
		</>
	);
}

Vote.getLayout = function getLayout(page: ReactElement, router: NextRouter): ReactElement {
	return <Wrapper router={router}>{page}</Wrapper>;
};

export default Vote;
