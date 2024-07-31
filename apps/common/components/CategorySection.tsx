import {IconChevron} from '@common/icons/IconChevron';

import {AppCard} from './AppCard';

import type {TApp} from 'pages/home/[category]';
import type {ReactElement} from 'react';

type TAppSectionProps = {
	title: string;
	onExpandClick: () => void;
	apps: TApp[];
};

export function CategorySection(props: TAppSectionProps): ReactElement {
	return (
		<div className={'flex flex-col gap-y-6 overflow-hidden'}>
			<div className={'flex h-12 w-full items-center justify-between px-1'}>
				<div className={'text-lg font-bold text-white'}>{props.title}</div>
				<button
					onClick={props.onExpandClick}
					className={'flex px-4 py-2 outline !outline-1 outline-white hover:!outline-[3px]'}>
					<span className={'mr-1 text-white'}>{'View all'}</span>
					<IconChevron className={'size-6 -rotate-90 text-white'} />
				</button>
			</div>
			<div className={'grid grid-cols-4 grid-rows-1 gap-6'}>
				{props.apps.slice(0, 4).map(app => (
					<AppCard app={app} />
				))}
			</div>
		</div>
	);
}
