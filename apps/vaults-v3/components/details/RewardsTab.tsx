import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {
	claim as claimAction,
	stake as stakeAction,
	stakeVeYFIGauge as stakeVeYFIAction,
	unstake as unstakeAction,
	unstakeVeYFIGauge as unstakeVeYFIAction
} from '@vaults-v2/utils/actions';
import {stakeYBold, unstakeYBold} from '@vaults-v3/utils/actions';
import {Button} from '@lib/components/Button';
import {Counter} from '@lib/components/Counter';
import {FakeInput} from '@lib/components/Input';
import {useWeb3} from '@lib/contexts/useWeb3';
import {useYearn} from '@lib/contexts/useYearn';
import {useYearnToken} from '@lib/hooks/useYearnToken';
import {cl, formatAmount, formatCounterValue, fromNormalized, isZero, toAddress, toBigInt} from '@lib/utils';
import {DISABLED_VEYFI_GAUGES_VAULTS_LIST} from '@lib/utils/constants';
import {approveERC20, defaultTxStatus} from '@lib/utils/wagmi';

import type {ChangeEvent, ReactElement} from 'react';
import type {TYDaemonVault} from '@lib/utils/schemas/yDaemonVaultsSchemas';
import type {TStakingInfo} from '@vaults-v2/hooks/useVaultStakingData';

/**************************************************************************************************
 ** The BoostMessage component will display a message to the user if the current vault has staking
 ** rewards and the source of the rewards is either 'OP Boost' or 'VeYFI'. More source might be
 ** added in the future.
 ** An empty span will be returned if the current tab is not the 'Boost' tab or if no staking
 ** rewards are available.
 *************************************************************************************************/
function BoostMessage(props: {currentVault: TYDaemonVault; hasStakingRewardsLive: boolean}): ReactElement {
	const hasVaultData = Boolean(props.currentVault.staking.available);
	const vaultDataSource = props.currentVault.staking.source;
	const extraAPY = props.currentVault.apr.extra.stakingRewardsAPR;
	const {pathname} = useRouter();
	const isV3Page = pathname.startsWith('/v3');

	if (hasVaultData && !props.hasStakingRewardsLive && vaultDataSource !== 'VeYFI') {
		return (
			<div className={'col-span-12 mt-0'}>
				<div
					className={cl(
						'w-full rounded-lg p-6 text-neutral-0',
						isV3Page ? 'bg-neutral-900' : 'dark:bg-neutral-900 bg-neutral-900'
					)}>
					<b className={'text-lg'}>{"Oh no... we're all out of rewards!"}</b>
					<div className={'mt-2 flex flex-col gap-2'}>
						<p>{"But fear not, you're still earning that juicy base yield so keep on staking."}</p>
					</div>
				</div>
			</div>
		);
	}

	if (hasVaultData && vaultDataSource === 'OP Boost') {
		return (
			<div className={'col-span-12 mt-0'}>
				<div
					className={cl(
						'w-full rounded-lg p-6 text-neutral-0',
						isV3Page ? 'bg-neutral-900' : 'dark:bg-neutral-900 bg-neutral-900'
					)}>
					<b className={'text-lg'}>{'Great news everybody!'}</b>
					<div className={'mt-2 flex flex-col gap-2'}>
						<p>
							{
								'This Vault is receiving an Optimism boost. Simply stake your Vault tokens to earn OP rewards. Fancy!'
							}
						</p>
					</div>
				</div>
			</div>
		);
	}

	if (hasVaultData && vaultDataSource === 'VeYFI') {
		return (
			<div className={'col-span-12 mt-0 hidden'}>
				<div
					className={cl(
						'w-full rounded-lg p-6 text-neutral-0',
						isV3Page ? 'bg-neutral-900' : 'dark:bg-neutral-900 bg-neutral-900'
					)}>
					<b className={'text-lg'}>{'Yield is good, but more yield is good-er!'}</b>
					<div className={'mt-2 flex flex-col gap-2'}>
						<p>
							{`This Vault has an active veYFI gauge which boosts your APY from ${formatAmount(extraAPY * 10)}% to ${formatAmount(extraAPY * 100)}% depending on the veYFI you have locked. Simply deposit and stake to start earning.`}
						</p>
						<p className={'block'}>
							{'Learn more about veYFI rewards in the '}
							<a
								className={'underline'}
								href={'https://docs.yearn.fi/contributing/governance/veyfi-intro'}
								target={'_blank'}
								rel={'noreferrer'}>
								{'FAQ'}
							</a>
							{'.'}
						</p>
					</div>
				</div>
			</div>
		);
	}

	if (hasVaultData && vaultDataSource === 'Juiced') {
		return (
			<div className={'col-span-12 mt-0'}>
				<div
					className={cl(
						'w-full rounded-lg p-6 text-neutral-0',
						isV3Page ? 'bg-neutral-900' : 'dark:bg-neutral-900 bg-neutral-900'
					)}>
					<b className={'text-lg'}>{'Yield is good, but more yield is good-er!'}</b>
					<div className={'mt-2 flex flex-col gap-2'}>
						<p>
							{`This Vault can be juiced for even more yield. Simply deposit and stake to receive juiced APYs of ${formatAmount(extraAPY * 100)}%.`}
						</p>
						<p className={'block'}>
							{'Visit '}
							<a
								className={'underline'}
								href={'https://juiced.app'}
								target={'_blank'}
								rel={'noreferrer'}>
								{'juiced.app'}
							</a>
							{' to learn more'}
						</p>
					</div>
				</div>
			</div>
		);
	}

	if (hasVaultData && vaultDataSource === 'V3 Staking') {
		return (
			<div className={'col-span-12 mt-0'}>
				<div
					className={cl(
						'w-full rounded-lg p-6 text-neutral-0',
						isV3Page ? 'bg-neutral-900' : 'dark:bg-neutral-900 bg-neutral-900'
					)}>
					<b className={'text-lg'}>{'Great news everybody!'}</b>
					<div className={'mt-2 flex flex-col gap-2'}>
						<p>
							{
								'This Vault is receiving an Staking Boost. Simply stake your Vault tokens to earn extra rewards. Fancy!'
							}
						</p>
					</div>
				</div>
			</div>
		);
	}

	return <span />;
}

