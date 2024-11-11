import {Hero} from 'apps/landing/components/sections/Hero';
import {WaysToEarn} from 'apps/landing/components/sections/WaysToEarn';

import type {ReactElement} from 'react';

function Landing(): ReactElement {
	return (
		<div className={'flex w-full flex-col items-center'}>
			<Hero />
			<WaysToEarn />
		</div>
	);
}

export default Landing;
