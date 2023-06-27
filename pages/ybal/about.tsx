import {useState} from 'react';
import {Balancer} from 'react-wrap-balancer';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {LPYBAL_TOKEN_ADDRESS, STYBAL_TOKEN_ADDRESS, YBAL_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import SettingsOverwrite from '@common/components/SettingsOverwrite';
import {useYBal} from '@yBal/contexts/useYBal';
import Wrapper from '@yBal/Wrapper';

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';

type TContractListRowProps = {
	label: string;
	address: string;
}

function ContractListRow({label, address}: TContractListRowProps): ReactElement {
	return (
		<p key={address} className={'pb-4 text-neutral-600'}>
			<b>{label}</b>
			{': '}
			<a
				href={`https://etherscan.io/address/${address}#code`}
				target={'_blank'}
				className={'text-neutral-900 underline'}
				rel={'noreferrer'}>
				{address}
			</a>
		</p>
	);
}

export function AboutContent(): ReactElement {
	const {slippage, set_slippage} = useYBal();
	const [localSlippage, set_localSlippage] = useState(slippage);

	return (
		<>
			<div className={'w-full bg-neutral-100 p-10'}>
				<div className={'flex flex-col pb-6'}>
					<h2 className={'text-3xl font-bold'}>{'Better Balancer yield,'}</h2>
					<h2 className={'text-3xl font-bold'}>{'with yBAL.'}</h2>
				</div>
				<div>
					<Balancer>
						<p className={' pb-4 text-neutral-600'}>{'yBAL is Yearn’s liquid veBAL wrapper system. yBAL shares the same mechanics as yCRV but adapted to work within the Balancer ecosystem. (Our naming guys probably aren’t getting a raise this year).'}</p>
						<p className={'text-neutral-600'}>{'yBAL offers users the best risk-adjusted yields with the same simple auto harvesting and auto-compounding features that Yearn is known (and loved) for. '}</p>
					</Balancer>
				</div>
			</div>

			<div className={'w-full bg-neutral-100 p-10'}>
				<div className={'flex flex-col pb-6'}>
					<h2 className={'text-3xl font-bold'}>{'People always ask yBAL'}</h2>
					<h2 className={'text-3xl font-bold'}>{'never how BAL?'}</h2>
				</div>
				<div>
					<Balancer>
						<p className={'pb-4 text-neutral-600'}>
							{'Users can mint yBAL tokens by locking their 80-20 BAL-WETH tokens to Yearn’s whitelisted voter (but pls note: this action is irreversible. Once a user mints there is no way to redeem, as the overall position is continually re-locked).'}
						</p>
						<p className={'pb-4 text-neutral-600'}>
							{'Once minted, yBAL can be staked into (you guessed it) st-yBAL for more yield. Or you can provide liquidity with (you guessed it) lp-yBAL for… more yield.'}
						</p>
						<p className={'text-neutral-600'}>{'Users can use the yBAL UI to swap between yBAL ecosystem tokens at will, so if one token is earning more yield than the other you don’t have to miss out.'}</p>
					</Balancer>
				</div>
			</div>


			<div className={'w-full bg-neutral-100 p-10'}>
				<div className={'flex flex-col pb-6'}>
					<h2 className={'text-3xl font-bold'}>{'Let’s talk yield'}</h2>
				</div>
				<div>
					<Balancer>
						<p className={'pb-4 text-neutral-600'}>{'With yBAL users get auto compounded yield for that lovely passive hands off yield feeling. The source of this yield is from various tokens, but Yearn’s automated process take care of selling each of these tokens and compounding it back into yBAL to increase the users position. TLDR, you can relax while Yearn smart contracts do the heavy lifting.'}</p>
						<p className={'text-neutral-600'}>{'yBAL also optimizes gauge voting to further maximize the yield that flows to st-yBAL, which is streamed along with the protocol fee revenue earned by Yearn’s voter position. More yield for you, without having to lift a finger.'}</p>
					</Balancer>
				</div>
			</div>


			<div className={'w-full bg-neutral-100 p-10'}>
				<div aria-label={'Contract corner'} className={'flex flex-col pb-6'}>
					<h2 className={'text-3xl font-bold'}>{'Contract corner'}</h2>
				</div>
				<div aria-label={'Contract corner details'}>
					<Balancer>
						<p className={'pb-6 text-neutral-600'}>
							{'The yBAL ecosystem is powered by smart contracts; programs that run on blockchains (in yBAL’s case Ethereum) with transparent functions that can be read by anyone. It wouldn\'t be open and transparent finance if we didn\'t let you check out our contracts. Go ahead and peek anon, it\'s ok.'}
						</p>
						{[
							{label: 'Zap', address: ZAP_YEARN_VE_CRV_ADDRESS},
							{label: 'yBal', address: YBAL_TOKEN_ADDRESS},
							{label: 'st-yBal', address: STYBAL_TOKEN_ADDRESS},
							{label: 'lp-yBal', address: LPYBAL_TOKEN_ADDRESS}
						].map(ContractListRow)}
					</Balancer>
				</div>
			</div>

			<div className={'w-full bg-neutral-100 p-10'}>
				<div aria-label={'Don’t get caught slippin’'} className={'flex flex-col pb-6'}>
					<h2 className={'text-3xl font-bold'}>{'Don’t get '}</h2>
					<h2 className={'text-3xl font-bold'}>{'caught slippin’'}</h2>
				</div>
				<div aria-label={'Don’t get caught slippin’ details'}>
					<Balancer>
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
					</Balancer>
				</div>
				<div className={'mt-8'}>
					<label
						htmlFor={'slippageTolerance'}
						className={'pb-1 text-neutral-900'}>
						{'Slippage tolerance'}
					</label>
					<div className={'flex flex-row space-x-2'}>
						<div className={'bg-neutral-1000 border-neutral-700py-4 flex h-10 w-40 min-w-[72px] items-center border-2 px-0 md:min-w-[160px]'}>
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
							isDisabled={slippage === localSlippage}
							className={'w-full'}
							onClick={(): void => set_slippage(localSlippage)}>
							{'Submit'}
						</Button>
					</div>
				</div>
			</div>

			<SettingsOverwrite />
		</>
	);
}

function About(): ReactElement {
	return (
		<section className={'mt-4 grid w-full grid-cols-1 gap-10 pb-10 md:mt-20 md:grid-cols-2'}>
			<AboutContent />
		</section>
	);
}

About.getLayout = function getLayout(page: ReactElement, router: NextRouter): ReactElement {
	return <Wrapper router={router}>{page}</Wrapper>;
};

export default About;
