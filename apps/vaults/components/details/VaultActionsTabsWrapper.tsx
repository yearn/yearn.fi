import {Fragment, useCallback, useEffect, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {useBlockNumber} from 'wagmi';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {useAsyncTrigger} from '@builtbymom/web3/hooks/useAsyncTrigger';
import {cl, decodeAsBigInt, toAddress, toNormalizedBN} from '@builtbymom/web3/utils';
import {retrieveConfig} from '@builtbymom/web3/utils/wagmi';
import {useUpdateEffect} from '@react-hookz/web';
import {SettingsPopover} from '@vaults/components/SettingsPopover';
import {Flow, useActionFlow} from '@vaults/contexts/useActionFlow';
import {useSolver} from '@vaults/contexts/useSolver';
import {STAKING_REWARDS_ABI} from '@vaults/utils/abi/stakingRewards.abi';
import {VAULT_V3_ABI} from '@vaults/utils/abi/vaultV3.abi';
import {VaultDetailsQuickActionsButtons} from '@vaults-v3/components/details/actions/QuickActionsButtons';
import {VaultDetailsQuickActionsFrom} from '@vaults-v3/components/details/actions/QuickActionsFrom';
import {VaultDetailsQuickActionsSwitch} from '@vaults-v3/components/details/actions/QuickActionsSwitch';
import {VaultDetailsQuickActionsTo} from '@vaults-v3/components/details/actions/QuickActionsTo';
import {RewardsTab} from '@vaults-v3/components/details/RewardsTab';
import {getCurrentTab, tabs, VaultDetailsTab} from '@vaults-v3/components/details/VaultActionsTabsWrapper';
import {readContracts} from '@wagmi/core';
import {parseMarkdown} from '@yearn-finance/web-lib/utils/helpers';
import {Solver} from '@yearn-finance/web-lib/utils/schemas/yDaemonTokenListBalances';
import {useYearn} from '@common/contexts/useYearn';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TNormalizedBN} from '@builtbymom/web3/types';
import type {TTabsOptions} from '@vaults-v3/components/details/VaultActionsTabsWrapper';
import {useVaultStakingData} from '@vaults/hooks/useVaultStakingData';

/**************************************************************************************************
 ** The MobileTabButtons component will be used to display the tab buttons to navigate between the
 ** different tabs on mobile devices.
 *************************************************************************************************/
function MobileTabButtons(props: {
	currentTab: TTabsOptions;
	selectedTab: TTabsOptions;
	set_currentTab: (tab: TTabsOptions) => void;
	onSwitchSelectedOptions: (flow: Flow) => void;
}): ReactElement {
	return (
		<button
			onClick={() => {
				props.set_currentTab(props.currentTab);
				props.onSwitchSelectedOptions(props.currentTab.flowAction);
			}}
			className={cl(
				'flex h-10 pr-4 transition-all duration-300 flex-row items-center border-0 bg-neutral-100 p-0 font-bold focus:border-neutral-900 md:hidden',
				props.selectedTab.value === props.currentTab.value
					? 'border-b-2 border-neutral-900'
					: 'border-b-2 border-neutral-300'
			)}>
			{props.currentTab.label}
		</button>
	);
}

/**************************************************************************************************
 ** The VaultActionsTabsWrapper wraps the different components that are part of the Vault Actions
 ** section. It will display the different tabs available for the current vault and the
 ** corresponding actions that can be taken.
 *************************************************************************************************/
