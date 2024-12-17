import {type ForwardedRef, forwardRef, type ReactElement} from 'react';
import React from 'react';
import {cl} from '@builtbymom/web3/utils';

import {AppCard} from './AppCard';
import {FeaturedApp} from './FeaturedApp';

import type {TApp} from '@common/types/category';

export const AppsCarousel = forwardRef(
	(
		props: {onScroll?: VoidFunction; isUsingFeatured?: boolean; apps: TApp[]},
		ref: ForwardedRef<HTMLDivElement>
	): ReactElement => {
		return (
			<div>
				<section className={'left-0 -mx-1 w-full'}>
					<div
						className={
							'pointer-events-none absolute left-0 top-0 z-30 h-[272px] w-1/6 bg-gradient-to-r from-gray-900/0 to-transparent md:h-full'
						}
					/>
					<div
						className={
							'pointer-events-none absolute right-0 top-0 z-30 h-[272px] w-1/5 bg-gradient-to-l from-gray-900/0 to-transparent md:h-full'
						}
					/>
					<div
						ref={ref}
						onScroll={props.onScroll}
						className={cl(
							'hidden md:flex overflow-x-auto pb-1 pl-1 scrollbar-none max-sm:pr-6',
							props.isUsingFeatured ? 'gap-x-8' : 'flex-col md:flex-row gap-x-4 overflow-y-hidden'
						)}>
						{props.apps?.map((app, i) => {
							return (
								<React.Fragment key={app.appURI + i}>
									{props.isUsingFeatured ? (
										<FeaturedApp
											key={app.name + i}
											app={app}
										/>
									) : (
										<AppCard
											app={app}
											key={app.name + i}
										/>
									)}
								</React.Fragment>
							);
						})}
					</div>
					<div
						onScroll={props.onScroll}
						className={cl(
							'flex md:hidden overflow-x-auto pb-1 pl-[38px] scrollbar-none max-sm:pr-6',
							props.isUsingFeatured ? 'gap-x-8' : 'flex-col md:flex-row gap-y-4 overflow-y-hidden'
						)}>
						{props.apps?.slice(0, 4).map((app, i) => {
							return (
								<React.Fragment key={app.appURI + i}>
									{props.isUsingFeatured ? (
										<FeaturedApp
											key={app.name + i}
											app={app}
										/>
									) : (
										<AppCard
											app={app}
											key={app.name + i}
										/>
									)}
								</React.Fragment>
							);
						})}
					</div>
				</section>
			</div>
		);
	}
);
