import {About} from 'apps/landing/components/sections/About';
import {Hero} from 'apps/landing/components/sections/Hero';
import {Partners} from 'apps/landing/components/sections/Partners';
import {WaysToEarn} from 'apps/landing/components/sections/WaysToEarn';

import type {ReactElement} from 'react';

function Landing(): ReactElement {
	return (
		<div className={'flex w-full flex-col items-center bg-[#080A0C]'}>
			<Hero />
			<WaysToEarn />
			<About />
			<Partners />
		</div>
	);
}

export default Landing;
