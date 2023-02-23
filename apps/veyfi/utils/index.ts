import {formatBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {roundToWeek, toSeconds, YEAR} from '@yearn-finance/web-lib/utils/time';

import type {BigNumber, ethers} from 'ethers';
import type {TMilliseconds, TSeconds} from '@yearn-finance/web-lib/utils/time';
import type {TDict} from '@yearn-finance/web-lib/utils/types';

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
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(array || []).reduce((r, x): TDict<T1> => ({...r, [(x as any)[key]]: x}), {});

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
