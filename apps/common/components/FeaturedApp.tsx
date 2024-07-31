import {IconShare} from '@common/icons/IconShare';

import type {TApp} from 'pages/home/[category]';
import type {ReactElement} from 'react';

export function FeaturedApp(props: {app: TApp}): ReactElement {
	return (
		<div
			className={
				'group relative flex w-full cursor-pointer flex-col justify-end overflow-hidden px-6  py-10 outline outline-1 outline-gray-500/50 lg:h-[520px] lg:min-w-[384px]'
			}>
			<div
				style={{
					backgroundImage: `url(${props.app.image})`
				}}
				className={'absolute right-0 top-0 size-full bg-center transition-all group-hover:scale-105'}
			/>
			<div
				className={
					'absolute right-2 top-2  hidden size-10 items-center justify-center bg-gray-900 transition-all group-hover:flex'
				}>
				<IconShare className={'size-[10px]'} />
			</div>
			<div
				style={{background: 'linear-gradient(180deg, rgba(12, 12, 12, 0) 0%, #0C0C0C 100%)'}}
				className={'absolute left-0 top-0 size-full group-hover:scale-105'}
			/>
			<p className={'z-20 text-xl font-bold text-white'}>{props.app.title}</p>
			<p className={'z-20 hidden text-gray-400 group-hover:block'}>{props.app.description}</p>
		</div>
	);
}
