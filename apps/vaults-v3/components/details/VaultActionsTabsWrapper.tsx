import {Fragment, useEffect, useState} from 'react';
import {useRouter} from 'next/router';
import {Listbox, Transition} from '@headlessui/react';
import {useUpdateEffect} from '@react-hookz/web';
import {RewardsTab} from '@vaults/components/RewardsTab';
import {Flow, useActionFlow} from '@vaults/contexts/useActionFlow';
import {VaultDetailsQuickActionsButtons} from '@vaults-v3/components/details/actions/QuickActionsButtons';
import {VaultDetailsQuickActionsFrom} from '@vaults-v3/components/details/actions/QuickActionsFrom';
import {VaultDetailsQuickActionsSwitch} from '@vaults-v3/components/details/actions/QuickActionsSwitch';
import {VaultDetailsQuickActionsTo} from '@vaults-v3/components/details/actions/QuickActionsTo';
import {SettingsPopover} from '@vaults-v3/components/SettingsPopover';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {performBatchedUpdates} from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import {IconChevron} from '@common/icons/IconChevron';
import {Solver} from '@common/schemas/yDaemonTokenListBalances';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';

type TTabsOptions = {
	value: number;
	label: string;
	flowAction: Flow;
	slug?: string;
};

const tabs: TTabsOptions[] = [
	{value: 0, label: 'Deposit', flowAction: Flow.Deposit, slug: 'deposit'},
	{value: 1, label: 'Withdraw', flowAction: Flow.Withdraw, slug: 'withdraw'},
	{value: 2, label: 'Migrate', flowAction: Flow.Migrate, slug: 'migrate'},
	{value: 3, label: '$OP BOOST', flowAction: Flow.None, slug: 'boost'}
];

function getCurrentTab({
	isDepositing,
	hasMigration,
	isRetired
}: {
	isDepositing: boolean;
	hasMigration: boolean;
	isRetired: boolean;
}): TTabsOptions {
	if (hasMigration || isRetired) {
		return tabs[1];
	}
	return tabs.find((tab): boolean => tab.value === (isDepositing ? 0 : 1)) as TTabsOptions;
}

