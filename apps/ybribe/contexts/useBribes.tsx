import React, {createContext, useCallback, useContext, useEffect, useState} from 'react';
import {Contract} from 'ethcall';
import {ethers} from 'ethers';
import axios from 'axios';
import useSWR from 'swr';
import {useSettings, useWeb3} from '@yearn-finance/web-lib/contexts';
import {performBatchedUpdates, providers} from '@yearn-finance/web-lib/utils';
import {allowanceKey, toAddress} from '@yearn-finance/web-lib/utils/address';
import {CURVE_BRIBE_V2_ADDRESS, CURVE_BRIBE_V3_ADDRESS, CURVE_BRIBE_V3_HELPER_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {useCurve} from '@common/contexts/useCurve';
import {getLastThursday, getNextThursday} from '@yBribe/utils';
import CURVE_BRIBE_V2 from '@yBribe/utils/abi/curveBribeV2.abi';
import CURVE_BRIBE_V3 from '@yBribe/utils/abi/curveBribeV3.abi';
import CURVE_BRIBE_V3_HELPER from '@yBribe/utils/abi/curveBribeV3Helper.abi';

import type {BigNumber} from 'ethers';
import type {TDict} from '@yearn-finance/web-lib/utils';
import type {TCurveGaugeVersionRewards} from '@common/types/curves';
import type {TYDaemonGaugeRewardsFeed} from '@common/types/yearn';

export type	TBribesContext = {
	currentRewards: TCurveGaugeVersionRewards,
	nextRewards: TCurveGaugeVersionRewards,
	claimable: TCurveGaugeVersionRewards,
	feed: TYDaemonGaugeRewardsFeed[],
	currentPeriod: number,
	nextPeriod: number,
	isLoading: boolean,
	refresh: () => Promise<void>
}
const	defaultProps: TBribesContext = {
	currentRewards: {
		v2: {},
		v3: {}
	},
	nextRewards: {
		v2: {},
		v3: {}
	},
	claimable: {
		v2: {},
		v3: {}
	},
	feed: [],
	currentPeriod: 0,
	nextPeriod: 0,
	isLoading: true,
	refresh: async (): Promise<void> => undefined
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const baseFetcher = async (url: string): Promise<any> => axios.get(url).then((res): any => res.data);

const	BribesContext = createContext<TBribesContext>(defaultProps);
export const BribesContextApp = ({children}: {children: React.ReactElement}): React.ReactElement => {
	const	{gauges} = useCurve();
	const	{provider, address, safeChainID} = useWeb3();
	const	[currentRewards, set_currentRewards] = useState<TCurveGaugeVersionRewards>({v2: {}, v3: {}});
	const	[nextRewards, set_nextRewards] = useState<TCurveGaugeVersionRewards>({v2: {}, v3: {}});
	const	[claimable, set_claimable] = useState<TCurveGaugeVersionRewards>({v2: {}, v3: {}});
	const	[isLoading, set_isLoading] = useState<boolean>(true);
	const	[currentPeriod, set_currentPeriod] = useState<number>(getLastThursday());
	const	[nextPeriod, set_nextPeriod] = useState<number>(getNextThursday());
	const	{settings:baseAPISettings} = useSettings();

	const	{data: feed} = useSWR(`${baseAPISettings.yDaemonBaseURI}/1/bribes/newRewardFeed`, baseFetcher);

	/* 🔵 - Yearn Finance ******************************************************
	**	getSharedStuffFromBribes will help you retrieved some elements from the
	** 	Bribe contracts, not related to the user.
	***************************************************************************/
	const	getSharedStuffFromBribes = useCallback(async (): Promise<void> => {
		const	currentProvider = safeChainID === 1 ? provider || providers.getProvider(1) : providers.getProvider(1);
		const	ethcallProvider = await providers.newEthCallProvider(currentProvider);
		const	curveBribeV3Contract = new Contract(CURVE_BRIBE_V3_ADDRESS, CURVE_BRIBE_V3);
		const	[_currentPeriod] = await ethcallProvider.tryAll([curveBribeV3Contract.current_period()]) as [number];	

		performBatchedUpdates((): void => {
			set_currentPeriod(Number(_currentPeriod));
			set_nextPeriod(Number(_currentPeriod) + (86400 * 7));
		});
	}, [provider, safeChainID]);
	useEffect((): void => {
		getSharedStuffFromBribes();
	}, [getSharedStuffFromBribes]);
	

	/* 🔵 - Yearn Finance ******************************************************
	**	getBribes will call the bribeV2 contract to get all the rewards
	**	per gauge.
	***************************************************************************/
	const getRewardsPerGauges = useCallback(async (
		currentProvider: ethers.providers.Provider,
		contract: Contract
	): Promise<string[][]> => {
		const	ethcallProvider = await providers.newEthCallProvider(currentProvider);
		const	rewardsPerGaugesCalls = [];

		for (const gauge of gauges) {
			rewardsPerGaugesCalls.push(contract.rewards_per_gauge(gauge.gauge));	
		}
		const	_rewardsPerGauges = await ethcallProvider.tryAll(rewardsPerGaugesCalls) as string[][];
		return ([..._rewardsPerGauges]);
	}, [gauges]);

	/* 🔵 - Yearn Finance ******************************************************
	**	getRewardsPerUser will help you retrieved the claimable and rewards
	** 	elements from the Bribe contracts, related to the user for a specific
	** 	list of gauges/tokens.
	***************************************************************************/
	const getRewardsPerUser = useCallback(async (
		currentProvider: ethers.providers.Provider,
		contract: Contract,
		rewardsPerGauges: string[][]
	): Promise<{rewardsList: string[], multicallResult: any[]}> => {
		if ((rewardsPerGauges || []).length === 0) {
			return ({rewardsList: [], multicallResult: []});
		}
		const	userAddress = address || ethers.constants.AddressZero;
		const	ethcallProvider = await providers.newEthCallProvider(currentProvider);
		const	rewardsPerTokensPerGaugesCalls = [];
		const	rewardsList: string[] = [];

		const	_rewardsPerGauges = [...rewardsPerGauges];
		for (const gauge of gauges) {
			const	rewardPerGauge = _rewardsPerGauges.shift();
			if (rewardPerGauge && rewardPerGauge.length > 0) {
				if (!gauge.rewardPerGauge) {
					gauge.rewardPerGauge = [];
				}
				gauge.rewardPerGauge.push(...rewardPerGauge);
				for (const tokenAsReward of rewardPerGauge) {
					rewardsList.push(allowanceKey(gauge.gauge, tokenAsReward));
					rewardsPerTokensPerGaugesCalls.push(...[
						contract.reward_per_token(gauge.gauge, tokenAsReward),
						contract.active_period(gauge.gauge, tokenAsReward),
						contract.claimable(userAddress, gauge.gauge, tokenAsReward)
					]);
				}
			}
		}

		const	_rewardsPerTokensPerGaugesWithPeriods = await ethcallProvider.tryAll(rewardsPerTokensPerGaugesCalls) as BigNumber[];
		return ({rewardsList, multicallResult: [..._rewardsPerTokensPerGaugesWithPeriods]});
	}, [gauges, address]);

	/* 🔵 - Yearn Finance ******************************************************
	**	getNextPeriodRewards will help you retrieved the the reward_per_gauge
	** 	and the claims_per_gauge elements from the Bribe V3 contracts to be
	** 	able to calculate the next period rewards.
	***************************************************************************/
	const getNextPeriodRewards = useCallback(async (
		currentProvider: ethers.providers.Provider,
		rewardsPerGauges: string[][]
	): Promise<{rewardsList: string[], multicallResult: any[]}> => {
		if ((rewardsPerGauges || []).length === 0) {
			return ({rewardsList: [], multicallResult: []});
		}
		const	contract = new ethers.Contract(CURVE_BRIBE_V3_HELPER_ADDRESS, CURVE_BRIBE_V3_HELPER, currentProvider);
		const	rewardsPerTokensPerGaugesCalls = [];
		const	rewardsList: string[] = [];

		const	_rewardsPerGauges = [...rewardsPerGauges];
		for (const gauge of gauges) {
			const	rewardPerGauge = _rewardsPerGauges.shift();
			if (rewardPerGauge && rewardPerGauge.length > 0) {
				for (const tokenAsReward of rewardPerGauge) {
					rewardsList.push(allowanceKey(gauge.gauge, tokenAsReward));
					rewardsPerTokensPerGaugesCalls.push([gauge.gauge, tokenAsReward]);
				}
			}
		}

		const	multicallResult = await Promise.all(rewardsPerTokensPerGaugesCalls.map((pair): any => contract.callStatic.getNewRewardPerToken(...pair))) as BigNumber[];
		return ({rewardsList, multicallResult: [...multicallResult]});
	}, [gauges]);

	/* 🔵 - Yearn Finance ******************************************************
	**	assignBribes will save the currentRewards,  periods and clamable values
	** 	for each gauge/token to the state to be used by the UI.
	***************************************************************************/
	const assignBribes = useCallback(async (
		version: string,
		rewardsList: string[],
		multicallResult: any[]
	): Promise<void> => {
		if (!multicallResult || multicallResult.length === 0 || rewardsList.length === 0) {
			return;
		}
		const	_currentRewards: TDict<TDict<BigNumber>> = {};
		const	_claimable: TDict<TDict<BigNumber>> = {};
		const	_periods: TDict<TDict<BigNumber>> = {};
		let	rIndex = 0;
		
		for (const rewardListKey of rewardsList) {
			const	rewardPerTokenPerGauge = multicallResult[rIndex++];
			const	periodPerTokenPerGauge = multicallResult[rIndex++];
			const	claimablePerTokenPerGauge = multicallResult[rIndex++];
			if (periodPerTokenPerGauge.toNumber() >= currentPeriod) {
				if (rewardListKey && rewardPerTokenPerGauge.gt(0)) {
					const	[gauge, token] = rewardListKey.split('_');
					if (!_currentRewards[toAddress(gauge)]) {
						_currentRewards[toAddress(gauge)] = {};
					}
					if (!_periods[toAddress(gauge)]) {
						_periods[toAddress(gauge)] = {};
					}
					if (!_claimable[toAddress(gauge)]) {
						_claimable[toAddress(gauge)] = {};
					}
					_currentRewards[toAddress(gauge)][toAddress(token)] = rewardPerTokenPerGauge;
					_periods[toAddress(gauge)][toAddress(token)] = periodPerTokenPerGauge;
					_claimable[toAddress(gauge)][toAddress(token)] = claimablePerTokenPerGauge;
				}
			}
		}
		set_currentRewards((c: TCurveGaugeVersionRewards): TCurveGaugeVersionRewards => ({...c, [version]: _currentRewards}));
		set_claimable((c: TCurveGaugeVersionRewards): TCurveGaugeVersionRewards => ({...c, [version]: _claimable}));
		set_isLoading(false);
	}, [currentPeriod]);

	/* 🔵 - Yearn Finance ******************************************************
	**	assignNextRewards will save the next period rewards values for each
	**	gauge/token to the state to be used by the UI.
	***************************************************************************/
	const assignNextRewards = useCallback(async (version: string, rewardsList: string[], multicallResult: any[]): Promise<void> => {
		if (!multicallResult || multicallResult.length === 0 || rewardsList.length === 0) {
			return;
		}
		const	_nextRewards: TDict<TDict<BigNumber>> = {};
		
		let	rIndex = 0;
		for (const rewardListKey of rewardsList) {
			const	pendingForNextPeriod = multicallResult[rIndex++];
			if (rewardListKey) {
				const	[gauge, token] = rewardListKey.split('_');
				if (!_nextRewards[toAddress(gauge)]) {
					_nextRewards[toAddress(gauge)] = {};
				}
				_nextRewards[toAddress(gauge)][toAddress(token)] = pendingForNextPeriod;
			}
		}
		set_nextRewards((c: TCurveGaugeVersionRewards): TCurveGaugeVersionRewards => ({...c, [version]: _nextRewards}));
	}, []);

	/* 🔵 - Yearn Finance ******************************************************
	**	getBribes will start the process to retrieve the bribe information.
	***************************************************************************/
	const	getBribes = useCallback(async (): Promise<void> => {
		const	currentProvider = safeChainID === 1 ? provider || providers.getProvider(1) : providers.getProvider(1);
		const	curveBribeV2Contract = new Contract(CURVE_BRIBE_V2_ADDRESS, CURVE_BRIBE_V2);
		const	curveBribeV3Contract = new Contract(CURVE_BRIBE_V3_ADDRESS, CURVE_BRIBE_V3);

		const	[rewardsPerGaugesV2, rewardsPerGaugesV3] = await Promise.all([
			getRewardsPerGauges(currentProvider, curveBribeV2Contract),
			getRewardsPerGauges(currentProvider, curveBribeV3Contract)
		]);
		const	[rewardsPerUserV2, rewardsPerUserV3, nextPeriodRewardsV3] = await Promise.all([
			getRewardsPerUser(currentProvider, curveBribeV2Contract, rewardsPerGaugesV2),
			getRewardsPerUser(currentProvider, curveBribeV3Contract, rewardsPerGaugesV3),
			getNextPeriodRewards(currentProvider, rewardsPerGaugesV3)
		]);

		const	{rewardsList: rewardsListV2, multicallResult: multicallResultV2} = rewardsPerUserV2;
		const	{rewardsList: rewardsListV3, multicallResult: multicallResultV3} = rewardsPerUserV3;
		const	{rewardsList: nextRewardsListV3, multicallResult: nextMulticallResultV3} = nextPeriodRewardsV3;
		performBatchedUpdates((): void => {
			assignBribes('v2', rewardsListV2, multicallResultV2);
			assignBribes('v3', rewardsListV3, multicallResultV3);
			assignNextRewards('v3', nextRewardsListV3, nextMulticallResultV3);
		});
	}, [safeChainID, provider, getRewardsPerGauges, getRewardsPerUser, getNextPeriodRewards, assignBribes, assignNextRewards]);
	useEffect((): void => {
		getBribes();
	}, [getBribes]);


	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	return (
		<BribesContext.Provider
			value={{
				currentRewards: currentRewards || {},
				nextRewards: nextRewards || {},
				claimable: claimable || {},
				isLoading: isLoading,
				currentPeriod,
				nextPeriod,
				feed: (feed || []) as TYDaemonGaugeRewardsFeed[],
				refresh: async (): Promise<void> => {
					await getBribes();
				}
			}}>
			{children}
		</BribesContext.Provider>
	);
};


export const useBribes = (): TBribesContext => useContext(BribesContext);
export default useBribes;