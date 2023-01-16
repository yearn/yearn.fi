import {useAppSettings} from '@vaults/contexts/useAppSettings';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import CHAINS from '@yearn-finance/web-lib/utils/web3/chains';

import type {ReactElement} from 'react';
import type {TCurveGauges} from '@common/types/curves';

export function GaugeListEmpty({
	gauges,
	currentCategory,
	isLoading
}: {
	gauges: TCurveGauges[],
	currentCategory: string,
	isLoading: boolean
}): ReactElement {
	const {safeChainID} = useChainID();
	const {searchValue, category, set_category} = useAppSettings();

	if (isLoading && gauges.length === 0) {
		return (
			<div className={'flex h-96 w-full flex-col items-center justify-center py-2 px-10'}>
				<b className={'text-lg'}>{'Fetching Gauges...'}</b>
				<p className={'text-neutral-600'}>{'Gauges will appear soon. Please wait. Beep boop.'}</p>
				<div className={'flex h-10 items-center justify-center'}>
					<span className={'loader'} />
				</div>
			</div>
		);
	}

	if (!isLoading && gauges.length === 0 && safeChainID !== 1) {
		const chainName = CHAINS[safeChainID]?.name || 'this network';
		return (
			<div className={'mx-auto flex h-96 w-full flex-col items-center justify-center py-2 px-10 md:w-3/4'}>
				<b className={'text-center text-lg'}>{'👀 Where Gauges ser?'}</b>
				<p className={'text-center text-neutral-600'}>
					{`It seems we don’t have ${currentCategory} on ${chainName} (yet).`}
				</p>
			</div>
		);
	}
	
	if (!isLoading && gauges.length === 0) {
		return (
			<div className={'mx-auto flex h-96 w-full flex-col items-center justify-center gap-4 py-2 px-10 md:w-3/4'}>
				<b className={'text-center text-lg'}>{'No data, reeeeeeeeeeee'}</b>
				{category === 'All Gauges' ?
					<p className={'text-center text-neutral-600'}>{`The gauge "${searchValue}" does not exist`}</p> :
					<>
						<p className={'text-center text-neutral-600'}>
							{`There doesn’t seem to be anything here. It might be because you searched for a token in the ${currentCategory} category, or because there’s a rodent infestation in our server room. You check the search box, we’ll check the rodents. Deal?`}
						</p>
						<Button
							className={'w-full md:w-48'}
							onClick={(): void => set_category('All Gauges')}>
							{'Search all gauges'}
						</Button>
					</>
				}
			</div>
		);
	}
	return <div />;
}
