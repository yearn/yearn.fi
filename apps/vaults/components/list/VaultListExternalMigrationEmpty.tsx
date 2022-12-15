

import type {ReactElement} from 'react';

function	VaultListExternalMigrationEmpty(): ReactElement {
	return (
		<div className={'mx-auto flex h-96 w-full flex-col items-center justify-center py-2 px-10 md:w-3/4'}>
			<b className={'text-center text-lg'}>{'We looked under the cushions...'}</b>
			<p className={'text-center text-neutral-600'}>
				{'Looks like you don\'t have any tokens to migrate. That could mean that you\'re already earning the best risk-adjusted yields in DeFi (go you), or you don\'t have any vault tokens at all. In which case... you know what to do.'}
			</p>
		</div>
	);
}

export {VaultListExternalMigrationEmpty};
