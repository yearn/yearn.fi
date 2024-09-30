import {type ReactElement, useRef} from 'react';
import {useRouter} from 'next/navigation';
import {useMountEffect} from '@react-hookz/web';
import {CarouselSlideArrows} from '@common/CarouselSlideArrows';
import {AppsCarousel} from '@common/components/AppsCarousel';
import {CategorySection} from '@common/components/CategorySection';
import {Cutaway} from '@common/components/Cutaway';
import {PromoPoster} from '@common/components/PromoPoster';
import {useSearch} from '@common/contexts/useSearch';
import {LogoDiscord} from '@common/icons/LogoDiscord';
import {LogoTwitter} from '@common/icons/LogoTwitter';
import {APPS, FEATURED_APPS, INTEGRATIONS_APPS, VAULTS_APPS, YEARN_X_APPS} from '@common/utils/constants';

export default function Home(): ReactElement {
	const router = useRouter();
	const {dispatch} = useSearch();

	const carouselRef = useRef<HTMLDivElement | null>(null);

	const onScrollBack = (): void => {
		if (!carouselRef.current) return;
		carouselRef.current.scrollLeft -= 400;
	};

	const onScrollForward = (): void => {
		if (!carouselRef.current) return;
		carouselRef.current.scrollLeft += 400;
	};

	useMountEffect(() => {
		dispatch({searchValue: ''});
	});

	return (
		<div className={'relative mb-4 mt-24 flex w-full justify-start md:mt-10'}>
			<div className={'md:max-w- w-full p-6 !pl-8 pb-24 pt-0 md:px-2'}>
				<div className={'flex flex-col gap-y-16'}>
					<div className={'md:hidden'}>
						<PromoPoster />
					</div>

					<div>
						<CarouselSlideArrows
							onScrollBack={onScrollBack}
							onScrollForward={onScrollForward}
							className={'mb-6'}
						/>

						<AppsCarousel
							ref={carouselRef}
							apps={FEATURED_APPS}
							isUsingFeatured={true}
						/>
					</div>

					<div className={'flex flex-col gap-10'}>
						<CategorySection
							title={'Vaults'}
							onExpandClick={() => router.push('/home/vaults')}
							apps={VAULTS_APPS}
						/>
						<CategorySection
							title={'Apps'}
							onExpandClick={() => router.push('/home/apps')}
							apps={APPS}
						/>
						<CategorySection
							title={'Yearn X Projects'}
							onExpandClick={() => router.push('/home/yearn-x')}
							apps={YEARN_X_APPS}
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
						icon={<LogoTwitter className={'text-white'} />}
						link={'https://yearn.finance/twitter'}
					/>
					<Cutaway
						title={'Join our Discord'}
						icon={<LogoDiscord className={'text-white'} />}
						link={'https://discord.com/invite/yearn'}
					/>
				</div>
			</div>
		</div>
	);
}
