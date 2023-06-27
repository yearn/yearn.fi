import {useCallback, useState} from 'react';
import {useContractRead} from 'wagmi';
import {useStakingRewards} from '@vaults/contexts/useStakingRewards';
import {claim as claimAction, stake as stakeAction, unstake as unstakeAction} from '@vaults/utils/actions';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import VAULT_ABI from '@yearn-finance/web-lib/utils/abi/vault.abi';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ZERO_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format';
import {formatCounterValue} from '@yearn-finance/web-lib/utils/format.value';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';
import {Input} from '@common/components/Input';
import {useWallet} from '@common/contexts/useWallet';
import {useBalance} from '@common/hooks/useBalance';
import {approveERC20} from '@common/utils/actions';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';

const DISPLAY_DECIMALS = 10;
const trimAmount = (amount: string | number): string => Number(Number(amount).toFixed(DISPLAY_DECIMALS)).toString();

function RewardsTab({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const {provider, address, isActive} = useWeb3();
	const {chainID} = useChainID();
	const {refresh: refreshBalances} = useWallet();
	const {stakingRewardsByVault, stakingRewardsMap, positionsMap, refresh: refreshStakingRewards} = useStakingRewards();
	const stakingRewardsAddress = stakingRewardsByVault[currentVault.address];
	const stakingRewards = stakingRewardsAddress ? stakingRewardsMap[stakingRewardsAddress] : undefined;
	const stakingRewardsPosition = stakingRewardsAddress ? positionsMap[stakingRewardsAddress] : undefined;
	const vaultBalance = useBalance(currentVault.address);
	const rewardTokenBalance = useBalance(toAddress(stakingRewards?.rewardsToken));
	const [approveStakeStatus, set_approveStakeStatus] = useState(defaultTxStatus);
	const [stakeStatus, set_stakeStatus] = useState(defaultTxStatus);
	const [claimStatus, set_claimStatus] = useState(defaultTxStatus);
	const [unstakeStatus, set_unstakeStatus] = useState(defaultTxStatus);
	const stakeBalance = toNormalizedBN(toBigInt(stakingRewardsPosition?.stake), currentVault.decimals);
	const rewardBalance = toNormalizedBN(toBigInt(stakingRewardsPosition?.reward), rewardTokenBalance.decimals);
	const {data: allowance, isLoading, refetch} = useContractRead({
		address: currentVault.address,
		abi: VAULT_ABI,
		chainId: chainID,
		functionName: 'allowance',
		args: [toAddress(address), toAddress(stakingRewards?.address)],
		enabled: toAddress(stakingRewards?.address) !== ZERO_ADDRESS
	});
	const isApproved = toBigInt(allowance) >= toBigInt(vaultBalance.raw);

	const refreshData = useCallback(async (): Promise<void> => {
		await Promise.all([refreshBalances(), refreshStakingRewards()]);
	}, [refreshBalances, refreshStakingRewards]);

	const onApprove = useCallback(async (): Promise<void> => {
		const result = await approveERC20({
			connector: provider,
			contractAddress: currentVault.address,
			spenderAddress: toAddress(stakingRewards?.address),
			amount: vaultBalance.raw,
			statusHandler: set_approveStakeStatus
		});
		if (result.isSuccessful) {
			refetch();
		}
	}, [currentVault.address, provider, refetch, stakingRewards?.address, vaultBalance.raw]);

	const onStake = useCallback(async (): Promise<void> => {
		const result = await stakeAction({
			connector: provider,
			contractAddress: toAddress(stakingRewards?.address),
			amount: vaultBalance.raw,
			statusHandler: set_stakeStatus
		});
		if (result.isSuccessful) {
			refreshData();
		}
	}, [provider, refreshData, stakingRewards?.address, vaultBalance.raw]);

	const onUnstake = useCallback(async (): Promise<void> => {
		const result = await unstakeAction({
			connector: provider,
			contractAddress: toAddress(stakingRewards?.address),
			statusHandler: set_unstakeStatus
		});
		if (result.isSuccessful) {
			refreshData();
		}
	}, [provider, refreshData, stakingRewards?.address]);

	const onClaim = useCallback(async (): Promise<void> => {
		const result = await claimAction({
			connector: provider,
			contractAddress: toAddress(stakingRewards?.address),
			statusHandler: set_claimStatus
		});
		if (result.isSuccessful) {
			refreshData();
		}
	}, [provider, refreshData, stakingRewards?.address]);

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
						legend={formatCounterValue(vaultBalance.normalized, vaultBalance.normalizedPrice || 0)}
						value={`${trimAmount(vaultBalance.normalized)} ${currentVault.symbol}`}
						isDisabled />
					<Button
						className={'w-full md:mt-7 md:w-[168px]'}
						onClick={(): unknown => isApproved ? onStake() : onApprove()}
						isBusy={stakeStatus.pending || approveStakeStatus.pending || isLoading}
						isDisabled={!isActive || isLoading || Number(vaultBalance.normalized) <= 0}>
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
						legend={formatCounterValue(rewardBalance.normalized, rewardTokenBalance.normalizedPrice || 0)}
						value={`${trimAmount(rewardBalance.normalized)} ${rewardTokenBalance.symbol || 'yvOP'}`}
						isDisabled />
					<Button
						className={'w-full md:mt-7 md:w-[168px]'}
						onClick={onClaim}
						isBusy={claimStatus.pending}
						isDisabled={!isActive || isZero(rewardBalance.raw)}>
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
						legend={formatCounterValue(stakeBalance.normalized, vaultBalance.normalizedPrice || 0)}
						value={`${trimAmount(stakeBalance.normalized)} ${currentVault.symbol}`}
						isDisabled />
					<Button
						className={'w-full md:mt-7 md:w-[168px]'}
						onClick={onUnstake}
						isBusy={unstakeStatus.pending}
						isDisabled={!isActive || Number(stakeBalance.normalized) <= 0 }>
						{'Unstake + Claim'}
					</Button>
				</div>
			</div>
		</div>
	);
}

export {RewardsTab};
