import {type ReactElement, useRef} from 'react';
import {useRouter} from 'next/navigation';
import {useMountEffect} from '@react-hookz/web';
import {AppsCarousel} from '@common/components/AppsCarousel';
import {CategorySection} from '@common/components/CategorySection';
import {Cutaway} from '@common/components/Cutaway';
import {PromoPoster} from '@common/components/PromoPoster';
import {useSearch} from '@common/contexts/useSearch';
import {IconChevron} from '@common/icons/IconChevron';
import {LogoDiscord} from '@common/icons/LogoDiscord';
import {LogoTwitter} from '@common/icons/LogoTwitter';
import {
	FEATURED_APPS,
	FRONTENDS_APPS,
	INTEGRATIONS_APPS,
	LOCKERS_APPS,
	POOLS_APPS,
	YEARN_X_APPS
} from '@common/utils/constants';

export default function Home(): ReactElement {
	const router = useRouter();
	const {dispatch} = useSearch();

	const carouselRef = useRef<HTMLDivElement | null>(null);

	const scrollBack = (): void => {
		if (!carouselRef.current) return;
		carouselRef.current.scrollLeft -= 400;
	};

	const scrollForward = (): void => {
		if (!carouselRef.current) return;
		carouselRef.current.scrollLeft += 400;
	};

	useMountEffect(() => {
		dispatch({searchValue: ''});
	});

	return (
		<div className={'relative mb-4 mt-24 flex w-full justify-start md:mt-10'}>
			<div className={'md:max-w- w-full p-6 !pl-8 pb-24 pt-0 md:px-2'}>
				<div className={'flex flex-col gap-y-6'}>
					<div className={'md:hidden'}>
						<PromoPoster />
					</div>

					<div className={''}>
						<div className={'flex w-full justify-between'}>
							<h1 className={'mb-6 text-lg text-white'}>{'Featured Apps'}</h1>
							<div className={'hidden gap-3 md:flex'}>
								<button
									onClick={scrollBack}
									className={
										'flex !h-8 items-center rounded-[4px] px-4 text-white outline !outline-1 outline-white hover:!outline-[3px]'
									}>
									<IconChevron className={'rotate-90'} />
								</button>
								<button
									onClick={scrollForward}
									className={
										'flex !h-8 items-center rounded-[4px] px-4 text-white outline !outline-1 outline-white hover:!outline-[3px]'
									}>
									<IconChevron className={' -rotate-90'} />
								</button>
							</div>
						</div>

						<AppsCarousel
							ref={carouselRef}
							apps={FEATURED_APPS}
						/>
					</div>

					<div className={'mt-[300px] flex flex-col gap-[64px]'}>
						<CategorySection
							title={'Frontends'}
							onExpandClick={() => router.push('/home/frontends')}
							apps={FRONTENDS_APPS}
						/>

						<CategorySection
							title={'Lockers'}
							onExpandClick={() => router.push('/home/lockers')}
							apps={LOCKERS_APPS}
						/>

						<CategorySection
							title={'Yearn X Projects'}
							onExpandClick={() => router.push('/home/yearn-x')}
							apps={YEARN_X_APPS}
						/>

						<CategorySection
							title={'Pools'}
							onExpandClick={() => router.push('/home/pools')}
							apps={POOLS_APPS}
						/>

						<CategorySection
							title={'Integrations'}
							onExpandClick={() => router.push('/home/integrations')}
							apps={INTEGRATIONS_APPS}
						/>
					</div>
				</div>
				<div className={'mt-16 flex w-full flex-col gap-6 md:flex-row'}>
					<Cutaway
						title={'Follow us on X'}
						description={'Product description example text product description example text'}
						icon={<LogoTwitter className={'text-white'} />}
						link={'https://yearn.finance/twitter'}
					/>
					<Cutaway
						title={'Join our Discord'}
						description={'Product description example text product description example text'}
						icon={<LogoDiscord className={'text-white'} />}
						link={'https://discord.com/invite/yearn'}
					/>
				</div>
			</div>
		</div>
	);
}
