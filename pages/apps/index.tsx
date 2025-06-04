import {type ReactElement} from 'react';
import {useRouter} from 'next/router';
import {CategorySection} from '@lib/components/CategorySection';
import {Cutaway} from '@lib/components/Cutaway';
import {LogoDiscord} from '@lib/icons/LogoDiscord';
import {LogoTwitter} from '@lib/icons/LogoTwitter';
import {INTEGRATIONS_APPS, OLD_APPS, VAULTS_APPS, YEARN_APPS, YEARN_X_APPS} from '@lib/utils/constants';

export default function Home(): ReactElement {
	const router = useRouter();

	return (
		<div className={'relative mb-4 mt-24 flex w-full justify-start bg-neutral-0 md:mt-10'}>
			<div className={'w-full p-6 !pl-8 pb-24 pt-0 md:px-2'}>
				<div className={'flex flex-col gap-y-14'}>
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
