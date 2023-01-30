import React from 'react';
import {useStakingRewards} from '@vaults/contexts/useStakingRewards';
import * as StakingRewardsActions from '@vaults/utils/actions/stakingRewards';
import {useTransaction} from '@veYFI/hooks/useTransaction'; // TODO: make a common hook
import {validateAllowance} from '@veYFI/utils/validations'; // TODO: make it common
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {toNormalizedBN} from '@yearn-finance/web-lib/utils/format';
import {formatCounterValue} from '@yearn-finance/web-lib/utils/format.value';
import {Input} from '@common/components/Input';
import {useWallet} from '@common/contexts/useWallet';
import {useAllowances} from '@common/hooks/useAllowances';
import {useBalance} from '@common/hooks/useBalance';

import type {ethers} from 'ethers';
import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';
import type {TYearnVault} from '@common/types/yearn';

function RewardsTab({currentVault}: {currentVault: TYearnVault}): ReactElement {
	const {provider, address, isActive} = useWeb3();
	const {refresh: refreshBalances} = useWallet();
	const {stakingRewardsByVault, stakingRewardsMap, positionsMap, refresh: refreshStakingRewards} = useStakingRewards();
	const stakingRewardsAddress = stakingRewardsByVault[currentVault.address];
	const stakingRewards = stakingRewardsAddress ? stakingRewardsMap[stakingRewardsAddress] : undefined;
	const stakingRewardsPosition = stakingRewardsAddress ? positionsMap[stakingRewardsAddress] : undefined;
	const vaultBalance = useBalance(currentVault.address);
	const rewardTokenBalance = useBalance(stakingRewards?.rewardsToken ?? '');
	const [allowances, isLoadingAllowances, refreshAllowances] = useAllowances([{token: currentVault.address, spender: stakingRewards?.address}]);
	const refreshData = (): unknown => Promise.all([refreshBalances(), refreshStakingRewards()]);
	const [approveStake, approveStakeStatus] = useTransaction(StakingRewardsActions.approveStake, refreshAllowances);
	const [stake, stakeStatus] = useTransaction(StakingRewardsActions.stake, refreshData);
	const [unstake, unstakeStatus] = useTransaction(StakingRewardsActions.unstake, refreshData);
	const [claim, claimStatus] = useTransaction(StakingRewardsActions.claim, refreshData);

	const web3Provider = provider as ethers.providers.Web3Provider;
	const userAddress = address as TAddress;
	const stakeBalance = toNormalizedBN(stakingRewardsPosition?.stake.balance ?? 0, currentVault.decimals);
	const rewardBalance = toNormalizedBN(stakingRewardsPosition?.reward.balance ?? 0, currentVault.decimals);

	const {isValid: isApproved} = validateAllowance({
		tokenAddress: currentVault.address,
		spenderAddress: toAddress(stakingRewardsAddress),
		allowances,
		amount: vaultBalance.raw
	});
	
	async function onApproveStake(): Promise<void> {
		if(!stakingRewards) {
			return;
		}
		approveStake(web3Provider, userAddress, currentVault.address, stakingRewards.address);
	}

	async function onStake(): Promise<void> {
		if(!stakingRewards) {
			return;
		}
		stake(web3Provider, userAddress, stakingRewards.address, vaultBalance.raw);
	}

	async function onUnstake(): Promise<void> {
		if(!stakingRewards) {
			return;
		}
		unstake(web3Provider, userAddress, stakingRewards.address);
	}

	async function onClaim(): Promise<void> {
		if(!stakingRewards) {
			return;
		}
		claim(web3Provider, userAddress, stakingRewards.address);
	}

	return (
		<div className={'grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-16'}>
			<div className={'col-span-1 grid w-full gap-6'}>
				<div className={'md:min-h-[104px]'}>
					<h2 className={'m-0 text-2xl font-bold'}>
						{'Stake'}
					</h2>
					<div className={'mt-6 text-neutral-600'} >
						<p>{'You can stake your yVault tokens to get additional $OP BOOST.'}</p>
					</div>
				</div>
				<div className={'grid grid-cols-1 gap-6 md:grid-cols-2'}>
					<Input
						label={'You have unstaked'}
						legend={formatCounterValue(vaultBalance.normalized, vaultBalance.normalizedPrice)}
						value={`${vaultBalance.normalized} ${currentVault.symbol}`}
						disabled
					/>
					<Button
						className={'w-full md:mt-7'}
						onClick={isApproved ? onStake : onApproveStake}
						isBusy={stakeStatus.loading || approveStakeStatus.loading || isLoadingAllowances}
						disabled={!isActive || isLoadingAllowances || vaultBalance.normalized <= 0 }
					>
						{isApproved ? 'Stake' : 'Approve'}
					</Button>	
				</div>
			</div>
			<div className={'col-span-1 grid w-full gap-6'}>
				<div className={'md:min-h-[104px]'}>
					<h2 className={'m-0 text-2xl font-bold'}>
						{'Unstake'}
					</h2>
					<div className={'mt-6 text-neutral-600'} >
						<p>{'You can unstake your yVault tokens. Your remaining rewards will be claimed automatically.'}</p>
					</div>
				</div>
				<div className={'grid grid-cols-1 gap-6 md:grid-cols-2'}>
					<Input
						label={'You have staked'}
						legend={formatCounterValue(stakeBalance.normalized, vaultBalance.normalizedPrice)}
						value={`${stakeBalance.normalized} ${currentVault.symbol}`}
						disabled
					/>
					<Button
						className={'w-full md:mt-7'}
						onClick={onUnstake}
						isBusy={unstakeStatus.loading}
						disabled={!isActive || stakeBalance.normalized <= 0 }
					>
						{'Unstake + Claim'}
					</Button>	
				</div>
			</div>
			<div className={'col-span-1 grid w-full gap-6'}>
				<div>
					<h2 className={'m-0 text-2xl font-bold'}>
						{'Claim'}
					</h2>
					<div className={'mt-6 text-neutral-600'} >
						<p>{'You can claim your rewards for staking.'}</p>
					</div>
				</div>
				<div className={'grid grid-cols-1 gap-6 md:grid-cols-2'}>
					<Input
						label={'You have unclaimed'}
						legend={formatCounterValue(rewardBalance.normalized, rewardTokenBalance.normalizedPrice)}
						value={`${rewardBalance.normalized} ${currentVault.symbol}`}
						disabled
					/>
					<Button
						className={'w-full md:mt-7'}
						onClick={onClaim}
						isBusy={claimStatus.loading}
						disabled={!isActive || rewardBalance.normalized <= 0 }
					>
						{'Claim'}
					</Button>					
				</div>
			</div>
		</div>
	);
}

export {RewardsTab};
