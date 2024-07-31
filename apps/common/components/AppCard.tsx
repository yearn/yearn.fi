import Image from 'next/image';
import Link from 'next/link';

import type {TApp} from 'pages/home/[category]';
import type {ReactElement} from 'react';

type TAppCardProps = {
	app: TApp;
};

export function AppCard(props: TAppCardProps): ReactElement {
	return (
		<Link
			href={props.app.link ?? ''}
			className={'bg-grey-900 border border-gray-800/50 p-6 hover:bg-[#29292966]'}>
			<div className={'mb-10'}>
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
