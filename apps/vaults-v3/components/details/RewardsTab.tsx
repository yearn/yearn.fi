import {useCallback, useMemo, useState} from 'react';
import {useRouter} from 'next/router';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {cl, formatAmount, formatCounterValue, isZero, toAddress, toBigInt} from '@builtbymom/web3/utils';
import {approveERC20, defaultTxStatus} from '@builtbymom/web3/utils/wagmi';
import {useVaultStakingData} from '@vaults/hooks/useVaultStakingData';
import {
	claim as claimAction,
	stake as stakeAction,
	stakeVeYFIGauge as stakeVeYFIAction,
	unstake as unstakeAction,
	unstakeVeYFIGauge as unstakeVeYFIAction
} from '@vaults/utils/actions';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {Counter} from '@common/components/Counter';
import {FakeInput} from '@common/components/Input';
import {useYearn} from '@common/contexts/useYearn';
import {useYearnToken} from '@common/hooks/useYearnToken';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';

/**************************************************************************************************
 ** The BoostMessage component will display a message to the user if the current vault has staking
 ** rewards and the source of the rewards is either 'OP Boost' or 'VeYFI'. More source might be
 ** added in the future.
 ** An empty span will be returned if the current tab is not the 'Boost' tab or if no staking
 ** rewards are available.
 *************************************************************************************************/
