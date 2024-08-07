import {type ForwardedRef, forwardRef, type ReactElement} from 'react';

import {FeaturedApp} from './FeaturedApp';

import type {TApp} from '@common/types/category';

export const AppsCarousel = forwardRef((props: {apps: TApp[]}, ref: ForwardedRef<HTMLDivElement>): ReactElement => {
	return (
		<section className={'absolute left-0 -mx-1 w-full'}>
			<div
				className={
					'pointer-events-none absolute left-0 top-0 z-30 h-[272px] w-1/6 bg-gradient-to-r from-gray-900 to-transparent md:h-full'
				}
			/>
			<div
				className={
					'pointer-events-none absolute right-0 top-0 z-30 h-[272px] w-1/5 bg-gradient-to-l from-gray-900 to-transparent md:h-full'
				}
			/>
			<div
				ref={ref}
				className={'flex gap-x-8 overflow-x-auto pb-1 pl-[38px] scrollbar-none max-sm:pr-6'}>
				{props.apps.map((app, i) => (
					<FeaturedApp
						key={app.name + i}
						app={app}
					/>
				))}
			</div>
		</section>
	);
});
