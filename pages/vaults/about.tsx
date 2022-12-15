import React, {useState} from 'react';
import Wrapper from '@vaults/Wrapper';
import SettingsOverwrite from '@common/components/SettingsOverwrite';

import type {ReactElement} from 'react';

function	About(): ReactElement {
	const	[showDust, set_showDust] = useState(false);
	const	[showLowTVLVaults, set_showLowTVLVaults] = useState(false);
	return (
		<section className={'mt-4 grid w-full grid-cols-1 gap-10 pb-10 md:mt-20 md:grid-cols-2'}>
			<div className={'w-full bg-neutral-100 p-10'}>
				<div aria-label={'Wtf is a Vault?'} className={'flex flex-col pb-6'}>
					<h2 className={'text-3xl font-bold'}>{'Wtf is a Vault?'}</h2>
				</div>
				<div aria-label={'Wtf is a Vault? details'}>
					<p className={'pb-4 text-neutral-600'}>
						{'In ‘traditional finance’ (boo, hiss) you can earn yield on your savings by depositing them in a bank - who use the capital for loans and other productive money growing means.'}
					</p>
					<p className={'pb-4 text-neutral-600'}>
						{'Yearn Vaults are like crypto savings accounts floating in cyberspace. You deposit your assets, and Yearn puts them to work within the DeFi ecosystem, returning the earned yield back to you.'}
					</p>
					<p className={'text-neutral-600'}>
						{'However, unlike a bank account - none of this takes place behind closed doors (no offence to doors). Decentralised Finance uses public blockchains, meaning you are in control of your assets and can see where they are at all times. Nothing is hidden and everything is auditable by anyone, at any time.'}
					</p>
				</div>
			</div> 

			<div className={'w-full bg-neutral-100 p-10'}>
				<div aria-label={'Risk Score'} className={'flex flex-col pb-6'}>
					<h2 className={'text-3xl font-bold'}>{'Risk Score'}</h2>
				</div>
				<div aria-label={'Risk Score details'}>
					<p className={'pb-4 text-neutral-600'}>
						{'In order to give users the best risk-adjusted yields in DeFi, Yearn uses a comprehensive risk assessment framework for each strategy within a Vault. This framework combines to give each Vault a holistic Risk Score.'}
					</p>
					<p className={'pb-4 text-neutral-600'}>
						{'Strategies are assessed against eight different factors; Audit, Code Review, Complexity, Longevity, Protocol Safety, Team Knowledge, Testing Score, TVL Impact. Since Vaults use multiple strategies, riskier strategies can be paired with more conservative ones to ensure the Vault has a robust and balanced Risk Score.'}
					</p>
					<p className={'text-neutral-600'}>
						{'For a full breakdown read more about our '}
						<a
							href={'https://docs.yearn.finance/resources/risks/risk-score'}
							target={'_blank'}
							className={'text-neutral-900 underline'}
							rel={'noreferrer'}>
							{'Risk Scores'}
						</a>
						{'.'}
					</p>
				</div>
			</div>


			<div className={'w-full bg-neutral-100 p-10'}>
				<div aria-label={'Fees'} className={'flex flex-col pb-6'}>
					<h2 className={'text-3xl font-bold'}>{'Fees'}</h2>
				</div>
				<div aria-label={'Fees'}>
					<p className={'pb-4 text-neutral-600'}>
						{'Yearn vaults never have a deposit or withdrawal fee (yay), and most have no management fee and a mere 10% performance fee. Because we use smart contracts (rather than human money managers with expensive designer drug habits) we’re able to be highly capital efficient and pass almost all earned yield on to you.'}
					</p>
				</div>
			</div>

			<div className={'w-full bg-neutral-100 p-10'}>
				<div aria-label={'APY'} className={'flex flex-col pb-6'}>
					<h2 className={'text-3xl font-bold'}>{'APY'}</h2>
				</div>
				<div aria-label={'APY'}>
					<p className={'pb-4 text-neutral-600'}>
						{'Vaults display a Net APY (or Annual Percentage Yield), which is the average APY of the past month’s harvest. For more detailed information on how APYs are calculated, visit our docs.'}
					</p>
				</div>
			</div>


			<div className={'w-full bg-neutral-100 p-10'}>
				<div aria-label={'Yearn? DeFi? I think I’m lost…'} className={'flex flex-col pb-6'}>
					<h2 className={'text-3xl font-bold'}>{'Yearn? DeFi? I think I’m lost…'}</h2>
				</div>
				<div aria-label={'Yearn? DeFi? I think I’m lost… details'}>
					<p className={'pb-4 text-neutral-600'}>
						{'Searching for ‘words that rhyme with turn’ and accidentally ended up here? Welcome! You’re at the frontier of Decentralised Finance - a new type of financial system built on blockchains and designed to give users better access, transparency and control of their assets.'}
					</p>
					<p className={'pb-4 text-neutral-600'}>
						{'DeFi offers many opportunities to put your digital assets to work, and earn yield in return - and Yearn was designed to automate this process for you. Less sharp suits and slicked back hair, more cyberspace yield ninjas wielding razor sharp battle tested code katanas.'}
					</p>
					<p className={'text-neutral-600'}>
						{'We can’t offer you a phone number with ambient jazz hold music to listen to - but please feel free to hop into our '}
						<a
							href={'https://discord.com/invite/6PNv2nF'}
							target={'_blank'}
							className={'text-neutral-900 underline'}
							rel={'noreferrer'}>
							{'discord'}
						</a>
						{' if you have any questions, we’d love to chat.'}
					</p>
				</div>
			</div>

			<SettingsOverwrite />

			<div className={'w-full bg-neutral-100 p-10'}>
				<div className={'flex flex-col pb-6'}>
					<h2 className={'text-3xl font-bold'}>{'Some more settings'}</h2>
				</div>
				<div aria-label={'Don’t get caught slippin’ details'}>
					<p className={'pb-4 text-neutral-600'}>
						{'More settings for the braves'}
					</p>
				</div>
				<div className={'mt-8 flex flex-row items-center space-x-4'}>
					<div className={'flex flex-row space-x-2'}>
						<input
							type={'checkbox'}
							id={'showLowTVLVaults'}
							className={'h-4 w-4'}
							checked={showLowTVLVaults}
							onChange={(): void => set_showLowTVLVaults(!showLowTVLVaults)}
						/>
					</div>
					<label
						htmlFor={'showLowTVLVaults'}
						className={'text-neutral-900'}>
						{'Show low TVL vaults'}
					</label>
				</div>

				<div className={'mt-2 flex flex-row items-center space-x-4'}>
					<div className={'flex flex-row space-x-2'}>
						<input
							type={'checkbox'}
							id={'showDust'}
							className={'h-4 w-4'}
							checked={showDust}
							onChange={(): void => set_showDust(!showDust)}
						/>
					</div>
					<label
						htmlFor={'showDust'}
						className={'text-neutral-900'}>
						{'Show dust'}
					</label>
				</div>
			</div>


		</section>
	);
}

About.getLayout = function getLayout(page: ReactElement): ReactElement {
	return <Wrapper>{page}</Wrapper>;
};

export default About;
