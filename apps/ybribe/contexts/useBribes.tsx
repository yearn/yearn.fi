import {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {useContractRead} from 'wagmi';
import {multicall, prepareWriteContract} from '@wagmi/core';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {allowanceKey, toAddress} from '@yearn-finance/web-lib/utils/address';
import {CURVE_BRIBE_V3_ADDRESS, CURVE_BRIBE_V3_HELPER_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {decodeAsBigInt} from '@yearn-finance/web-lib/utils/decoder';
import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import {useCurve} from '@common/contexts/useCurve';
import {getLastThursday, getNextThursday} from '@yBribe/utils';
import CURVE_BRIBE_V3 from '@yBribe/utils/abi/curveBribeV3.abi';
import CURVE_BRIBE_V3_HELPER from '@yBribe/utils/abi/curveBribeV3Helper.abi';

import type {TAddress, TDict, VoidPromiseFunction} from '@yearn-finance/web-lib/types';
import type {TCurveGaugeVersionRewards} from '@common/types/curves';
import type {PrepareWriteContractResult} from '@wagmi/core';

export type	TBribesContext = {
	currentRewards: TCurveGaugeVersionRewards,
	nextRewards: TCurveGaugeVersionRewards,
	claimable: TCurveGaugeVersionRewards,
	currentPeriod: number,
	nextPeriod: number,
	isLoading: boolean,
	refresh: VoidPromiseFunction
}
const defaultProps: TBribesContext = {
	currentRewards: {},
	nextRewards: {},
	claimable: {},
	currentPeriod: 0,
	nextPeriod: 0,
	isLoading: true,
	refresh: async (): Promise<void> => undefined
};

const BribesContext = createContext<TBribesContext>(defaultProps);
export const BribesContextApp = ({children}: {children: React.ReactElement}): React.ReactElement => {
	const {gauges} = useCurve();
	const {address} = useWeb3();
	const {safeChainID} = useChainID();
	const [currentRewards, set_currentRewards] = useState<TCurveGaugeVersionRewards>({});
	const [nextRewards, set_nextRewards] = useState<TCurveGaugeVersionRewards>({});
	const [claimable, set_claimable] = useState<TCurveGaugeVersionRewards>({});
	const [isLoading, set_isLoading] = useState<boolean>(true);
	const [currentPeriod, set_currentPeriod] = useState<number>(getLastThursday());
	const [nextPeriod, set_nextPeriod] = useState<number>(getNextThursday());
	const bribeV3BaseContract = useMemo((): {address: TAddress, abi: typeof CURVE_BRIBE_V3} => ({
		address: CURVE_BRIBE_V3_ADDRESS,
		abi: CURVE_BRIBE_V3
	}), []);

	const {data: _currentPeriod} = useContractRead({
		...bribeV3BaseContract,
		functionName: 'current_period',
		chainId: 1
	});

	/* 🔵 - Yearn Finance ******************************************************
	** getSharedStuffFromBribes will help you retrieved some elements from the
	**  Bribe contracts, not related to the user.
	***************************************************************************/
	useEffect((): void => {
		performBatchedUpdates((): void => {
			set_currentPeriod(Number(_currentPeriod));
			set_nextPeriod(Number(_currentPeriod) + (86400 * 7));
		});
	}, [_currentPeriod]);

	/* 🔵 - Yearn Finance ******************************************************
	**	getBribes will call the bribeV2 contract to get all the rewards
	**	per gauge.
	***************************************************************************/
	const getRewardsPerGauges = useCallback(async (): Promise<TDict<TAddress[]>> => {
		const rewardsPerGaugesCalls = [];
		for (const gauge of gauges) {
			rewardsPerGaugesCalls.push({
				...bribeV3BaseContract,
				functionName: 'rewards_per_gauge',
				args: [gauge.gauge]
			});
		}
		const result = await multicall({contracts: rewardsPerGaugesCalls, chainId: safeChainID});
		const rewardsPerGauges: TDict<TAddress[]> = {};
		let resultIndex = 0;
		for (const gauge of gauges) {
			const item = result[resultIndex++];
			if (item.status === 'failure') {
				continue;
			}
			const rewardsTokensAddresses = item.result as TAddress[];
			if (isZero(rewardsTokensAddresses.length)) {
				continue;
			}
			rewardsPerGauges[gauge.gauge.toString()] = rewardsTokensAddresses;
		}
		return rewardsPerGauges;
	}, [bribeV3BaseContract, gauges, safeChainID]);

	/* 🔵 - Yearn Finance ******************************************************
	**	getRewardsPerUser will help you retrieved the claimable and rewards
	** 	elements from the Bribe contracts, related to the user for a specific
	** 	list of gauges/tokens.
	***************************************************************************/
	type TGetRewardsPerUser = {
		gaugeAddress: TAddress,
		tokenAddress: TAddress,
		rewardPerToken: bigint,
		activePeriod: bigint,
		claimable: bigint,
		claimRewardFor: bigint
	}
	const getRewardsPerUser = useCallback(async (
		rewardsPerGauges: TDict<TAddress[]>
	): Promise<TDict<TGetRewardsPerUser>> => {
		const userAddress = toAddress(address);
		const rewardsPerTokensPerGaugesCalls = [];
		const rewardsList: string[] = [];

		for (const [gaugeAddress, rewardsTokens] of Object.entries(rewardsPerGauges)) {
			for (const tokenAsReward of rewardsTokens) {
				const args = [toAddress(gaugeAddress), toAddress(tokenAsReward)];
				rewardsList.push(allowanceKey(
					safeChainID,
					toAddress(gaugeAddress),
					tokenAsReward,
					userAddress
				));
				rewardsPerTokensPerGaugesCalls.push(...[
					{...bribeV3BaseContract, functionName: 'reward_per_token', args: args},
					{...bribeV3BaseContract, functionName: 'active_period', args: args},
					{...bribeV3BaseContract, functionName: 'claimable', args: [userAddress, ...args]}
				]);
			}
		}

		const rewards: TDict<TGetRewardsPerUser> = {};
		const result = await multicall({contracts: rewardsPerTokensPerGaugesCalls, chainId: safeChainID});
		let resultIndex = 0;
		for (const [gaugeAddress, rewardsTokens] of Object.entries(rewardsPerGauges)) {
			for (const tokenAsReward of rewardsTokens) {
				const prepareWriteResult = await prepareWriteContract({
					...bribeV3BaseContract,
					functionName: 'claim_reward_for',
					args: [userAddress, toAddress(gaugeAddress), toAddress(tokenAsReward)]
				});
				rewards[gaugeAddress] = {
					gaugeAddress: toAddress(gaugeAddress),
					tokenAddress: toAddress(tokenAsReward),
					rewardPerToken: decodeAsBigInt(result[resultIndex++]),
					activePeriod: decodeAsBigInt(result[resultIndex++]),
					claimable: decodeAsBigInt(result[resultIndex++]),
					claimRewardFor: prepareWriteResult.result
				};
			}
		}

		return rewards;
	}, [address, safeChainID, bribeV3BaseContract]);

	/* 🔵 - Yearn Finance ******************************************************
	**	getNextPeriodRewards will help you retrieved the the reward_per_gauge
	** 	and the claims_per_gauge elements from the Bribe V3 contracts to be
	** 	able to calculate the next period rewards.
	***************************************************************************/
	type TGetNextPeriodRewards = {
		gaugeAddress: TAddress,
		tokenAddress: TAddress,
		nextRewards: bigint,
	}
	const getNextPeriodRewards = useCallback(async (
		rewardsPerGauges: TDict<TAddress[]>
	): Promise<TDict<TGetNextPeriodRewards>> => {
		const rewardsPerTokensPerGaugesCalls: Promise<PrepareWriteContractResult>[] = [];

		for (const [gaugeAddress, rewardsTokens] of Object.entries(rewardsPerGauges)) {
			for (const tokenAsReward of rewardsTokens) {
				rewardsPerTokensPerGaugesCalls.push(
					prepareWriteContract({
						address: CURVE_BRIBE_V3_HELPER_ADDRESS,
						abi: CURVE_BRIBE_V3_HELPER,
						functionName: 'getNewRewardPerToken',
						args: [toAddress(gaugeAddress), tokenAsReward]
					})
				);
			}
		}

		const result = await Promise.all(rewardsPerTokensPerGaugesCalls);
		const multicallResult: TDict<TGetNextPeriodRewards> = {};
		let resultIndex = 0;
		for (const [gaugeAddress, rewardsTokens] of Object.entries(rewardsPerGauges)) {
			for (const tokenAsReward of rewardsTokens) {
				multicallResult[gaugeAddress] = {
					gaugeAddress: toAddress(gaugeAddress),
					tokenAddress: toAddress(tokenAsReward),
					nextRewards: toBigInt(result[resultIndex++].result as bigint)
				};
			}
		}

		return multicallResult;
	}, []);

	/* 🔵 - Yearn Finance ******************************************************
	**	assignBribes will save the currentRewards,  periods and clamable values
	** 	for each gauge/token to the state to be used by the UI.
	***************************************************************************/
	const assignBribes = useCallback(async (
		rewards: TDict<TGetRewardsPerUser>
	): Promise<void> => {
		const _currentRewards: TDict<TDict<bigint>> = {};
		const _claimable: TDict<TDict<bigint>> = {};
		const _periods: TDict<TDict<bigint>> = {};
		for (const [gaugeAddress, rewardData] of Object.entries(rewards)) {
			const {tokenAddress, rewardPerToken, activePeriod, claimRewardFor} = rewardData;
			if (!_currentRewards[gaugeAddress]) {
				_currentRewards[gaugeAddress] = {};
				_periods[gaugeAddress] = {};
				_claimable[gaugeAddress] = {};
			}
			_currentRewards[gaugeAddress][tokenAddress] = rewardPerToken;
			_periods[gaugeAddress][tokenAddress] = activePeriod;
			_claimable[gaugeAddress][tokenAddress] = claimRewardFor;
		}
		set_currentRewards(_currentRewards);
		set_claimable(_claimable);
		set_isLoading(false);
	}, []);

	/* 🔵 - Yearn Finance ******************************************************
	**	assignNextRewards will save the next period rewards values for each
	**	gauge/token to the state to be used by the UI.
	***************************************************************************/
	const assignNextRewards = useCallback(async (
		nextPeriodRewards: TDict<TGetNextPeriodRewards>
	): Promise<void> => {
		const _nextRewards: TDict<TDict<bigint>> = {};
		for (const [gaugeAddress, rewardData] of Object.entries(nextPeriodRewards)) {
			const {tokenAddress, nextRewards} = rewardData;
			if (!_nextRewards[gaugeAddress]) {
				_nextRewards[gaugeAddress] = {};
			}
			_nextRewards[gaugeAddress][tokenAddress] = nextRewards;
		}

		set_nextRewards(_nextRewards);
	}, []);

	/* 🔵 - Yearn Finance ******************************************************
	**	getBribes will start the process to retrieve the bribe information.
	***************************************************************************/
	const getBribes = useCallback(async (): Promise<void> => {
		const rewardsPerGauges = await getRewardsPerGauges();
		const [rewardsPerUser, nextPeriodRewards] = await Promise.all([
			getRewardsPerUser(rewardsPerGauges),
			getNextPeriodRewards(rewardsPerGauges)
		]);

		performBatchedUpdates((): void => {
			assignBribes(rewardsPerUser);
			assignNextRewards(nextPeriodRewards);
		});
		return;
	}, [getRewardsPerGauges, getRewardsPerUser, getNextPeriodRewards, assignBribes, assignNextRewards]);
	useEffect((): void => {
		getBribes();
	}, [getBribes]);

	const onRefresh = useCallback(async (): Promise<void> => {
		await getBribes();
	}, [getBribes]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const contextValue = useMemo((): TBribesContext => ({
		currentRewards: currentRewards || {},
		nextRewards: nextRewards || {},
		claimable: claimable || {},
		isLoading: isLoading,
		currentPeriod,
		nextPeriod,
		refresh: onRefresh
	}), [currentRewards, nextRewards, claimable, isLoading, currentPeriod, nextPeriod, onRefresh]);

	return (
		<BribesContext.Provider value={contextValue}>
			{children}
		</BribesContext.Provider>
	);
};


export const useBribes = (): TBribesContext => useContext(BribesContext);
export default useBribes;
