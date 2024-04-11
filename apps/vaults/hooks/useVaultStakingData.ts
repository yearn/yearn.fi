import {useEffect} from 'react';
import {erc20Abi} from 'viem';
import {useBlockNumber, useReadContracts} from 'wagmi';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {isZeroAddress, toAddress, toBigInt} from '@builtbymom/web3/utils';
import {STAKING_REWARDS_ABI} from '@vaults/utils/abi/stakingRewards.abi';
import {VEYFI_GAUGE_ABI} from '@vaults/utils/abi/veYFIGauge.abi.ts';

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
export function useVaultStakingData(props: {currentVault: TYDaemonVault}): [TStakingInfo, VoidFunction] {
	const {address} = useWeb3();
	const {data: blockNumber} = useBlockNumber({watch: true});
	const stakingType = props.currentVault.staking.source as 'OP Boost' | 'VeYFI';

	const {data, refetch} = useReadContracts({
		contracts: [
			{
				address: toAddress(props.currentVault.staking.address),
				chainId: props.currentVault.chainID,
				abi: stakingType === 'OP Boost' ? STAKING_REWARDS_ABI : VEYFI_GAUGE_ABI,
				functionName: stakingType === 'OP Boost' ? 'stakingToken' : 'asset'
			},
			{
				address: toAddress(props.currentVault.staking.address),
				chainId: props.currentVault.chainID,
				abi: stakingType === 'OP Boost' ? STAKING_REWARDS_ABI : VEYFI_GAUGE_ABI,
				functionName: stakingType === 'OP Boost' ? 'rewardsToken' : 'REWARD_TOKEN'
			},
			{
				address: toAddress(props.currentVault.staking.address),
				abi: STAKING_REWARDS_ABI,
				chainId: props.currentVault.chainID,
				functionName: 'totalSupply'
			},
			{
				address: toAddress(props.currentVault.staking.address),
				abi: STAKING_REWARDS_ABI,
				chainId: props.currentVault.chainID,
				functionName: 'balanceOf',
				args: [toAddress(address)]
			},
			{
				address: toAddress(props.currentVault.staking.address),
				abi: STAKING_REWARDS_ABI,
				chainId: props.currentVault.chainID,
				functionName: 'earned',
				args: [toAddress(address)]
			},
			{
				address: toAddress(props.currentVault.address),
				abi: erc20Abi,
				chainId: props.currentVault.chainID,
				functionName: 'allowance',
				args: [toAddress(address), toAddress(props.currentVault.staking.address)]
			}
		],
		query: {
			enabled: props.currentVault.staking.available
		}
	});

	useEffect(() => {
		refetch();
	}, [blockNumber, refetch]);

	return [
		{
			address: toAddress(props.currentVault.staking.address),
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