function VeYFIBoostMessage(props: {
	currentVault: TYDaemonVault;
	hasStakingRewardsLive: boolean;
	shouldForceUnstake: boolean;
}): ReactElement {
	const vaultDataource = props.currentVault.staking.source;
	const extraAPY = props.currentVault.apr.extra.stakingRewardsAPR;
	const {pathname} = useRouter();
	const isV3Page = pathname.startsWith('/v3');

	const OneUp = (
		<Link
			href={'https://1up.tokyo/stake'}
			target={'_blank'}
			rel={'noreferrer'}>
			<div
				className={cl(
					'flex items-center justify-center gap-2 rounded-lg p-3 transition-colors hover:bg-[#D21162]',
					'bg-neutral-100/5'
				)}>
				<Image
					className={'rounded-full'}
					src={'https://1up.tokyo/logo.svg'}
					alt={'1UP'}
					width={32}
					height={32}
					unoptimized
				/>
				<p className={cl('text-base font-bold text-neutral-100')}>{'1UP'}</p>
			</div>
		</Link>
	);

	const Cove = (
		<Link
			href={'https://boosties.cove.finance/boosties'}
			target={'_blank'}
			rel={'noreferrer'}>
			<div
				className={cl(
					'flex items-center justify-center gap-2 rounded-lg p-3 transition-colors hover:bg-[#D21162]',
					'bg-neutral-100/5'
				)}>
				<Image
					className={'rounded-full'}
					src={
						'https://assets-global.website-files.com/651af12fcd3055636b6ac9ad/66242dbf1d6e7ff1b18336c4_Twitter%20pp%20-%20Logo%202.png'
					}
					alt={'Cove'}
					width={32}
					height={32}
					unoptimized
				/>
				<p className={cl('text-base font-bold text-neutral-100')}>{'Cove'}</p>
			</div>
		</Link>
	);

	const StakeDAO = (
		<Link
			href={'https://www.stakedao.org/yield?protocol=yearn'}
			target={'_blank'}
			rel={'noreferrer'}>
			<div
				className={cl(
					'flex items-center justify-center gap-2 rounded-lg p-3 transition-colors hover:bg-[#D21162]',
					'bg-neutral-100/5'
				)}>
				<Image
					className={'rounded-full'}
					src={'https://www.stakedao.org/logo.png'}
					alt={'StakeDAO'}
					width={32}
					height={32}
					unoptimized
				/>
				<p className={cl('text-base font-bold text-neutral-100')}>{'StakeDAO'}</p>
			</div>
		</Link>
	);

	const randomOrder = useMemo(() => {
		const apps = [OneUp, Cove, StakeDAO];
		function shuffle(array: ReactElement[]): ReactElement[] {
			for (let i = array.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[array[i], array[j]] = [array[j], array[i]];
			}
			return array;
		}
		return shuffle(apps);
	}, []);

	if (props.shouldForceUnstake) {
		return (
			<div className={cl('flex w-full flex-col rounded-2xl p-6 my-auto', 'bg-neutral-900')}>
				<b className={cl('text-lg text-neutral-100')}>{'This gauge is no longer active'}</b>
				<div className={cl('flex flex-col gap-2 py-4', isV3Page ? 'text-[#908FB4]' : 'text-neutral-400')}>
					<p>{'This gauge has been removed and no longer brings any benefits. Please withdraw from it'}</p>
				</div>
			</div>
		);
	}

	if (vaultDataource !== 'VeYFI') {
		return <Fragment />;
	}

	return (
		<div className={cl('flex w-full flex-col rounded-2xl p-6', 'bg-neutral-900')}>
			<b className={cl('text-lg text-neutral-100')}>{'Yield is good, but more yield is good-er!'}</b>
			<div className={cl('flex flex-col gap-2 py-4', isV3Page ? 'text-[#908FB4]' : 'text-neutral-400')}>
				<p>
					{'This Vault has an active veYFI gauge which boosts your APY from '}
					<span className={cl('font-bold text-neutral-100')}>{`${formatAmount(extraAPY * 10)}%`}</span>
					{' to '}
					<span className={cl('font-bold text-neutral-100')}>{`${formatAmount(extraAPY * 100)}%`}</span>
					{' depending on the veYFI you have locked. Simply deposit and stake to start earning. '}
					<a
						className={'underline'}
						href={'https://docs.yearn.fi/contributing/governance/veyfi-intro'}
						target={'_blank'}
						rel={'noreferrer'}>
						{'Learn more'}
					</a>
					{'.'}
				</p>
				<p>{"Don't have veYFI? Deposit with a liquid locker to earn boosted rewards today!"}</p>
			</div>
			<div className={'grid grid-cols-2 gap-2 pt-6 md:grid-cols-3'}>
				{randomOrder.map((item, index) => (
					<Fragment key={index}>{item}</Fragment>
				))}
			</div>
		</div>
	);
}

