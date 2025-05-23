import {type ReactElement} from 'react';
import {useRouter} from 'next/router';
import {useMountEffect} from '@react-hookz/web';
// import {CarouselSlideArrows} from '@common/CarouselSlideArrows';
// import {AppsCarousel} from '@common/components/AppsCarousel';
import {CategorySection} from '@common/components/CategorySection';
import {Cutaway} from '@common/components/Cutaway';
// import {PromoPoster} from '@common/components/PromoPoster';
import {useSearch} from '@common/contexts/useSearch';
import {LogoDiscord} from '@common/icons/LogoDiscord';
import {LogoTwitter} from '@common/icons/LogoTwitter';
import {INTEGRATIONS_APPS, OLD_APPS, VAULTS_APPS, YEARN_APPS, YEARN_X_APPS} from '@common/utils/constants';

export default function Home(): ReactElement {
	const router = useRouter();
	const {dispatch} = useSearch();

	// const carouselRef = useRef<HTMLDivElement | null>(null);

	// const onScrollBack = (): void => {
	// 	if (!carouselRef.current) return;
	// 	carouselRef.current.scrollLeft -= 400;
	// };

	// const onScrollForward = (): void => {
	// 	if (!carouselRef.current) return;
	// 	carouselRef.current.scrollLeft += 400;
	// };

	useMountEffect(() => {
		dispatch({searchValue: ''});
	});

	return (
		<div className={'relative mb-4 mt-24 flex w-full justify-start bg-neutral-0 md:mt-10'}>
			<div className={'w-full p-6 !pl-8 pb-24 pt-0 md:px-2'}>
				<div className={'flex flex-col gap-y-14'}>
					{/* <div className={'md:hidden'}>
						<PromoPoster />
					</div> */}

					{/* <div>
						<div className={'mb-6 flex items-start justify-between'}>
							<p className={'w-full text-lg font-bold text-white'}>{'Featured Products'}</p>
							{FEATURED_APPS?.length > 3 && (
								<CarouselSlideArrows
									onScrollBack={onScrollBack}
									onScrollForward={onScrollForward}
									className={'w-auto'}
								/>
							)}
						</div>

						<AppsCarousel
							ref={carouselRef}
							apps={FEATURED_APPS}
							isUsingFeatured={true}
						/>
					</div> */}

					<div className={'flex flex-col gap-10'}>
						<CategorySection
							title={'Yearn Vaults'}
							onExpandClick={async () => router.push('/apps/vaults')}
							apps={VAULTS_APPS}
						/>
						<CategorySection
							title={'Other Yearn Products'}
							onExpandClick={async () => router.push('/apps/yearn-apps')}
							apps={YEARN_APPS}
						/>
						<CategorySection
							title={'Yearn X Projects'}
							onExpandClick={async () => router.push('/apps/yearn-x')}
							apps={YEARN_X_APPS}
						/>
						<CategorySection
							title={'Integrations'}
							onExpandClick={async () => router.push('/apps/integrations')}
							apps={INTEGRATIONS_APPS}
						/>
						<CategorySection
							title={'Retired Apps'}
							onExpandClick={async () => router.push('/apps/retired-apps')}
							apps={OLD_APPS}
						/>
					</div>
				</div>
				<div className={'mt-16 flex w-full flex-col gap-6 md:flex-row'}>
					<Cutaway
						title={'Follow us on X'}
						icon={<LogoTwitter className={'text-neutral-800'} />}
						link={'https://yearn.finance/twitter'}
					/>
					<Cutaway
						title={'Join our Discord'}
						icon={<LogoDiscord className={'text-neutral-800'} />}
						link={'https://discord.com/invite/yearn'}
					/>
				</div>
			</div>
		</div>
	);
}
