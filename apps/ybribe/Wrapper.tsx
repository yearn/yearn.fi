import React from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {CurveContextApp} from '@common/contexts/useCurve';
import {variants} from '@common/utils/animations';
import {HeroTimer} from '@yBribe/components/HeroTimer';
import {BribesContextApp} from '@yBribe/contexts/useBribes';

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';


export default function Wrapper({children, router}: {children: ReactElement, router: NextRouter}): ReactElement {
	return (
		<CurveContextApp>
			<BribesContextApp>
				<AnimatePresence mode={'wait'}>
					<motion.div
						key={router.asPath}
						initial={'initial'}
						animate={'enter'}
						exit={'exit'}
						className={'my-0 h-full md:mb-0 md:mt-16'}
						variants={variants}>
						<HeroTimer />
						{children}
					</motion.div>
				</AnimatePresence>
			</BribesContextApp>
		</CurveContextApp>
	);
}
