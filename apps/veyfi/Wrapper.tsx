import React from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import Meta from '@common/components/Meta';
import {useCurrentApp} from '@common/hooks/useCurrentApp';
import {variants} from '@common/utils/animations';

import {VotingEscrowContextApp} from './contexts/useVotingEscrow';

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';

export default function Wrapper({children, router}: {children: ReactElement, router: NextRouter}): ReactElement {
	const {manifest} = useCurrentApp(router);

	return (
		<>
			<Meta meta={manifest} />
			<VotingEscrowContextApp>
				<AnimatePresence mode={'wait'}>
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
			</VotingEscrowContextApp>
		</>
	);
}
