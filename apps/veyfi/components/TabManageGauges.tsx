import {QueryParamProvider} from 'use-query-params';
import {NextQueryParamAdapter} from '@common/utils/QueryParamsProvider';

import {StakeUnstakeGauges} from './ViewStakeUnstakeGauges';
import {VoteGauge} from './ViewVoteGauges';

import type {ReactElement} from 'react';

export function TabManageGauges(): ReactElement {
	return (
		<div className={'grid gap-10'}>
			<VoteGauge />
			<div className={'h-[1px] w-full bg-neutral-300'} />
			<div>
				<QueryParamProvider
					adapter={NextQueryParamAdapter}
					options={{removeDefaultsFromUrl: true}}>
					<StakeUnstakeGauges />
				</QueryParamProvider>
			</div>
		</div>
	);
}
