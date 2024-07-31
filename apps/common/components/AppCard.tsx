import Image from 'next/image';
import Link from 'next/link';
import {IconShare} from '@common/icons/IconShare';

import type {TApp} from 'pages/home/[category]';
import type {ReactElement} from 'react';

type TAppCardProps = {
	app: TApp;
};

export function AppCard(props: TAppCardProps): ReactElement {
	return (
		<Link
			href={props.app.link ?? ''}
			className={'bg-grey-900 group relative border border-gray-500/50 p-6 hover:bg-gray-600/40'}>
			<div className={'mb-10'}>
				<div
					className={
						'absolute right-2 top-2 hidden size-10 items-center justify-center bg-gray-900 group-hover:flex'
					}>
					<IconShare className={'size-[10px]'} />
				</div>
				{props.app.image ? (
					<Image
						src={props.app.image}
						alt={props.app.title}
						width={100}
						height={100}
						className={'object-contain'}
					/>
				) : (
					<div className={'size-[120px] rounded-[32px] bg-fallback'} />
				)}
			</div>
			<div className={'mb-2 text-2xl font-bold text-white'}>{props.app.title}</div>
			<div className={''}>
				<p className={' text-base text-gray-400'}>{props.app.description}</p>
			</div>
		</Link>
	);
}
