import {type ReactElement, useMemo} from 'react';
import Image from 'next/image';
import {useSearchParams} from 'next/navigation';
import {cl} from '@builtbymom/web3/utils';
import {AppCard} from '@common/components/AppCard';
import {ALL_APPS} from '@common/utils/constants';

export default function SeachResults(): ReactElement {
	const searchParams = useSearchParams();

	const searchValue = searchParams.get('query') ?? '';
	const searchFilteredApps = useMemo(() => {
		if (!searchValue) {
			return [];
		}
		return [...ALL_APPS].filter(app => app.name.toLowerCase().includes(searchValue.toLowerCase()));
	}, [searchValue]);

	return (
		<div className={' mt-20 flex w-full justify-center'}>
			<div className={'w-full max-w-6xl !pl-8'}>
				<div className={'mb-10 flex w-full max-w-full flex-col justify-start'}>
					<p
						className={cl(
							'hidden truncate text-[64px] font-bold leading-[84px] text-white md:block',
							searchFilteredApps.length < 1 ? 'mb-4' : 'mb-10'
						)}>{`Results for "${searchValue}"`}</p>
					{searchFilteredApps.length < 1 ? (
						<div>
							<p
								className={
									'flex w-full justify-center text-center text-base text-gray-400 md:justify-start'
								}>
								{'Nothing to display'}
							</p>
							<p
								className={
									'flex w-full justify-center text-center text-base text-gray-400 md:justify-start'
								}>
								{'Try searching for another term'}
							</p>

							<Image
								className={'mt-40 hidden md:hidden lg:block'}
								src={'/empty-lg.png '}
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
