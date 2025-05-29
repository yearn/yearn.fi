import Image from 'next/image';
import Link from 'next/link';
import {SectionHeader} from '@common/components/SectionHeader';

import type {ReactElement} from 'react';

export function VaultsBanner(): ReactElement {
	return (
		<div
			className={
				'relative flex w-full items-stretch overflow-hidden rounded-[16px] border border-white/5 bg-white/5 bg-gradient-to-r'
			}>
			<div className={'flex flex-1 flex-col justify-center gap-4 p-8'}>
				<SectionHeader
					tagline={'Growing every day'}
					title={'Vaults'}
					align={'left'}
				/>
				<div className={'flex flex-col gap-4'}>
					<p
						className={` max-w-[55ch] border-t border-white/10 pt-4 text-[18px] text-steelGray-500 md:max-w-full`}>
						{'Strategies curated to maximize yield across DeFi.'}
					</p>
					<Link
						href={'/vaults'}
						className={'text-white'}>
						{'Learn More'} {'→'}
					</Link>
				</div>
			</div>
			<div
				className={
					'border-inner hidden w-1/2 border-l border-white/10 bg-gradient-to-b from-[#180832] to-[#281B9A] md:flex md:shrink-0 md:items-center md:justify-center'
				}>
				<div className={'relative size-48'}>
					<Image
						src={'/landing/safe.png'}
						alt={'Yearn Vaults Safe'}
						fill
						className={'object-contain'}
						priority
					/>
				</div>
			</div>
		</div>
	);
}
