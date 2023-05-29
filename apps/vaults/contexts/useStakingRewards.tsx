import React, {createContext, memo, useCallback, useContext, useMemo} from 'react';
import {useRouter} from 'next/router';
import {Contract} from 'ethcall';
import useSWR from 'swr';
import STAKING_REWARDS_ABI from '@vaults/utils/abi/stakingRewards.abi';
import STAKING_REWARDS_REGISTRY_ABI from '@vaults/utils/abi/stakingRewardsRegistry.abi';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {STAKING_REWARDS_REGISTRY_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
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
}

export type TStakePosition = {
	address: TAddress,
	stake: BigNumber,
	reward: BigNumber,
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
	const {chainID: appChainID} = useChainID();
	const router = useRouter();
	const routeChainID = Number(router.query.chainID || '0');
	const chainID = routeChainID || appChainID;
	const isChainSupported = [10].includes(chainID);

	const stakingRewardsFetcher = useCallback(async (): Promise<TStakingRewards[]> => {
		const currentProvider = provider || getProvider(chainID);
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
	}, [chainID, provider]);
	const {data: stakingRewards, mutate: refreshStakingRewards, isLoading: isLoadingStakingRewards} = useSWR(isChainSupported ? 'stakingRewards' : null, stakingRewardsFetcher, {shouldRetryOnError: false});

	const positionsFetcher = useCallback(async (): Promise<TStakePosition[]> => {
		if (!stakingRewards || !isActive|| !userAddress) {
			return [];
		}
		const currentProvider = provider || getProvider(chainID);
		const ethcallProvider = await newEthCallProvider(currentProvider);

		const	calls = [];
		for (const {address} of stakingRewards) {
			const stakingRewardsContract = new Contract(address, STAKING_REWARDS_ABI);
			calls.push(stakingRewardsContract.balanceOf(userAddress));
			calls.push(stakingRewardsContract.earned(userAddress));
		}
		const results = await ethcallProvider.tryAll(calls) as BigNumber[];

		let	resultIndex = 0;
		const	positionPromises = [];
		for (const {address} of stakingRewards) {
			const stake = results[resultIndex++];
			const reward = results[resultIndex++];
			positionPromises.push({address, stake, reward});
		}

		return positionPromises;
	}, [stakingRewards, isActive, userAddress, chainID, provider]);
	const {data: positions, mutate: refreshPositions, isLoading: isLoadingPositions} = useSWR(isActive && provider && stakingRewards ? 'stakePositions' : null, positionsFetcher, {shouldRetryOnError: false});

	const positionsMap = useMemo((): TDict<TStakePosition | undefined> => {
		return keyBy(positions ?? [], 'address');
	}, [positions]);

	const refresh = useCallback((): void => {
		refreshStakingRewards();
		refreshPositions();
	}, [refreshPositions, refreshStakingRewards]);

	const contextValue = useMemo((): TStakingRewardsContext => ({
		stakingRewardsByVault: stakingRewards?.reduce((map, {address, stakingToken}): TDict<TAddress> => ({...map, [stakingToken]: address}), {}) ?? {},
		stakingRewardsMap: keyBy(stakingRewards ?? [], 'address'),
		positionsMap,
		isLoading: isLoadingStakingRewards || isLoadingPositions,
		refresh
	}), [stakingRewards, positionsMap, isLoadingStakingRewards, isLoadingPositions, refresh]);

	return (
		<StakingRewardsContext.Provider value={contextValue}>
			{children}
		</StakingRewardsContext.Provider>
	);
});

export const useStakingRewards = (): TStakingRewardsContext => useContext(StakingRewardsContext);
export default useStakingRewards;
