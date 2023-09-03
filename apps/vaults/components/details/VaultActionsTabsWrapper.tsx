import {Fragment, useEffect, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {Listbox, Transition} from '@headlessui/react';
import {useUpdateEffect} from '@react-hookz/web';
import {VaultDetailsQuickActionsButtons} from '@vaults/components/details/actions/QuickActionsButtons';
import {VaultDetailsQuickActionsFrom} from '@vaults/components/details/actions/QuickActionsFrom';
import {VaultDetailsQuickActionsSwitch} from '@vaults/components/details/actions/QuickActionsSwitch';
import {VaultDetailsQuickActionsTo} from '@vaults/components/details/actions/QuickActionsTo';
import {ImageWithOverlay} from '@vaults/components/ImageWithOverlay';
import {RewardsTab} from '@vaults/components/RewardsTab';
import {SettingsPopover} from '@vaults/components/SettingsPopover';
import {Flow, useActionFlow} from '@vaults/contexts/useActionFlow';
import {useStakingRewards} from '@vaults/contexts/useStakingRewards';
import {Banner} from '@yearn-finance/web-lib/components/Banner';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useLocalStorage} from '@yearn-finance/web-lib/hooks/useLocalStorage';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {performBatchedUpdates} from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import {useBalance} from '@common/hooks/useBalance';
import {IconChevron} from '@common/icons/IconChevron';
import {Solver} from '@common/schemas/yDaemonTokenListBalances';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';

type TTabsOptions = {
	value: number;
	label: string;
	flowAction: Flow;
	slug?: string;
}

const tabs: TTabsOptions[] = [
	{value: 0, label: 'Deposit', flowAction: Flow.Deposit, slug: 'deposit'},
	{value: 1, label: 'Withdraw', flowAction: Flow.Withdraw, slug: 'withdraw'},
	{value: 2, label: 'Migrate', flowAction: Flow.Migrate, slug: 'migrate'},
	{value: 3, label: '$OP BOOST', flowAction: Flow.None, slug: 'boost'}
];

const DISPLAY_DECIMALS = 10;
const trimAmount = (amount: string | number): string => Number(Number(amount).toFixed(DISPLAY_DECIMALS)).toString();

function getCurrentTab({isDepositing, hasMigration, isRetired}: {isDepositing: boolean, hasMigration: boolean, isRetired: boolean}): TTabsOptions {
	if (hasMigration || isRetired) {
		return tabs[1];
	}
	return tabs.find((tab): boolean => tab.value === (isDepositing ? 0 : 1)) as TTabsOptions;
}

