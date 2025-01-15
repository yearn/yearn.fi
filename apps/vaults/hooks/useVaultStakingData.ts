import {useEffect, useState} from 'react';
import {erc20Abi, zeroAddress} from 'viem';
import {useBlockNumber} from 'wagmi';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {useAsyncTrigger} from '@builtbymom/web3/hooks/useAsyncTrigger';
import {
	decodeAsAddress,
	decodeAsBigInt,
	decodeAsNumber,
	isZeroAddress,
	toAddress,
	toBigInt,
	toNormalizedBN,
	zeroNormalizedBN
} from '@builtbymom/web3/utils';
import {retrieveConfig} from '@builtbymom/web3/utils/wagmi';
import {JUICED_STAKING_REWARDS_ABI} from '@vaults/utils/abi/juicedStakingRewards.abi';
import {STAKING_REWARDS_ABI} from '@vaults/utils/abi/stakingRewards.abi';
import {V3_STAKING_REWARDS_ABI} from '@vaults/utils/abi/V3StakingRewards.abi';
import {VEYFI_GAUGE_ABI} from '@vaults/utils/abi/veYFIGauge.abi';
import {readContract, readContracts} from '@wagmi/core';

import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TAddress, TNormalizedBN} from '@builtbymom/web3/types';

type TStakingInfo = {
	address: TAddress;
	stakingToken: TAddress;
	rewardsToken: TAddress;
	rewardDecimals: number | undefined;
	stakingDecimals: number | undefined;
	totalStaked: TNormalizedBN;
	stakedBalanceOf: TNormalizedBN;
	stakedEarned: TNormalizedBN;
	vaultAllowance: TNormalizedBN;
	vaultBalanceOf: TNormalizedBN;
};
export function useVaultStakingData(props: {currentVault: TYDaemonVault}): {
	vaultData: TStakingInfo;
	updateVaultData: VoidFunction;
} {
	const {address} = useWeb3();
	const {data: blockNumber} = useBlockNumber({watch: true});
	const stakingType = props.currentVault.staking.source as 'OP Boost' | 'VeYFI' | 'Juiced' | 'V3 Staking';
	const [vaultData, set_vaultData] = useState<TStakingInfo>({
		address: toAddress(props.currentVault.staking.address),
		stakingToken: toAddress(''),
		rewardsToken: toAddress(''),
		rewardDecimals: undefined,
		stakingDecimals: undefined,
		totalStaked: zeroNormalizedBN,
		stakedBalanceOf: zeroNormalizedBN,
		stakedEarned: zeroNormalizedBN,
		vaultAllowance: zeroNormalizedBN,
		vaultBalanceOf: zeroNormalizedBN
	});

	/**********************************************************************************************
	 ** The refetch function is a trigger that will be called whenever the user wants to refresh
	 ** the data. It will fetch the most up-to-date data from the blockchain and update the state.
	 *********************************************************************************************/
	const refetch = useAsyncTrigger(async () => {
		if (!props.currentVault.staking.available) {
			return;
		}

		let stakingToken: TAddress = zeroAddress;
		let rewardsToken: TAddress = zeroAddress;
		let totalStaked = 0n;
		let balanceOf = 0n;
		let earned = 0n;
		let allowance = 0n;
		let vaultBalanceOf = 0n;
		/******************************************************************************************
		 ** To have the most up-to-date data, we fetch a few informations directly onChain, such as:
		 ** - the staking token
		 ** - the rewards token
		 ** - the total staked amount in the staking contract
		 ** - the user's balance in the staking contract
		 ** - the user's earned amount in the staking contract
		 ** - the user's allowance for the vault token to be spent by the staking contract
		 ** - the user's balance in the vault contract
		 ******************************************************************************************/
		if (stakingType === 'OP Boost' || stakingType === 'VeYFI') {
			const data = await readContracts(retrieveConfig(), {
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
					},
					{
						address: toAddress(props.currentVault.address),
						abi: erc20Abi,
						chainId: props.currentVault.chainID,
						functionName: 'balanceOf',
						args: [toAddress(address)]
					}
				]
			});
			stakingToken = decodeAsAddress(data[0]);
			rewardsToken = decodeAsAddress(data[1]);
			totalStaked = decodeAsBigInt(data[2]);
			balanceOf = isZeroAddress(address) ? 0n : decodeAsBigInt(data[3]);
			earned = isZeroAddress(address) ? 0n : decodeAsBigInt(data[4]);
			allowance = isZeroAddress(address) ? 0n : decodeAsBigInt(data[5]);
			vaultBalanceOf = isZeroAddress(address) ? 0n : decodeAsBigInt(data[6]);
		} else if (stakingType === 'Juiced') {
			const data = await readContracts(retrieveConfig(), {
				contracts: [
					{
						address: toAddress(props.currentVault.staking.address),
						chainId: props.currentVault.chainID,
						abi: JUICED_STAKING_REWARDS_ABI,
						functionName: 'stakingToken'
					},
					{
						address: toAddress(props.currentVault.staking.address),
						chainId: props.currentVault.chainID,
						abi: JUICED_STAKING_REWARDS_ABI,
						functionName: 'rewardTokens',
						args: [0n]
					},
					{
						address: toAddress(props.currentVault.staking.address),
						abi: JUICED_STAKING_REWARDS_ABI,
						chainId: props.currentVault.chainID,
						functionName: 'totalSupply'
					},
					{
						address: toAddress(props.currentVault.staking.address),
						abi: JUICED_STAKING_REWARDS_ABI,
						chainId: props.currentVault.chainID,
						functionName: 'balanceOf',
						args: [toAddress(address)]
					},
					{
						address: toAddress(props.currentVault.address),
						abi: erc20Abi,
						chainId: props.currentVault.chainID,
						functionName: 'allowance',
						args: [toAddress(address), toAddress(props.currentVault.staking.address)]
					},
					{
						address: toAddress(props.currentVault.address),
						abi: erc20Abi,
						chainId: props.currentVault.chainID,
						functionName: 'balanceOf',
						args: [toAddress(address)]
					}
				]
			});
			stakingToken = decodeAsAddress(data[0]);
			rewardsToken = decodeAsAddress(data[1]);
			totalStaked = decodeAsBigInt(data[2]);
			balanceOf = isZeroAddress(address) ? 0n : decodeAsBigInt(data[3]);
			allowance = isZeroAddress(address) ? 0n : decodeAsBigInt(data[4]);
			vaultBalanceOf = isZeroAddress(address) ? 0n : decodeAsBigInt(data[5]);

			const earnedRaw = await readContract(retrieveConfig(), {
				address: toAddress(props.currentVault.staking.address),
				abi: JUICED_STAKING_REWARDS_ABI,
				chainId: props.currentVault.chainID,
				functionName: 'earned',
				args: [toAddress(address), rewardsToken]
			});
			earned = isZeroAddress(address) ? 0n : earnedRaw;
		} else if (stakingType === 'V3 Staking') {
			const rewardTokensLength = await readContract(retrieveConfig(), {
				address: toAddress(props.currentVault.staking.address),
				chainId: props.currentVault.chainID,
				abi: V3_STAKING_REWARDS_ABI,
				functionName: 'rewardTokensLength'
			});

			const rewardTokensCalls = [] as any[];
			for (let i = 0; i < Number(rewardTokensLength); i++) {
				rewardTokensCalls.push({
					address: toAddress(props.currentVault.staking.address),
					chainId: props.currentVault.chainID,
					abi: V3_STAKING_REWARDS_ABI,
					functionName: 'rewardTokens',
					args: [toBigInt(i)]
				});
			}
			const data = await readContracts(retrieveConfig(), {
				contracts: [
					{
						address: toAddress(props.currentVault.staking.address),
						chainId: props.currentVault.chainID,
						abi: V3_STAKING_REWARDS_ABI,
						functionName: 'stakingToken'
					},
					{
						address: toAddress(props.currentVault.staking.address),
						abi: V3_STAKING_REWARDS_ABI,
						chainId: props.currentVault.chainID,
						functionName: 'totalSupply'
					},
					{
						address: toAddress(props.currentVault.staking.address),
						abi: V3_STAKING_REWARDS_ABI,
						chainId: props.currentVault.chainID,
						functionName: 'balanceOf',
						args: [toAddress(address)]
					},
					{
						address: toAddress(props.currentVault.address),
						abi: erc20Abi,
						chainId: props.currentVault.chainID,
						functionName: 'allowance',
						args: [toAddress(address), toAddress(props.currentVault.staking.address)]
					},
					{
						address: toAddress(props.currentVault.address),
						abi: erc20Abi,
						chainId: props.currentVault.chainID,
						functionName: 'balanceOf',
						args: [toAddress(address)]
					},
					...rewardTokensCalls
				]
			});
			stakingToken = decodeAsAddress(data[0]);
			totalStaked = decodeAsBigInt(data[1]);
			balanceOf = isZeroAddress(address) ? 0n : decodeAsBigInt(data[2]);
			allowance = isZeroAddress(address) ? 0n : decodeAsBigInt(data[3]);
			vaultBalanceOf = isZeroAddress(address) ? 0n : decodeAsBigInt(data[4]);
			rewardsToken = decodeAsAddress(data[5]);

			const earnedRaw = await readContract(retrieveConfig(), {
				address: toAddress(props.currentVault.staking.address),
				abi: V3_STAKING_REWARDS_ABI,
				chainId: props.currentVault.chainID,
				functionName: 'earned',
				args: [toAddress(address), rewardsToken]
			});
			earned = isZeroAddress(address) ? 0n : earnedRaw;
		}

		/******************************************************************************************
		 ** Some extra elements are required at this point to be able to display a comprehensive
		 ** view of the user's holdings in the vault: we need to know what is the reward token. This
		 ** means we need to retrieve the token's symbol and decimals.
		 ******************************************************************************************/
		const decimalsResult = await readContracts(retrieveConfig(), {
			contracts: [
				{
					address: rewardsToken,
					abi: erc20Abi,
					chainId: props.currentVault.chainID,
					functionName: 'decimals'
				},
				{
					address: stakingToken,
					abi: erc20Abi,
					chainId: props.currentVault.chainID,
					functionName: 'decimals'
				}
			]
		});
		const rewardDecimals = decodeAsNumber(decimalsResult[0]);
		const stakingDecimals = decodeAsNumber(decimalsResult[1]);

		set_vaultData({
			address: toAddress(props.currentVault.staking.address),
			stakingToken,
			rewardsToken,
			rewardDecimals,
			stakingDecimals,
			totalStaked: toNormalizedBN(totalStaked, stakingDecimals),
			stakedBalanceOf: toNormalizedBN(balanceOf, stakingDecimals),
			stakedEarned: toNormalizedBN(earned, rewardDecimals),
			vaultAllowance: toNormalizedBN(allowance, props.currentVault.decimals),
			vaultBalanceOf: toNormalizedBN(vaultBalanceOf, props.currentVault.decimals)
		});
	}, [
		address,
		props.currentVault.address,
		props.currentVault.chainID,
		props.currentVault.decimals,
		props.currentVault.staking.address,
		props.currentVault.staking.available,
		stakingType
	]);

	useEffect(() => {
		refetch();
	}, [blockNumber, refetch]);

	return {
		vaultData,
		updateVaultData: refetch
	};
}
