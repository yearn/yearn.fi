import {createContext, memo, useCallback, useContext, useMemo} from 'react';
import {useRouter} from 'next/router';
import useSWR from 'swr';
import {STACKING_TO_VAULT, VAULT_TO_STACKING} from '@vaults/constants/optRewards';
import STAKING_REWARDS_ABI from '@vaults/utils/abi/stakingRewards.abi';
import STAKING_REWARDS_REGISTRY_ABI from '@vaults/utils/abi/stakingRewardsRegistry.abi';
import {multicall} from '@wagmi/core';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {STAKING_REWARDS_REGISTRY_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {decodeAsBigInt, decodeAsString} from '@yearn-finance/web-lib/utils/decoder';
import {keyBy} from '@common/utils';

import type {ReactElement} from 'react';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';

export type TStakingRewards = {
	address: TAddress,
	stakingToken: TAddress,
	rewardsToken: TAddress,
	totalStaked: bigint,
}
export type TStakePosition = {
	address: TAddress,
	stake: bigint,
	reward: bigint,
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
		/* 🔵 - Yearn Finance **********************************************************************
		** Base wagmi contract struct ready to use in the viem functions call
		******************************************************************************************/
		const baseContract = {
			address: STAKING_REWARDS_REGISTRY_ADDRESS,
			abi: STAKING_REWARDS_REGISTRY_ABI,
			chainId: chainID
		} as const;

		/* 🔵 - Yearn Finance **********************************************************************
		** Retrieve the number of tokens in the registry, and for each token retrieve it's address
		** so we can proceed
		******************************************************************************************/
		// const numTokens = await readContract({...baseContract, functionName: 'numTokens'});
		// const tokensCalls = [];
		// for (let i = 0; i < numTokens; i++) {
		// 	tokensCalls.push({...baseContract, functionName: 'tokens', args: [i]});
		// }
		// const vaultAddressesMulticall = await multicall({contracts: tokensCalls, chainId: chainID});

		/* 🔵 - Yearn Finance **********************************************************************
		** For each address of token, retrieve the related stacking pool address
		******************************************************************************************/
		// const stakingPoolCalls = [];
		// for (const vaultAddressMulticall of vaultAddressesMulticall) {
		// 	if (vaultAddressMulticall.status === 'success') {
		// 		const address = decodeAsString(vaultAddressMulticall);
		// 		stakingPoolCalls.push({...baseContract, functionName: 'stakingPool', args: [address]});
		// 	}
		// }

		const stakingPoolCalls = [];
		const stackingAddresses = Object.values(VAULT_TO_STACKING);
		for (const stackingAddress of stackingAddresses) {
			stakingPoolCalls.push({...baseContract, functionName: 'stakingPool', args: [stackingAddress]});
		}
		const stakingRewardsAddresses = await multicall({contracts: stakingPoolCalls, chainId: chainID});

		/* 🔵 - Yearn Finance **********************************************************************
		** For each stakingRewardsAddresses, grab the info in a multicall
		******************************************************************************************/
		const stackingRewards: TStakingRewards[] = [];
		for (const stakingRewardsAddress of stakingRewardsAddresses) {
			if (stakingRewardsAddress.status === 'success') {
				const address = decodeAsString(stakingRewardsAddress);
				const baseStackingContract = {
					address: toAddress(address),
					abi: STAKING_REWARDS_ABI,
					chainId: chainID
				};
				const results = await multicall({
					contracts: [
						{...baseStackingContract, functionName: 'stakingToken'},
						{...baseStackingContract, functionName: 'rewardsToken'},
						{...baseStackingContract, functionName: 'totalSupply'}
					],
					chainId: chainID
				});

				const stakingToken = decodeAsString(results[0]);
				const rewardsToken = decodeAsString(results[1]);
				const totalSupply = decodeAsBigInt(results[2]);
				stackingRewards.push({
					address: toAddress(address),
					stakingToken: toAddress(stakingToken),
					rewardsToken: toAddress(rewardsToken),
					totalStaked: totalSupply
				});
			}
		}

		return stackingRewards;
	}, [chainID]);
	const {data: stakingRewards, mutate: refreshStakingRewards, isLoading: isLoadingStakingRewards} = useSWR(isChainSupported ? 'stakingRewards' : null, stakingRewardsFetcher, {shouldRetryOnError: false});

	const positionsFetcher = useCallback(async (): Promise<TStakePosition[]> => {
		if (!stakingRewards || !isActive|| !userAddress) {
			return [];
		}
		/* 🔵 - Yearn Finance **********************************************************************
		** Retrieve the number of tokens in the registry, and for each token retrieve it's address
		** so we can proceed
		******************************************************************************************/
		const calls = [];
		for (const {address} of stakingRewards) {
			const baseContract = {
				address,
				abi: STAKING_REWARDS_ABI,
				chainId: chainID
			} as const;
			calls.push({...baseContract, functionName: 'balanceOf', args: [userAddress]});
			calls.push({...baseContract, functionName: 'earned', args: [userAddress]});
		}
		const results = await multicall({contracts: calls, chainId: chainID});

		let resultIndex = 0;
		const positionPromises = [];
		for (const {address} of stakingRewards) {
			const stake = decodeAsBigInt(results[resultIndex++]);
			const reward = decodeAsBigInt(results[resultIndex++]);
			positionPromises.push({address, stake, reward});
		}

		return positionPromises;
	}, [stakingRewards, isActive, userAddress, chainID]);
	const {data: positions, mutate: refreshPositions, isLoading: isLoadingPositions} = useSWR(isActive && provider && stakingRewards ? 'stakePositions' : null, positionsFetcher, {shouldRetryOnError: false});

	const positionsMap = useMemo((): TDict<TStakePosition | undefined> => {
		return keyBy(positions ?? [], 'address');
	}, [positions]);

	const refresh = useCallback((): void => {
		refreshStakingRewards();
		refreshPositions();
	}, [refreshPositions, refreshStakingRewards]);

	const contextValue = useMemo((): TStakingRewardsContext => ({
		stakingRewardsByVault: STACKING_TO_VAULT,
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
