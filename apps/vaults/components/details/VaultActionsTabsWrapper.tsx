import {Fragment, useEffect, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {useBlockNumber} from 'wagmi';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {useAsyncTrigger} from '@builtbymom/web3/hooks/useAsyncTrigger';
import {cl, decodeAsBigInt, toAddress, toNormalizedBN} from '@builtbymom/web3/utils';
import {retrieveConfig} from '@builtbymom/web3/utils/wagmi';
import {Listbox, Transition} from '@headlessui/react';
import {useUpdateEffect} from '@react-hookz/web';
import {SettingsPopover} from '@vaults/components/SettingsPopover';
import {Flow, useActionFlow} from '@vaults/contexts/useActionFlow';
import {STAKING_REWARDS_ABI} from '@vaults/utils/abi/stakingRewards.abi';
import {VAULT_V3_ABI} from '@vaults/utils/abi/vaultV3.abi';
import {VaultDetailsQuickActionsButtons} from '@vaults-v3/components/details/actions/QuickActionsButtons';
import {VaultDetailsQuickActionsFrom} from '@vaults-v3/components/details/actions/QuickActionsFrom';
import {VaultDetailsQuickActionsSwitch} from '@vaults-v3/components/details/actions/QuickActionsSwitch';
import {VaultDetailsQuickActionsTo} from '@vaults-v3/components/details/actions/QuickActionsTo';
import {RewardsTab} from '@vaults-v3/components/details/RewardsTab';
import {
	BoostMessage,
	getCurrentTab,
	tabs,
	VaultDetailsTab
} from '@vaults-v3/components/details/VaultActionsTabsWrapper';
import {readContracts} from '@wagmi/core';
import {parseMarkdown} from '@yearn-finance/web-lib/utils/helpers';
import {IconChevron} from '@common/icons/IconChevron';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TNormalizedBN} from '@builtbymom/web3/types';
import type {TTabsOptions} from '@vaults-v3/components/details/VaultActionsTabsWrapper';

/**************************************************************************************************
 ** The VaultActionsTabsWrapper wraps the different components that are part of the Vault Actions
 ** section. It will display the different tabs available for the current vault and the
 ** corresponding actions that can be taken.
 *************************************************************************************************/
export function VaultActionsTabsWrapper({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const router = useRouter();
	const {address} = useWeb3();
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

			<div className={'col-span-12 mb-4 flex flex-col bg-neutral-100'}>
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
							'col-span-12 mb-4 flex flex-col space-x-0 space-y-2 bg-neutral-100 p-4 md:flex-row md:space-x-4 md:space-y-0 md:px-8 md:py-6'
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
					hasStakingRewardsLive={hasStakingRewardsLive}
				/>
			</div>
		</>
	);
}
