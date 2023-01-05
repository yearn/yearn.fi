import {formatBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {roundToWeek, toSeconds, YEAR} from '@yearn-finance/web-lib/utils/time';

import type {BigNumber} from 'ethers';
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
