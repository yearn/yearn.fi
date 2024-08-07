import Link from 'next/link';
import {IconShare} from '@common/icons/IconShare';

import type {ReactElement} from 'react';

export function PromoPoster(): ReactElement {
	return (
		<Link
			href={'/'}
			className={
				'border-1 relative flex flex-col rounded-lg border border-gray-600/50 bg-gradient-to-b from-gray-900 to-[#1A1A1A] p-6 hover:from-[#1A1A1A] hover:to-[#262626]'
			}>
			<div className={'mb-4 flex w-full justify-start text-[40px] font-bold uppercase leading-[40px] text-white'}>
				{'stack'}
				<br /> {'with yearn'}
			</div>

			<div className={'absolute right-2 top-2 flex size-10 items-center justify-center rounded-lg'}>
				<IconShare className={'size-[10px]'} />
			</div>

			<div className={'max-w-[610px]'}>
				<p className={'text-base text-gray-400'}>
					{
						'Yearn is a decentralized suite of products helping individuals, DAOs, and other protocols earn yield on their digital assets.'
					}
				</p>
			</div>
		</Link>
	);
}
