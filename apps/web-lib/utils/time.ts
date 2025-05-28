export type TSeconds = number;
export type TMilliseconds = number;
export type TWeeks = number;

export const SECOND: TMilliseconds = 1000;
export const DAY: TMilliseconds = SECOND * 3600 * 24;
export const WEEK: TMilliseconds = DAY * 7;
export const YEAR: TMilliseconds = DAY * 365;

export function toTime(time: number | string | undefined): TMilliseconds {
	if (time === undefined) {
		return 0;
	}

	const parsedTime = Number(time);

	if (isNaN(parsedTime)) {
		throw new Error(`Invalid input: Cannot convert "${time}" to a number.`);
	}

	return parsedTime;
}

export function toMilliseconds(time?: TSeconds): TMilliseconds {
	if (!time) {
		return 0;
	}
	return toTime(time) * SECOND;
}

export function toSeconds(time?: TMilliseconds, floor = true): TSeconds {
	if (!time) {
		return 0;
	}
	const seconds = toTime(time) / SECOND;
	return floor ? Math.floor(seconds) : seconds;
}

export function toWeeks(time?: TMilliseconds, floor = true): TWeeks {
	if (!time) {
		return 0;
	}
	const weeks = toTime(time) / WEEK;
	return floor ? Math.floor(weeks) : weeks;
}

export function fromWeeks(time?: TWeeks): TMilliseconds {
	if (!time) {
		return 0;
	}
	return toTime(time) * WEEK;
}

export function getTimeUntil(time?: TMilliseconds): TMilliseconds {
	if (!time) {
		return 0;
	}
	const duration = toTime(time) - Date.now();
	return duration < 0 ? 0 : duration;
}

export function roundToWeek(time?: TMilliseconds): TMilliseconds {
	if (!time) {
		return 0;
	}
	return Math.floor(toTime(time) / WEEK) * WEEK;
}
