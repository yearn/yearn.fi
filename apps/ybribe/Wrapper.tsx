import React from 'react';
import dayjs from 'dayjs';
import {AnimatePresence, motion} from 'framer-motion';
import {HeroTimer} from '@common/components/HeroTimer';
import Meta from '@common/components/Meta';
import {CurveContextApp} from '@common/contexts/useCurve';
import {useCurrentApp} from '@common/hooks/useCurrentApp';
import {variants} from '@common/utils/animations';
import {BribesContextApp} from '@yBribe/contexts/useBribes';

import {getNextThursday} from './utils';

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';

function	computeTimeLeft(): number {
	const nextPeriod = getNextThursday();
	const currentTime = dayjs();
	const diffTime = nextPeriod - currentTime.unix();
	const duration = dayjs.duration(diffTime * 1000, 'milliseconds');
	return duration.asMilliseconds();
}

export default function Wrapper({children, router}: {children: ReactElement, router: NextRouter}): ReactElement {
	const {manifest} = useCurrentApp(router);
	
	return (
		<CurveContextApp>
			<>
				<Meta meta={manifest} />
				<BribesContextApp>
					<AnimatePresence mode={'wait'}>
						<motion.div
							key={router.asPath}
							initial={'initial'}
							animate={'enter'}
							exit={'exit'}
							className={'my-0 h-full md:mb-0 md:mt-16'}
							variants={variants}>
							<HeroTimer timeLeft={computeTimeLeft()} />
							{children}
						</motion.div>
					</AnimatePresence>
				</BribesContextApp>
			</>
		</CurveContextApp>
	);
}
