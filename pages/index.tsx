import {Footer, Hero, Integrations, Partners, Security, Vaults, FAQs} from 'apps/landing/components/sections';

import type {ReactElement} from 'react';

function Index(): ReactElement {
	return (
		<div>
			<main className={'flex w-full flex-col items-center gap-y-[64px] bg-[#080A0C]'}>
				<div className={'flex w-full flex-col items-center gap-y-[64px] md:gap-y-0'}>
					<Hero />
					<Vaults />
					<Security />
					<Partners />
					<Integrations />
					<FAQs />
				</div>
			</main>
			<footer className={'flex w-full flex-col items-center bg-[#080A0C]'}>
				<Footer />
			</footer>
		</div>
	);
}

export default Index;
