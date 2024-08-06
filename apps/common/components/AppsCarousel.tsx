import {type ForwardedRef, forwardRef, type ReactElement} from 'react';

import {FeaturedApp} from './FeaturedApp';

import type {TApp} from 'pages/home/[category]';

export const AppsCarousel = forwardRef((props: {apps: TApp[]}, ref: ForwardedRef<HTMLDivElement>): ReactElement => {
	return (
		<section className={'left-0 -mx-1 w-full md:absolute'}>
			<div
				className={
					'pointer-events-none absolute left-0 top-0 z-10 h-full w-1/6 bg-gradient-to-r from-gray-900 to-transparent'
				}
			/>
			<div
				className={
					'pointer-events-none absolute right-0 top-0 z-10 h-full w-1/5 bg-gradient-to-l from-gray-900 to-transparent'
				}
			/>
			<div
				ref={ref}
				className={'flex  gap-x-6 overflow-x-auto pb-1 pr-1 scrollbar-none md:pl-28 lg:pl-36'}>
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
