import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {roundToWeek, toSeconds, YEAR} from '@yearn-finance/web-lib/utils/time';

import type {ethers} from 'ethers';
import type {TDict} from '@yearn-finance/web-lib/types';
import type {TMilliseconds, TSeconds} from '@yearn-finance/web-lib/utils/time';

const MAX_LOCK: TSeconds = toSeconds(roundToWeek(YEAR * 4));

export function getVotingPower(lockAmount: bigint, unlockTime: TMilliseconds): bigint {
	const duration = toSeconds(roundToWeek(unlockTime)) - toSeconds(Date.now());
	if (duration <= 0) {
		return 0n;
	}
	if (duration >= MAX_LOCK) {
		return lockAmount;
	}
	return lockAmount / toBigInt(MAX_LOCK) * toBigInt(duration);
}

export const keyBy = <T1, T2 extends keyof T1 & string>(array: T1[], key: T2): TDict<T1 | undefined> => 
	(array || []).reduce((r, x): TDict<T1> => ({...r, [x[key] as unknown as string]: x}), {});

export const isNumber = (value: unknown): boolean => !isNaN(value as number);

export const sort = <T>(data: T[], by: Extract<keyof T, string>, order?: 'asc' | 'desc'): T[] => {
	const compare = (a: T, b: T): number => {
		const elementA = a[by];
		const elementB = b[by];
		if (isNumber(elementA) && isNumber(elementB)) {
			return order === 'desc' ? Number(elementA) - Number(elementB) : Number(elementB) - Number(elementA);
		}
		if (typeof elementA === 'string' && typeof elementB === 'string') {
			return order === 'desc' ? elementA.toLowerCase().localeCompare(elementB.toLowerCase()) : elementB.toLowerCase().localeCompare(elementA.toLowerCase());
		}
		return 0;
	};

	return [...data].sort(compare);
};

export const handleTx = async (txPromise: Promise<ethers.providers.TransactionResponse>): Promise<boolean> => {
	try {
		const tx = await txPromise;
		const receipt = await tx.wait();
		if (receipt.status === 0) {
			console.error('Fail to perform transaction');
			return false;
		}
		return true;
	} catch (error) {
		console.error(error);
		return false;
	}
};
