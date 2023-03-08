import React, {Fragment, useState} from 'react';
import Link from 'next/link';
import {Listbox, Transition} from '@headlessui/react';
import {useUpdateEffect} from '@react-hookz/web';
import VaultDetailsQuickActionsButtons from '@vaults/components/details/actions/QuickActionsButtons';
import VaultDetailsQuickActionsFrom from '@vaults/components/details/actions/QuickActionsFrom';
import VaultDetailsQuickActionsSwitch from '@vaults/components/details/actions/QuickActionsSwitch';
import VaultDetailsQuickActionsTo from '@vaults/components/details/actions/QuickActionsTo';
import {RewardsTab} from '@vaults/components/RewardsTab';
import SettingsPopover from '@vaults/components/SettingsPopover';
import {Flow, useActionFlow} from '@vaults/contexts/useActionFlow';
import {Solver} from '@vaults/contexts/useSolver';
import {useStakingRewards} from '@vaults/contexts/useStakingRewards';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import IconChevron from '@common/icons/IconChevron';

import type {ReactElement} from 'react';
import type {TYearnVault} from '@common/types/yearn';

type TTabsOptions = {
	value: number;
	label: string;
	flowAction: Flow;
}

const tabs: TTabsOptions[] = [
	{value: 0, label: 'Deposit', flowAction: Flow.Deposit},
	{value: 1, label: 'Withdraw', flowAction: Flow.Withdraw},
	{value: 2, label: 'Migrate', flowAction: Flow.Migrate},
	{value: 3, label: '$OP BOOST', flowAction: Flow.Switch}
];
function	getCurrentTab({isDepositing, hasMigration}: {isDepositing: boolean, hasMigration: boolean}): TTabsOptions {
	if (hasMigration) {
		return tabs[1];
	}
	return tabs.find((tab): boolean => tab.value === (isDepositing ? 0 : 1)) as TTabsOptions;
}

function	VaultActionsTabsWrapper({currentVault}: {currentVault: TYearnVault}): ReactElement {
	const {onSwitchSelectedOptions, isDepositing, actionParams, currentSolver} = useActionFlow();
	const [possibleTabs, set_possibleTabs] = useState<TTabsOptions[]>([tabs[0], tabs[1]]);
	const {stakingRewardsByVault} = useStakingRewards();
	const willDepositAndStake = currentSolver === Solver.OPTIMISM_BOOSTER;
	const hasStakingRewards = !!stakingRewardsByVault[currentVault.address];
	const [currentTab, set_currentTab] = useState<TTabsOptions>(
		getCurrentTab({isDepositing, hasMigration: currentVault.migration?.available})
	);

	useUpdateEffect((): void => {
		let	_possibleTabs: TTabsOptions[] = [tabs[0], tabs[1]];
		let	_currentTab = currentTab;
		let _expectedFlow = currentTab.flowAction;
		if (currentVault.migration?.available && actionParams.isReady) {
			_possibleTabs = [tabs[1], tabs[2]];
			_currentTab = tabs[2]; // eslint-disable-line prefer-destructuring
			_expectedFlow = Flow.Migrate;
		}
		if (currentVault.chainID === 10 && hasStakingRewards) {
			_possibleTabs.push(tabs[3]);
		}

		performBatchedUpdates((): void => {
			set_possibleTabs(_possibleTabs);
			set_currentTab(_currentTab);
			onSwitchSelectedOptions(_expectedFlow);
		});
	}, [currentVault.migration?.available, actionParams.isReady, hasStakingRewards, currentVault.chainID]);

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
									onSwitchSelectedOptions(tab.flowAction);
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
								onSwitchSelectedOptions(newTab.flowAction);
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

				{currentTab.value === 3 ? (
					<RewardsTab currentVault={currentVault} />
				) : (
					<div className={'col-span-12 flex flex-col space-x-0 space-y-2 bg-neutral-100 p-4 md:flex-row md:space-x-4 md:space-y-0 md:py-6 md:px-8'}>
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
				)}

				{currentTab.value === 0 && hasStakingRewards && willDepositAndStake ? (
					<div className={'col-span-12 flex p-4 pt-0 md:px-8 md:pb-6'}>
						<div className={'w-full bg-up-only-green-400 p-2 md:px-6 md:py-4'}>
							<b className={'text-base text-white'}>{'Great news! This Vault is receiving an Optimism Boost. Your tokens will be automatically staked to receive $OP rewards. Nice!'}</b>
						</div>
					</div>
				) : currentTab.value === 0 && hasStakingRewards && !willDepositAndStake && (
					<div className={'col-span-12 flex p-4 pt-0 md:px-8 md:pb-6'}>
						<div className={'w-full bg-metaverse-sunset-400 p-2 md:px-6 md:py-4'}>
							<b className={'text-base text-white'}>{'This Vault is receiving an Optimism Boost. To zap into it for additional OP rewards, you\'ll have to stake your yVault tokens manually on the $OP BOOST tab after you deposit. Sorry anon, it\'s just how it works.'}</b>
						</div>
					</div>
				)}

			</div>
		</Fragment>
	);
}

export {VaultActionsTabsWrapper};
