import {Fragment, useEffect, useMemo, useState} from 'react';
import {useRouter} from 'next/router';
import {useBlockNumber} from 'wagmi';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {useAsyncTrigger} from '@builtbymom/web3/hooks/useAsyncTrigger';
import {
	cl,
	decodeAsBigInt,
	formatAmount,
	parseMarkdown,
	toAddress,
	toBigInt,
	toNormalizedBN
} from '@builtbymom/web3/utils';
import {retrieveConfig} from '@builtbymom/web3/utils/wagmi';
import {Listbox, Transition} from '@headlessui/react';
import {useUpdateEffect} from '@react-hookz/web';
import {Flow, useActionFlow} from '@vaults/contexts/useActionFlow';
import {STAKING_REWARDS_ABI} from '@vaults/utils/abi/stakingRewards.abi';
import {VAULT_V3_ABI} from '@vaults/utils/abi/vaultV3.abi';
import {VaultDetailsQuickActionsButtons} from '@vaults-v3/components/details/actions/QuickActionsButtons';
import {VaultDetailsQuickActionsFrom} from '@vaults-v3/components/details/actions/QuickActionsFrom';
import {VaultDetailsQuickActionsSwitch} from '@vaults-v3/components/details/actions/QuickActionsSwitch';
import {VaultDetailsQuickActionsTo} from '@vaults-v3/components/details/actions/QuickActionsTo';
import {RewardsTab} from '@vaults-v3/components/details/RewardsTab';
import {SettingsPopover} from '@vaults-v3/components/SettingsPopover';
import {readContracts} from '@wagmi/core';
import {useYearn} from '@common/contexts/useYearn';
import {IconChevron} from '@common/icons/IconChevron';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TNormalizedBN} from '@builtbymom/web3/types';

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
export function BoostMessage(props: {
	currentVault: TYDaemonVault;
	currentTab: number;
	hasStakingRewardsLive: boolean;
}): ReactElement {
	const {isAutoStakingEnabled} = useYearn();
	const hasStakingRewards = Boolean(props.currentVault.staking.available);
	const stakingRewardSource = props.currentVault.staking.source;
	const extraAPY = props.currentVault.apr.extra.stakingRewardsAPR;

	if (
		props.currentTab === 0 &&
		hasStakingRewards &&
		!props.hasStakingRewardsLive &&
		stakingRewardSource !== 'VeYFI'
	) {
		return <Fragment />;
	}

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
						{`This Vault has an active veYFI gauge which boosts your APY from ${formatAmount(extraAPY * 10)}% to ${formatAmount(extraAPY * 100)}% depending on the veYFI you have locked. Simply deposit and stake to start earning.`}
					</b>
					<b className={'block text-white'}>
						{'Learn more about veYFI rewards in the '}
						<a
							className={'underline'}
							href={'https://docs.yearn.fi/contributing/governance/veyfi-intro'}
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
	if (props.currentTab === 0 && hasStakingRewards && stakingRewardSource === 'Juiced') {
		return (
			<div className={'col-span-12 flex p-4 pt-0 md:px-8 md:pb-6'}>
				<div className={'w-full rounded-lg bg-[#34A14F] p-2 md:px-6 md:py-4'}>
					<b className={'text-base text-white'}>
						{`This Vault can be juiced for even more yield. Simply deposit and stake to receive juiced APYs of ${formatAmount(extraAPY * 100)}%.`}
					</b>
					<b className={'block text-white'}>
						{'Visit '}
						<a
							className={'underline'}
							href={'https://juiced.app'}
							target={'_blank'}
							rel={'noreferrer'}>
							{'juiced.app'}
						</a>
						{' to learn more'}
					</b>
				</div>
			</div>
		);
	}
	if (props.currentTab === 0 && hasStakingRewards && stakingRewardSource === 'V3 Staking') {
		if (isAutoStakingEnabled) {
			return (
				<div className={'col-span-12 flex p-4 pt-0 md:px-8 md:pb-6'}>
					<div className={'w-full rounded-lg bg-[#34A14F] p-2 md:px-6 md:py-4'}>
						<b className={'text-base text-white'}>
							{
								'Great news! This Vault is receiving a Staking Boost. Deposit and stake your tokens to receive extra rewards. Nice!'
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
							"This Vault is receiving a Staking Boost. To zap into it for additional rewards, you'll have to stake your yVault tokens manually on the BOOST tab after you deposit. Sorry anon, it's just how it works."
						}
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
	unstakedBalance: TNormalizedBN | undefined;
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
		if (props.tab.label === 'Boost' && stakingRewardSource === 'Juiced') {
			return 'Juiced BOOST';
		}
		if (props.tab.label === 'Boost' && stakingRewardSource === 'V3 Staking') {
			return 'Staking BOOST';
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
					'hover-fix tab relative',
					isV3Page
						? props.selectedTab.value === props.tab.value
							? '!text-neutral-900'
							: '!text-neutral-900/50 hover:!text-neutral-900'
						: ''
				)}>
				{tabLabel}
				{props.tab.label === 'Boost' && toBigInt(props.unstakedBalance?.raw) > 0n ? (
					<span className={'absolute -right-3 -top-1 z-10 flex size-2.5'}>
						<span
							className={'absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75'}
						/>
						<span className={'relative inline-flex size-2.5 rounded-full bg-primary'} />
					</span>
				) : null}
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
	const {address} = useWeb3();
	const router = useRouter();
	const {isAutoStakingEnabled, set_isAutoStakingEnabled} = useYearn();
	const [unstakedBalance, set_unstakedBalance] = useState<TNormalizedBN | undefined>(undefined);
	const [possibleTabs, set_possibleTabs] = useState<TTabsOptions[]>([tabs[0], tabs[1]]);
	const [hasStakingRewardsLive, set_hasStakingRewardsLive] = useState(true);
	const [currentTab, set_currentTab] = useState<TTabsOptions>(
		getCurrentTab({
			isDepositing,
			hasMigration: currentVault?.migration?.available,
			isRetired: currentVault?.info?.isRetired
		})
	);
	const hasStakingRewards = Boolean(currentVault.staking.available);

	const {data: blockNumber} = useBlockNumber({watch: true});

	/**********************************************************************************************
	 ** Retrieve some data from the vault and the staking contract to display a comprehensive view
	 ** of the user's holdings in the vault.
	 **********************************************************************************************/
	const refetch = useAsyncTrigger(async (): Promise<void> => {
		if (!currentVault.staking.available) {
			return;
		}
		const result = await readContracts(retrieveConfig(), {
			contracts: [
				{
					address: toAddress(currentVault.address),
					abi: VAULT_V3_ABI,
					chainId: currentVault.chainID,
					functionName: 'balanceOf',
					args: [toAddress(address)]
				},
				{
					address: toAddress(currentVault.address),
					abi: STAKING_REWARDS_ABI,
					chainId: currentVault.chainID,
					functionName: 'periodFinish',
					args: []
				}
			]
		});

		const hasLiveRewards = decodeAsBigInt(result[1]) > Math.floor(Date.now() / 1000);
		const hasLiveRewardsFromYDaemon = (currentVault.staking.rewards || []).some(e => !e.isFinished);
		set_unstakedBalance(toNormalizedBN(decodeAsBigInt(result[0]), currentVault.decimals));
		set_hasStakingRewardsLive(hasLiveRewards || hasLiveRewardsFromYDaemon);
	}, [currentVault, address]);

	/**********************************************************************************************
	 ** As we want live data, we want the data to be refreshed every time the block number changes.
	 ** This way, the user will always have the most up-to-date data.
	 **********************************************************************************************/
	useEffect(() => {
		refetch();
	}, [blockNumber, refetch]);

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
			const tabsToDisplay = [tabs[1], tabs[2]];
			if (hasStakingRewards) {
				tabsToDisplay.push(tabs[3]);
			}
			set_possibleTabs(tabsToDisplay);
			set_currentTab(tabs[2]);
			onSwitchSelectedOptions(Flow.Migrate);
		} else if (currentVault?.info?.isRetired && actionParams.isReady) {
			const tabsToDisplay = [tabs[1]];
			if (hasStakingRewards) {
				tabsToDisplay.push(tabs[3]);
			}
			set_possibleTabs(tabsToDisplay);
			set_currentTab(tabs[1]);
			onSwitchSelectedOptions(Flow.Withdraw);
		} else if (hasStakingRewards) {
			set_possibleTabs([tabs[0], tabs[1], tabs[3]]);
		} else {
			set_possibleTabs([tabs[0], tabs[1]]);
		}
	}, [currentVault?.migration?.available, currentVault?.info?.isRetired, actionParams.isReady, hasStakingRewards]);

	/************************************************************************************************
	 * This effect manages the auto-staking feature based on staking rewards availability.
	 * It disables auto-staking if there are no staking rewards and the last reward ended over a week ago.
	 * Otherwise, it enables auto-staking.
	 *
	 * The check for rewards ending over a week ago helps prevent unnecessary auto-staking
	 * for vaults with expired or long-inactive staking programs.
	 ************************************************************************************************/
	useEffect(() => {
		if (
			!hasStakingRewards &&
			currentVault.staking.rewards?.some(
				el => Math.floor(Date.now() / 1000) - (el.finishedAt ?? 0) > 60 * 60 * 24 * 7
			)
		) {
			set_isAutoStakingEnabled(false);
			return;
		}
		set_isAutoStakingEnabled(true);
	}, [currentVault.staking.rewards, hasStakingRewards, hasStakingRewardsLive, set_isAutoStakingEnabled]);

	const isSonneRetiredVault =
		toAddress(currentVault.address) === toAddress(`0x5b977577eb8a480f63e11fc615d6753adb8652ae`) ||
		toAddress(currentVault.address) === toAddress(`0xad17a225074191d5c8a37b50fda1ae278a2ee6a2`) ||
		toAddress(currentVault.address) === toAddress(`0x65343f414ffd6c97b0f6add33d16f6845ac22bac`) ||
		toAddress(currentVault.address) === toAddress(`0xfaee21d0f0af88ee72bb6d68e54a90e6ec2616de`);
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

			{!currentVault?.migration.available &&
				currentVault?.info?.isRetired &&
				!currentVault.info.uiNotice &&
				!isSonneRetiredVault && (
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
						<p
							className={'mt-2'}
							dangerouslySetInnerHTML={{
								__html: parseMarkdown(
									currentVault?.info.uiNotice.replaceAll('{{token}}', currentVault.token.symbol)
								)
							}}
						/>
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
									unstakedBalance={unstakedBalance}
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
					<RewardsTab
						currentVault={currentVault}
						hasStakingRewardsLive={hasStakingRewardsLive}
					/>
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
								{!hasStakingRewardsLive && (
									<div className={'mt-1 flex justify-between'}>
										<button
											className={'font-number text-xxs text-neutral-900/50'}
											onClick={(): void => set_isAutoStakingEnabled(!isAutoStakingEnabled)}>
											{isAutoStakingEnabled ? 'Deposit only' : 'Deposit and Stake'}
										</button>
									</div>
								)}
							</div>
						</div>
					</div>
				)}

				<BoostMessage
					currentVault={currentVault}
					currentTab={currentTab.value}
					hasStakingRewardsLive={hasStakingRewardsLive}
				/>
			</div>
		</>
	);
}
