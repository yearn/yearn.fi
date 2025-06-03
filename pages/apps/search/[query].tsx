import {type ReactElement, useMemo} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {AppCard} from '@lib/components/AppCard';
import {useInitialQueryParam} from '@lib/hooks/useInitialQueryParam';
import {cl} from '@lib/utils';
import {ALL_APPS} from '@lib/utils/constants';

import type {GetServerSidePropsContext} from 'next';

export default function SeachResults(): ReactElement {
	const searchValue = useInitialQueryParam('query');
	const searchFilteredApps = useMemo(() => {
		if (!searchValue) {
			return [];
		}
		return ALL_APPS.filter(app => app.name.toLowerCase().includes(searchValue.toLowerCase()));
	}, [searchValue]);

	return (
		<div className={'mt-24 flex w-full justify-center md:mt-10'}>
			<div className={'w-full max-w-6xl !pl-8'}>
				<div className={'mb-10 flex w-full max-w-full flex-col justify-start'}>
					<p
						className={cl(
							'hidden truncate text-[64px] font-bold leading-[84px] text-white md:block',
							searchFilteredApps.length < 1 ? 'mb-4' : 'mb-10'
						)}>
						{`Results for "${searchValue}"`}
					</p>
					{searchFilteredApps.length < 1 ? (
						<div>
							<p className={'text-base text-gray-400'}>
								{
									"Hmm, we couldn't find what you're looking for, did you spell it right? Try again or go"
								}{' '}
								<Link
									className={'text-white hover:underline'}
									href={'/apps'}>
									{'home'}
								</Link>
							</p>

							<Image
								className={'mt-40 hidden md:hidden lg:block'}
								src={'/empty-lg.png'}
								alt={'nothing-to-display'}
								width={2000}
								height={500}
							/>
							<Image
								className={'mt-40 hidden  md:block lg:hidden'}
								src={'/empty-md.png'}
								alt={'nothing-to-display'}
								width={1000}
								height={200}
							/>
							<Image
								className={'mt-10 block md:hidden'}
								src={'/empty-sm.png'}
								alt={'nothing-to-display'}
								width={500}
								height={200}
							/>
						</div>
					) : (
						<div className={'flex grid-rows-1 flex-col gap-6 md:grid md:grid-cols-2 lg:grid-cols-4'}>
							{searchFilteredApps.map((app, index) => (
								<AppCard
									key={app.name + index}
									app={app}
								/>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

/************************************************************************************************
 ** getServerSideProps is used here for the following reasons:
 ** 1. To extract the search query from the URL parameters on the server-side
 ** 2. To ensure the search query is available as a prop when the page is initially rendered
 ** 3. To enable server-side rendering (SSR) for this dynamic route, improving SEO and performance
 ** 4. To handle cases where the query might be undefined, providing a fallback empty string
 ** This approach allows for immediate access to the search query without client-side processing
 ************************************************************************************************/
export async function getServerSideProps(context: GetServerSidePropsContext): Promise<{props: {query: string}}> {
	const {query} = context.params as {query: string};
	return {
		props: {
			query: query || ''
		}
	};
}
