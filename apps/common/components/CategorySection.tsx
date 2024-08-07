import {IconChevron} from '@common/icons/IconChevron';

import {AppCard} from './AppCard';

import type {ReactElement} from 'react';
import type {TApp} from '@common/types/category';

type TAppSectionProps = {
	title: string;
	onExpandClick: () => void;
	apps: TApp[];
};

export function CategorySection(props: TAppSectionProps): ReactElement {
	return (
		<div className={'flex flex-col gap-y-6 overflow-hidden'}>
			<div className={'flex h-12 w-full items-center justify-between pr-px'}>
				<div className={'text-lg font-bold text-white'}>{props.title}</div>
				<button
					onClick={props.onExpandClick}
					className={'flex px-4 py-2 outline !outline-1 outline-white hover:!outline-[3px]'}>
					<span className={'mr-1 text-white'}>{'View all'}</span>
					<IconChevron className={'size-6 -rotate-90 text-white'} />
				</button>
			</div>
			<div className={'flex grid-rows-1 flex-col gap-6 md:grid md:grid-cols-2 lg:grid-cols-4'}>
				{props.apps.slice(0, 4).map((app, i) => (
					<AppCard
						key={app.name + i}
						app={app}
					/>
				))}
			</div>
		</div>
	);
}
