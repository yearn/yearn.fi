import React from 'react';
import Balancer from 'react-wrap-balancer';
import Wrapper from '@vaults/Wrapper';
import SettingsOverwrite from '@common/components/SettingsOverwrite';

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';

function	About(): ReactElement {
	return (
		<section className={'mt-4 grid w-full grid-cols-1 gap-10 pb-10 md:mt-20 md:grid-cols-2'}>
			<div className={'w-full bg-neutral-100 p-10'}>
				<div aria-label={'Wtf is a Vault?'} className={'flex flex-col pb-6'}>
					<h2 className={'text-3xl font-bold'}>{'Wtf is a Vault?'}</h2>
				</div>
				<div aria-label={'Wtf is a Vault? details'}>
					<p className={'pb-4 text-neutral-600'}>
						<Balancer>{'In ‘traditional finance’ (boo, hiss) you can earn yield on your savings by depositing them in a bank - who use the capital for loans and other productive money growing means.'}</Balancer>
					</p>
					<p className={'pb-4 text-neutral-600'}>
						<Balancer>{'Yearn Vaults are like crypto savings accounts floating in cyberspace. You deposit your assets, and Yearn puts them to work within the DeFi ecosystem, returning the earned yield back to you.'}</Balancer>
					</p>
					<p className={'text-neutral-600'}>
						<Balancer>{'However, unlike a bank account - none of this takes place behind closed doors (no offence to doors). Decentralised Finance uses public blockchains, meaning you are in control of your assets and can see where they are at all times. Nothing is hidden and everything is auditable by anyone, at any time.'}</Balancer>
					</p>
				</div>
			</div> 

			<div className={'w-full bg-neutral-100 p-10'}>
				<div aria-label={'Risk Score'} className={'flex flex-col pb-6'}>
					<h2 className={'text-3xl font-bold'}>{'Risk Score'}</h2>
				</div>
				<div aria-label={'Risk Score details'}>
					<p className={'pb-4 text-neutral-600'}>
						<Balancer>{'In order to give users the best risk-adjusted yields in DeFi, Yearn uses a comprehensive risk assessment framework for each strategy within a Vault. This framework combines to give each Vault a holistic Risk Score.'}</Balancer>
					</p>
					<p className={'pb-4 text-neutral-600'}>
						<Balancer>{'Strategies are assessed against eight different factors; Audit, Code Review, Complexity, Longevity, Protocol Safety, Team Knowledge, Testing Score, TVL Impact. Since Vaults use multiple strategies, riskier strategies can be paired with more conservative ones to ensure the Vault has a robust and balanced Risk Score.'}</Balancer>
					</p>
					<p className={'text-neutral-600'}>
						<Balancer>{'For a full breakdown read more about our '}
							<a
								href={'https://docs.yearn.finance/resources/risks/risk-score'}
								target={'_blank'}
								className={'text-neutral-900 underline'}
								rel={'noreferrer'}>
								{'Risk Scores'}
							</a>
							{'.'}
						</Balancer>
					</p>
				</div>
			</div>


			<div className={'w-full bg-neutral-100 p-10'}>
				<div aria-label={'Fees'} className={'flex flex-col pb-6'}>
					<h2 className={'text-3xl font-bold'}>{'Fees'}</h2>
				</div>
				<div aria-label={'Fees'}>
					<p className={'pb-4 text-neutral-600'}>
						<Balancer>{'Yearn vaults never have a deposit or withdrawal fee (yay), and most have no management fee and a mere 10% performance fee. Because we use smart contracts (rather than human money managers with expensive designer drug habits) we’re able to be highly capital efficient and pass almost all earned yield on to you.'}</Balancer>
					</p>
				</div>
			</div>

			<div className={'w-full bg-neutral-100 p-10'}>
				<div aria-label={'APY'} className={'flex flex-col pb-6'}>
					<h2 className={'text-3xl font-bold'}>{'APY'}</h2>
				</div>
				<div aria-label={'APY'}>
					<p className={'pb-4 text-neutral-600'}>
						<Balancer>{'Vaults display a Net APY (or Annual Percentage Yield), which is the average APY of the past month’s harvest. For more detailed information on how APYs are calculated, visit our docs.'}</Balancer>
					</p>
				</div>
			</div>


			<div className={'w-full bg-neutral-100 p-10'}>
				<div aria-label={'Yearn? DeFi? I think I’m lost…'} className={'flex flex-col pb-6'}>
					<h2 className={'text-3xl font-bold'}>{'Yearn? DeFi? I think I’m lost…'}</h2>
				</div>
				<div aria-label={'Yearn? DeFi? I think I’m lost… details'}>
					<p className={'pb-4 text-neutral-600'}>
						<Balancer>{'Searching for ‘words that rhyme with turn’ and accidentally ended up here? Welcome! You’re at the frontier of Decentralised Finance - a new type of financial system built on blockchains and designed to give users better access, transparency and control of their assets.'}</Balancer>
					</p>
					<p className={'pb-4 text-neutral-600'}>
						<Balancer>{'DeFi offers many opportunities to put your digital assets to work, and earn yield in return - and Yearn was designed to automate this process for you. Less sharp suits and slicked back hair, more cyberspace yield ninjas wielding razor sharp battle tested code katanas.'}</Balancer>
					</p>
					<p className={'text-neutral-600'}>
						<Balancer>{'We can’t offer you a phone number with ambient jazz hold music to listen to - but please feel free to hop into our '}
							<a
								href={'https://discord.com/invite/6PNv2nF'}
								target={'_blank'}
								className={'text-neutral-900 underline'}
								rel={'noreferrer'}>
								{'discord'}
							</a>
							{' if you have any questions, we’d love to chat.'}
						</Balancer>
					</p>
				</div>
			</div>

			<SettingsOverwrite />
		</section>
	);
}

About.getLayout = function getLayout(page: ReactElement, router: NextRouter): ReactElement {
	return <Wrapper router={router}>{page}</Wrapper>;
};

export default About;
