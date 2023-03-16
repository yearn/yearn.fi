import {formatBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {roundToWeek, toSeconds, YEAR} from '@yearn-finance/web-lib/utils/time';

import type {BigNumber} from 'ethers';
import type {TDict} from '@yearn-finance/web-lib/types';
import type {TMilliseconds, TSeconds} from '@yearn-finance/web-lib/utils/time';

const MAX_LOCK: TSeconds = toSeconds(roundToWeek(YEAR * 4));

export function getVotingPower(lockAmount: BigNumber, unlockTime: TMilliseconds): BigNumber {
	const duration = toSeconds(roundToWeek(unlockTime)) - toSeconds(Date.now());
	if (duration <= 0) {
		return formatBN(0);
	}
	if (duration >= MAX_LOCK) {
		return lockAmount;
	}
	return lockAmount.div(MAX_LOCK).mul(duration);
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
			return order === 'desc' ? elementA.toLowerCase().localeCompare(elementB.toLowerCase()) : elementB.toLowerCase().localeCompare(elementA.toLowerCase());
		}
		return 0;
	};

	return [...data].sort(compare);
};
