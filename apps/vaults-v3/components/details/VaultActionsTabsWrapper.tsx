import {Fragment, useEffect, useMemo, useState} from 'react';
import {useRouter} from 'next/router';
import {cl, formatAmount} from '@builtbymom/web3/utils';
import {Listbox, Transition} from '@headlessui/react';
import {useUpdateEffect} from '@react-hookz/web';
import {Flow, useActionFlow} from '@vaults/contexts/useActionFlow';
import {VaultDetailsQuickActionsButtons} from '@vaults-v3/components/details/actions/QuickActionsButtons';
import {VaultDetailsQuickActionsFrom} from '@vaults-v3/components/details/actions/QuickActionsFrom';
import {VaultDetailsQuickActionsSwitch} from '@vaults-v3/components/details/actions/QuickActionsSwitch';
import {VaultDetailsQuickActionsTo} from '@vaults-v3/components/details/actions/QuickActionsTo';
import {RewardsTab} from '@vaults-v3/components/details/RewardsTab';
import {SettingsPopover} from '@vaults-v3/components/SettingsPopover';
import {useYearn} from '@common/contexts/useYearn';
import {IconChevron} from '@common/icons/IconChevron';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';

export type TTabsOptions = {
	value: number;
	label: string;
	flowAction: Flow;
	slug?: string;
};

export const tabs: TTabsOptions[] = [
	{value: 0, label: 'Deposit', flowAction: Flow.Deposit, slug: 'deposit'},
	{value: 1, label: 'Withdraw', flowAction: Flow.Withdraw, slug: 'withdraw'},
	{value: 2, label: 'Migrate', flowAction: Flow.Migrate, slug: 'migrate'},
	{value: 3, label: 'Boost', flowAction: Flow.None, slug: 'boost'}
];

export function getCurrentTab(props: {isDepositing: boolean; hasMigration: boolean; isRetired: boolean}): TTabsOptions {
	if (props.hasMigration || props.isRetired) {
		return tabs[1];
	}
	return tabs.find((tab): boolean => tab.value === (props.isDepositing ? 0 : 1)) as TTabsOptions;
}

/**************************************************************************************************
 ** The BoostMessage component will display a message to the user if the current vault has staking
 ** rewards and the source of the rewards is either 'OP Boost' or 'VeYFI'. More source might be
 ** added in the future.
 ** An empty span will be returned if the current tab is not the 'Boost' tab or if no staking
 ** rewards are available.
 *************************************************************************************************/
export function BoostMessage(props: {currentVault: TYDaemonVault; currentTab: number}): ReactElement {
	const {isAutoStakingEnabled} = useYearn();
	const hasStakingRewards = Boolean(props.currentVault.staking.available);
	const stakingRewardSource = props.currentVault.staking.source;
	const extraAPR = props.currentVault.apr.extra.stakingRewardsAPR;

	if (props.currentTab === 0 && hasStakingRewards && stakingRewardSource === 'OP Boost') {
		if (isAutoStakingEnabled) {
			return (
				<div className={'col-span-12 flex p-4 pt-0 md:px-8 md:pb-6'}>
					<div className={'w-full rounded-lg bg-[#34A14F] p-2 md:px-6 md:py-4'}>
						<b className={'text-base text-white'}>
							{
								'Great news! This Vault is receiving an Optimism Boost. Deposit and stake your tokens to receive OP rewards. Nice!'
							}
						</b>
					</div>
				</div>
			);
		}
		return (
			<div className={'col-span-12 flex p-4 pt-0 md:px-8 md:pb-6'}>
				<div className={'w-full rounded-lg bg-[#F8A908] p-2 md:px-6 md:py-4'}>
					<b className={'text-base text-white'}>
						{
							"This Vault is receiving an Optimism Boost. To zap into it for additional OP rewards, you'll have to stake your yVault tokens manually on the $OP BOOST tab after you deposit. Sorry anon, it's just how it works."
						}
					</b>
				</div>
			</div>
		);
	}

	if (props.currentTab === 0 && hasStakingRewards && stakingRewardSource === 'VeYFI') {
		return (
			<div className={'col-span-12 flex p-4 pt-0 md:px-8 md:pb-6'}>
				<div className={'w-full rounded-lg bg-[#34A14F] p-2 md:px-6 md:py-4'}>
					<b className={'text-base text-white'}>
						{`You can earn from ${formatAmount(extraAPR * 10)}% to ${formatAmount(extraAPR * 100)}% extra APR by depositing your tokens into the veYFI gauge!`}
					</b>
					<b className={'block text-white'}>
						{'Learn more about veYFI rewards in the '}
						<a
							className={'underline'}
							href={'https://docs.yearn.fi/getting-started/products/veyfi'}
							target={'_blank'}
							rel={'noreferrer'}>
							{'FAQ'}
						</a>
						{'.'}
					</b>
				</div>
			</div>
		);
	}

	return <span />;
}

/**************************************************************************************************
 ** The Tab component will be used to display the tab buttons to navigate between the different
 ** actions available for the current vault.
 ** A special case exists when the current vault has staking rewards, because the name of the tab
 ** will be different depending on the source of the rewards.
 *************************************************************************************************/
