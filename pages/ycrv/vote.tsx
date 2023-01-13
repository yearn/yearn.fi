import React from 'react';
import Wrapper from '@vaults/Wrapper';
import {HeroTimer} from '@common/components/HeroTimer';
import GaugeList from '@yCRV/components/list/GaugeList';
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
	const {nextPeriod} = useVLyCRV();

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
				{/* <VaultDetailsQuickActions currentVault={currentVault.current} /> */}
				<GaugeList />
			</section>
		</>
	);
}

Vote.getLayout = function getLayout(page: ReactElement, router: NextRouter): ReactElement {
	return <Wrapper router={router}>{page}</Wrapper>;
};

export default Vote;
