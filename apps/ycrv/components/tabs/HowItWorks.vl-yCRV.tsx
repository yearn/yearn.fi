import React from 'react';
import Balancer from 'react-wrap-balancer';
import HowItWorksDiagram from '@yCRV/components/illustrations/how-it-works';

import type {ReactElement} from 'react';

function HowItWorks(): ReactElement {
	return (
		<div
			aria-label={'Quick Actions'}
			className={'col-span-12'}>
			<Balancer>
				<h2 suppressHydrationWarning className={'pb-2 text-lg font-bold md:pb-4 md:text-3xl'}>{'Deposit'}</h2>
				<p>{'Deposit vanilla yCRV for vote locked yCRV (vl-yCRV) and gain vote power for Curve voting. Let’s learn about the fun way that Curve voting works. Each vote period lasts for two weeks, and once you vote in the ‘current period’ (as shown below) your tokens cannot be withdrawn until after the ‘next period’. Voting in the next period (once it becomes the current period) would again lock your tokens for a further period. Please note, vl-yCRV does not generate yield but maintains a 1:1 exchange rate with yCRV (so if yCRV increases in value, so will your vl-yCRV).'}</p>
				<h2 suppressHydrationWarning className={'mt-4 pb-2 text-lg font-bold md:mt-8 md:pb-4 md:text-3xl'}>{'Withdraw'}</h2>
				<p>{'Once you vote in the ‘current period’ (as shown below), you must wait until the end of the ‘next period’ in order to withdraw your vl-yCRV back to yCRV. However, if you choose to also vote in the ‘next period’ once it becomes the ‘current period’ you would then have to wait until the end of the following period (without voting in it) in order to withdraw. In other words, once you vote in the ‘current period’ you must wait for the ‘next period’ to end without voting in it to withdraw. Who said DeFi was complicated...'}</p>
			</Balancer>
			<p className={'pt-8 md:pt-16 md:pb-0'}>
				<HowItWorksDiagram />
			</p>
		</div>
	);
}

export default HowItWorks;
