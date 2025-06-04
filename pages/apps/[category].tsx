import {type ReactElement, useMemo, useState} from 'react';
import {useMountEffect} from '@react-hookz/web';
import {AppCard} from '@lib/components/AppCard';
import {FilterBar} from '@lib/components/FilterBar';
import {SortingBar} from '@lib/components/SortingBar';
import {CATEGORIES_DICT} from '@lib/utils/constants';

import type {NextRouter} from 'next/router';
import type {TApp} from '@lib/types/mixed';

export default function Index(props: {router: NextRouter}): ReactElement {
	const [shuffledApps, set_shuffledApps] = useState<TApp[]>();
	const currentCategory = useMemo(() => {
		const currentTab = props.router.asPath?.startsWith('/apps/')
			? props.router.asPath?.split('/')[2]
			: 'featured-apps';
		return CATEGORIES_DICT[currentTab as keyof typeof CATEGORIES_DICT];
	}, [props.router.asPath]);

	/**********************************************************************************************
	 ** On component mount we shuffle the array of Apps to avoid any bias.
	 **********************************************************************************************/
	useMountEffect(() => {
		if (currentCategory?.apps.length < 1) {
			return;
		}
		set_shuffledApps(currentCategory?.apps.toSorted(() => 0.5 - Math.random()));
	});

	useMountEffect(() => {
		if (currentCategory?.apps.length < 1) {
			return;
		}
		if (currentCategory.categoryName === 'Integrations') {
			set_shuffledApps(currentCategory.apps.toSorted(() => 0.5 - Math.random()));
		}
		set_shuffledApps(currentCategory.apps);
	});

	return (
		<div className={'mt-24 flex w-full justify-start px-8 !pl-8 pb-14 md:mt-10'}>
			<div className={'flex w-full max-w-4xl flex-col'}>
				<div className={'mb-10 flex w-full flex-col justify-start'}>
					<p className={'text-3xl font-bold text-neutral-800 md:text-[64px] md:leading-[64px]'}>
						{currentCategory?.categoryName}
					</p>

					<p className={'mt-4 max-w-[610px] text-base text-neutral-600'}>
						{currentCategory?.categoryDescription}
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

				<div
					className={
						'flex grid-rows-1 gap-4 max-md:flex-col md:grid-cols-2 md:flex-wrap lg:grid lg:grid-cols-4'
					}>
					{shuffledApps?.map(app => (
						<AppCard
							app={app}
							key={app.appURI}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
