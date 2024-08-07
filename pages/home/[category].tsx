import {type ReactElement, useMemo} from 'react';
import {AppCard} from '@common/components/AppCard';
import {FilterBar} from '@common/components/FilterBar';
import {SortingBar} from '@common/components/SortingBar';
import {CATEGORIES_DICT} from '@common/utils/constants';

import type {NextRouter} from 'next/router';

export default function Index(props: {router: NextRouter}): ReactElement {
	const currentCatrgory = useMemo(() => {
		const currentTab = props.router.asPath?.startsWith('/home/') ? props.router.asPath?.split('/')[2] : '/';
		return CATEGORIES_DICT[currentTab as keyof typeof CATEGORIES_DICT];
	}, [props.router.asPath]);

	return (
		<div className={'mt-24 flex w-full justify-start px-4 !pl-8 pb-14 md:mt-10'}>
			<div className={'flex w-full max-w-4xl flex-col'}>
				<div className={'mb-10 flex w-full flex-col justify-start'}>
					<p className={'text-3xl font-bold text-white md:text-[64px] md:leading-[64px]'}>
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

				<div className={'flex grid-rows-1 flex-col gap-4 md:grid md:grid-cols-2 lg:grid-cols-4'}>
					{currentCatrgory?.apps.map(app => <AppCard app={app} />)}
				</div>
			</div>
		</div>
	);
}
