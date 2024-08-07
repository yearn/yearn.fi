import {usePathname} from 'next/navigation';
import {AppCard} from '@common/components/AppCard';
import {FilterBar} from '@common/components/FilterBar';
import {SortingBar} from '@common/components/SortingBar';
import {CATEGORIES_DICT} from '@common/utils/constants';

import type {ReactElement} from 'react';

export default function Index(): ReactElement {
	const pathName = usePathname();
	const currentTab = pathName?.startsWith('/home/') ? pathName?.split('/')[2] : '/';
	const currentCatrgory = CATEGORIES_DICT[currentTab as keyof typeof CATEGORIES_DICT];

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

				<div className={'relative mb-10 hidden w-full flex-col justify-between gap-7  md:flex-row md:gap-0'}>
					<FilterBar
						selectedFilter={{
							title: 'Filter',
							value: 'filter'
						}}
					/>

					<SortingBar />
				</div>

				<div className={'flex grid-rows-1 flex-col gap-6 md:grid md:grid-cols-2 lg:grid-cols-4'}>
					{currentCatrgory?.apps.map(app => <AppCard app={app} />)}
				</div>
			</div>
		</div>
	);
}
