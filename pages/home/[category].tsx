import {usePathname} from 'next/navigation';
import {AppCard} from '@common/components/AppCard';
import {CATEGORIES_DICT} from '@common/utils/constants';

import type {ReactElement} from 'react';

export type TApp = {
	title: string;
	description?: string;
	image: string;
	link?: string;
};

export default function Index(): ReactElement {
	const pathName = usePathname();
	const currentTab = pathName?.startsWith('/home/') ? pathName?.split('/')[2] : '/';
	const currentCatrgory = CATEGORIES_DICT[currentTab as 'featured-apps' | 'community' | 'yearn-x'];

	return (
		<div className={'my-20 flex w-full justify-center'}>
			<div className={'w-full max-w-6xl'}>
				<div className={'mb-10 flex w-full flex-col justify-start'}>
					<p className={'text-[64px] font-bold leading-[64px] text-white'}>{currentCatrgory?.categoryName}</p>

					<p className={'mt-4 max-w-[610px] text-base text-gray-400'}>
						{currentCatrgory?.categoryDescription}
					</p>
				</div>

				<div className={'grid grid-cols-4 gap-4'}>
					{currentCatrgory?.apps.map(app => <AppCard app={app} />)}
				</div>
			</div>
		</div>
	);
}
