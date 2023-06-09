import React from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {AppSettingsContextApp} from '@vaults/contexts/useAppSettings';
import {StakingRewardsContextApp} from '@vaults/contexts/useStakingRewards';
import Meta from '@common/components/Meta';
import {useCurrentApp} from '@common/hooks/useCurrentApp';
import {variants} from '@common/utils/animations';

import {WalletForZapApp} from './contexts/useWalletForZaps';

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';

export default function Wrapper({children, router}: {children: ReactElement, router: NextRouter}): ReactElement {
	const {manifest} = useCurrentApp(router);

	return (
		<>
			<Meta meta={manifest} />
			<AppSettingsContextApp>
				<WalletForZapApp>
					<StakingRewardsContextApp>
						<AnimatePresence mode={'wait'}>
							<div className={'fixed inset-x-0 bottom-0 z-40 w-full bg-purple-500 p-2 text-center text-base text-white'}>
								{'Rewards are currently not displaying due to an API error. We are on it, and '}
								<b className={'underline'}>{'rewards are still live'}</b>
								{'.'}
							</div>
							<motion.div
								key={router.asPath}
								initial={'initial'}
								animate={'enter'}
								exit={'exit'}
								className={'my-0 h-full md:mb-0 md:mt-16'}
								variants={variants}>
								{children}
							</motion.div>
						</AnimatePresence>
					</StakingRewardsContextApp>
				</WalletForZapApp>
			</AppSettingsContextApp>
		</>
	);
}