function BoostMessage(props: {currentVault: TYDaemonVault; hasStakingRewardsLive: boolean}): ReactElement {
	const hasVaultData = Boolean(props.currentVault.staking.available);
	const vaultDataource = props.currentVault.staking.source;
	const extraAPR = props.currentVault.apr.extra.stakingRewardsAPR;
	const {pathname} = useRouter();
	const isV3Page = pathname.startsWith(`/v3`);

	if (hasVaultData && !props.hasStakingRewardsLive) {
		return (
			<div className={'col-span-12 mt-0'}>
				<div
					className={cl('w-full bg-neutral-900 rounded-lg p-6 text-neutral-0', isV3Page ? 'rounded-lg' : '')}>
					<b className={'text-lg'}>{'No extra, you are extra!'}</b>
					<div className={'mt-2 flex flex-col gap-2'}>
						<p>
							{
								'All the extra rewards have been distributed. You are still earning the base yield, so keep on staking!'
							}
						</p>
					</div>
				</div>
			</div>
		);
	}

	if (hasVaultData && vaultDataource === 'OP Boost') {
		return (
			<div className={'col-span-12 mt-0'}>
				<div
					className={cl('w-full bg-neutral-900 rounded-lg p-6 text-neutral-0', isV3Page ? 'rounded-lg' : '')}>
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

	if (hasVaultData && vaultDataource === 'VeYFI') {
		return (
			<div className={'col-span-12 mt-0'}>
				<div
					className={cl('w-full bg-neutral-900 rounded-lg p-6 text-neutral-0', isV3Page ? 'rounded-lg' : '')}>
					<b className={'text-lg'}>{'Yield is good, but more yield is good-er!'}</b>
					<div className={'mt-2 flex flex-col gap-2'}>
						<p>
							{`This Vault has an active veYFI gauge which boosts your APR from ${formatAmount(extraAPR * 10)}% to ${formatAmount(extraAPR * 100)}%. Simply deposit and stake to start earning.`}
						</p>
						<p className={'block'}>
							{'Learn more about veYFI rewards in the '}
							<a
								className={'underline'}
								href={'https://docs.yearn.fi/getting-started/products/veyfi'}
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

	if (hasVaultData && vaultDataource === 'Juiced') {
		return (
			<div className={'col-span-12 mt-0'}>
				<div
					className={cl('w-full bg-neutral-900 rounded-lg p-6 text-neutral-0', isV3Page ? 'rounded-lg' : '')}>
					<b className={'text-lg'}>{'Yield is good, but more yield is good-er!'}</b>
					<div className={'mt-2 flex flex-col gap-2'}>
						<p>
							{`This Vault can be juiced for even more yield. Simply deposit and stake to receive juiced APRs of ${formatAmount(extraAPR * 100)}%.`}
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
	return <span />;
}

/**************************************************************************************************
 ** The RewardsTab component will display the staking rewards data for the current vault. It will
 ** allow the user to stake, unstake, and claim rewards from the staking rewards contract.
 ** Based on the staking source, the UI might change a bit to display the correct information.
 *************************************************************************************************/
export function RewardsTab({
	currentVault,
	hasStakingRewardsLive
}: {
	currentVault: TYDaemonVault;
	hasStakingRewardsLive: boolean;
}): ReactElement {
	const {provider, isActive} = useWeb3();
	const {getPrice} = useYearn();
	const {vaultData, updateVaultData} = useVaultStakingData({currentVault});
	const rewardTokenBalance = useYearnToken({address: vaultData.rewardsToken, chainID: currentVault.chainID});
	const [approveStakeStatus, set_approveStakeStatus] = useState(defaultTxStatus);
	const [stakeStatus, set_stakeStatus] = useState(defaultTxStatus);
	const [claimStatus, set_claimStatus] = useState(defaultTxStatus);
	const [unstakeStatus, set_unstakeStatus] = useState(defaultTxStatus);
	const isApproved = vaultData.vaultAllowance.raw >= vaultData.vaultBalanceOf.raw;

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
			chainID: currentVault.chainID,
			contractAddress: currentVault.address,
			spenderAddress: toAddress(vaultData?.address),
			amount: vaultData.vaultBalanceOf.raw,
			statusHandler: set_approveStakeStatus
		});
		if (result.isSuccessful) {
			updateVaultData();
		}
	}, [currentVault, provider, updateVaultData, vaultData?.address, vaultData.vaultBalanceOf.raw]);

	/**********************************************************************************************
	 ** The onStake function will be called when the user clicks the "Stake" button. It will call
	 ** the stakeAction function to stake the user's yVault tokens into the staking rewards
	 ** contract. If the stake is successful, the user's balances and staking rewards data will be
	 ** refreshed.
	 ** Depending on the staking source, we will use either the stake function or the
	 ** stakeVeYFIGauge function.
	 *********************************************************************************************/
	const onStake = useCallback(async (): Promise<void> => {
		if (currentVault.staking.source === 'VeYFI') {
			const result = await stakeVeYFIAction({
				connector: provider,
				chainID: currentVault.chainID,
				contractAddress: toAddress(vaultData?.address),
				amount: vaultData.vaultBalanceOf.raw,
				statusHandler: set_stakeStatus
			});
			if (result.isSuccessful) {
				refreshData();
				updateVaultData();
			}
		} else {
			const result = await stakeAction({
				connector: provider,
				chainID: currentVault.chainID,
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
		currentVault.staking.source,
		currentVault.chainID,
		provider,
		vaultData?.address,
		vaultData.vaultBalanceOf.raw,
		refreshData,
		updateVaultData
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
		if (currentVault.staking.source === 'VeYFI') {
			const result = await unstakeVeYFIAction({
				connector: provider,
				chainID: currentVault.chainID,
				contractAddress: toAddress(vaultData?.address),
				amount: vaultData.stakedBalanceOf.raw,
				willClaim: true,
				statusHandler: set_unstakeStatus
			});
			if (result.isSuccessful) {
				refreshData();
				updateVaultData();
			}
		} else {
			const result = await unstakeAction({
				connector: provider,
				chainID: currentVault.chainID,
				contractAddress: toAddress(vaultData?.address),
				statusHandler: set_unstakeStatus
			});
			if (result.isSuccessful) {
				refreshData();
				updateVaultData();
			}
		}
	}, [
		currentVault.staking.source,
		currentVault.chainID,
		provider,
		vaultData?.address,
		vaultData.stakedBalanceOf.raw,
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
			chainID: currentVault.chainID,
			contractAddress: toAddress(vaultData?.address),
			statusHandler: set_claimStatus
		});
		if (result.isSuccessful) {
			refreshData();
		}
	}, [provider, refreshData, vaultData?.address, currentVault.chainID]);

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
		() => getPrice({address: currentVault.address, chainID: currentVault.chainID}),
		[getPrice, currentVault]
	);

	return (
		<>
			<div className={'flex flex-col gap-6 bg-neutral-100 p-4 md:gap-4 md:p-8'}>
				<BoostMessage
					hasStakingRewardsLive={hasStakingRewardsLive}
					currentVault={currentVault}
				/>

				<div className={'flex flex-col gap-2'}>
					<div>
						<div className={'font-bold'}>{'Stake'}</div>
					</div>
					<div className={'flex flex-col gap-4 md:flex-row'}>
						<FakeInput
							className={'w-full md:w-1/3'}
							legend={
								<div className={'flex items-center justify-between'}>
									<p>{`${formatAmount(vaultData.vaultBalanceOf.normalized, 6)} ${currentVault.symbol} available to stake`}</p>
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

						<Button
							className={'w-full md:w-[200px]'}
							onClick={(): unknown => (isApproved ? onStake() : onApprove())}
							isBusy={stakeStatus.pending || approveStakeStatus.pending}
							isDisabled={
								!isActive || toBigInt(vaultData.vaultBalanceOf.raw) <= 0n || !hasStakingRewardsLive
							}>
							{isApproved ? 'Stake' : 'Approve'}
						</Button>
					</div>
				</div>
				<div className={'flex flex-col gap-2'}>
					<div>
						<div className={'font-bold'}>{'Claim Rewards'}</div>
					</div>
					<div className={'flex flex-col gap-4 md:flex-row'}>
						<FakeInput
							className={'w-full md:w-1/3'}
							legend={
								<div className={'flex items-center justify-between'}>
									<p>{`${formatAmount(vaultData.stakedEarned.normalized, 6)} ${rewardTokenBalance.symbol || 'yvOP'} available to claim`}</p>
									<p>{`${formatCounterValue(vaultData.stakedEarned.normalized, rewardTokenPrice.normalized)}`}</p>
								</div>
							}
							value={
								toBigInt(vaultData.stakedEarned.raw) === 0n ? undefined : (
									<Counter
										value={Number(vaultData.stakedEarned.normalized)}
										decimals={18}
									/>
								)
							}
						/>
						<Button
							className={'w-full md:w-[200px]'}
							onClick={onUnstake}
							isBusy={unstakeStatus.pending}
							isDisabled={!isActive || Number(vaultData.stakedBalanceOf.normalized) <= 0}>
							{'Claim & Exit'}
						</Button>
						<Button
							className={'w-full md:w-[200px]'}
							onClick={onClaim}
							isBusy={claimStatus.pending}
							isDisabled={!isActive || isZero(vaultData.stakedEarned.raw)}>
							{'Claim'}
						</Button>
					</div>
				</div>
			</div>
		</>
	);
}
