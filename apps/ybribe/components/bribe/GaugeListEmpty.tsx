import React from 'react';
import {useBribes} from '@yBribe/contexts/useBribes';

import type {ReactElement} from 'react';

function	GaugeListEmpty(): ReactElement {
	const	{isLoading} = useBribes();

	if (isLoading) {
		return (
			<div className={'flex h-96 w-full flex-col items-center justify-center py-2 px-10'}>
				<b className={'text-lg'}>{'Fetching gauge data'}</b>
				<p className={'text-neutral-600'}>{'We are retrieving the gauges. Please wait.'}</p>
				<div className={'flex h-10 items-center justify-center'}>
					<span className={'loader'} />
				</div>
			</div>
		);	
	}
	return (
		<div className={'flex h-96 w-full flex-col items-center justify-center py-2 px-10'}>
			<b className={'text-lg'}>{'No Gauges'}</b>
			<p className={'text-neutral-600'}>
				{'No gauges available.'}
			</p>
		</div>
	);	
}

export {GaugeListEmpty};
