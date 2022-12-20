import React from 'react';
import Link from 'next/link';
import VaultDetailsQuickActionsButtons from '@vaults/components/details/actions/QuickActionsButtons';
import VaultDetailsQuickActionsFrom from '@vaults/components/details/actions/QuickActionsFrom';
import VaultDetailsQuickActionsSwitch from '@vaults/components/details/actions/QuickActionsSwitch';
import VaultDetailsQuickActionsTo from '@vaults/components/details/actions/QuickActionsTo';
import ActionFlowContextApp from '@vaults/contexts/useActionFlow';
import {WithSolverContextApp} from '@vaults/contexts/useSolver';

import type {TYearnVault} from '@common/types/yearn';

export const VaultDetailsQuickActions = ({currentVault}: {currentVault: TYearnVault}): React.ReactElement => {
	return (
		<ActionFlowContextApp currentVault={currentVault}>
			<nav className={'mt-10 mb-2 w-full md:mt-20'}>
				<Link href={'/vaults'}>
					<p className={'yearn--header-nav-item w-full whitespace-nowrap opacity-30'}>
						{'Back to vaults'}
					</p>
				</Link>
			</nav>

			<WithSolverContextApp>
				<div
					aria-label={'Quick Deposit'}
					className={'col-span-12 mb-4 flex flex-col space-x-0 space-y-2 bg-neutral-200 p-4 md:flex-row md:space-x-4 md:space-y-0 md:p-8'}>
					<VaultDetailsQuickActionsFrom />
					<VaultDetailsQuickActionsSwitch />
					<VaultDetailsQuickActionsTo />
					<div className={'w-full space-y-0 md:w-42 md:min-w-42 md:space-y-2'}>
						<label className={'hidden text-base md:inline'}>&nbsp;</label>
						<div>
							<VaultDetailsQuickActionsButtons />
						</div>
						<legend className={'hidden text-xs md:inline'}>&nbsp;</legend>
					</div>
				</div>
			</WithSolverContextApp>
		</ActionFlowContextApp>
	);
};

export default VaultDetailsQuickActions;
