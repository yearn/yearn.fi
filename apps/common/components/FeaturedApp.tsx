import Image from 'next/image';
import {cl} from '@builtbymom/web3/utils';
import {IconShare} from '@common/icons/IconShare';

import type {TApp} from 'pages/home/[category]';
import type {ReactElement} from 'react';

export function FeaturedApp(props: {app: TApp}): ReactElement {
	return (
		<div
			className={cl(
				'group relative flex h-[376px] w-full min-w-[280px] cursor-pointer flex-col justify-end overflow-hidden px-6 py-10 outline outline-1 outline-gray-500/50  md:h-[520px] md:min-w-[384px]'
			)}>
			<Image
				src={props.app.logoURI}
				alt={props.app.name}
				width={1400}
				height={2000}
				className={
					'absolute right-0 top-0 size-full bg-center object-cover transition-all group-hover:scale-105'
				}
			/>
			<div
				className={
					'absolute right-2 top-2 hidden size-10 items-center justify-center bg-gray-900 transition-all group-hover:flex'
				}>
				<IconShare className={'size-[10px]'} />
			</div>
			<div className={'absolute left-0 top-0 size-full bg-gradient-to-b from-transparent to-gray-900'} />
			<p className={'z-20 text-xl font-bold text-white'}>{props.app.name}</p>
			<p className={'z-20 hidden text-gray-400 group-hover:block'}>{props.app.description}</p>
		</div>
	);
}
