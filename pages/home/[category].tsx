import {usePathname} from 'next/navigation';
import {AppCard} from '@common/components/AppCard';
import {CATEGORIES_DICT} from '@common/utils/constants';

import type {ReactElement} from 'react';

export type TApp = {
	name: string;
	description?: string;
	logoURI: string;
	appURI: string;
};

export default function Index(): ReactElement {
	const pathName = usePathname();
	const currentTab = pathName?.startsWith('/home/') ? pathName?.split('/')[2] : '/';
	const currentCatrgory = CATEGORIES_DICT[currentTab as 'community' | 'yearn-x'];

	return (
		<div className={'my-20 flex w-full justify-start px-4 md:pl-28 lg:pl-36'}>
			<div className={'flex w-full max-w-5xl flex-col'}>
				<div className={'mb-10 flex w-full flex-col justify-start'}>
					<p className={'text-3xl font-bold leading-[64px] text-white md:text-[64px]'}>
						{currentCatrgory?.categoryName}
					</p>

					<p className={'mt-4 max-w-[610px] text-base text-gray-400'}>
						{currentCatrgory?.categoryDescription}
					</p>
				</div>

				<div className={'flex grid-rows-1 flex-col gap-6 md:grid md:grid-cols-2 lg:grid-cols-4'}>
					{currentCatrgory?.apps.map(app => <AppCard app={app} />)}
				</div>
			</div>
		</div>
	);
}
