import React, {Fragment} from 'react';
import {CurveContextApp} from '@common/contexts/useCurve';
import {HeroTimer} from '@yBribe/components/HeroTimer';
import {BribesContextApp} from '@yBribe/contexts/useBribes';

import type {ReactElement} from 'react';

export default function Wrapper({children}: {children: ReactElement}): ReactElement {
	return (
		<CurveContextApp>
			<BribesContextApp>
				<Fragment>
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
				</Fragment>
			</BribesContextApp>
		</CurveContextApp>
	);
}