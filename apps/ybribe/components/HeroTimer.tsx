import React, {useCallback, useEffect, useRef, useState} from 'react';
import dayjs, {extend} from 'dayjs';
import dayjsDuration from 'dayjs/plugin/duration.js';
import {useBribes} from '@yBribe/contexts/useBribes';
import {getNextThursday} from '@yBribe/utils';

import type {ReactElement} from 'react';

extend(dayjsDuration);

function	computeTimeLeft(): number {
	const nextPeriod = getNextThursday();
	const currentTime = dayjs();
	const diffTime = nextPeriod - currentTime.unix();
	const duration = dayjs.duration(diffTime * 1000, 'milliseconds');
	return duration.asMilliseconds();
}

function	HeroTimer(): ReactElement {
	const	{nextPeriod} = useBribes();
	const	interval = useRef<NodeJS.Timeout | null>(null);
	const	[time, set_time] = useState<number>(computeTimeLeft());

	useEffect((): VoidFunction => {
		set_time(computeTimeLeft());

		interval.current = setInterval((): void => {
			set_time(computeTimeLeft());
		}, 1000);

		return (): void => {
			if (interval.current) {
				clearInterval(interval.current);
			}
		};
	}, [nextPeriod]);

	const formatTimestamp = useCallback((n: number): string => {
		const	twoDP = (n: number): string | number => (n > 9 ? n : '0' + n);
		const	duration = dayjs.duration(n, 'milliseconds');
		const	days = duration.days();
		const	hours = duration.hours();
		const	minutes = duration.minutes();
		const	seconds = duration.seconds();
		return `${days ? `${days}d ` : ''}${twoDP(hours)}h ${twoDP(minutes)}m ${twoDP(seconds)}s`;
	}, []);

	return (
		<div className={'md:mb-0 md:mt-16'}>
			<div className={'mx-auto flex w-full max-w-6xl flex-col items-center justify-center'}>
				<div className={'mt-10 w-[300px] md:w-full'}>
					<div className={'flex w-full items-center justify-center text-center text-4xl font-bold uppercase text-neutral-900 md:text-8xl'}>
						<b className={'font-number'} suppressHydrationWarning>
							{time ? formatTimestamp(time) : '00H 00M 00S'}
						</b>
					</div>
				</div>
			</div>
		</div>
	);
}

export {HeroTimer};
