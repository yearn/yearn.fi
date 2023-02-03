import React, {createContext, memo, useCallback, useContext, useMemo} from 'react';
import {Contract} from 'ethcall';
import useSWR from 'swr';
import {STAKING_REWARDS_ADDRESSES, STAKING_REWARDS_SUPPORTED_CHAINS} from '@vaults/constants';
import STAKING_REWARDS_ABI from '@vaults/utils/abi/stakingRewards.abi';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {getProvider, newEthCallProvider} from '@yearn-finance/web-lib/utils/web3/providers';
import {keyBy} from '@common/utils';

import type {BigNumber} from 'ethers';
import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';
import type {TDict} from '@yearn-finance/web-lib/utils/types';

export type TStakingRewards = {
	address: TAddress,
	stakingToken: TAddress,
	rewardsToken: TAddress,
	totalStaked: BigNumber,
	// apy?: number;
}

export type TPosition = {
	balance: BigNumber,
	underlyingBalance: BigNumber,
}

export type TStakePosition = {
	address: TAddress,
	stake: TPosition,
	reward: TPosition,
}

export type	TStakingRewardsContext = {
	stakingRewardsByVault: TDict<TAddress | undefined>,
	stakingRewardsMap: TDict<TStakingRewards | undefined>,
	positionsMap: TDict<TStakePosition | undefined>,
	isLoading: boolean,
	refresh: () => void,
}

const defaultProps: TStakingRewardsContext = {
	stakingRewardsByVault: {},
	stakingRewardsMap: {},
	positionsMap: {},
	isLoading: true,
	refresh: (): void => undefined
};

const StakingRewardsContext = createContext<TStakingRewardsContext>(defaultProps);
export const StakingRewardsContextApp = memo(function StakingRewardsContextApp({children}: {children: ReactElement}): ReactElement {
	const {provider, address: userAddress, isActive} = useWeb3();
	const {chainID} = useChainID();
	const isChainSupported = STAKING_REWARDS_SUPPORTED_CHAINS.includes(chainID);

	const stakingRewardsFetcher = useCallback(async (): Promise<TStakingRewards[]> => {
		const currentProvider = getProvider(chainID);
		const ethcallProvider = await newEthCallProvider(currentProvider);

		// const stakingRewardsRegistryContract = new Contract(STAKING_REWARDS_REGISTRY_ADDRESS, []); // TODO: update once abi is available
		// const [stakingRewardsAddresses] = await ethcallProvider.tryAll([stakingRewardsRegistryContract.getAddresses()]) as [TAddress[]]; // TODO: call correct method
		const stakingRewardsAddresses = STAKING_REWARDS_ADDRESSES;
		const stakingRewardsPromises = stakingRewardsAddresses.map(async (address): Promise<TStakingRewards> => {
			const stakingRewardsContract = new Contract(address, STAKING_REWARDS_ABI);
			const [
				stakingToken,
				rewardsToken,
				totalSupply
			] = await ethcallProvider.tryAll([
				stakingRewardsContract.stakingToken(),
				stakingRewardsContract.rewardsToken(),
				stakingRewardsContract.totalSupply()
			]) as [TAddress, TAddress, BigNumber];
			
			return ({
				address,
				stakingToken,
				rewardsToken,
				totalStaked: totalSupply
			});
		});
		return Promise.all(stakingRewardsPromises);
	}, [chainID]);
	const {data: stakingRewards, mutate: refreshStakingRewards, isLoading: isLoadingStakingRewards} = useSWR(isChainSupported ? 'stakingRewards' : null, stakingRewardsFetcher, {shouldRetryOnError: false});

	const positionsFetcher = useCallback(async (): Promise<TStakePosition[]> => {
		if (!stakingRewards|| !isActive|| !userAddress) {
			return [];
		}
		const currentProvider = getProvider(chainID);
		const ethcallProvider = await newEthCallProvider(currentProvider);

		const positionPromises = stakingRewards.map(async ({address}): Promise<TStakePosition> => {
			const stakingRewardsContract = new Contract(address, STAKING_REWARDS_ABI);
			const [balance, rewards] = await ethcallProvider.tryAll([stakingRewardsContract.balanceOf(userAddress), stakingRewardsContract.rewards(userAddress)]) as [BigNumber, BigNumber];
			
			const stakePosition: TPosition = {
				balance,
				underlyingBalance: balance
			};

			const rewardPosition: TPosition = {
				balance: rewards,
				underlyingBalance: rewards
			};

			return {
				address,
				stake: stakePosition,
				reward: rewardPosition
			};
		});
		return Promise.all(positionPromises);
	}, [stakingRewards, isActive, userAddress, chainID]);
	const {data: positions, mutate: refreshPositions, isLoading: isLoadingPositions} = useSWR(isActive && provider && stakingRewards ? 'gaugePositions' : null, positionsFetcher, {shouldRetryOnError: false});

	const refresh = useCallback((): void => {
		refreshStakingRewards();
		refreshPositions();
	}, [refreshPositions, refreshStakingRewards]);

	const contextValue = useMemo((): TStakingRewardsContext => ({
		stakingRewardsByVault: stakingRewards?.reduce((map, {address, stakingToken}): TDict<TAddress> => ({...map, [stakingToken]: address}), {}) ?? {},
		stakingRewardsMap: keyBy(stakingRewards ?? [], 'address'),
		positionsMap: keyBy(positions ?? [], 'address'),
		isLoading: isLoadingStakingRewards || isLoadingPositions,
		refresh
	}), [stakingRewards, positions, isLoadingStakingRewards, isLoadingPositions, refresh]);

	return (
		<StakingRewardsContext.Provider value={contextValue}>
			{children}
		</StakingRewardsContext.Provider>
	);
});

export const useStakingRewards = (): TStakingRewardsContext => useContext(StakingRewardsContext);
export default useStakingRewards;