export function VaultActionsTabsWrapper({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const router = useRouter();
	const {isAutoStakingEnabled, set_isAutoStakingEnabled} = useYearn();
	const {address} = useWeb3();
	const {vaultData, updateVaultData} = useVaultStakingData({currentVault});
	const {onSwitchSelectedOptions, isDepositing, actionParams} = useActionFlow();
	const [possibleTabs, set_possibleTabs] = useState<TTabsOptions[]>([tabs[0], tabs[1]]);
	const [unstakedBalance, set_unstakedBalance] = useState<TNormalizedBN | undefined>(undefined);
	const [hasStakingRewardsLive, set_hasStakingRewardsLive] = useState(true);
	const [currentTab, set_currentTab] = useState<TTabsOptions>(
		getCurrentTab({
			isDepositing,
			hasMigration: currentVault?.migration?.available,
			isRetired: currentVault?.info?.isRetired
		})
	);
	const hasStakingRewards = Boolean(currentVault.staking.available);

	const {currentSolver} = useSolver();

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
					address: toAddress(currentVault.staking.address),
					abi: STAKING_REWARDS_ABI,
					chainId: currentVault.chainID,
					functionName: 'periodFinish'
				}
			]
		});
		set_unstakedBalance(toNormalizedBN(decodeAsBigInt(result[0]), currentVault.decimals));
		set_hasStakingRewardsLive(decodeAsBigInt(result[1]) > Math.floor(Date.now() / 1000));
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

	const getTabLabel = useCallback((): string => {
		if (currentVault.staking.source === 'VeYFI') {
			return 'veYFI BOOST';
		}
		if (currentVault.staking.source === 'OP Boost') {
			return '$OP BOOST';
		}
		if (currentVault.staking.source === 'Juiced') {
			return 'Juiced BOOST';
		}
		if (currentVault.staking.source === 'V3 Staking') {
			return 'Staking BOOST';
		}
		return 'Boost';
	}, [currentVault.staking.source]);

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

			{!currentVault?.migration.available && currentVault?.info?.isRetired && !isSonneRetiredVault && (
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

			<nav
				className={cl(
					`mb-2 w-full`,
					currentVault?.info?.isRetired
						? 'mt-1 md:mt-4'
						: currentVault?.info.uiNotice
							? 'mt-10 md:mt-10'
							: 'mt-10 md:mt-20'
				)}>
				<Link href={'/vaults'}>
					<p className={'yearn--header-nav-item w-full whitespace-nowrap opacity-30'}>{'Back to vaults'}</p>
				</Link>
			</nav>

			<div className={'col-span-12 mb-4 flex flex-col rounded-3xl bg-neutral-100 py-2'}>
				<div className={'relative flex w-full flex-row items-center justify-between px-4 pt-4 md:px-8'}>
					<nav className={'hidden flex-row items-center space-x-10 md:flex'}>
						{possibleTabs
							.filter(tab => tab.value !== 3)
							.map(
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
						<div className={'flex gap-4'}>
							<MobileTabButtons
								currentTab={tabs[0]}
								selectedTab={currentTab}
								set_currentTab={set_currentTab}
								onSwitchSelectedOptions={onSwitchSelectedOptions}
							/>
							<MobileTabButtons
								currentTab={tabs[1]}
								selectedTab={currentTab}
								set_currentTab={set_currentTab}
								onSwitchSelectedOptions={onSwitchSelectedOptions}
							/>
						</div>
					</div>

					<div className={'flex flex-row items-center justify-end space-x-2 pb-0 md:pb-4 md:last:space-x-4'}>
						<SettingsPopover vault={currentVault} />
					</div>
				</div>
				<div className={'-mt-0.5 h-0.5 w-full bg-neutral-300'} />

				{currentTab.value === 3 ? (
					<RewardsTab
						currentVault={currentVault}
						vaultData={vaultData}
						updateVaultData={updateVaultData}
						hasStakingRewardsLive={hasStakingRewardsLive}
					/>
				) : (
					<div
						className={
							'col-span-12 mb-4 flex flex-col space-x-0 space-y-2 bg-neutral-100 p-4 md:flex-row md:space-x-4 md:space-y-0 md:px-8 md:py-6'
						}>
						<VaultDetailsQuickActionsFrom vaultData={vaultData} />
						<VaultDetailsQuickActionsSwitch />
						<VaultDetailsQuickActionsTo />
						<div className={'w-full space-y-0 md:w-42 md:min-w-42 md:space-y-2'}>
							<p className={'hidden text-base md:inline'}>&nbsp;</p>
							<div>
								<VaultDetailsQuickActionsButtons
									currentVault={currentVault}
									hasStakingRewardsLive={hasStakingRewardsLive}
								/>
								{(currentSolver === Solver.enum.OptimismBooster ||
									currentSolver === Solver.enum.GaugeStakingBooster ||
									currentSolver === Solver.enum.JuicedStakingBooster ||
									currentSolver === Solver.enum.V3StakingBooster) &&
									isAutoStakingEnabled &&
									hasStakingRewardsLive &&
									isDepositing && (
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
				{currentTab.value !== 3 && currentVault.staking.rewards && (
					<Fragment>
						<div className={'relative flex w-full flex-row items-center justify-between px-4 pt-4 md:px-8'}>
							<div
								className={cl(
									'flex h-10 min-w-28 z-10 flex-row items-center bg-neutral-100 p-0 font-bold md:hidden border-b-2 border-neutral-900'
								)}>
								{'Boost'}
							</div>
							<div className={'hidden border-b-2 border-neutral-900 pb-4 font-bold md:block'}>
								{getTabLabel()}
							</div>
						</div>
						<div>
							<div className={'-mt-0.5 h-0.5 w-full bg-neutral-300'} />
							<RewardsTab
								currentVault={currentVault}
								vaultData={vaultData}
								updateVaultData={updateVaultData}
								hasStakingRewardsLive={hasStakingRewardsLive}
							/>
						</div>
					</Fragment>
				)}
			</div>
		</>
	);
}
