import {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {useAccount, useContractRead} from 'wagmi';
import {multicall, prepareWriteContract} from '@wagmi/core';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {allowanceKey, toAddress} from '@yearn-finance/web-lib/utils/address';
import {CURVE_BRIBE_V3_ADDRESS, CURVE_BRIBE_V3_HELPER_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {decodeAsBigInt} from '@yearn-finance/web-lib/utils/decoder';
import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {useCurve} from '@common/contexts/useCurve';
import {useAsyncTrigger} from '@common/hooks/useAsyncEffect';
import {YBRIBE_SUPPORTED_NETWORK} from '@yBribe/constants/index';
import {getLastThursday, getNextThursday} from '@yBribe/utils';
import {CURVE_BRIBE_V3_ABI} from '@yBribe/utils/abi/curveBribeV3.abi';
import {CURVE_BRIBE_V3_HELPER_ABI} from '@yBribe/utils/abi/curveBribeV3Helper.abi';

import type {TAddress, TDict, VoidPromiseFunction} from '@yearn-finance/web-lib/types';
import type {TCurveGaugeVersionRewards} from '@common/types/curves';
import type {PrepareWriteContractResult} from '@wagmi/core';

export type TBribesContext = {
	currentRewards: TCurveGaugeVersionRewards;
	nextRewards: TCurveGaugeVersionRewards;
	claimable: TCurveGaugeVersionRewards;
	currentPeriod: number;
	nextPeriod: number;
	isLoading: boolean;
	refresh: VoidPromiseFunction;
};
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
	const hasConnector = useAccount().connector !== undefined;
	const {address, isActive} = useWeb3();
	const {gauges} = useCurve();
	const [currentRewards, set_currentRewards] = useState<TCurveGaugeVersionRewards>({});
	const [nextRewards, set_nextRewards] = useState<TCurveGaugeVersionRewards>({});
	const [claimable, set_claimable] = useState<TCurveGaugeVersionRewards>({});
	const [isLoading, set_isLoading] = useState<boolean>(true);
	const [currentPeriod, set_currentPeriod] = useState<number>(getLastThursday());
	const [nextPeriod, set_nextPeriod] = useState<number>(getNextThursday());
	const {data: _currentPeriod} = useContractRead({
		address: CURVE_BRIBE_V3_ADDRESS,
		abi: CURVE_BRIBE_V3_ABI,
		functionName: 'current_period',
		chainId: YBRIBE_SUPPORTED_NETWORK
	});

	/* 🔵 - Yearn Finance ******************************************************
	 ** getSharedStuffFromBribes will help you retrieved some elements from the
	 **  Bribe contracts, not related to the user.
	 ***************************************************************************/
	useEffect((): void => {
		set_currentPeriod(Number(_currentPeriod));
		set_nextPeriod(Number(_currentPeriod) + 86400 * 7);
	}, [_currentPeriod]);

	/* 🔵 - Yearn Finance ******************************************************
	 **	getBribes will call the bribeV2 contract to get all the rewards
	 **	per gauge.
	 ***************************************************************************/
	const getRewardsPerGauges = useCallback(async (): Promise<TDict<TAddress[]>> => {
		const rewardsPerGaugesCalls = [];
		for (const gauge of gauges) {
			rewardsPerGaugesCalls.push({
				address: CURVE_BRIBE_V3_ADDRESS,
				abi: CURVE_BRIBE_V3_ABI,
				chainId: YBRIBE_SUPPORTED_NETWORK,
				functionName: 'rewards_per_gauge',
				args: [gauge.gauge]
			});
		}
		const result = await multicall({
			contracts: rewardsPerGaugesCalls,
			chainId: YBRIBE_SUPPORTED_NETWORK
		});
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
	}, [gauges]);

	/* 🔵 - Yearn Finance ******************************************************
	 **	getRewardsPerUser will help you retrieved the claimable and rewards
	 ** 	elements from the Bribe contracts, related to the user for a specific
	 ** 	list of gauges/tokens.
	 ***************************************************************************/
	type TGetRewardsPerUser = {
		gaugeAddress: TAddress;
		tokenAddress: TAddress;
		rewardPerToken: bigint;
		activePeriod: bigint;
		claimable: bigint;
		claimRewardFor: bigint;
	};
	const getRewardsPerUser = useCallback(
		async (rewardsPerGauges: TDict<TAddress[]>): Promise<TDict<TGetRewardsPerUser>> => {
			if (!isActive) {
				return {};
			}
			const userAddress = toAddress(address);
			const rewardsPerTokensPerGaugesCalls = [];
			const rewardsList: string[] = [];

			for (const [gaugeAddress, rewardsTokens] of Object.entries(rewardsPerGauges)) {
				for (const tokenAsReward of rewardsTokens) {
					const args = [toAddress(gaugeAddress), toAddress(tokenAsReward)];
					rewardsList.push(
						allowanceKey(YBRIBE_SUPPORTED_NETWORK, toAddress(gaugeAddress), tokenAsReward, userAddress)
					);
					rewardsPerTokensPerGaugesCalls.push(
						...[
							{
								address: CURVE_BRIBE_V3_ADDRESS,
								abi: CURVE_BRIBE_V3_ABI,
								functionName: 'reward_per_token',
								args: args
							},
							{
								address: CURVE_BRIBE_V3_ADDRESS,
								abi: CURVE_BRIBE_V3_ABI,
								functionName: 'active_period',
								args: args
							},
							{
								address: CURVE_BRIBE_V3_ADDRESS,
								abi: CURVE_BRIBE_V3_ABI,
								functionName: 'claimable',
								args: [userAddress, ...args]
							}
						]
					);
				}
			}

			const rewards: TDict<TGetRewardsPerUser> = {};
			const result = await multicall({
				contracts: rewardsPerTokensPerGaugesCalls,
				chainId: YBRIBE_SUPPORTED_NETWORK
			});
			let resultIndex = 0;
			for (const [gaugeAddress, rewardsTokens] of Object.entries(rewardsPerGauges)) {
				for (const tokenAsReward of rewardsTokens) {
					try {
						const prepareWriteResult = await prepareWriteContract({
							address: CURVE_BRIBE_V3_ADDRESS,
							abi: CURVE_BRIBE_V3_ABI,
							chainId: YBRIBE_SUPPORTED_NETWORK,
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
					} catch (error) {
						//
					}
				}
			}

			return rewards;
		},
		[address, isActive]
	);

	/* 🔵 - Yearn Finance ******************************************************
	 **	getNextPeriodRewards will help you retrieved the the reward_per_gauge
	 ** 	and the claims_per_gauge elements from the Bribe V3 contracts to be
	 ** 	able to calculate the next period rewards.
	 ***************************************************************************/
	type TGetNextPeriodRewards = {
		gaugeAddress: TAddress;
		tokenAddress: TAddress;
		nextRewards: bigint;
	};
	const getNextPeriodRewards = useCallback(
		async (rewardsPerGauges: TDict<TAddress[]>): Promise<TDict<TGetNextPeriodRewards>> => {
			const rewardsPerTokensPerGaugesCalls: Promise<PrepareWriteContractResult>[] = [];
			for (const [gaugeAddress, rewardsTokens] of Object.entries(rewardsPerGauges)) {
				for (const tokenAsReward of rewardsTokens) {
					rewardsPerTokensPerGaugesCalls.push(
						prepareWriteContract({
							chainId: YBRIBE_SUPPORTED_NETWORK,
							address: CURVE_BRIBE_V3_HELPER_ADDRESS,
							abi: CURVE_BRIBE_V3_HELPER_ABI,
							functionName: 'getNewRewardPerToken',
							args: [toAddress(gaugeAddress), tokenAsReward]
						})
					);
				}
			}

			try {
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
			} catch (error) {
				console.error(error);
				return {};
			}
		},
		[]
	);

	/* 🔵 - Yearn Finance ******************************************************
	 **	assignBribes will save the currentRewards,  periods and clamable values
	 ** 	for each gauge/token to the state to be used by the UI.
	 ***************************************************************************/
	const assignBribes = useCallback(async (rewards: TDict<TGetRewardsPerUser>): Promise<void> => {
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
	const assignNextRewards = useCallback(async (nextPeriodRewards: TDict<TGetNextPeriodRewards>): Promise<void> => {
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
	const getBribes = useAsyncTrigger(async (): Promise<void> => {
		if (!hasConnector) {
			return;
		}
		const rewardsPerGauges = await getRewardsPerGauges();
		const [rewardsPerUser, nextPeriodRewards] = await Promise.all([
			getRewardsPerUser(rewardsPerGauges),
			getNextPeriodRewards(rewardsPerGauges)
		]);

		assignBribes(rewardsPerUser);
		assignNextRewards(nextPeriodRewards);
	}, [hasConnector, getRewardsPerGauges, getRewardsPerUser, getNextPeriodRewards, assignBribes, assignNextRewards]);

	const onRefresh = useCallback(async (): Promise<void> => {
		await getBribes();
	}, [getBribes]);

	/* 🔵 - Yearn Finance ******************************************************
	 **	Setup and render the Context provider to use in the app.
	 ***************************************************************************/
	const contextValue = useMemo(
		(): TBribesContext => ({
			currentRewards: currentRewards || {},
			nextRewards: nextRewards || {},
			claimable: claimable || {},
			isLoading: isLoading,
			currentPeriod,
			nextPeriod,
			refresh: onRefresh
		}),
		[currentRewards, nextRewards, claimable, isLoading, currentPeriod, nextPeriod, onRefresh]
	);

	return <BribesContext.Provider value={contextValue}>{children}</BribesContext.Provider>;
};

export const useBribes = (): TBribesContext => useContext(BribesContext);