export function VaultDetailsTab(props: {
	currentVault: TYDaemonVault;
	tab: TTabsOptions;
	selectedTab: TTabsOptions;
	onSwitchTab: (tab: TTabsOptions) => void;
}): ReactElement {
	const router = useRouter();
	const isV3Page = router.pathname.startsWith(`/v3`);
	const stakingRewardSource = props.currentVault.staking.source;
	const tabLabel = useMemo(() => {
		if (props.tab.label === 'Boost' && stakingRewardSource === 'VeYFI') {
			return 'veYFI BOOST';
		}
		if (props.tab.label === 'Boost' && stakingRewardSource === 'OP Boost') {
			return '$OP BOOST';
		}
		return props.tab.label;
	}, [props.tab.label, stakingRewardSource]);

	return (
		<button
			key={`desktop-${props.tab.value}`}
			onClick={(): void => {
				router.replace(
					{
						query: {
							...router.query,
							action: props.tab.slug
						}
					},
					undefined,
					{shallow: true}
				);
				props.onSwitchTab(props.tab);
			}}>
			<p
				title={tabLabel}
				aria-selected={props.selectedTab.value === props.tab.value}
				className={cl(
					'hover-fix tab',
					isV3Page
						? props.selectedTab.value === props.tab.value
							? '!text-neutral-900'
							: '!text-neutral-900/50 hover:!text-neutral-900'
						: ''
				)}>
				{tabLabel}
			</p>
		</button>
	);
}

/**************************************************************************************************
 ** The VaultActionsTabsWrapper wraps the different components that are part of the Vault Actions
 ** section. It will display the different tabs available for the current vault and the
 ** corresponding actions that can be taken.
 *************************************************************************************************/
export function VaultActionsTabsWrapper({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const {onSwitchSelectedOptions, isDepositing, actionParams} = useActionFlow();
	const [possibleTabs, set_possibleTabs] = useState<TTabsOptions[]>([tabs[0], tabs[1]]);
	const [currentTab, set_currentTab] = useState<TTabsOptions>(
		getCurrentTab({
			isDepositing,
			hasMigration: currentVault?.migration?.available,
			isRetired: currentVault?.retired
		})
	);
	const router = useRouter();
	const hasStakingRewards = Boolean(currentVault.staking.available);

	/**********************************************************************************************
	 ** Update the current state based on the query parameter action. This will allow the user to
	 ** navigate between the different tabs by changing the URL, or directly access a specific tab
	 ** based on the URL.
	 *********************************************************************************************/
	useEffect((): void => {
		const tab = tabs.find((tab): boolean => tab.slug === router.query.action);
		if (tab?.value) {
			set_currentTab(tab);
		}
	}, [router.query.action, set_currentTab]);

	/**********************************************************************************************
	 ** UpdateEffect to define which tabs are available based on the current state of the vault.
	 ** - If the vault has been migrated, only the withdraw and migrate tabs will be available,
	 ** with the focus set on the migrate tab.
	 ** - If the vault is retired, only the withdraw tab will be available.
	 ** - If the vault has staking rewards, the deposit, withdraw, and boost tabs will be
	 ** available.
	 ** - Otherwise we keep the default, aka deposit and withdraw tabs.
	 *********************************************************************************************/
	useUpdateEffect((): void => {
		if (currentVault?.migration?.available && actionParams.isReady) {
			set_possibleTabs([tabs[1], tabs[2]]);
			set_currentTab(tabs[2]);
			onSwitchSelectedOptions(Flow.Migrate);
		} else if (currentVault?.retired && actionParams.isReady) {
			set_possibleTabs([tabs[1]]);
			set_currentTab(tabs[1]);
			onSwitchSelectedOptions(Flow.Withdraw);
		}

		if (hasStakingRewards) {
			set_possibleTabs([tabs[0], tabs[1], tabs[3]]);
		}
	}, [currentVault?.migration?.available, currentVault?.retired, actionParams.isReady, hasStakingRewards]);

	return (
		<>
			{currentVault?.migration?.available && (
				<div
					aria-label={'Migration Warning'}
					className={'col-span-12 mt-10'}>
					<div className={'w-full rounded-3xl bg-neutral-900 p-6 text-neutral-0'}>
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
					<div className={'w-full rounded-3xl bg-neutral-900 p-6 text-neutral-0'}>
						<b className={'text-lg'}>{'This Vault is no longer supported (oh no).'}</b>
						<p className={'mt-2'}>
							{
								'They say all good things must come to an end, and sadly this vault is deprecated and will no longer earn yield or be supported by Yearn. Please withdraw your funds (which you could deposit into another Vault. Just saying…)'
							}
						</p>
					</div>
				</div>
			)}

			{currentVault?.info.uiNotice && (
				<div
					aria-label={'Migration Warning'}
					className={'col-span-12 mt-10'}>
					<div className={'w-full rounded-3xl bg-neutral-900 p-6 text-neutral-0'}>
						<b className={'text-lg'}>{'Oh look, an important message for you to read!'}</b>
						<p className={'mt-2'}>{currentVault?.info.uiNotice}</p>
					</div>
				</div>
			)}

			<div className={'col-span-12 mt-6 flex flex-col rounded-t-3xl bg-neutral-100'}>
				<div className={'relative flex w-full flex-row items-center justify-between px-4 pt-4 md:px-8'}>
					<nav className={'hidden flex-row items-center space-x-10 md:flex'}>
						{possibleTabs.map(
							(tab): ReactElement => (
								<VaultDetailsTab
									currentVault={currentVault}
									key={tab.value}
									tab={tab}
									selectedTab={currentTab}
									onSwitchTab={newTab => {
										set_currentTab(newTab);
										onSwitchSelectedOptions(newTab.flowAction);
									}}
								/>
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
												className={`size-6 transition-transform${
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

				<BoostMessage
					currentVault={currentVault}
					currentTab={currentTab.value}
				/>
			</div>
		</>
	);
}
