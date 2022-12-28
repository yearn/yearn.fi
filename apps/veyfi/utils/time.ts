import type {TMilliseconds, TSeconds, TWeeks} from '@veYFI/types';

export const SECOND: TMilliseconds = 1000;
export const DAY: TMilliseconds = SECOND * 3600 * 24;
export const WEEK: TMilliseconds = DAY * 7;
export const YEAR: TMilliseconds = DAY * 365;

export function toTime(time: number | string | undefined): TMilliseconds {
	return Number(time || 0);
}

export function toMilliseconds(time?: TSeconds): TMilliseconds {
	return toTime(time) * SECOND;
}

export function toSeconds(time?: TMilliseconds, floor = true): TSeconds {
	const seconds = toTime(time) / SECOND;
	return floor ? Math.floor(seconds) : seconds;
}

export function toWeeks(time?: TMilliseconds, floor = true): TWeeks {
	const weeks = toTime(time) / WEEK;
	return floor ? Math.floor(weeks) : weeks;
}

export function fromWeeks(time?: TWeeks): TMilliseconds {
	return toTime(time) * WEEK;
}

export function getTimeUntil(time?: TMilliseconds): TMilliseconds {
	const duration = toTime(time) - Date.now();
	return duration < 0 ? 0 : duration;
}

export function roundToWeek(time?: TMilliseconds): TMilliseconds {
	return Math.floor(toTime(time) / WEEK) * WEEK;
}
