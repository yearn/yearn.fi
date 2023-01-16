import React, {Fragment} from 'react';
import Link from 'next/link';
import VaultDetailsQuickActionsButtons from '@vaults/components/details/actions/QuickActionsButtons';
import VaultDetailsQuickActionsFrom from '@vaults/components/details/actions/QuickActionsFrom';
import VaultDetailsQuickActionsSwitch from '@vaults/components/details/actions/QuickActionsSwitch';
import VaultDetailsQuickActionsTo from '@vaults/components/details/actions/QuickActionsTo';
import {useActionFlow} from '@vaults/contexts/useActionFlow';
import {Solver, useSolver} from '@vaults/contexts/useSolver';

import SettingsPopover from '../SettingsPopover';

import type {ReactElement} from 'react';

type TTabsOptions = {
	value: number;
	label: string;
}

const tabs: TTabsOptions[] = [
	{value: 0, label: 'Deposit'},
	{value: 1, label: 'Withdraw'}
];
function	VaultActionsTabsWrapper(): ReactElement {
	const {onSwitchSelectedOptions, isDepositing} = useActionFlow();
	const {effectiveSolver} = useSolver();

	return (
		<Fragment>
			<nav className={'mt-10 mb-2 w-full md:mt-20'}>
				<Link href={'/vaults'}>
					<p className={'yearn--header-nav-item w-full whitespace-nowrap opacity-30'}>
						{'Back to vaults'}
					</p>
				</Link>
			</nav>
			<div aria-label={'Vault Actions'} className={'col-span-12 mb-4 flex flex-col bg-neutral-200'}>
				<div className={'relative flex w-full flex-row items-center justify-between px-4 pt-4 md:px-8'}>
					<nav className={'hidden flex-row items-center space-x-10 md:flex'}>
						{tabs.map((tab): ReactElement => (
							<button
								key={`desktop-${tab.value}`}
								onClick={(): void => {
									if ((tab.value === 0 && !isDepositing) || (tab.value === 1 && isDepositing)) {
										onSwitchSelectedOptions();
									}
								}}>
								<p
									title={tab.label}
									aria-selected={(tab.value === 0 && isDepositing) || (tab.value === 1 && !isDepositing)}
									className={'hover-fix tab'}>
									{tab.label}
								</p>
							</button>
						))}
					</nav>

					<div className={'flex flex-row items-center justify-end space-x-2 pb-0 md:pb-4 md:last:space-x-4'}>
						<SettingsPopover />
					</div>
				</div>
				<div className={'-mt-0.5 h-0.5 w-full bg-neutral-300'} />

				<Fragment>
					<div
						className={'col-span-12 mb-4 flex flex-col space-x-0 space-y-2 bg-neutral-200 p-4 md:flex-row md:space-x-4 md:space-y-0 md:py-6 md:px-8'}>
						<VaultDetailsQuickActionsFrom />
						<VaultDetailsQuickActionsSwitch />
						<VaultDetailsQuickActionsTo />
						<div className={'w-full space-y-0 md:w-42 md:min-w-42 md:space-y-2'}>
							<label className={'hidden text-base md:inline'}>&nbsp;</label>
							<div>
								<VaultDetailsQuickActionsButtons />
							</div>
							<legend className={'hidden text-xs text-neutral-400 md:inline'}>
								{[Solver.COWSWAP, Solver.PORTALS, Solver.WIDO].includes(effectiveSolver) ? `Zap provided by ${effectiveSolver}` : ''}&nbsp;
							</legend>
						</div>
					</div>
				</Fragment>
			</div>
		</Fragment>
	);
}

export {VaultActionsTabsWrapper};
