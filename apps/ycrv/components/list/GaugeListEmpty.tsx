import {Button} from '@yearn-finance/web-lib/components/Button';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import CHAINS from '@yearn-finance/web-lib/utils/web3/chains';

import type {ReactElement} from 'react';

type TGaugeListEmptyProps = {
	category: string;
	isLoading?: boolean;
	searchValue?: string;
	set_category?: React.Dispatch<React.SetStateAction<string>>;
	isSwitchEnabled?: boolean;
}

export function GaugeListEmpty(props: TGaugeListEmptyProps): ReactElement {
	const {category, isLoading, isSwitchEnabled, searchValue, set_category} = props;

	const {safeChainID} = useChainID();

	const handleSearchAllGauges = (): void => {
		set_category ? set_category('All') : undefined;
	};

	if (isLoading) {
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

	if (safeChainID !== 1) {
		const chainName = CHAINS[safeChainID]?.name || 'this network';
		return (
			<div className={'mx-auto flex h-96 w-full flex-col items-center justify-center py-2 px-10 md:w-3/4'}>
				<b className={'text-center text-lg'}>{'👀 Where Gauges ser?'}</b>
				<p className={'text-center text-neutral-600'}>
					{`It seems we don’t have ${category} on ${chainName} (yet).`}
				</p>
			</div>
		);
	}

	if (isSwitchEnabled && searchValue !== '' && category !== 'All') {
		return (
			<div className={'mx-auto flex h-96 w-full flex-col items-center justify-center gap-4 py-2 px-10 md:w-3/4'}>
				<b className={'text-center text-lg'}>{'👀 Where Gauges ser?'}</b>
				<p className={'text-center text-neutral-600'}>
					{`There are no gauges that have votes with "${searchValue}" in the name and in the category ${category}.`}
				</p>
				<Button
					className={'w-full md:w-48'}
					onClick={handleSearchAllGauges}>
					{'Search all gauges'}
				</Button>
			</div>
		);
	}

	if (isSwitchEnabled && searchValue !== '' && category === 'All') {
		return (
			<div className={'mx-auto flex h-96 w-full flex-col items-center justify-center py-2 px-10 md:w-3/4'}>
				<b className={'text-center text-lg'}>{'👀 Where Gauges ser?'}</b>
				<p className={'text-center text-neutral-600'}>
					{`There are no gauges with votes and with "${searchValue}" in the name.`}
				</p>
			</div>
		);
	}

	if (isSwitchEnabled) {
		return (
			<div className={'mx-auto flex h-96 w-full flex-col items-center justify-center py-2 px-10 md:w-3/4'}>
				<b className={'text-center text-lg'}>{'👀 Where Gauges ser?'}</b>
				<p className={'text-center text-neutral-600'}>
					{'There are no gauges with votes, put your vote in any of the gauges before toggling'}
				</p>
			</div>
		);
	}
	
	return (
		<div className={'mx-auto flex h-96 w-full flex-col items-center justify-center gap-4 py-2 px-10 md:w-3/4'}>
			<b className={'text-center text-lg'}>{'No data, reeeeeeeeeeee'}</b>
			{category === 'All' ?
				<p className={'text-center text-neutral-600'}>{`The gauge "${searchValue}" does not exist`}</p> :
				<>
					<p className={'text-center text-neutral-600'}>
						{`There doesn’t seem to be anything here. It might be because you searched for a token in the ${category} category, or because there’s a rodent infestation in our server room. You check the search box, we’ll check the rodents. Deal?`}
					</p>
					<Button
						className={'w-full md:w-48'}
						onClick={handleSearchAllGauges}>
						{'Search all gauges'}
					</Button>
				</>
			}
		</div>
	);
}
