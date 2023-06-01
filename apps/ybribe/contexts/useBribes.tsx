import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {useContractRead} from 'wagmi';
import {multicall, prepareWriteContract} from '@wagmi/core';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {allowanceKey, toAddress} from '@yearn-finance/web-lib/utils/address';
import {CURVE_BRIBE_V3_ADDRESS, CURVE_BRIBE_V3_HELPER_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {decodeAsBigInt} from '@yearn-finance/web-lib/utils/decoder';
import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
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
	dryRunClaimRewards: TCurveGaugeVersionRewards,
	currentPeriod: number,
	nextPeriod: number,
	isLoading: boolean,
	refresh: VoidPromiseFunction
}
const defaultProps: TBribesContext = {
	currentRewards: {},
	nextRewards: {},
	claimable: {},
	dryRunClaimRewards: {},
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
	const [dryRunClaimRewards, set_dryRunClaimRewards] = useState<TCurveGaugeVersionRewards>({});
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
	const getRewardsPerGauges = useCallback(async (): Promise<TAddress[][]> => {
		const rewardsPerGaugesCalls = [];
		for (const gauge of gauges) {
			rewardsPerGaugesCalls.push({
				...bribeV3BaseContract,
				functionName: 'rewards_per_gauge',
				args: [gauge.gauge]
			});
		}
		const result = await multicall({contracts: rewardsPerGaugesCalls, chainId: safeChainID});
		const _rewardsPerGauges = [];
		for (const item of result) {
			if (item.status === 'failure') {
				continue;
			}
			_rewardsPerGauges.push(item.result as TAddress[]);
		}
		return ([..._rewardsPerGauges]);
	}, [bribeV3BaseContract, gauges, safeChainID]);

	/* 🔵 - Yearn Finance ******************************************************
	**	getRewardsPerUser will help you retrieved the claimable and rewards
	** 	elements from the Bribe contracts, related to the user for a specific
	** 	list of gauges/tokens.
	***************************************************************************/
	const getRewardsPerUser = useCallback(async (
		rewardsPerGauges: TAddress[][]
	): Promise<{rewardsList: string[], multicallResult: bigint[]}> => {
		if ((rewardsPerGauges || []).length === 0) {
			return ({rewardsList: [], multicallResult: []});
		}
		const userAddress = toAddress(address);
		const rewardsPerTokensPerGaugesCalls = [];
		const rewardsList: string[] = [];

		const _rewardsPerGauges = [...rewardsPerGauges];
		for (const gauge of gauges) {
			const rewardPerGauge = _rewardsPerGauges.shift();
			if (rewardPerGauge && rewardPerGauge.length > 0) {
				if (!gauge.rewardPerGauge) {
					gauge.rewardPerGauge = [];
				}
				gauge.rewardPerGauge.push(...rewardPerGauge);
				for (const tokenAsReward of rewardPerGauge) {
					const args = [gauge.gauge, tokenAsReward];
					rewardsList.push(allowanceKey(
						safeChainID,
						gauge.gauge,
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
		}

		const _rewardsPerTokensPerGaugesWithPeriods = [];
		const result = await multicall({contracts: rewardsPerTokensPerGaugesCalls, chainId: safeChainID});
		for (const item of result) {
			if (item.status === 'failure') {
				continue;
			}
			_rewardsPerTokensPerGaugesWithPeriods.push(decodeAsBigInt(item));
		}

		return ({rewardsList, multicallResult: [..._rewardsPerTokensPerGaugesWithPeriods]});
	}, [address, safeChainID, gauges, bribeV3BaseContract]);

	/* 🔵 - Yearn Finance ******************************************************
	**	getNextPeriodRewards will help you retrieved the the reward_per_gauge
	** 	and the claims_per_gauge elements from the Bribe V3 contracts to be
	** 	able to calculate the next period rewards.
	***************************************************************************/
	const getNextPeriodRewards = useCallback(async (
		rewardsPerGauges: TAddress[][]
	): Promise<{rewardsList: string[], multicallResult: bigint[]}> => {
		if ((rewardsPerGauges || []).length === 0) {
			return ({rewardsList: [], multicallResult: []});
		}
		const rewardsPerTokensPerGaugesCalls: [TAddress, TAddress][] = [];
		const rewardsList: string[] = [];
		const userAddress = toAddress(address);

		const _rewardsPerGauges = [...rewardsPerGauges];
		for (const gauge of gauges) {
			const rewardPerGauge = _rewardsPerGauges.shift();
			if (rewardPerGauge && rewardPerGauge.length > 0) {
				for (const tokenAsReward of rewardPerGauge) {
					rewardsList.push(allowanceKey(safeChainID, gauge.gauge, tokenAsReward, userAddress));
					rewardsPerTokensPerGaugesCalls.push([gauge.gauge, tokenAsReward]);
				}
			}
		}

		const simulate = await Promise.all(
			rewardsPerTokensPerGaugesCalls.map(async (pair): Promise<PrepareWriteContractResult> => {
				const config = prepareWriteContract({
					address: CURVE_BRIBE_V3_HELPER_ADDRESS,
					abi: CURVE_BRIBE_V3_HELPER,
					functionName: 'getNewRewardPerToken',
					args: pair
				});
				return config;
			})
		);
		const multicallResult: bigint[] = [];
		for (const item of simulate) {
			const itemResult = item.result as {newRewards?: bigint};
			multicallResult.push(toBigInt(itemResult?.newRewards));
		}
		return ({rewardsList, multicallResult: [...multicallResult]});
	}, [gauges, address, safeChainID]);

	/* 🔵 - Yearn Finance ******************************************************
	**	assignBribes will save the currentRewards,  periods and clamable values
	** 	for each gauge/token to the state to be used by the UI.
	***************************************************************************/
	const assignBribes = useCallback(async (
		rewardsList: string[],
		multicallResult: bigint[]
	): Promise<void> => {
		if (!multicallResult || multicallResult.length === 0 || rewardsList.length === 0) {
			return;
		}
		const userAddress = toAddress(address);
		const _currentRewards: TDict<TDict<bigint>> = {};
		const _claimable: TDict<TDict<bigint>> = {};
		const _periods: TDict<TDict<bigint>> = {};
		const _dryRunClaimRewards: TDict<TDict<bigint>> = {};
		let rIndex = 0;

		for (const rewardListKey of rewardsList) {
			const rewardPerTokenPerGauge = multicallResult[rIndex++];
			const periodPerTokenPerGauge = multicallResult[rIndex++];
			const claimablePerTokenPerGauge = multicallResult[rIndex++];
			if (Number(periodPerTokenPerGauge) >= currentPeriod) {
				if (rewardListKey && rewardPerTokenPerGauge > 0n) {
					const [, gaugeRaw, tokenRaw] = rewardListKey.split('_');
					const gauge = toAddress(gaugeRaw);
					const token = toAddress(tokenRaw);
					if (!_currentRewards[gauge]) {
						_currentRewards[gauge] = {};
					}
					if (!_periods[gauge]) {
						_periods[gauge] = {};
					}
					if (!_claimable[gauge]) {
						_claimable[gauge] = {};
					}
					if (!_dryRunClaimRewards[gauge]) {
						_dryRunClaimRewards[gauge] = {};
					}
					_currentRewards[gauge][token] = rewardPerTokenPerGauge;
					_periods[gauge][token] = periodPerTokenPerGauge;
					_claimable[gauge][token] = claimablePerTokenPerGauge;
					const prepareWriteResult = await prepareWriteContract({
						...bribeV3BaseContract,
						functionName: 'claim_reward_for',
						args: [userAddress, gauge, token]
					});
					_dryRunClaimRewards[gauge][token] = prepareWriteResult.result;
				}
			}
		}
		set_currentRewards(_currentRewards);
		set_claimable(_claimable);
		set_dryRunClaimRewards(_dryRunClaimRewards);
		set_isLoading(false);
	}, [address, bribeV3BaseContract, currentPeriod]);

	/* 🔵 - Yearn Finance ******************************************************
	**	assignNextRewards will save the next period rewards values for each
	**	gauge/token to the state to be used by the UI.
	***************************************************************************/
	const assignNextRewards = useCallback(async (rewardsList: string[], multicallResult: bigint[]): Promise<void> => {
		if (!multicallResult || multicallResult.length === 0 || rewardsList.length === 0) {
			return;
		}
		const _nextRewards: TDict<TDict<bigint>> = {};

		let rIndex = 0;
		for (const rewardListKey of rewardsList) {
			const pendingForNextPeriod = multicallResult[rIndex++];
			if (rewardListKey) {
				const [, gaugeRaw, tokenRaw] = rewardListKey.split('_');
				const gauge = toAddress(gaugeRaw);
				const token = toAddress(tokenRaw);
				if (!_nextRewards[gauge]) {
					_nextRewards[gauge] = {};
				}
				_nextRewards[gauge][token] = pendingForNextPeriod;
			}
		}
		set_nextRewards(_nextRewards);
	}, []);

	/* 🔵 - Yearn Finance ******************************************************
	**	getBribes will start the process to retrieve the bribe information.
	***************************************************************************/
	const getBribes = useCallback(async (): Promise<void> => {
		const rewardsPerGaugesV3 = await getRewardsPerGauges();
		const [rewardsPerUserV3, nextPeriodRewardsV3] = await Promise.all([
			getRewardsPerUser(rewardsPerGaugesV3),
			getNextPeriodRewards(rewardsPerGaugesV3)
		]);

		const {rewardsList: rewardsListV3, multicallResult: multicallResultV3} = rewardsPerUserV3;
		const {rewardsList: nextRewardsListV3, multicallResult: nextMulticallResultV3} = nextPeriodRewardsV3;
		performBatchedUpdates((): void => {
			assignBribes(rewardsListV3, multicallResultV3);
			assignNextRewards(nextRewardsListV3, nextMulticallResultV3);
		});
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
		dryRunClaimRewards: dryRunClaimRewards || {},
		isLoading: isLoading,
		currentPeriod,
		nextPeriod,
		refresh: onRefresh
	}), [currentRewards, nextRewards, claimable, dryRunClaimRewards, isLoading, currentPeriod, nextPeriod, onRefresh]);

	return (
		<BribesContext.Provider value={contextValue}>
			{children}
		</BribesContext.Provider>
	);
};


export const useBribes = (): TBribesContext => useContext(BribesContext);
export default useBribes;
