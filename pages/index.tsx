import {About} from 'apps/landing/components/sections/About';
import {Contribute} from 'apps/landing/components/sections/Contribute';
import {Footer} from 'apps/landing/components/sections/Footer';
import {Form} from 'apps/landing/components/sections/Form';
import {Hero} from 'apps/landing/components/sections/Hero';
import {Partners} from 'apps/landing/components/sections/Partners';
import {WaysToEarn} from 'apps/landing/components/sections/WaysToEarn';

import type {ReactElement} from 'react';

function Index(): ReactElement {
	return (
		<div>
			<main className={'flex w-full flex-col items-center bg-[#080A0C]'}>
				<Hero />
				<WaysToEarn />
				<About />
				<Partners />
				<Contribute />
				<div id={'form'}>
					<Form />
				</div>
			</main>
			<footer className={'flex w-full flex-col items-center bg-[#080A0C] pt-[104px] md:pt-[160px]'}>
				<Footer />
			</footer>
		</div>
	);
}

export default Index;
