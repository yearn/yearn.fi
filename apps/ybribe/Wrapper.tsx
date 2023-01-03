import React from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import Meta from '@common/components/Meta';
import {CurveContextApp} from '@common/contexts/useCurve';
import {useCurrentApp} from '@common/hooks/useCurrentApp';
import {variants} from '@common/utils/animations';
import {HeroTimer} from '@yBribe/components/HeroTimer';
import {BribesContextApp} from '@yBribe/contexts/useBribes';

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';


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
							<div className={'md:mb-0 md:mt-16'}>
								<div className={'mx-auto flex w-full max-w-6xl flex-col items-center justify-center'}>
									<div className={'mt-10 w-[300px] md:w-full'}>
										<div className={'flex w-full items-center justify-center text-center text-4xl font-bold uppercase text-neutral-900 md:text-8xl'}>
											<HeroTimer />
										</div>
									</div>
								</div>
							</div>
							{children}
						</motion.div>
					</AnimatePresence>
				</BribesContextApp>
			</>
		</CurveContextApp>
	);
}
