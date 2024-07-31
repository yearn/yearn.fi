import {Button} from '@yearn-finance/web-lib/components/Button';
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
			<div className={'flex w-full items-center justify-between'}>
				<div className={'text-lg font-bold text-white'}>{props.title}</div>
				<div>
					<Button
						onClick={props.onExpandClick}
						className={
							'!rounded-none !border !border-white px-4 py-2 hover:!border-2 hover:!bg-transparent'
						}>
						<span>{'View all'}</span>
						<IconChevron className={'size-6 -rotate-90'} />
					</Button>
				</div>
			</div>
			<div className={'grid grid-cols-4 grid-rows-1 gap-6'}>
				{props.apps.slice(0, 4).map(app => (
					<AppCard app={app} />
				))}
			</div>
		</div>
	);
}
