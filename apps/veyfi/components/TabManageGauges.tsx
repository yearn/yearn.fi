import {StakeUnstakeGauges} from './ViewStakeUnstakeGauges';
import {VoteGauge} from './ViewVoteGauges';

import type {ReactElement} from 'react';

export function TabManageGauges(): ReactElement {
	return (
		<div className={'grid gap-10'}>
			<div>
				<StakeUnstakeGauges />
			</div>
			<div className={'h-[1px] w-full bg-neutral-300'} />
			<VoteGauge />
		</div>
	);
}
