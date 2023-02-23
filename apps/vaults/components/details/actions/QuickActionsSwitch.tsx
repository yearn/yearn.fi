import React from 'react';
import IconArrowRight from '@common/icons/IconArrowRight';

import type {ReactElement} from 'react';

function	VaultDetailsQuickActionsSwitch(): ReactElement {
	return (
		<div className={'mx-auto flex w-full justify-center space-y-0 md:mx-none md:block md:w-14 md:space-y-2'}>
			<label className={'hidden text-base md:inline'}>&nbsp;</label>

			<div
				className={'flex h-6 w-6 rotate-90 items-center justify-center p-0 md:h-10 md:w-14 md:rotate-0'}>
				<span className={'sr-only'}>{'Deposit / Withdraw'}</span>
				<IconArrowRight className={'w-4 text-neutral-900 md:w-[25px]'} />
			</div>
			<legend className={'hidden text-xs md:inline'}>&nbsp;</legend>
		</div>
	);
}


export default VaultDetailsQuickActionsSwitch;
