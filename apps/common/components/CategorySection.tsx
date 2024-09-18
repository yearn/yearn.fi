import {type ReactElement, useState} from 'react';
import {useMountEffect} from '@react-hookz/web';
import {IconChevron} from '@common/icons/IconChevron';

import {AppCard} from './AppCard';

import type {TApp} from '@common/types/category';

type TAppSectionProps = {
	title: string;
	onExpandClick: () => void;
	apps: TApp[];
};

export function CategorySection({title, onExpandClick, apps}: TAppSectionProps): ReactElement {
	const [shuffledApps, set_shuffledApps] = useState<TApp[]>([]);

	/**********************************************************************************************
	 ** On component mount we shuffle the array of Partners to avoid any bias.
	 **********************************************************************************************/
	useMountEffect(() => {
		if (apps.length < 1) {
			return;
		}
		set_shuffledApps(apps.toSorted(() => 0.5 - Math.random()));
	});
	return (
		<div className={'flex flex-col gap-y-6 overflow-hidden'}>
			<div className={'flex h-10 w-full items-center justify-between pr-1'}>
				<div className={'text-lg font-bold text-white'}>{title}</div>
				<button
					onClick={onExpandClick}
					className={
						'flex items-center rounded-[4px] px-4 py-2 outline !outline-1 outline-gray-600/50 hover:bg-gray-600/40'
					}>
					<span className={'mr-2 text-xs text-white'}>{'View all'}</span>
					<IconChevron className={'size-3 -rotate-90 text-white'} />
				</button>
			</div>
			<div className={'flex grid-rows-1 flex-col gap-4 md:grid md:grid-cols-2 lg:grid-cols-4'}>
				{shuffledApps.slice(0, 4).map((app, i) => (
					<AppCard
						key={app.name + i}
						app={app}
					/>
				))}
			</div>
		</div>
	);
}
