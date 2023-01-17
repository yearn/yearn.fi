import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {roundToWeek, toSeconds, YEAR} from '@yearn-finance/web-lib/utils/time';

import type {TMilliseconds, TSeconds} from '@yearn-finance/web-lib/utils/time';
import type {TDict} from '@yearn-finance/web-lib/utils/types';

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
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(array || []).reduce((r, x): TDict<T1> => ({...r, [(x as any)[key]]: x}), {});
