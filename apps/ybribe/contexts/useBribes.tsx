import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {Contract} from 'ethcall';
import {ethers} from 'ethers';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {allowanceKey, toAddress} from '@yearn-finance/web-lib/utils/address';
import {CURVE_BRIBE_V3_ADDRESS, CURVE_BRIBE_V3_HELPER_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import {getProvider, newEthCallProvider} from '@yearn-finance/web-lib/utils/web3/providers';
import {useCurve} from '@common/contexts/useCurve';
import {getLastThursday, getNextThursday} from '@yBribe/utils';
import CURVE_BRIBE_V3 from '@yBribe/utils/abi/curveBribeV3.abi';
import CURVE_BRIBE_V3_HELPER from '@yBribe/utils/abi/curveBribeV3Helper.abi';

import type {BigNumber} from 'ethers';
import type {TDict} from '@yearn-finance/web-lib/utils/types';
import type {TCurveGaugeVersionRewards} from '@common/types/curves';

export type	TBribesContext = {
	currentRewards: TCurveGaugeVersionRewards,
	nextRewards: TCurveGaugeVersionRewards,
	claimable: TCurveGaugeVersionRewards,
	currentPeriod: number,
	nextPeriod: number,
	isLoading: boolean,
	refresh: () => Promise<void>
}
const	defaultProps: TBribesContext = {
	currentRewards: {
		v3: {}
	},
	nextRewards: {
		v3: {}
	},
	claimable: {
		v3: {}
	},
	currentPeriod: 0,
	nextPeriod: 0,
	isLoading: true,
	refresh: async (): Promise<void> => undefined
};

const	BribesContext = createContext<TBribesContext>(defaultProps);
export const BribesContextApp = ({children}: {children: React.ReactElement}): React.ReactElement => {
	const {gauges} = useCurve();
	const {provider, address} = useWeb3();
	const {safeChainID} = useChainID();
	const [currentRewards, set_currentRewards] = useState<TCurveGaugeVersionRewards>({v3: {}});
	const [nextRewards, set_nextRewards] = useState<TCurveGaugeVersionRewards>({v3: {}});
	const [claimable, set_claimable] = useState<TCurveGaugeVersionRewards>({v3: {}});
	const [isLoading, set_isLoading] = useState<boolean>(true);
	const [currentPeriod, set_currentPeriod] = useState<number>(getLastThursday());
	const [nextPeriod, set_nextPeriod] = useState<number>(getNextThursday());


	/* 🔵 - Yearn Finance ******************************************************
	** getSharedStuffFromBribes will help you retrieved some elements from the
	**  Bribe contracts, not related to the user.
	***************************************************************************/
	const getSharedStuffFromBribes = useCallback(async (): Promise<void> => {
		const	currentProvider = safeChainID === 1 ? provider || getProvider(1) : getProvider(1);
		const	ethcallProvider = await newEthCallProvider(currentProvider);
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
		const	ethcallProvider = await newEthCallProvider(currentProvider);
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
	): Promise<{rewardsList: string[], multicallResult: BigNumber[]}> => {
		if ((rewardsPerGauges || []).length === 0) {
			return ({rewardsList: [], multicallResult: []});
		}
		const	userAddress = address || ethers.constants.AddressZero;
		const	ethcallProvider = await newEthCallProvider(currentProvider);
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
	): Promise<{rewardsList: string[], multicallResult: BigNumber[]}> => {
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

		const	multicallResult = await Promise.all(
			rewardsPerTokensPerGaugesCalls.map((pair): unknown => contract.callStatic.getNewRewardPerToken(...pair))
		) as BigNumber[];

		return ({rewardsList, multicallResult: [...multicallResult]});
	}, [gauges]);

	/* 🔵 - Yearn Finance ******************************************************
	**	assignBribes will save the currentRewards,  periods and clamable values
	** 	for each gauge/token to the state to be used by the UI.
	***************************************************************************/
	const assignBribes = useCallback(async (
		version: string,
		rewardsList: string[],
		multicallResult: BigNumber[]
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
	const assignNextRewards = useCallback(async (version: string, rewardsList: string[], multicallResult: BigNumber[]): Promise<void> => {
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
		const	currentProvider = safeChainID === 1 ? provider || getProvider(1) : getProvider(1);
		const	curveBribeV3Contract = new Contract(CURVE_BRIBE_V3_ADDRESS, CURVE_BRIBE_V3);

		const	[rewardsPerGaugesV3] = await Promise.all([getRewardsPerGauges(currentProvider, curveBribeV3Contract)]);
		const	[rewardsPerUserV3, nextPeriodRewardsV3] = await Promise.all([
			getRewardsPerUser(currentProvider, curveBribeV3Contract, rewardsPerGaugesV3),
			getNextPeriodRewards(currentProvider, rewardsPerGaugesV3)
		]);

		const	{rewardsList: rewardsListV3, multicallResult: multicallResultV3} = rewardsPerUserV3;
		const	{rewardsList: nextRewardsListV3, multicallResult: nextMulticallResultV3} = nextPeriodRewardsV3;
		performBatchedUpdates((): void => {
			assignBribes('v3', rewardsListV3, multicallResultV3);
			assignNextRewards('v3', nextRewardsListV3, nextMulticallResultV3);
		});

	}, [safeChainID, provider, getRewardsPerGauges, getRewardsPerUser, getNextPeriodRewards, assignBribes, assignNextRewards]);
	useEffect((): void => {
		getBribes();
	}, [getBribes]);

	const	onRefresh = useCallback(async (): Promise<void> => {
		await getBribes();
	}, [getBribes]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const	contextValue = useMemo((): TBribesContext => ({
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