function VaultActionsTabsWrapper({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const {onSwitchSelectedOptions, isDepositing, actionParams, currentSolver} = useActionFlow();
	const [possibleTabs, set_possibleTabs] = useState<TTabsOptions[]>([tabs[0], tabs[1]]);
	const {stakingRewardsMap, positionsMap, stakingRewardsByVault} = useStakingRewards();
	const willDepositAndStake = currentSolver === Solver.enum.OptimismBooster;
	const stakingRewardsAddress = stakingRewardsByVault[currentVault.address];
	const stakingRewards = stakingRewardsAddress ? stakingRewardsMap[stakingRewardsAddress] : undefined;
	const stakingRewardsPosition = stakingRewardsAddress ? positionsMap[stakingRewardsAddress] : undefined;
	const rewardTokenBalance = useBalance(toAddress(stakingRewards?.rewardsToken));
	const hasStakingRewards = !!stakingRewardsByVault[currentVault.address];
	const [currentTab, set_currentTab] = useState<TTabsOptions>(
		getCurrentTab({
			isDepositing,
			hasMigration: currentVault?.migration?.available,
			isRetired: currentVault?.details?.retired
		})
	);
	const [shouldShowLedgerPluginBanner, set_shouldShowLedgerPluginBanner] = useLocalStorage<boolean>('yearn.fi/ledger-plugin-banner', true);
	const [shouldShowOpBoostInfo, set_shouldShowOpBoostInfo] = useLocalStorage<boolean>('yearn.fi/op-boost-banner', true);
	const router = useRouter();
	const {isWalletLedger} = useWeb3();
	const rewardBalance = toNormalizedBN(toBigInt(stakingRewardsPosition?.reward), rewardTokenBalance.decimals);

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
		} else if (currentVault?.details?.retired && actionParams.isReady) {
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
	}, [currentVault?.migration?.available, currentVault?.details?.retired, actionParams.isReady, hasStakingRewards]);

	const isLedgerPluginVisible = isWalletLedger && shouldShowLedgerPluginBanner;

	return (
		<>
			{isLedgerPluginVisible && (
				<div aria-label={'Ledger Plugin'} className={'col-span-12 mt-10'}>
					<ImageWithOverlay
						imageAlt={''}
						imageWidth={2400}
						imageHeight={385}
						imageSrc={'/ledger-plugin-bg.png'}
						href={'ledgerlive://myledger?installApp=yearn'}
						onCloseClick={(): void => set_shouldShowLedgerPluginBanner(false)}
						overlayText={'SIGN IN WITH LEDGER'}
						buttonText={'DOWNLOAD LEDGER PLUGIN'}
					/>
				</div>
			)}

			{currentVault?.migration?.available && (
				<div aria-label={'Migration Warning'} className={'col-span-12 mt-10'}>
					<div className={'w-full bg-neutral-900 p-6 text-neutral-0'}>
						<b className={'text-lg'}>{'Looks like this is an old vault.'}</b>
						<p className={'mt-2'}>{'This Vault is no longer earning yield, but good news, there’s a shiny up to date version just waiting for you to deposit your tokens into. Click migrate, and your tokens will be migrated to the current Vault, which will be mi-great!'}</p>
					</div>
				</div>
			)}


			{(!currentVault?.migration.available && currentVault?.details?.retired) && (
				<div aria-label={'Deprecation Warning'} className={'col-span-12 mt-10'}>
					<div className={'w-full bg-neutral-900 p-6 text-neutral-0'}>
						<b className={'text-lg'}>{'This Vault is no longer supported (oh no).'}</b>
						<p className={'mt-2'}>{'They say all good things must come to an end, and sadly this vault is deprecated and will no longer earn yield or be supported by Yearn. Please withdraw your funds (which you could deposit into another Vault. Just saying…)'}</p>
					</div>
				</div>
			)}

			<nav className={`mb-2 w-full ${(isLedgerPluginVisible || currentVault?.details?.retired) ? 'mt-1 md:mt-4' : 'mt-10 md:mt-20'}`}>
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
						<SettingsPopover chainID={currentVault.chainID} />
					</div>
				</div>
				<div className={'-mt-0.5 h-0.5 w-full bg-neutral-300'} />

				{shouldShowOpBoostInfo && !isZero(rewardBalance.normalized) && (
					<div>
						<Banner
							content={`Ser where's my rewards? You have ${trimAmount(rewardBalance.normalized)} ${rewardTokenBalance.symbol || 'yvOP'} waiting for you in the OP BOOST tab (yep, the one just above here).`}
							type={'info'}
							onClose={(): void => set_shouldShowOpBoostInfo(false)}
						/>
					</div>
				)}
				{currentTab.value === 3 ? (
					<RewardsTab currentVault={currentVault} />
				) : (
					<div className={'col-span-12 mb-4 flex flex-col space-x-0 space-y-2 bg-neutral-100 p-4 md:flex-row md:space-x-4 md:space-y-0 md:px-8 md:py-6'}>
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

				{isZero(currentTab.value) && currentVault.apy?.composite?.boost && hasStakingRewards && willDepositAndStake ? (
					<div className={'col-span-12 flex p-4 pt-0 md:px-8 md:pb-6'}>
						<div className={'w-full bg-[#34A14F] p-2 md:px-6 md:py-4'}>
							<b className={'text-base text-white'}>{'Great news! This Vault is receiving an Optimism Boost. Deposit and stake your tokens to receive OP rewards. Nice!'}</b>
						</div>
					</div>
				) : isZero(currentTab.value) && hasStakingRewards && !willDepositAndStake && (
					<div className={'col-span-12 flex p-4 pt-0 md:px-8 md:pb-6'}>
						<div className={'w-full bg-[#F8A908] p-2 md:px-6 md:py-4'}>
							<b className={'text-base text-white'}>{'This Vault is receiving an Optimism Boost. To zap into it for additional OP rewards, you\'ll have to stake your yVault tokens manually on the $OP BOOST tab after you deposit. Sorry anon, it\'s just how it works.'}</b>
						</div>
					</div>
				)}

			</div>
		</>
	);
}

export {VaultActionsTabsWrapper};
