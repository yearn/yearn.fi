import React, {ReactElement} from 'react';
import Wrapper from 'components/apps/vaults/Wrapper';

function	About(): ReactElement {
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
					<p className={'text-neutral-600'}>
						{'Yearn Vaults are like crypto savings accounts floating in cyberspace. You deposit your assets, and Yearn puts them to work within the DeFi ecosystem, returning the earned yield back to you.'}
					</p>
				</div>
			</div> 

			<div className={'w-full bg-neutral-100 p-10'}>
				<div aria-label={'Trust Score'} className={'flex flex-col pb-6'}>
					<h2 className={'text-3xl font-bold'}>{'Trust Score'}</h2>
				</div>
				<div aria-label={'Trust Score details'}>
					<p className={'pb-4 text-neutral-600'}>
						{'They say there’s no such thing as a free lunch (clearly ‘they’ have never found a half eaten sandwich on the pavement)... But, we digress, in order to give users the best risk-adjusted yields in DeFi, Yearn uses a comprehensive risk assessment framework for each strategy within a Vault. This framework combines to give each Vault a holistic Trust Score. '}
					</p>
					<p className={'pb-4 text-neutral-600'}>
						{'Strategies are assessed against eight different factors; Audit, Code Review, Complexity, Longevity, Protocol Safety, Team Knowledge, Testing Score, TVL Impact. Since Vaults use multiple strategies, riskier strategies can be paired with more conservative ones to ensure the Vault has a robust and balanced Trust Score.'}
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
						{'Yearn vaults never have a deposit or withdrawal fee (yay), and most have no management fee and a mere 10% performance fee. Because we use smart contracts (rather than human money managers with expensive designer drug habits) we’re able to be highly capital efficient and pass almost all earned yield on to you. '}
					</p>
				</div>
			</div>


			<div className={'w-full bg-neutral-100 p-10'}>
				<div aria-label={'This DeFi thing seems scary… '} className={'flex flex-col pb-6'}>
					<h2 className={'text-3xl font-bold'}>{'This DeFi thing seems scary… '}</h2>
				</div>
				<div aria-label={'This DeFi thing seems scary…  details'}>
					<p className={'pb-4 text-neutral-600'}>
						{'If you’re new to the exciting world of Decentralised Finance - welcome! We completely understand how daunting all of this can seem. But, unlike the financial world you are used to, in DeFi you are in control of your assets - plus you have total visibility and can see transparently where your funds are at all times.'}
					</p>
					<p className={'text-neutral-600'}>
						{'Everything takes place on open blockchains - auditable by all, 24/7. And while we can’t offer you a phone number with nice hold music to listen to - please feel free to hop into our '}
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
		</section>
	);
}

About.getLayout = function getLayout(page: ReactElement): ReactElement {
	return <Wrapper>{page}</Wrapper>;
};

export default About;
