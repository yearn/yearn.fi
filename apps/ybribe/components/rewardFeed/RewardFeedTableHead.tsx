import React from 'react';

import type {ReactElement} from 'react';

function	RewardFeedTableHead(): ReactElement {
	return (
		<div className={'grid w-full grid-cols-2 px-4 pb-6 md:grid-cols-3 md:px-10'}>
			<p className={'col-span-1 text-start text-base text-neutral-400'}>{'Gauge'}</p>
			<p className={'col-span-1 text-end text-base text-neutral-400'}>{'Date'}</p>
			<p className={'col-span-1 text-end text-base text-neutral-400'}>{'Reward $/veCRV'}</p>
		</div>
	);
}

export {RewardFeedTableHead};
