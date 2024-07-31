import {type ReactElement} from 'react';
import {useRouter} from 'next/navigation';
import {useMountEffect} from '@react-hookz/web';
import {CategorySection} from '@common/components/CategorySection';
import {FeaturedApp} from '@common/components/FeaturedApp';
import {useSearch} from '@common/contexts/useSearch';
import {COMMUNITY_APPS, FEATURED_APPS, YEARN_X_APPS} from '@common/utils/constants';

export default function Home(): ReactElement {
	const router = useRouter();
	const {dispatch} = useSearch();

	useMountEffect(() => {
		dispatch({type: 'SET_SEARCH', payload: ''});
	});

	return (
		<div className={'my-20 flex w-full justify-center'}>
			<div className={'w-full max-w-6xl'}>
				<div className={'flex flex-col gap-y-6'}>
					<div
						className={
							'flex w-full  justify-start text-[100px] font-bold uppercase leading-[108px] text-white'
						}>
						{'Stake '}
						<br /> {'with yearn'}
					</div>

					<div className={'max-w-[610px]'}>
						<p className={'text-base text-gray-400'}>
							{
								'Yearn is a decentralized suite of products helping individuals, DAOs, and other protocols earn yield on their digital assets.'
							}
						</p>
					</div>

					<div>
						<h1 className={'mb-6  text-lg text-white'}>{'Featured Apps'}</h1>
						<div className={'flex gap-x-6'}>
							{FEATURED_APPS.map(app => (
								<FeaturedApp app={app} />
							))}
						</div>
					</div>

					<div className={'flex flex-col gap-[64px]'}>
						<CategorySection
							title={'Community Apps'}
							onExpandClick={() => router.push('/home/community')}
							apps={COMMUNITY_APPS}
						/>

						<CategorySection
							title={'Yearn X Projects'}
							onExpandClick={() => router.push('/home/yearn-x')}
							apps={YEARN_X_APPS}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