/**************************************************************************************************
 ** The RewardsTab component will display the staking rewards data for the current vault. It will
 ** allow the user to stake, unstake, and claim rewards from the staking rewards contract.
 ** Based on the staking source, the UI might change a bit to display the correct information.
 *************************************************************************************************/
export function RewardsTab(props: {
	currentVault: TYDaemonVault;
	hasStakingRewardsLive: boolean;
	vaultData: TStakingInfo;
	updateVaultData: VoidFunction;
}): ReactElement {
	const {provider, isActive} = useWeb3();
	const {getPrice} = useYearn();
	const {vaultData, updateVaultData} = props;
	const rewardTokenBalance = useYearnToken({address: vaultData.rewardsToken, chainID: props.currentVault.chainID});
	const [approveStakeStatus, set_approveStakeStatus] = useState(defaultTxStatus);
	const [stakeStatus, set_stakeStatus] = useState(defaultTxStatus);
	const [claimStatus, set_claimStatus] = useState(defaultTxStatus);
	const [unstakeStatus, set_unstakeStatus] = useState(defaultTxStatus);
	const [unstakeAmount, set_unstakeAmount] = useState<string>(vaultData.stakedBalanceOf.display);
	const [stakeAmount, set_stakeAmount] = useState<string>(vaultData.vaultBalanceOf.display);
	const [isUnstakeAmountDirty, set_isUnstakeAmountDirty] = useState(false);
	const [isStakeAmountDirty, set_isStakeAmountDirty] = useState(false);

	const isUnstakingMax =
		fromNormalized(unstakeAmount, vaultData.stakingDecimals || 18) === vaultData.stakedBalanceOf.raw;
	const isLargerThanStakedBalance =
		fromNormalized(unstakeAmount, vaultData.stakingDecimals || 18) > vaultData.stakedBalanceOf.raw;
	const isLargerThanVaultBalance =
		fromNormalized(stakeAmount, props.currentVault.decimals || 18) > vaultData.vaultBalanceOf.raw;

	const isApproved = vaultData.vaultAllowance.raw >= vaultData.vaultBalanceOf.raw;

	/**************************************************************************************************
	 ** Check if the current vault is in the list of disabled veYFI gauges. If it is, we should make
	 ** it possible to withdraw the rewards and display a corresponding message to the user.
	 *************************************************************************************************/
	const shouldForceUnstake = !!DISABLED_VEYFI_GAUGES_VAULTS_LIST.find(
		vault => vault.address === props.currentVault.address
	);

	/**********************************************************************************************
	 ** The refreshData function will be called when the user interacts with the stake, unstake, or
	 ** claim buttons. It will refresh the user's balances and the staking rewards data so the app
	 ** can display the most up-to-date information.
	 *********************************************************************************************/
	const refreshData = useCallback(async (): Promise<void> => {
		await updateVaultData();
	}, [updateVaultData]);

	/**********************************************************************************************
	 ** The onApprove function will be called when the user clicks the "Approve" button. It will
	 ** call the approveERC20 function to approve the staking rewards contract to spend the user's
	 ** yVault tokens. If the approval is successful, the staking rewards data will be updated.
	 *********************************************************************************************/
	const onApprove = useCallback(async (): Promise<void> => {
		const result = await approveERC20({
			connector: provider,
			chainID: props.currentVault.chainID,
			contractAddress: props.currentVault.address,
			spenderAddress: toAddress(vaultData?.address),
			amount: vaultData.vaultBalanceOf.raw,
			statusHandler: set_approveStakeStatus
		});
		if (result.isSuccessful) {
			updateVaultData();
		}
	}, [props.currentVault, provider, updateVaultData, vaultData?.address, vaultData.vaultBalanceOf.raw]);

	/**********************************************************************************************
	 ** The onStake function will be called when the user clicks the "Stake" button. It will call
	 ** the stakeAction function to stake the user's yVault tokens into the staking rewards
	 ** contract. If the stake is successful, the user's balances and staking rewards data will be
	 ** refreshed.
	 ** Depending on the staking source, we will use either the stake function or the
	 ** stakeVeYFIGauge function.
	 *********************************************************************************************/
	const onStake = useCallback(async (): Promise<void> => {
		if (props.currentVault.staking.source === 'VeYFI') {
			const result = await stakeVeYFIAction({
				connector: provider,
				chainID: props.currentVault.chainID,
				contractAddress: toAddress(vaultData?.address),
				amount: vaultData.vaultBalanceOf.raw,
				statusHandler: set_stakeStatus
			});
			if (result.isSuccessful) {
				refreshData();
				updateVaultData();
			}
		} else if (props.currentVault.staking.source === 'yBOLD') {
			const result = await stakeYBold({
				connector: provider,
				chainID: props.currentVault.chainID,
				contractAddress: toAddress(vaultData?.address),
				amount: fromNormalized(stakeAmount, vaultData.stakingDecimals || 18),
				statusHandler: set_stakeStatus
			});
			if (result.isSuccessful) {
				refreshData();
				updateVaultData();
			}
		} else {
			const result = await stakeAction({
				connector: provider,
				chainID: props.currentVault.chainID,
				contractAddress: toAddress(vaultData?.address),
				amount: vaultData.vaultBalanceOf.raw,
				statusHandler: set_stakeStatus
			});
			if (result.isSuccessful) {
				refreshData();
				updateVaultData();
			}
		}
	}, [
		props.currentVault.staking.source,
		props.currentVault.chainID,
		provider,
		vaultData?.address,
		vaultData.vaultBalanceOf.raw,
		vaultData.stakingDecimals,
		refreshData,
		updateVaultData,
		stakeAmount
	]);

	/**********************************************************************************************
	 ** The onUnstake function will be called when the user clicks the "Unstake" button. It will
	 ** call the unstakeAction function to unstake the user's yVault tokens from the staking
	 ** rewards contract. If the unstake is successful, the user's balances and staking rewards
	 ** data will be refreshed.
	 ** Note: this will also claim the user's staking rewards.
	 ** Depending on the staking source, we will use either the unstake function or the
	 ** unstakeVeYFIGauge function.
	 *********************************************************************************************/
	const onUnstake = useCallback(async (): Promise<void> => {
		if (props.currentVault.staking.source === 'VeYFI' || shouldForceUnstake) {
			const result = await unstakeVeYFIAction({
				connector: provider,
				chainID: props.currentVault.chainID,
				contractAddress: toAddress(vaultData?.address),
				amount: fromNormalized(unstakeAmount, vaultData.stakingDecimals || 18),
				willClaim: isUnstakingMax,
				statusHandler: set_unstakeStatus
			});
			if (result.isSuccessful) {
				refreshData();
				updateVaultData();
			}
		} else if (props.currentVault.staking.source === 'yBOLD') {
			const result = await unstakeYBold({
				connector: provider,
				chainID: props.currentVault.chainID,
				contractAddress: toAddress(vaultData?.address),
				amount: fromNormalized(unstakeAmount, vaultData.stakingDecimals || 18),
				statusHandler: set_unstakeStatus
			});
			if (result.isSuccessful) {
				refreshData();
				updateVaultData();
			}
		} else {
			const result = await unstakeAction({
				connector: provider,
				chainID: props.currentVault.chainID,
				contractAddress: toAddress(vaultData?.address),
				statusHandler: set_unstakeStatus
			});
			if (result.isSuccessful) {
				refreshData();
				updateVaultData();
			}
		}
	}, [
		unstakeAmount,
		vaultData.stakingDecimals,
		vaultData?.address,
		props.currentVault.staking.source,
		props.currentVault.chainID,
		shouldForceUnstake,
		provider,
		isUnstakingMax,
		refreshData,
		updateVaultData
	]);

	/**********************************************************************************************
	 ** The onClaim function will be called when the user clicks the "Claim" button. It will call
	 ** the claimAction function to claim the user's staking rewards from the staking rewards
	 ** contract. If the claim is successful, the user's balances and staking rewards data will be
	 ** refreshed.
	 *********************************************************************************************/
	const onClaim = useCallback(async (): Promise<void> => {
		const result = await claimAction({
			connector: provider,
			chainID: props.currentVault.chainID,
			contractAddress: toAddress(vaultData?.address),
			statusHandler: set_claimStatus
		});
		if (result.isSuccessful) {
			refreshData();
		}
	}, [provider, refreshData, vaultData?.address, props.currentVault.chainID]);

	/**********************************************************************************************
	 ** In order to display the counter value of the user's staking rewards and yVault tokens, we
	 ** need to get the price of the reward token and the yVault token. We can use the getPrice
	 ** function from the useYearn hook to get the price of the tokens.
	 *********************************************************************************************/
	const rewardTokenPrice = useMemo(
		() => getPrice({address: rewardTokenBalance.address, chainID: rewardTokenBalance.chainID}),
		[getPrice, rewardTokenBalance]
	);
	const vaultTokenPrice = useMemo(
		() => getPrice({address: props.currentVault.address, chainID: props.currentVault.chainID}),
		[getPrice, props.currentVault]
	);

	useEffect(() => {
		if (!isUnstakeAmountDirty) {
			set_unstakeAmount(vaultData.stakedBalanceOf.display);
		}
	}, [vaultData.stakedBalanceOf.display, unstakeAmount, isUnstakeAmountDirty]);

	useEffect(() => {
		if (!isStakeAmountDirty) {
			set_stakeAmount(vaultData.stakedBalanceOf.display);
		}
	}, [stakeAmount, isStakeAmountDirty, vaultData.stakedBalanceOf.display]);

	if (props.currentVault.staking.rewards?.length === 0) {
		return (
			<div className={'flex flex-col gap-6 rounded-b-3xl p-4 md:gap-4 md:p-8'}>
				<BoostMessage
					hasStakingRewardsLive={props.hasStakingRewardsLive}
					currentVault={props.currentVault}
				/>
			</div>
		);
	}

	if (shouldForceUnstake) {
		return (
			<div className={'grid grid-cols-1 md:grid-cols-2'}>
				<div className={'flex flex-col gap-6 rounded-b-3xl p-4 md:gap-4 md:p-8 md:pr-0'}>
					<BoostMessage
						hasStakingRewardsLive={props.hasStakingRewardsLive}
						currentVault={props.currentVault}
					/>

					<div className={'flex flex-col gap-2'}>
						<div>
							<div className={'font-bold'}>{'Unstake'}</div>
						</div>
						<div className={'flex flex-col gap-4 md:flex-row'}>
							<FakeInput
								className={'w-full'}
								legend={
									<div className={'flex items-center justify-between'}>
										<p>{`${formatAmount(vaultData.stakedBalanceOf.normalized, 6)} ${vaultData.stakedGaugeSymbol || props.currentVault.symbol} staked`}</p>
										<p>{`${formatCounterValue(vaultData.stakedBalanceOf.normalized, vaultTokenPrice.normalized)}`}</p>
									</div>
								}
								value={
									toBigInt(vaultData.stakedBalanceOf.raw) === 0n ? undefined : (
										<Counter
											value={Number(vaultData.stakedBalanceOf.normalized)}
											decimals={vaultData.stakingDecimals || 18}
										/>
									)
								}
							/>

							<Button
								className={'w-full md:w-[180px] md:min-w-[180px]'}
								onClick={onUnstake}
								isBusy={unstakeStatus.pending}
								isDisabled={!isActive || Number(vaultData.stakedBalanceOf.normalized) <= 0}>
								{'Claim & Exit'}
							</Button>
						</div>
					</div>
				</div>
				<div className={'flex flex-col gap-6 rounded-b-3xl p-4 md:gap-4 md:p-8'}>
					<VeYFIBoostMessage
						currentVault={props.currentVault}
						hasStakingRewardsLive={props.hasStakingRewardsLive}
						shouldForceUnstake={shouldForceUnstake}
					/>
				</div>
			</div>
		);
	}

	/**********************************************************************************************
	 ** Special case for yBold.
	 *********************************************************************************************/
	if (props.currentVault.address === toAddress('0x9F4330700a36B29952869fac9b33f45EEdd8A3d8')) {
		return (
			<div className={'grid grid-cols-1 md:grid-cols-2'}>
				<div className={'flex flex-col gap-6 rounded-b-3xl p-4 md:gap-4 md:p-8 md:pr-0'}>
					<div className={'flex flex-col gap-2'}>
						<div>
							<div className={'font-bold'}>{'Stake'}</div>
						</div>

						<div className={'flex flex-col gap-4 md:flex-row'}>
							<div className={'w-full'}>
								<div className={cl('flex h-10 items-center rounded-lg p-2 w-full', 'bg-neutral-300')}>
									<div className={'flex h-10 w-full flex-row items-center justify-between px-0 py-4'}>
										<input
											id={'stakeAmount'}
											className={cl(
												'w-full overflow-x-scroll border-none bg-transparent px-0 py-4 font-bold outline-none scrollbar-none',
												isActive ? '' : 'cursor-not-allowed'
											)}
											type={'number'}
											inputMode={'numeric'}
											min={0}
											pattern={'^((?:0|[1-9]+)(?:.(?:\\d+?[1-9]|[1-9]))?)$'}
											autoComplete={'off'}
											disabled={!isActive}
											value={stakeAmount}
											onChange={(e: ChangeEvent<HTMLInputElement>): void => {
												set_stakeAmount(e.target.value);
												set_isStakeAmountDirty(true);
											}}
										/>

										<button
											onClick={(): void => {
												set_stakeAmount(vaultData.vaultBalanceOf.display);
												set_isStakeAmountDirty(true);
											}}
											className={
												'ml-2 cursor-pointer rounded-[4px] bg-neutral-800/20 px-2 py-1 text-xs text-neutral-900 transition-colors hover:bg-neutral-800/50'
											}>
											{'Max'}
										</button>
									</div>
								</div>
								<legend
									className={'mt-1 pl-0.5 text-xs text-neutral-600 opacity-70 md:mr-0'}
									suppressHydrationWarning>
									<div className={'flex items-center justify-between'}>
										<p>{`${formatAmount(vaultData.vaultBalanceOf.normalized, 6)} yBOLD available`}</p>
										<p>{`${formatCounterValue(vaultData.vaultBalanceOf.normalized, vaultTokenPrice.normalized)}`}</p>
									</div>
								</legend>
							</div>
							<Button
								className={'w-full md:w-[180px] md:min-w-[180px]'}
								onClick={(): unknown => (isApproved ? onStake() : onApprove())}
								isBusy={stakeStatus.pending || approveStakeStatus.pending}
								isDisabled={
									!isActive ||
									Number(vaultData.vaultBalanceOf.display) <= 0 ||
									isLargerThanVaultBalance
								}>
								{isApproved ? 'Stake' : 'Approve'}
							</Button>
						</div>
					</div>
					<div className={'flex flex-col gap-2'}>
						<div>
							<div className={'font-bold'}>{'Unstake'}</div>
						</div>
						<div className={'flex flex-col gap-4 md:flex-row'}>
							<div className={'w-full'}>
								<div className={cl('flex h-10 items-center rounded-lg p-2 w-full', 'bg-neutral-300')}>
									<div className={'flex h-10 w-full flex-row items-center justify-between px-0 py-4'}>
										<input
											id={'unstakeAmount'}
											className={cl(
												'w-full overflow-x-scroll border-none bg-transparent px-0 py-4 font-bold outline-none scrollbar-none',
												isActive ? '' : 'cursor-not-allowed'
											)}
											type={'number'}
											inputMode={'numeric'}
											min={0}
											pattern={'^((?:0|[1-9]+)(?:.(?:d+?[1-9]|[1-9]))?)$'}
											autoComplete={'off'}
											disabled={!isActive}
											value={unstakeAmount}
											onChange={(e: ChangeEvent<HTMLInputElement>): void => {
												set_unstakeAmount(e.target.value);
												set_isUnstakeAmountDirty(true);
											}}
										/>

										<button
											onClick={(): void => {
												set_unstakeAmount(vaultData.stakedBalanceOf.display);
												set_isUnstakeAmountDirty(true);
											}}
											className={
												'ml-2 cursor-pointer rounded-[4px] bg-neutral-800/20 px-2 py-1 text-xs text-neutral-900 transition-colors hover:bg-neutral-800/50'
											}>
											{'Max'}
										</button>
									</div>
								</div>
								<legend
									className={'mt-1 pl-0.5 text-xs text-neutral-600 opacity-70 md:mr-0'}
									suppressHydrationWarning>
									<div className={'flex items-center justify-between'}>
										<p>{`${formatAmount(vaultData.stakedBalanceOf.normalized, 6)} st-yBOLD staked`}</p>
										<p>{`${formatCounterValue(vaultData.stakedBalanceOf.normalized, vaultTokenPrice.normalized)}`}</p>
									</div>
								</legend>
							</div>
							<Button
								className={'w-full md:w-[180px] md:min-w-[180px]'}
								onClick={onUnstake}
								isBusy={unstakeStatus.pending}
								isDisabled={!isActive || Number(unstakeAmount) <= 0 || isLargerThanStakedBalance}>
								{'Unstake'}
							</Button>
						</div>
					</div>
				</div>
				<div className={'flex flex-col gap-6 rounded-b-3xl p-4 md:gap-4 md:p-8'}>
					<div className={cl('flex w-full flex-col rounded-2xl p-6', 'bg-neutral-900')}>
						<b className={cl('text-lg text-neutral-100')}>
							{'Meet yBOLD: Tokenized Stability Pool Rewards'}
						</b>
						<div className={cl('flex flex-col gap-2 py-4', 'text-[#908FB4]')}>
							<p>
								{
									'yBOLD represents BOLD deposited in Liquity V2 Stability Pools, earning liquidation fees and protocol interest. '
								}
								{
									'When you stake yBOLD, you receive st-yBOLD that auto-compounds rewards and optimizes allocations across pools every 30 minutes.'
								}
							</p>
							<p>
								<span className={cl('font-bold text-neutral-100')}>
									{'TLDR: Highest rewards, lowest risk. '}
								</span>
							</p>
							<p>
								<span>
									{
										'Benefits include auto-compounding rewards, optimized MEV-resistant reward selling, '
									}
									{'and full composability. '}
								</span>
								<a
									className={'underline'}
									href={'https://docs.yearn.fi/getting-started/products/yvaults/yBold#how-it-works'}
									target={'_blank'}
									rel={'noreferrer'}>
									{'Learn more about yBOLD'}
								</a>
								{'.'}
							</p>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className={'grid grid-cols-1 md:grid-cols-2'}>
			<div className={'flex flex-col gap-6 rounded-b-3xl p-4 md:gap-4 md:p-8 md:pr-0'}>
				<BoostMessage
					hasStakingRewardsLive={props.hasStakingRewardsLive}
					currentVault={props.currentVault}
				/>
				<div className={'flex flex-col gap-2'}>
					<div>
						<div className={'font-bold'}>{'Stake'}</div>
					</div>

					<div className={'flex flex-col gap-4 md:flex-row'}>
						<FakeInput
							className={'w-full'}
							legend={
								<div className={'flex items-center justify-between'}>
									<p>{`${formatAmount(vaultData.vaultBalanceOf.normalized, 6)} ${props.currentVault.symbol} available to stake`}</p>
									<p>{`${formatCounterValue(vaultData.vaultBalanceOf.normalized, vaultTokenPrice.normalized)}`}</p>
								</div>
							}
							value={
								toBigInt(vaultData.vaultBalanceOf.raw) === 0n ? undefined : (
									<Counter
										value={Number(vaultData.vaultBalanceOf.normalized)}
										decimals={18}
									/>
								)
							}
						/>
						<div>
							<Button
								className={'w-full md:w-[180px] md:min-w-[180px]'}
								onClick={(): unknown => (isApproved ? onStake() : onApprove())}
								isBusy={stakeStatus.pending || approveStakeStatus.pending}
								isDisabled={
									!isActive ||
									toBigInt(vaultData.vaultBalanceOf.raw) <= 0n ||
									(!props.hasStakingRewardsLive && props.currentVault.staking.source !== 'VeYFI')
								}>
								{isApproved ? 'Stake' : 'Approve & Stake'}
							</Button>
						</div>
					</div>
				</div>
				<div className={'flex flex-col gap-2'}>
					<div>
						<div className={'font-bold'}>{'Unstake'}</div>
					</div>
					<div className={'flex flex-col gap-4 md:flex-row'}>
						<div className={'w-full'}>
							<div className={cl('flex h-10 items-center rounded-lg p-2 w-full', 'bg-neutral-300')}>
								<div className={'flex h-10 w-full flex-row items-center justify-between px-0 py-4'}>
									<input
										id={'fromAmount'}
										className={cl(
											'w-full overflow-x-scroll border-none bg-transparent px-0 py-4 font-bold outline-none scrollbar-none',
											isActive ? '' : 'cursor-not-allowed'
										)}
										type={'number'}
										inputMode={'numeric'}
										min={0}
										pattern={'^((?:0|[1-9]+)(?:.(?:d+?[1-9]|[1-9]))?)$'}
										autoComplete={'off'}
										disabled={!isActive}
										value={unstakeAmount}
										onChange={(e: ChangeEvent<HTMLInputElement>): void => {
											set_unstakeAmount(e.target.value);
											set_isUnstakeAmountDirty(true);
										}}
									/>

									<button
										onClick={(): void => {
											set_unstakeAmount(vaultData.stakedBalanceOf.display);
											set_isUnstakeAmountDirty(true);
										}}
										className={
											'ml-2 cursor-pointer rounded-[4px] bg-neutral-800/20 px-2 py-1 text-xs text-neutral-900 transition-colors hover:bg-neutral-800/50'
										}>
										{'Max'}
									</button>
								</div>
							</div>
							<legend
								className={'mt-1 pl-0.5 text-xs text-neutral-600 opacity-70 md:mr-0'}
								suppressHydrationWarning>
								<div className={'flex items-center justify-between'}>
									<p>{`${formatAmount(vaultData.stakedBalanceOf.normalized, 6)} ${vaultData.stakedGaugeSymbol || props.currentVault.symbol} staked`}</p>
									<p>{`${formatCounterValue(vaultData.stakedBalanceOf.normalized, vaultTokenPrice.normalized)}`}</p>
								</div>
							</legend>
						</div>
						<Button
							className={'w-full md:w-[180px] md:min-w-[180px]'}
							onClick={onUnstake}
							isBusy={unstakeStatus.pending}
							isDisabled={!isActive || Number(unstakeAmount) <= 0 || isLargerThanStakedBalance}>
							{isUnstakingMax ? 'Claim & Exit' : 'Unstake'}
						</Button>
					</div>
				</div>
				<div className={'flex flex-col gap-2'}>
					<div>
						<div className={'font-bold'}>{'Claim Rewards'}</div>
					</div>
					<div className={'flex flex-col gap-4 md:flex-row'}>
						<FakeInput
							className={'w-full'}
							legend={
								<div className={'flex items-center justify-between'}>
									<p>{`${formatAmount(vaultData.stakedEarned.normalized, 6)} ${rewardTokenBalance.symbol || (props.currentVault.staking.rewards || [])[0]?.symbol || ''} available to claim`}</p>
									<p>{`${formatCounterValue(vaultData.stakedEarned.normalized, rewardTokenPrice.normalized)}`}</p>
								</div>
							}
							value={
								toBigInt(vaultData.stakedEarned.raw) === 0n ? undefined : (
									<Counter
										value={Number(vaultData.stakedEarned.normalized)}
										decimals={vaultData.rewardDecimals || 18}
									/>
								)
							}
						/>

						<Button
							className={'w-full md:w-[180px] md:min-w-[180px]'}
							onClick={onClaim}
							isBusy={claimStatus.pending}
							isDisabled={!isActive || isZero(vaultData.stakedEarned.raw)}>
							{'Claim'}
						</Button>
					</div>
				</div>
			</div>
			<div className={'flex flex-col gap-6 rounded-b-3xl p-4 md:gap-4 md:p-8'}>
				<VeYFIBoostMessage
					currentVault={props.currentVault}
					hasStakingRewardsLive={props.hasStakingRewardsLive}
					shouldForceUnstake={shouldForceUnstake}
				/>
			</div>
		</div>
	);
}
