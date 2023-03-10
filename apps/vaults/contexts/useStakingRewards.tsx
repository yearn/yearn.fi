import React, {createContext, memo, useCallback, useContext, useMemo} from 'react';
import {Contract} from 'ethcall';
import useSWR from 'swr';
import {STAKING_REWARDS_REGISTRY_ADDRESS, STAKING_REWARDS_SUPPORTED_CHAINS} from '@vaults/constants';
import STAKING_REWARDS_ABI from '@vaults/utils/abi/stakingRewards.abi';
import STAKING_REWARDS_REGISTRY_ABI from '@vaults/utils/abi/stakingRewardsRegistry.abi';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {formatBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {getProvider, newEthCallProvider} from '@yearn-finance/web-lib/utils/web3/providers';
import {keyBy} from '@common/utils';

import type {BigNumber} from 'ethers';
import type {ReactElement} from 'react';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';

export type TStakingRewards = {
	address: TAddress,
	stakingToken: TAddress,
	rewardsToken: TAddress,
	totalStaked: BigNumber,
	// apy?: number;
}

export type TStakePosition = {
	address: TAddress,
	stake: BigNumber,
	reward: BigNumber,
	earned: BigNumber,
}

export type	TStakingRewardsContext = {
	stakingRewardsByVault: TDict<TAddress | undefined>,
	stakingRewardsMap: TDict<TStakingRewards | undefined>,
	positionsMap: TDict<TStakePosition | undefined>,
	earningsMap: TDict<BigNumber | undefined>,
	isLoading: boolean,
	refresh: () => void,
}

const defaultProps: TStakingRewardsContext = {
	stakingRewardsByVault: {},
	stakingRewardsMap: {},
	positionsMap: {},
	earningsMap: {},
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

		const stakingRewardsRegistryContract = new Contract(STAKING_REWARDS_REGISTRY_ADDRESS, STAKING_REWARDS_REGISTRY_ABI);
		const [numTokens] = await ethcallProvider.tryAll([stakingRewardsRegistryContract.numTokens()]) as [BigNumber];
		const tokensCalls = [];
		for (let i = 0; i < numTokens.toNumber(); i++) {
			tokensCalls.push(stakingRewardsRegistryContract.tokens(i));
		}
		const vaultAddresses = await ethcallProvider.tryAll(tokensCalls) as TAddress[];
		const stakingPoolCalls = [];
		for (const address of vaultAddresses) {
			stakingPoolCalls.push(stakingRewardsRegistryContract.stakingPool(address));
		}
		const stakingRewardsAddresses = await ethcallProvider.tryAll(stakingPoolCalls) as TAddress[];
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
		if (!stakingRewards || !isActive|| !userAddress) {
			return [];
		}
		const currentProvider = getProvider(chainID);
		const ethcallProvider = await newEthCallProvider(currentProvider);

		const	calls = [];
		for (const {address} of stakingRewards) {
			const stakingRewardsContract = new Contract(address, STAKING_REWARDS_ABI);
			calls.push(stakingRewardsContract.balanceOf(userAddress));
			calls.push(stakingRewardsContract.rewards(userAddress));
			calls.push(stakingRewardsContract.earned(userAddress));
		}
		const results = await ethcallProvider.tryAll(calls) as BigNumber[];

		let	resultIndex = 0;
		const	positionPromises = [];
		for (const {address} of stakingRewards) {
			const stake = results[resultIndex++];
			const reward = results[resultIndex++];
			const earned = results[resultIndex++];
			positionPromises.push({address, stake, reward, earned});
		}
		
		return positionPromises;
	}, [stakingRewards, isActive, userAddress, chainID]);
	const {data: positions, mutate: refreshPositions, isLoading: isLoadingPositions} = useSWR(isActive && provider && stakingRewards ? 'stakePositions' : null, positionsFetcher, {shouldRetryOnError: false});

	const positionsMap = useMemo((): TDict<TStakePosition | undefined> => {
		return keyBy(positions ?? [], 'address');
	}, [positions]);

	const earningsMap = useMemo((): TDict<BigNumber | undefined> => {
		if (!stakingRewards) {
			return {};
		}

		return stakingRewards.reduce<TDict<BigNumber | undefined>>((acc, {address, stakingToken}): TDict<BigNumber | undefined> => {
			const earnedBalance = formatBN(positionsMap[address]?.earned);
			acc[stakingToken] = formatBN(acc[stakingToken]).add(earnedBalance);
			return acc;
		}, {});
	}, [stakingRewards, positionsMap]);

	const refresh = useCallback((): void => {
		refreshStakingRewards();
		refreshPositions();
	}, [refreshPositions, refreshStakingRewards]);

	const contextValue = useMemo((): TStakingRewardsContext => ({
		stakingRewardsByVault: stakingRewards?.reduce((map, {address, stakingToken}): TDict<TAddress> => ({...map, [stakingToken]: address}), {}) ?? {},
		stakingRewardsMap: keyBy(stakingRewards ?? [], 'address'),
		positionsMap,
		earningsMap,
		isLoading: isLoadingStakingRewards || isLoadingPositions,
		refresh
	}), [stakingRewards, positionsMap, earningsMap, isLoadingStakingRewards, isLoadingPositions, refresh]);

	return (
		<StakingRewardsContext.Provider value={contextValue}>
			{children}
		</StakingRewardsContext.Provider>
	);
});

export const useStakingRewards = (): TStakingRewardsContext => useContext(StakingRewardsContext);
export default useStakingRewards;
