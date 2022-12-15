
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import CHAINS from '@yearn-finance/web-lib/utils/web3/chains';

import type {ReactElement} from 'react';
import type {TMigratableVault} from '@vaults/utils/types';

type TProps = {
	migratableVaultsToDisplay: TMigratableVault[];
	isLoadingMigratableVaultList: boolean;
}

function	MigratableVaultsListEmpty({migratableVaultsToDisplay, isLoadingMigratableVaultList}: TProps): ReactElement {
	const {safeChainID} = useChainID(); // TODO safeChainID should be of a more concrete type

	if (isLoadingMigratableVaultList && migratableVaultsToDisplay.length === 0) {
		return (
			<div className={'flex h-96 w-full flex-col items-center justify-center py-2 px-10'}>
				<b className={'text-lg'}>{'Fetching Vaults'}</b>
				<p className={'text-neutral-600'}>{'Migratable vaults will appear soon. Please wait. Beep boop.'}</p>
				<div className={'flex h-10 items-center justify-center'}>
					<span className={'loader'} />
				</div>
			</div>
		);
	}

	if (!isLoadingMigratableVaultList && migratableVaultsToDisplay.length === 0 && safeChainID !== 1) {
		const	chainName = CHAINS[safeChainID].name || 'this network';
		return (
			<div className={'mx-auto flex h-96 w-full flex-col items-center justify-center py-2 px-10 md:w-3/4'}>
				<b className={'text-center text-lg'}>{'👀 Where Vaults ser?'}</b>
				<p className={'text-center text-neutral-600'}>
					{`It seems we don't have migratable vaults on ${chainName} (yet). Feel free to check out other vaults on ${chainName} or change network. New Vaults and strategies are added often, so check back later. Don't be a stranger.`}
				</p>
			</div>
		);
	}
	
	if (!isLoadingMigratableVaultList && migratableVaultsToDisplay.length === 0) {
		return (
			<div className={'mx-auto flex h-96 w-full flex-col items-center justify-center py-2 px-10 md:w-3/4'}>
				<b className={'text-center text-lg'}>{'No data, reeeeeeeeeeee'}</b>
				<p className={'text-center text-neutral-600'}>
					{'There doesn\'t seem to be anything here. It might be because you searched for a token in the wrong category, or because there\'s a rodent infestation in our server room. You check the search box, we\'ll check the rodents. Deal?'}
				</p>
			</div>
		);
	}
	return <div />;
}

export {MigratableVaultsListEmpty};
