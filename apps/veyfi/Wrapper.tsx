import React from 'react';
import meta from 'public/apps/vaults-manifest.json';
import {AnimatePresence, motion} from 'framer-motion';
import Meta from '@common/components/Meta';
import {variants} from '@common/utils/animations';

import {VotingEscrowContextApp} from './contexts/useVotingEscrow';

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';

export default function Wrapper({children, router}: {children: ReactElement, router: NextRouter}): ReactElement {
	return (
		<>
			<Meta meta={meta} />
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
