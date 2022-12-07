import React, {useState} from 'react';
import {Button} from '@yearn-finance/web-lib/components/Button';
import SettingsOverwrite from '@common/components/SettingsOverwrite';
import {useWallet} from '@common/contexts/useWallet';
import Wrapper from '@yCRV/Wrapper';

import type {ReactElement} from 'react';

function	About(): ReactElement {
	const	{slippage, set_slippage} = useWallet();
	const	[localSlippage, set_localSlippage] = useState(slippage);

	return (
		<section className={'mt-4 grid w-full grid-cols-1 gap-10 pb-10 md:mt-20 md:grid-cols-2'}>
			<div className={'w-full bg-neutral-100 p-10'}>
				<div aria-label={'Win the curve wars with Yearn'} className={'flex flex-col pb-6'}>
					<h2 className={'text-3xl font-bold'}>{'Win the curve wars'}</h2>
					<h2 className={'text-3xl font-bold'}>{'with Yearn.'}</h2>
				</div>
				<div aria-label={'Win the curve wars with Yearn details'}>
					<p className={' pb-4 text-neutral-600'}>{'We’ve completely overhauled our suite of curve products; refining, improving, and simplifying everything. The result? Our users get the highest yields, in the most streamlined way possible. Lfg.'}</p>
					<p className={'text-neutral-600'}>
						{'For more info on each token, and how to use the UI read our '}
						<a
							href={'https://docs.yearn.finance/getting-started/products/ycrv/overview'}
							target={'_blank'}
							className={'text-neutral-900 underline'}
							rel={'noreferrer'}>{'docs'}
						</a>
						{'.'}
					</p>
				</div>
			</div> 

			<div className={'w-full bg-neutral-100 p-10'}>
				<div aria-label={'Swap anytime for better yield'} className={'flex flex-col pb-6'}>
					<h2 className={'text-3xl font-bold'}>{'Swap anytime for'}</h2>
					<h2 className={'text-3xl font-bold'}>{'better yield.'}</h2>
				</div>
				<div aria-label={'Swap anytime for better yield details'}>
					<p className={'pb-4 text-neutral-600'}>
						{'If you have '}
						<span className={'text-neutral-900'}>{'st-yCRV'}</span>
						{' and notice that '}
						<span className={'text-neutral-900'}>{'lp-yCRV'}</span>
						{' is generating better yield, you can swap anytime on the main page. Or vice versa.'}
					</p>
					<p className={'text-neutral-600'}>{'You get more yield, and a fun swap experience. Win win.'}</p>
				</div>
			</div>


			<div className={'w-full bg-neutral-100 p-10'}>
				<div aria-label={'Better tokens, better yield'} className={'flex flex-col pb-6'}>
					<h2 className={'text-3xl font-bold'}>{'Better tokens,'}</h2>
					<h2 className={'text-3xl font-bold'}>{'better yield.'}</h2>
				</div>
				<div aria-label={'Better tokens, better yield details'}>
					<p className={'pb-4 text-neutral-600'}>{'By simplifying our product (and naming conventions) we can focus on getting users the best ‘hands off’ yield around.'}</p>
					<p className={'pb-4 text-neutral-600'}>
						<span className={'text-neutral-900'}>{'yCRV'}</span>
						{' can be staked for '}
						<span className={'text-neutral-900'}>{'st-yCRV'}</span>
						{', or LP’d for '}
						<span className={'text-neutral-900'}>{'lp-yCRV'}</span>
						{'.'}
					</p>
					<p className={'text-neutral-600'}>{'Whichever option you pick, rewards are auto claimed and auto compound - giving you supercharged yield without you having to lift a finger. After all, lazy yield is the best yield.'}</p>
				</div>
			</div>


			<div className={'w-full bg-neutral-100 p-10'}>
				<div aria-label={'“But ser... I have yveCRV and yvBOOST”'} className={'flex flex-col pb-6'}>
					<h2 className={'text-3xl font-bold'}>{'“But ser... I have yveCRV'}</h2>
					<h2 className={'text-3xl font-bold'}>{'and yvBOOST”'}</h2>
				</div>
				<div aria-label={'“But ser... I have yveCRV and yvBOOST” details'}>
					<p className={'pb-4 text-neutral-600'}>
						{'Streamlining and simplifying our products means that '}
						<span className={'text-neutral-900'}>{'yveCRV'}</span>
						{' and '}
						<span className={'text-neutral-900'}>{'yvBOOST'}</span>
						{' are now legacy tokens that no longer earn yield (RIP).'}
					</p>
					<p className={'text-neutral-600'}>
						{'But *Professor Farnsworth voice* good news everybody; you can migrate them for '}
						<span className={'text-neutral-900'}>{'yCRV'}</span>
						{', '}
						<span className={'text-neutral-900'}>{'st-yCRV'}</span>
						{' or '}
						<span className={'text-neutral-900'}>{'lp-yCRV'}</span>
						{' on the main page.'}
					</p>
				</div>
			</div>

			<div className={'w-full bg-neutral-100 p-10'}>
				<div aria-label={'Don’t get caught slippin’'} className={'flex flex-col pb-6'}>
					<h2 className={'text-3xl font-bold'}>{'Don’t get '}</h2>
					<h2 className={'text-3xl font-bold'}>{'caught slippin’'}</h2>
				</div>
				<div aria-label={'Don’t get caught slippin’ details'}>
					<p className={'pb-4 text-neutral-600'}>
						{'Slippage is set to 1% and hidden by default to streamline the experience for the average user.'}
					</p>
					<p className={'pb-4 text-neutral-600'}>
						{'For advanced apes users worried about MEV we advise using '}
						<a
							href={'https://securerpc.com/'}
							target={'_blank'}
							className={'text-neutral-900 underline'}
							rel={'noreferrer'}>{'SecureRpc'}
						</a>
						{'.'}
					</p>
					<p className={'text-neutral-600'}>
						{'If the above sentence causes your brain to wrinkle and eyes to glaze over, then you do not need to worry about this step. '}
					</p>
				</div>
				<div className={'mt-8'}>
					<label
						htmlFor={'slippageTolerance'}
						className={'pb-1 text-neutral-900'}>
						{'Slippage tolerance'}
					</label>
					<div className={'flex flex-row space-x-2'}>
						<div className={'flex h-10 w-40 min-w-[160px] items-center border-2 border-neutral-700 bg-neutral-0 py-4 px-0'}>
							<input
								id={'slippageTolerance'}
								type={'number'}
								min={0}
								step={0.1}
								max={100}
								className={'h-10 w-full overflow-x-scroll border-none bg-transparent p-2 text-right outline-none scrollbar-none'}
								value={localSlippage}
								onChange={(e): void => {
									set_localSlippage(parseFloat(e.target.value) || 0);
								}} />
							<p className={'mt-1 pr-2 text-neutral-900/60'}>{'%'}</p>
						</div>
						<button onClick={(): void => set_localSlippage(2)} className={'flex h-10 items-center bg-neutral-300 p-2'}>
							<p className={'pr-5 text-neutral-900'}>{'2%'}</p>
						</button>
						<button onClick={(): void => set_localSlippage(3)} className={'flex h-10 items-center bg-neutral-300 p-2'}>
							<p className={'pr-5 text-neutral-900'}>{'3%'}</p>
						</button>
						<Button
							disabled={slippage === localSlippage}
							className={'w-full'}
							onClick={(): void => set_slippage(localSlippage)}>
							{'Submit'}
						</Button>
					</div>
				</div>
			</div>


			<div className={'w-full bg-neutral-100 p-10'}>
				<div aria-label={'‘Mum... where do yields come from?’'} className={'flex flex-col pb-6'}>
					<h2 className={'text-3xl font-bold'}>{'‘Mum... where do '}</h2>
					<h2 className={'text-3xl font-bold'}>{'yields come from?’'}</h2>
				</div>
				<div aria-label={'‘Mum... where do yields come from?’ details'}>
					<p className={'pb-6 text-neutral-600'}>
						{'Well anon, when a gauge and a pool love each other very much...'}
					</p>
					<b>{'st-yCRV'}</b>
					<p className={'pb-4 text-neutral-600'}>
						{'Part of the yields come from boosted Curve admin fees and part from revenue-optimized gauge voting (so users always benefit from the biggest bribes).'}
					</p>

					<b>{'lp-yCRV'}</b>
					<p className={'pb-6 text-neutral-600'}>
						{'The yields come from farming the CRV/yCRV gauge. '}
					</p>
					<p className={'text-neutral-600'}>
						{'As Yearn holds a large amount of veCRV we are able to optimize bribe revenues and work with other partners to drive outsized yields to both yCRV stakers and LPers.'}
					</p>
				</div>
			</div>

			<SettingsOverwrite />

		</section>
	);
}

About.getLayout = function getLayout(page: ReactElement): ReactElement {
	return <Wrapper>{page}</Wrapper>;
};

export default About;
