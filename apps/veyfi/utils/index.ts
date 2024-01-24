import {toBigInt} from '@builtbymom/web3/utils';
import {roundToWeek, toSeconds, YEAR} from '@yearn-finance/web-lib/utils/time';

import type {TMilliseconds, TSeconds} from '@yearn-finance/web-lib/utils/time';
import type {TDict} from '@builtbymom/web3/types';

const MAX_LOCK: TSeconds = toSeconds(roundToWeek(YEAR * 4));

export function getVotingPower(lockAmount: bigint, unlockTime: TMilliseconds): bigint {
	const duration = toSeconds(roundToWeek(unlockTime)) - toSeconds(Date.now());
	if (duration <= 0) {
		return 0n;
	}
	if (duration >= MAX_LOCK) {
		return lockAmount;
	}
	return (lockAmount / toBigInt(MAX_LOCK)) * toBigInt(duration);
}

export const keyBy = <T1, T2 extends keyof T1 & string>(array: T1[], key: T2): TDict<T1 | undefined> =>
	(array || []).reduce((r, x): TDict<T1> => ({...r, [x[key] as string]: x}), {});

export const isNumberable = (value: unknown): boolean => !isNaN(value as number);

export const isString = (value: unknown): value is string => typeof value === 'string';

export const sort = <T>(data: T[], by: Extract<keyof T, string>, order?: 'asc' | 'desc'): T[] => {
	const compare = (a: T, b: T): number => {
		const elementA = a[by];
		const elementB = b[by];
		if (isNumberable(elementA) && isNumberable(elementB)) {
			return order === 'desc' ? Number(elementA) - Number(elementB) : Number(elementB) - Number(elementA);
		}
		if (isString(elementA) && isString(elementB)) {
			return order === 'desc'
				? elementA.toLowerCase().localeCompare(elementB.toLowerCase())
				: elementB.toLowerCase().localeCompare(elementA.toLowerCase());
		}
		return 0;
	};

	return [...data].sort(compare);
};
