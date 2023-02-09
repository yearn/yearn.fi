import React, {Fragment, useState} from 'react';
import Link from 'next/link';
import {Listbox, Transition} from '@headlessui/react';
import {useUpdateEffect} from '@react-hookz/web';
import VaultDetailsQuickActionsButtons from '@vaults/components/details/actions/QuickActionsButtons';
import VaultDetailsQuickActionsFrom from '@vaults/components/details/actions/QuickActionsFrom';
import VaultDetailsQuickActionsSwitch from '@vaults/components/details/actions/QuickActionsSwitch';
import VaultDetailsQuickActionsTo from '@vaults/components/details/actions/QuickActionsTo';
import SettingsPopover from '@vaults/components/SettingsPopover';
import {Flow, useActionFlow} from '@vaults/contexts/useActionFlow';
import IconChevron from '@common/icons/IconChevron';

import type {ReactElement} from 'react';

type TTabsOptions = {
	value: number;
	label: string;
}

const tabs: TTabsOptions[] = [
	{value: 0, label: 'Deposit'},
	{value: 1, label: 'Withdraw'}
];
function	getCurrentTab({isDepositing, hasMigration}: {isDepositing: boolean, hasMigration: boolean}): TTabsOptions {
	if (hasMigration) {
		return tabs[1];
	}
	return tabs.find((tab): boolean => tab.value === (isDepositing ? 0 : 1)) as TTabsOptions;
}

function	VaultActionsTabsWrapper(): ReactElement {
	const {currentVault, onSwitchSelectedOptions, isDepositing, actionParams} = useActionFlow();
	const [possibleTabs, set_possibleTabs] = useState<TTabsOptions[]>(tabs);
	const [currentTab, set_currentTab] = useState<TTabsOptions>(
		getCurrentTab({isDepositing, hasMigration: currentVault?.migration?.available})
	);

	useUpdateEffect((): void => {
		if (currentVault?.migration?.available && actionParams.isReady) {
			set_possibleTabs([tabs[1]]);
			set_currentTab(tabs[1]);
			onSwitchSelectedOptions(Flow.Withdraw);
		}
	}, [currentVault?.migration?.available, actionParams.isReady]);

	return (
		<Fragment>
			<nav className={'mt-10 mb-2 w-full md:mt-20'}>
				<Link href={'/vaults'}>
					<p className={'yearn--header-nav-item w-full whitespace-nowrap opacity-30'}>
						{'Back to vaults'}
					</p>
				</Link>
			</nav>
			<div aria-label={'Vault Actions'} className={'col-span-12 mb-4 flex flex-col bg-neutral-100'}>
				<div className={'relative flex w-full flex-row items-center justify-between px-4 pt-4 md:px-8'}>
					<nav className={'hidden flex-row items-center space-x-10 md:flex'}>
						{possibleTabs.map((tab): ReactElement => (
							<button
								key={`desktop-${tab.value}`}
								onClick={(): void => {
									set_currentTab(tab);
									onSwitchSelectedOptions(Flow.Switch);
								}}>
								<p
									title={tab.label}
									aria-selected={currentTab.value === tab.value}
									className={'hover-fix tab'}>
									{tab.label}
								</p>
							</button>
						))}
					</nav>
					<div className={'relative z-50'}>
						<Listbox
							value={currentTab.label}
							onChange={(value): void => {
								const	newTab = tabs.find((tab): boolean => tab.value === Number(value));
								if (!newTab) {
									return;
								}
								set_currentTab(newTab);
								onSwitchSelectedOptions(Flow.Switch);
							}}>
							{({open}): ReactElement => (
								<>
									<Listbox.Button
										className={'flex h-10 w-40 flex-row items-center border-0 border-b-2 border-neutral-900 bg-neutral-100 p-0 font-bold focus:border-neutral-900 md:hidden'}>
										<div className={'relative flex flex-row items-center'}>
											{currentTab?.label || 'Menu'}
										</div>
										<div className={'absolute right-0'}>
											<IconChevron
												className={`h-6 w-6 transition-transform ${open ? '-rotate-180' : 'rotate-0'}`} />
										</div>
									</Listbox.Button>
									<Transition
										as={Fragment}
										show={open}
										enter={'transition duration-100 ease-out'}
										enterFrom={'transform scale-95 opacity-0'}
										enterTo={'transform scale-100 opacity-100'}
										leave={'transition duration-75 ease-out'}
										leaveFrom={'transform scale-100 opacity-100'}
										leaveTo={'transform scale-95 opacity-0'}>
										<Listbox.Options className={'yearn--listbox-menu'}>
											{possibleTabs.map((tab): ReactElement => (
												<Listbox.Option
													className={'yearn--listbox-menu-item'}
													key={tab.value}
													value={tab.value}>
													{tab.label}
												</Listbox.Option>
											))}
										</Listbox.Options>
									</Transition>
								</>
							)}
						</Listbox>
					</div>

					<div className={'flex flex-row items-center justify-end space-x-2 pb-0 md:pb-4 md:last:space-x-4'}>
						<SettingsPopover />
					</div>
				</div>
				<div className={'-mt-0.5 h-0.5 w-full bg-neutral-300'} />

				<Fragment>
					<div
						className={'col-span-12 mb-4 flex flex-col space-x-0 space-y-2 bg-neutral-100 p-4 md:flex-row md:space-x-4 md:space-y-0 md:py-6 md:px-8'}>
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
				</Fragment>
			</div>
		</Fragment>
	);
}

export {VaultActionsTabsWrapper};
