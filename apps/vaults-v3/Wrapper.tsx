import {type ReactElement} from 'react';
import {type NextRouter} from 'next/router';
import {AnimatePresence, motion} from 'framer-motion';
import {AppSettingsContextApp} from '@vaults/contexts/useAppSettings';
import {StakingRewardsContextApp} from '@vaults/contexts/useStakingRewards';
import {WalletForZapAppContextApp} from '@vaults/contexts/useWalletForZaps';
import Meta from '@common/components/Meta';
import {useCurrentApp} from '@common/hooks/useCurrentApp';
import {variants} from '@common/utils/animations';

export function Wrapper({children, router}: {children: ReactElement; router: NextRouter}): ReactElement {
	const {manifest} = useCurrentApp(router);

	return (
		<>
			<Meta meta={manifest} />
			<AppSettingsContextApp>
				<WalletForZapAppContextApp>
					<StakingRewardsContextApp>
						<AnimatePresence mode={'wait'}>
							<motion.div
								key={router.basePath}
								initial={'initial'}
								animate={'enter'}
								exit={'exit'}
								className={'my-0 h-full bg-neutral-0 md:mb-0 md:mt-16'}
								variants={variants}>
								{children}
							</motion.div>
						</AnimatePresence>
					</StakingRewardsContextApp>
				</WalletForZapAppContextApp>
			</AppSettingsContextApp>
		</>
	);
}