export function VaultActionsTabsWrapper({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const {onSwitchSelectedOptions, isDepositing, actionParams, currentSolver} = useActionFlow();
	const [possibleTabs, set_possibleTabs] = useState<TTabsOptions[]>([tabs[0], tabs[1]]);
	const willDepositAndStake = currentSolver === Solver.enum.OptimismBooster;
	const hasStakingRewards = Boolean(currentVault.staking.available);
	const [currentTab, set_currentTab] = useState<TTabsOptions>(
		getCurrentTab({
			isDepositing,
			hasMigration: currentVault?.migration?.available,
			isRetired: currentVault?.retired
		})
	);
	const router = useRouter();

	useEffect((): void => {
		const tab = tabs.find((tab): boolean => tab.slug === router.query.action);
		if (tab?.value) {
			set_currentTab(tab);
		}
	}, [router.query.action, set_currentTab]);

	useUpdateEffect((): void => {
		if (currentVault?.migration?.available && actionParams.isReady) {
			performBatchedUpdates((): void => {
				set_possibleTabs([tabs[1], tabs[2]]);
				set_currentTab(tabs[2]);
				onSwitchSelectedOptions(Flow.Migrate);
			});
		} else if (currentVault?.retired && actionParams.isReady) {
			performBatchedUpdates((): void => {
				set_possibleTabs([tabs[1]]);
				set_currentTab(tabs[1]);
				onSwitchSelectedOptions(Flow.Withdraw);
			});
		}

		if (currentVault.chainID === 10 && hasStakingRewards) {
			performBatchedUpdates((): void => {
				set_possibleTabs([tabs[0], tabs[1], tabs[3]]);
			});
		}
	}, [currentVault?.migration?.available, currentVault?.retired, actionParams.isReady, hasStakingRewards]);

	return (
		<>
			{currentVault?.migration?.available && (
				<div
					aria-label={'Migration Warning'}
					className={'col-span-12 mt-10'}>
					<div className={'w-full bg-neutral-900 p-6 text-neutral-0'}>
						<b className={'text-lg'}>{'Looks like this is an old vault.'}</b>
						<p className={'mt-2'}>
							{
								'This Vault is no longer earning yield, but good news, there’s a shiny up to date version just waiting for you to deposit your tokens into. Click migrate, and your tokens will be migrated to the current Vault, which will be mi-great!'
							}
						</p>
					</div>
				</div>
			)}

			{!currentVault?.migration.available && currentVault?.retired && (
				<div
					aria-label={'Deprecation Warning'}
					className={'col-span-12 mt-10'}>
					<div className={'w-full bg-neutral-900 p-6 text-neutral-0'}>
						<b className={'text-lg'}>{'This Vault is no longer supported (oh no).'}</b>
						<p className={'mt-2'}>
							{
								'They say all good things must come to an end, and sadly this vault is deprecated and will no longer earn yield or be supported by Yearn. Please withdraw your funds (which you could deposit into another Vault. Just saying…)'
							}
						</p>
					</div>
				</div>
			)}

			<div className={'col-span-12 mt-6 flex flex-col rounded-t-3xl bg-neutral-100'}>
				<div className={'relative flex w-full flex-row items-center justify-between px-4 pt-4 md:px-8'}>
					<nav className={'hidden flex-row items-center space-x-10 md:flex'}>
						{possibleTabs.map(
							(tab): ReactElement => (
								<button
									key={`desktop-${tab.value}`}
									onClick={(): void => {
										set_currentTab(tab);
										router.replace(
											{
												query: {
													...router.query,
													action: tab.slug
												}
											},
											undefined,
											{
												shallow: true
											}
										);
										onSwitchSelectedOptions(tab.flowAction);
									}}>
									<p
										title={tab.label}
										aria-selected={currentTab.value === tab.value}
										className={cl(
											'hover-fix tab',
											currentTab.value === tab.value
												? '!text-neutral-900'
												: '!text-neutral-900/50 hover:!text-neutral-900'
										)}>
										{tab.label}
									</p>
								</button>
							)
						)}
					</nav>
					<div className={'relative z-50'}>
						<Listbox
							value={currentTab.label}
							onChange={(value): void => {
								const newTab = tabs.find((tab): boolean => tab.value === Number(value));
								if (!newTab) {
									return;
								}
								set_currentTab(newTab);
								onSwitchSelectedOptions(newTab.flowAction);
							}}>
							{({open}): ReactElement => (
								<>
									<Listbox.Button
										className={
											'flex h-10 w-40 flex-row items-center border-0 border-b-2 border-neutral-900 bg-neutral-100 p-0 font-bold focus:border-neutral-900 md:hidden'
										}>
										<div className={'relative flex flex-row items-center'}>
											{currentTab?.label || 'Menu'}
										</div>
										<div className={'absolute right-0'}>
											<IconChevron
												className={`h-6 w-6 transition-transform ${
													open ? '-rotate-180' : 'rotate-0'
												}`}
											/>
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
											{possibleTabs.map(
												(tab): ReactElement => (
													<Listbox.Option
														className={'yearn--listbox-menu-item'}
														key={tab.value}
														value={tab.value}>
														{tab.label}
													</Listbox.Option>
												)
											)}
										</Listbox.Options>
									</Transition>
								</>
							)}
						</Listbox>
					</div>

					<div className={'flex flex-row items-center justify-end space-x-2 pb-0 md:pb-4 md:last:space-x-4'}>
						<SettingsPopover vault={currentVault} />
					</div>
				</div>
				<div className={'-mt-0.5 h-0.5 w-full bg-neutral-300'} />

				{currentTab.value === 3 ? (
					<RewardsTab currentVault={currentVault} />
				) : (
					<div
						className={
							'col-span-12 flex flex-col space-x-0 space-y-2 bg-neutral-100 p-4 md:flex-row md:space-x-4 md:space-y-0 md:px-8 md:py-10'
						}>
						<VaultDetailsQuickActionsFrom />
						<VaultDetailsQuickActionsSwitch />
						<VaultDetailsQuickActionsTo />
						<div className={'w-full space-y-0 md:w-42 md:min-w-42 md:space-y-2'}>
							<p className={'hidden text-base md:inline'}>&nbsp;</p>
							<div>
								<VaultDetailsQuickActionsButtons currentVault={currentVault} />
							</div>
							<legend className={'hidden text-xs md:inline'}>&nbsp;</legend>
						</div>
					</div>
				)}

				{isZero(currentTab.value) &&
				currentVault.apr?.forwardAPR?.composite?.boost &&
				hasStakingRewards &&
				willDepositAndStake ? (
					<div className={'col-span-12 flex p-4 pt-0 md:px-8 md:pb-6'}>
						<div className={'w-full bg-[#34A14F] p-2 md:px-6 md:py-4'}>
							<b className={'text-base text-white'}>
								{
									'Great news! This Vault is receiving an Optimism Boost. Deposit and stake your tokens to receive OP rewards. Nice!'
								}
							</b>
						</div>
					</div>
				) : (
					isZero(currentTab.value) &&
					hasStakingRewards &&
					!willDepositAndStake && (
						<div className={'col-span-12 flex p-4 pt-0 md:px-8 md:pb-6'}>
							<div className={'w-full bg-[#F8A908] p-2 md:px-6 md:py-4'}>
								<b className={'text-base text-white'}>
									{
										"This Vault is receiving an Optimism Boost. To zap into it for additional OP rewards, you'll have to stake your yVault tokens manually on the $OP BOOST tab after you deposit. Sorry anon, it's just how it works."
									}
								</b>
							</div>
						</div>
					)
				)}
			</div>
		</>
	);
}
