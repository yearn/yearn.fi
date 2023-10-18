
import {ClaimVeYFI} from './ViewClaimVeYFI';
import {EarlyExitVeYFI} from './ViewEarlyExitVeYFI';
import {ExtendLockVeYFI} from './ViewExtendLockVeYFI';
import {LockVeYFI} from './ViewLockVeYFI';

import type {ReactElement} from 'react';

export function TabManageVeYFI(): ReactElement {
	return (
		<div className={'grid gap-10'}>
			<LockVeYFI />
			<div className={'h-[1px] w-full bg-neutral-300'} />
			<ExtendLockVeYFI />
			<div className={'h-[1px] w-full bg-neutral-300'} />
			<EarlyExitVeYFI />
			<div className={'h-[1px] w-full bg-neutral-300'} />
			<ClaimVeYFI />
		</div>
	);
}
