import Link from 'next/link';
import {IconShare} from '@common/icons/IconShare';

import type {ReactElement} from 'react';

type TCutawayProps = {
	title: string;
	link: string;
	icon: ReactElement;
};

export function Cutaway(props: TCutawayProps): ReactElement {
	return (
		<Link
			href={props.link}
			target={'_blank'}
			className={
				'relative flex w-full items-center justify-between rounded-lg bg-gray-600/20 p-6 hover:bg-gray-600/40'
			}>
			<div className={'flex flex-col md:flex-row md:items-center'}>
				<div className={'flex size-20 items-center justify-center'}>{props.icon}</div>
				<div className={'md:ml-6'}>
					<p className={'mb-2 text-2xl font-bold text-gray-300'}>{props.title}</p>
				</div>
			</div>
			<div className={'absolute right-7 top-7 md:static'}>
				<IconShare />
			</div>
		</Link>
	);
}
