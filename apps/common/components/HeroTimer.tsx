import React from 'react';
import {extend} from 'dayjs';
import dayjsDuration from 'dayjs/plugin/duration.js';
import {useTimer} from '@common/hooks/useTimer';

import type {ReactElement} from 'react';
import type {TSeconds} from '@yearn-finance/web-lib/utils/time';

extend(dayjsDuration);

type TProps = {
	endTime?: TSeconds;
}

function	HeroTimer({endTime}: TProps): ReactElement {
	const time = useTimer({endTime});

	return (
		<div className={'md:mb-0 md:mt-16'}>
			<div className={'mx-auto flex w-full max-w-6xl flex-col items-center justify-center'}>
				<div className={'mt-10 w-[300px] md:w-full'}>
					<div className={'flex w-full items-center justify-center text-center text-4xl font-bold uppercase text-neutral-900 md:text-8xl'}>
						<b className={'font-number'} suppressHydrationWarning>
							{time}
						</b>
					</div>
				</div>
			</div>
		</div>
	);
}

export {HeroTimer};
