import {type ReactElement, useState} from 'react';
import {cl} from 'builtbymom-web3-fork/utils';

export function About(): ReactElement {
	const [isReadMore, set_isReadMore] = useState(false);
	return (
		<div
			className={'mt-[160px] flex w-full max-w-[1920px] justify-center px-6 pb-10 md:h-[430px] md:pb-0'}
			style={{
				backgroundImage: "url('/landing/about_bg.png')",
				backgroundRepeat: 'no-repeat',
				backgroundSize: 'auto 100%',
				backgroundPosition: 'center'
			}}>
			<div className={'relative lg:mr-[400px]'}>
				<p className={'font-aeonikFono mb-10 text-left text-3xl font-light text-white md:text-5xl'}>
					{'WTF IS A YEARN VAULT?'}
				</p>
				<div
					className={cl(
						'md:max-w-[720px] text-lg transition-all overflow-hidden leading-7',
						isReadMore
							? 'max-h-screen'
							: 'max-h-[160px] md:max-h-screen gradient-mask-b-10 md:gradient-mask-none'
					)}>
					<p className={cl('text-gray-400 to-indigo-400')}>
						{
							'In ‘traditional finance’ (boo, hiss) you can earn yield on your savings by depositing them in a bank'
						}
						{' - who use the capital for loans and other productive money growing means.'}
					</p>
					<br />
					<div className={cl('text-gray-400')}>
						<p>{'Yearn Vaults are like crypto savings accounts floating in cyberspace. You deposit'}</p>{' '}
						<p className={cl('text-gray-400')}>
							{
								'your assets, and Yearn puts them to work within the DeFi ecosystem, returning the earned '
							}
							{'yield back to you.'}
						</p>
					</div>
					<br />

					<p className={cl('text-gray-400')}>
						{'Unlike a bank account - none of this takes place behind closed doors (no offence to doors). '}
						{
							'DeFi runs on public blockchains, so you are in control of your assets and can see where they are'
						}
						{'at all times.'}
					</p>
				</div>
				{isReadMore ? null : (
					<button
						className={'text-primary mt-6 text-lg font-light md:hidden'}
						onClick={() => set_isReadMore(true)}>
						{'Read more'}
					</button>
				)}
			</div>
		</div>
	);
}
