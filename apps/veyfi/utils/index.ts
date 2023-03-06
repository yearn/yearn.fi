import {formatBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {roundToWeek, toSeconds, YEAR} from '@yearn-finance/web-lib/utils/time';

import type {TMilliseconds} from '@yearn-finance/web-lib/utils/time';

const MAX_LOCK = BigInt(toSeconds(roundToWeek(YEAR * 4)));

export function getVotingPower(lockAmount: bigint, unlockTime: TMilliseconds): bigint {
	const duration = BigInt(toSeconds(roundToWeek(unlockTime)) - toSeconds(Date.now()));
	if (duration <= 0) {
		return formatBN(0);
	}
	if (duration >= MAX_LOCK) {
		return lockAmount;
	}
	return lockAmount / MAX_LOCK * duration;
}
