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
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TYearnVault} from '@common/types/yearn';

const DISPLAY_DECIMALS = 10;
const trimAmount = (amount: string | number): string => Number(Number(amount).toFixed(DISPLAY_DECIMALS)).toString(); 

function RewardsTab({currentVault}: {currentVault: TYearnVault}): ReactElement {
	const {provider, address, isActive} = useWeb3();
	const {refresh: refreshBalances} = useWallet();
	const {stakingRewardsByVault, stakingRewardsMap, positionsMap, refresh: refreshStakingRewards} = useStakingRewards();
	const stakingRewardsAddress = stakingRewardsByVault[currentVault.address];
	const stakingRewards = stakingRewardsAddress ? stakingRewardsMap[stakingRewardsAddress] : undefined;
	const stakingRewardsPosition = stakingRewardsAddress ? positionsMap[stakingRewardsAddress] : undefined;
	const vaultBalance = useBalance(currentVault.address);
	const rewardTokenBalance = useBalance(toAddress(stakingRewards?.rewardsToken));
	const [allowances, isLoadingAllowances, refreshAllowances] = useAllowances([{token: currentVault.address, spender: stakingRewards?.address}]);
	const refreshData = (): unknown => Promise.all([refreshBalances(), refreshStakingRewards()]);
	const [approveStake, approveStakeStatus] = useTransaction(StakingRewardsActions.approveStake, refreshAllowances);
	const [stake, stakeStatus] = useTransaction(StakingRewardsActions.stake, refreshData);
	const [unstake, unstakeStatus] = useTransaction(StakingRewardsActions.unstake, refreshData);
	const [claim, claimStatus] = useTransaction(StakingRewardsActions.claim, refreshData);

	const web3Provider = provider as ethers.providers.Web3Provider;
	const userAddress = address as TAddress;
	const stakeBalance = toNormalizedBN(stakingRewardsPosition?.stake ?? 0, currentVault.decimals);
	const rewardBalance = toNormalizedBN(stakingRewardsPosition?.reward ?? 0, rewardTokenBalance.decimals);

	const {isValid: isApproved} = validateAllowance({
		tokenAddress: currentVault.address,
		spenderAddress: toAddress(stakingRewardsAddress),
		allowances,
		amount: vaultBalance.raw
	});

	async function onApproveStake(): Promise<void> {
		approveStake(web3Provider, userAddress, currentVault.address, toAddress(stakingRewards?.address));
	}

	async function onStake(): Promise<void> {
		stake(web3Provider, userAddress, toAddress(stakingRewards?.address), vaultBalance.raw);
	}

	async function onUnstake(): Promise<void> {
		unstake(web3Provider, userAddress, toAddress(stakingRewards?.address));
	}

	async function onClaim(): Promise<void> {
		claim(web3Provider, userAddress, toAddress(stakingRewards?.address));
	}

	return (
		<div className={'flex flex-col gap-6 bg-neutral-100 p-4 md:gap-10 md:p-8'}>
			<div className={'flex flex-col gap-4'}>
				<div>
					<div className={'font-bold'}>
						{'Stake'}
					</div>
					<div className={'mt-2 text-neutral-600'} >
						<p>{'Stake your yVault tokens for additional $OP rewards.'}</p>
					</div>
				</div>
				<div className={'flex flex-col gap-4 md:flex-row'}>
					<Input
						className={'w-full md:w-[216px]'}
						label={'You have unstaked'}
						legend={formatCounterValue(vaultBalance.normalized, vaultBalance.normalizedPrice)}
						value={`${trimAmount(vaultBalance.normalized)} ${currentVault.symbol}`}
						isDisabled
					/>
					<Button
						className={'w-full md:mt-7 md:w-[168px]'}
						onClick={isApproved ? onStake : onApproveStake}
						isBusy={stakeStatus.loading || approveStakeStatus.loading || isLoadingAllowances}
						isDisabled={!isActive || isLoadingAllowances || vaultBalance.normalized <= 0 }
					>
						{isApproved ? 'Stake' : 'Approve'}
					</Button>
				</div>
			</div>
			<div className={'flex flex-col gap-4'}>
				<div>
					<div className={'font-bold'}>
						{'Claim'}
					</div>
					<div className={'mt-2 text-neutral-600'} >
						<p>{'Claim your staking rewards here. You\'ve earned it anon.'}</p>
					</div>
				</div>
				<div className={'flex flex-col gap-4 md:flex-row'}>
					<Input
						className={'w-full md:w-[216px]'}
						label={'You have unclaimed'}
						legend={formatCounterValue(rewardBalance.normalized, rewardTokenBalance.normalizedPrice)}
						value={`${trimAmount(rewardBalance.normalized)} ${rewardTokenBalance.symbol}`}
						isDisabled
					/>
					<Button
						className={'w-full md:mt-7 md:w-[168px]'}
						onClick={onClaim}
						isBusy={claimStatus.loading}
						isDisabled={!isActive || rewardBalance.normalized <= 0}
					>
						{'Claim'}
					</Button>
				</div>
			</div>
			<div className={'flex flex-col gap-4'}>
				<div>
					<div className={'font-bold'}>
						{'Unstake'}
					</div>
					<div className={'mt-2 text-neutral-600'} >
						<p>{'Unstake your yVault tokens and your remaining $OP rewards will be claimed automatically. Boom.'}</p>
					</div>
				</div>
				<div className={'flex flex-col gap-4 md:flex-row'}>
					<Input
						className={'w-full md:w-[216px]'}
						label={'You have staked'}
						legend={formatCounterValue(stakeBalance.normalized, vaultBalance.normalizedPrice)}
						value={`${trimAmount(stakeBalance.normalized)} ${currentVault.symbol}`}
						isDisabled
					/>
					<Button
						className={'w-full md:mt-7 md:w-[168px]'}
						onClick={onUnstake}
						isBusy={unstakeStatus.loading}
						isDisabled={!isActive || stakeBalance.normalized <= 0 }
					>
						{'Unstake + Claim'}
					</Button>
				</div>
			</div>
		</div>
	);
}

export {RewardsTab};
