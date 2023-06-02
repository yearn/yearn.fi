import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {roundToWeek, toSeconds, YEAR} from '@yearn-finance/web-lib/utils/time';

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
