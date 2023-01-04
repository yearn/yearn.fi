import {BN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {roundToWeek, toSeconds, YEAR} from '@yearn-finance/web-lib/utils/time';

import type {TMilliseconds, TSeconds} from '@yearn-finance/web-lib/utils/time';
import type {TRaw} from '@veYFI/types';

const MAX_LOCK: TSeconds = toSeconds(roundToWeek(YEAR * 4));

export function getVotingPower(lockAmount: TRaw, unlockTime: TMilliseconds): TRaw {
	const duration = toSeconds(roundToWeek(unlockTime)) - toSeconds(Date.now());
	if (duration <= 0) {
		return '0';
	}
	if (duration >= MAX_LOCK) {
		return lockAmount;
	}
	return BN(lockAmount).div(MAX_LOCK).mul(duration).toString();
}
