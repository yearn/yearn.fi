import React from 'react';
import Balancer from 'react-wrap-balancer';
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
	const vlYCrv = useVLyCRV();

	console.log({vlYCrv});
	
	return (
		<>
			<HeroTimer timeLeft={127579000} />
			<div className={'mt-8 mb-10 w-full max-w-6xl text-center'}>
				<Balancer>
					<b className={'text-center text-lg md:text-2xl'}>{'Vote For Your Gauge. '}</b>
					<p className={'mt-8 whitespace-pre-line text-center text-base text-neutral-600'}>
						{'... stats ...'}
					</p>
				</Balancer>
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
