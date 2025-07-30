import {IconShare} from '@lib/icons/IconShare';
import Link from 'next/link';

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
				'relative flex w-full items-center justify-between rounded-lg border border-neutral-200 bg-neutral-0 p-6 hover:bg-neutral-200'
			}
		>
			<div className={'flex flex-col md:flex-row md:items-center'}>
				<div className={'flex size-20 items-center justify-center'}>{props.icon}</div>
				<div className={'md:ml-6'}>
					<p className={'mb-2 text-2xl font-bold text-neutral-800'}>{props.title}</p>
				</div>
			</div>
			<div className={'absolute right-7 top-7 md:static'}>
				<IconShare />
			</div>
		</Link>
	);
}
