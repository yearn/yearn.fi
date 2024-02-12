import {useCallback, useState} from 'react';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {formatCounterValue, isZero, toAddress, toBigInt, toNormalizedBN} from '@builtbymom/web3/utils';
import {defaultTxStatus} from '@builtbymom/web3/utils/wagmi';
import {useVaultStakingData} from '@vaults/hooks/useVaultStakingData';
import {claim as claimAction, stake as stakeAction, unstake as unstakeAction} from '@vaults/utils/actions';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useYearnWallet} from '@yearn-finance/web-lib/contexts/useYearnWallet';
import {useYearnToken} from '@yearn-finance/web-lib/hooks/useYearnToken';
import {Input} from '@common/components/Input';
import {approveERC20} from '@common/utils/actions';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';

export function RewardsTab({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const {provider, isActive} = useWeb3();
	const {onRefresh: refreshBalances} = useYearnWallet();
	const [stakingRewards, updateStakingRewards] = useVaultStakingData({currentVault});
	const vaultToken = useYearnToken({address: currentVault.address, chainID: currentVault.chainID});
	const rewardTokenBalance = useYearnToken({address: stakingRewards.rewardsToken, chainID: currentVault.chainID});
	const normalizedStakeBalance = toNormalizedBN(stakingRewards.balanceOf, currentVault.decimals);
	const normalizedRewardBalance = toNormalizedBN(stakingRewards.earned, rewardTokenBalance.decimals);

	const [approveStakeStatus, set_approveStakeStatus] = useState(defaultTxStatus);
	const [stakeStatus, set_stakeStatus] = useState(defaultTxStatus);
	const [claimStatus, set_claimStatus] = useState(defaultTxStatus);
	const [unstakeStatus, set_unstakeStatus] = useState(defaultTxStatus);

	const isApproved = toBigInt(stakingRewards.allowance) >= vaultToken.balance.raw;

	const refreshData = useCallback(async (): Promise<void> => {
		await Promise.all([refreshBalances(), updateStakingRewards()]);
	}, [refreshBalances, updateStakingRewards]);

	const onApprove = useCallback(async (): Promise<void> => {
		const result = await approveERC20({
			connector: provider,
			chainID: currentVault.chainID,
			contractAddress: currentVault.address,
			spenderAddress: toAddress(stakingRewards?.address),
			amount: vaultToken.balance.raw,
			statusHandler: set_approveStakeStatus
		});
		if (result.isSuccessful) {
			updateStakingRewards();
		}
	}, [currentVault, provider, updateStakingRewards, stakingRewards?.address, vaultToken.balance.raw]);

	const onStake = useCallback(async (): Promise<void> => {
		const result = await stakeAction({
			connector: provider,
			chainID: vaultToken.chainID,
			contractAddress: toAddress(stakingRewards?.address),
			amount: vaultToken.balance.raw,
			statusHandler: set_stakeStatus
		});
		if (result.isSuccessful) {
			refreshData();
		}
	}, [provider, refreshData, stakingRewards?.address, vaultToken]);

	const onUnstake = useCallback(async (): Promise<void> => {
		const result = await unstakeAction({
			connector: provider,
			chainID: currentVault.chainID,
			contractAddress: toAddress(stakingRewards?.address),
			statusHandler: set_unstakeStatus
		});
		if (result.isSuccessful) {
			refreshData();
		}
	}, [provider, refreshData, stakingRewards?.address, currentVault.chainID]);

	const onClaim = useCallback(async (): Promise<void> => {
		const result = await claimAction({
			connector: provider,
			chainID: currentVault.chainID,
			contractAddress: toAddress(stakingRewards?.address),
			statusHandler: set_claimStatus
		});
		if (result.isSuccessful) {
			refreshData();
		}
	}, [provider, refreshData, stakingRewards?.address, currentVault.chainID]);

	return (
		<>
			<div className={'flex flex-col gap-6 bg-neutral-100 p-4 md:gap-10 md:p-8'}>
				<div className={'flex flex-col gap-4'}>
					<div>
						<div className={'font-bold'}>{'Stake'}</div>
						<div className={'mt-2 text-neutral-600'}>
							<p>{'Stake your yVault tokens for additional $OP rewards.'}</p>
						</div>
					</div>
					<div className={'flex flex-col gap-4 md:flex-row'}>
						<Input
							className={'w-full md:w-1/3'}
							label={`You have unstaked, ${currentVault.symbol}`}
							legend={formatCounterValue(
								vaultToken.balance.normalized,
								Number(vaultToken.price.normalized)
							)}
							value={`${Number(vaultToken.balance.normalized).toFixed(vaultToken.decimals)}`}
							// value={`${trimAmount(vaultToken.balance.normalized)} ${currentVault.symbol}`}
							isDisabled
						/>
						<Button
							className={'w-full md:mt-7 md:w-[200px]'}
							onClick={(): unknown => (isApproved ? onStake() : onApprove())}
							isBusy={stakeStatus.pending || approveStakeStatus.pending}
							isDisabled={
								!isActive ||
								Number(vaultToken.balance.normalized) <= 0 ||
								stakingRewards.allowance > vaultToken.balance.raw
							}>
							{isApproved ? 'Stake' : 'Approve'}
						</Button>
					</div>
				</div>
				<div className={'flex flex-col gap-4'}>
					<div>
						<div className={'font-bold'}>{'Claim'}</div>
						<div className={'mt-2 text-neutral-600'}>
							<p>{"Claim your staking rewards here. You've earned it anon."}</p>
						</div>
					</div>
					<div className={'flex flex-col gap-4 md:flex-row'}>
						<Input
							className={'w-full md:w-1/3'}
							label={`You have unclaimed, ${rewardTokenBalance.symbol || 'yvOP'}`}
							legend={formatCounterValue(
								normalizedRewardBalance.normalized,
								Number(rewardTokenBalance.price.normalized)
							)}
							value={`${Number(normalizedRewardBalance.normalized).toFixed(rewardTokenBalance.decimals)}`}
							// value={`${trimAmount(normalizedRewardBalance.normalized)}`}
							isDisabled
						/>
						<Button
							className={'w-full md:mt-7 md:w-[200px]'}
							onClick={onClaim}
							isBusy={claimStatus.pending}
							isDisabled={!isActive || isZero(normalizedRewardBalance.raw)}>
							{'Claim'}
						</Button>
					</div>
				</div>
				<div className={'flex flex-col gap-4'}>
					<div>
						<div className={'font-bold'}>{'Unstake'}</div>
						<div className={'mt-2 text-neutral-600'}>
							<p>
								{
									'Unstake your yVault tokens and your remaining $OP rewards will be claimed automatically. Boom.'
								}
							</p>
						</div>
					</div>
					<div className={'flex flex-col gap-4 md:flex-row'}>
						<Input
							className={'w-full md:w-1/3'}
							label={`You have staked, ${currentVault.symbol}`}
							legend={formatCounterValue(
								normalizedStakeBalance.normalized,
								Number(vaultToken.price.normalized)
							)}
							value={`${Number(normalizedStakeBalance.normalized).toFixed(vaultToken.decimals)}`}
							isDisabled
						/>
						<Button
							className={'w-full md:mt-7 md:w-[200px]'}
							onClick={onUnstake}
							isBusy={unstakeStatus.pending}
							isDisabled={!isActive || Number(normalizedStakeBalance.normalized) <= 0}>
							{'Unstake + Claim'}
						</Button>
					</div>
				</div>
			</div>
		</>
	);
}
