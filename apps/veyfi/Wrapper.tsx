import {AnimatePresence, motion} from 'framer-motion';
import {VotingEscrowContextApp} from '@veYFI/contexts/useVotingEscrow';
import Meta from '@common/components/Meta';
import {useCurrentApp} from '@common/hooks/useCurrentApp';
import {variants} from '@common/utils/animations';

import {GaugeContextApp} from './contexts/useGauge';
import {OptionContextApp} from './contexts/useOption';

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';

export function Wrapper({children, router}: {children: ReactElement; router: NextRouter}): ReactElement {
	const {manifest} = useCurrentApp(router);

	return (
		<div className={'mx-auto my-0 max-w-6xl md:mb-0 md:mt-16'}>
			<Meta meta={manifest} />
			<VotingEscrowContextApp>
				<GaugeContextApp>
					<OptionContextApp>
						<AnimatePresence mode={'wait'}>
							<motion.div
								key={router.basePath}
								initial={'initial'}
								animate={'enter'}
								exit={'exit'}
								className={'my-0 h-full md:mb-0 md:mt-16'}
								variants={variants}>
								{children}
							</motion.div>
						</AnimatePresence>
					</OptionContextApp>
				</GaugeContextApp>
			</VotingEscrowContextApp>
		</div>
	);
}
