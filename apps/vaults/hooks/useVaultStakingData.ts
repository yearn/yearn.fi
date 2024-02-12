import {erc20ABI, useContractReads} from 'wagmi';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {isZeroAddress, toAddress, toBigInt} from '@builtbymom/web3/utils';
import {STAKING_REWARDS_ABI} from '@vaults/utils/abi/stakingRewards.abi';

import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TAddress} from '@builtbymom/web3/types';

type TStakingInfo = {
	address: TAddress;
	stakingToken: TAddress;
	rewardsToken: TAddress;
	totalStaked: bigint;
	balanceOf: bigint;
	earned: bigint;
	allowance: bigint;
};
export function useVaultStakingData({currentVault}: {currentVault: TYDaemonVault}): [TStakingInfo, VoidFunction] {
	const {address} = useWeb3();
	const {data, refetch} = useContractReads({
		contracts: [
			{
				address: toAddress(currentVault.staking.address),
				abi: STAKING_REWARDS_ABI,
				chainId: currentVault.chainID,
				functionName: 'stakingToken'
			},
			{
				address: toAddress(currentVault.staking.address),
				abi: STAKING_REWARDS_ABI,
				chainId: currentVault.chainID,
				functionName: 'rewardsToken'
			},
			{
				address: toAddress(currentVault.staking.address),
				abi: STAKING_REWARDS_ABI,
				chainId: currentVault.chainID,
				functionName: 'totalSupply'
			},
			{
				address: toAddress(currentVault.staking.address),
				abi: STAKING_REWARDS_ABI,
				chainId: currentVault.chainID,
				functionName: 'balanceOf',
				args: [toAddress(address)]
			},
			{
				address: toAddress(currentVault.staking.address),
				abi: STAKING_REWARDS_ABI,
				chainId: currentVault.chainID,
				functionName: 'earned',
				args: [toAddress(address)]
			},
			{
				address: toAddress(currentVault.address),
				abi: erc20ABI,
				chainId: currentVault.chainID,
				functionName: 'allowance',
				args: [toAddress(address), toAddress(currentVault.staking.address)]
			}
		],
		enabled: currentVault.staking.available
	});

	return [
		{
			address: toAddress(currentVault.staking.address),
			stakingToken: toAddress(data?.[0].result),
			rewardsToken: toAddress(data?.[1].result),
			totalStaked: toBigInt(data?.[2].result),
			balanceOf: isZeroAddress(address) ? 0n : toBigInt(data?.[3].result),
			earned: isZeroAddress(address) ? 0n : toBigInt(data?.[4].result),
			allowance: isZeroAddress(address) ? 0n : toBigInt(data?.[5].result)
		},
		refetch
	];
}
