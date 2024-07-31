import {type ReactElement, useMemo} from 'react';
import {useSearchParams} from 'next/navigation';
import {AppCard} from '@common/components/AppCard';
import {ALL_APPS} from '@common/utils/constants';

export default function SeachResults(): ReactElement {
	const searchParams = useSearchParams();

	const searchValue = searchParams.get('query') ?? '';
	const searchFilteredApps = useMemo(() => {
		if (!searchValue) {
			return [];
		}
		return [...ALL_APPS].filter(app => app.title.toLowerCase().includes(searchValue.toLowerCase()));
	}, [searchValue]);

	return (
		<div className={'my-20 flex w-full justify-center'}>
			<div className={'w-full max-w-6xl'}>
				<div className={'mb-10 flex w-full flex-col justify-start'}>
					<p className={'text-[64px] font-bold leading-[64px] text-white'}>{'Search App'}</p>
					<div className={'mt-20 grid w-full grid-cols-4 gap-4'}>
						{searchFilteredApps.length < 1 ? (
							<>{'Nothing'}</>
						) : (
							searchFilteredApps.map(app => <AppCard app={app} />)
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
