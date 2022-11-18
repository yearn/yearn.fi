import React, {ReactElement} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {toAddress} from '@yearn-finance/web-lib/utils';
import LogoYearn from 'components/icons/LogoYearn';
import LogoYearnBlue from 'components/icons/LogoYearnBlue';

function	Index(): ReactElement {
	return (
		<>
			<div className={'mx-auto mt-20 mb-44 flex w-full max-w-6xl flex-col items-center justify-center'}>
				<div className={'relative h-12 w-[300px] md:h-[104px] md:w-[600px]'}>
					<p className={'wordWrapper'}> 
						<span className={'word'} style={{opacity: 100}}>{'YEARN'}</span>
					</p>
				</div>
				<div className={'mt-8 mb-6'}>
					<p className={'text-center text-lg md:text-2xl'}>{'The yield protocol for digital assets.'}</p>
				</div>
			</div>
			<section
				className={'grid grid-cols-3 gap-10'}>
				<Link href={'/vaults'}>
					<div className={'flex aspect-video h-full w-full cursor-pointer flex-col items-center rounded-[3px] border border-neutral-100/20 p-6 shadow shadow-transparent transition-all duration-300 hover:shadow-neutral-100'}>
						<div>
							<LogoYearnBlue className={'h-[100px] w-[100px]'} />
						</div>
						<div className={'pt-6 text-center'}>
							<b className={'text-lg'}>{'Vaults'}</b>
							<p className={'whitespace-pre'}>{'deposit tokens and recieve yield.'}</p>
						</div>
					</div>
				</Link>
				<Link href={'/ycrv'}>
					<div className={'flex aspect-video h-full w-full cursor-pointer flex-col items-center rounded-[3px] border border-neutral-100/20 p-6 shadow shadow-transparent transition-all duration-300 hover:shadow-neutral-100'}>
						<div>
							<Image
								alt={'yCRV'}
								width={100}
								height={100}
								src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${toAddress(process.env.YCRV_TOKEN_ADDRESS)}/logo-128.png`}
								loading={'eager'}
								priority />
						</div>
						<div className={'pt-6 text-center'}>
							<b className={'text-lg'}>{'yCRV'}</b>
							<p className={'whitespace-pre'}>{'get the best CRV yields in DeFi.'}</p>
						</div>
					</div>
				</Link>
				<div className={'flex aspect-video h-full w-full cursor-pointer flex-col items-center rounded-[3px] border border-neutral-100/20 p-6 shadow shadow-transparent transition-all duration-300 hover:shadow-neutral-100'}>
					<div>
						<LogoYearn className={'h-[100px] w-[100px]'} />
					</div>
					<div className={'pt-6 text-center'}>
						<b className={'text-lg'}>{'veYFI'}</b>
						<p className={'whitespace-pre'}>{'stake your YFI to recieve\nrewards and boost gauges.'}</p>
					</div>
				</div>
			</section>
		</>
	);
}

export default Index;