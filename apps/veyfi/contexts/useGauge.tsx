import React, {createContext, memo, useCallback, useContext, useMemo} from 'react';
import {FixedNumber} from 'ethers';
import {useContractRead} from 'wagmi';
import useSWR from 'swr';
import {keyBy} from '@veYFI/utils';
import VEYFI_GAUGE_ABI from '@veYFI/utils/abi/veYFIGauge.abi';
import VEYFI_REGISTRY_ABI from '@veYFI/utils/abi/veYFIRegistry.abi';
import {VEYFI_REGISTRY_ADDRESS} from '@veYFI/utils/constants';
import {erc20ABI, getContract, multicall} from '@wagmi/core';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {allowanceKey} from '@yearn-finance/web-lib/utils/address';

import type {ReactElement} from 'react';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';
import type {TMulticallContract} from '@common/types/types';

export type TGauge = {
	address: TAddress,
	vaultAddress: TAddress,
	name: string,
	symbol: string,
	decimals: number,
	totalStaked: bigint,
	// apy?: number;
}

export type TPosition = {
	balance: bigint,
	underlyingBalance: bigint,
}

export type TGaugePosition = {
	address: TAddress,
	deposit: TPosition,
	reward: TPosition,
	boost: number,
}

export type	TGaugeContext = {
	gaugeAddresses: TAddress[],
	gaugesMap: TDict<TGauge | undefined>,
	positionsMap: TDict<TGaugePosition | undefined>,
	allowancesMap: TDict<bigint>,
	isLoading: boolean,
	refresh: () => void,
}
const defaultProps: TGaugeContext = {
	gaugeAddresses: [],
	gaugesMap: {},
	positionsMap: {},
	allowancesMap: {},
	isLoading: true,
	refresh: (): void => undefined
};

const GaugeContext = createContext<TGaugeContext>(defaultProps);
export const GaugeContextApp = memo(function GaugeContextApp({children}: {children: ReactElement}): ReactElement {
	const {address: userAddress, isActive} = useWeb3();
	const {chainID} = useChainID();
	const veYFIRegistryContract = useMemo((): {address: TAddress, abi: typeof VEYFI_REGISTRY_ABI} => ({
		address: VEYFI_REGISTRY_ADDRESS,
		abi: VEYFI_REGISTRY_ABI
	}), []);
	const {data: vaultAddresses} = useContractRead({
		...veYFIRegistryContract,
		functionName: 'getVaults',
		chainId: chainID
	});

	const gaugesFetcher = useCallback(async (): Promise<TGauge[]> => {
		if (!isActive || !userAddress) {
			return [];
		}

		const gaugeAddressCalls = vaultAddresses?.map((vaultAddress): TMulticallContract => ({
			...veYFIRegistryContract,
			functionName: 'gauges',
			args: [vaultAddress]
		}));

		const gaugeAddressesResults = await multicall({contracts: gaugeAddressCalls ?? [], chainId: chainID});
		
		const gaugeAddresses = gaugeAddressesResults.map(({result}): unknown => result) as TAddress[];
		const gaugePromises = gaugeAddresses.map(async (address): Promise<TGauge> => {
			// todo: update once abi is available
			const veYFIGaugeContract = getContract({
				address,
				abi: VEYFI_GAUGE_ABI,
				chainId: chainID
			});

			// TODO: These should be migrated to wagmi
			const calls: TMulticallContract[] = [];
			['asset', 'name', 'symbol', 'decimals', 'totalAssets'].forEach((functionName): void => {
				calls.push({...veYFIGaugeContract, functionName});
			});

			const results = await multicall({
				contracts: calls,
				chainId: chainID
			});

			const [asset, name, symbol, decimals, totalAssets] = results.map(({result}): unknown => result) as [TAddress, string, string, number, bigint];
			
			return ({
				address,
				vaultAddress: asset,
				name,
				symbol,
				decimals,
				totalStaked: totalAssets
			});
		});
		return Promise.all(gaugePromises);
	}, []);
	const {data: gauges, mutate: refreshVotingEscrow, isLoading: isLoadingGauges} = useSWR('gauges', gaugesFetcher, {shouldRetryOnError: false});

	const positionsFetcher = useCallback(async (): Promise<TGaugePosition[]> => {
		if (!gauges|| !isActive|| !userAddress) {
			return [];
		}

		const positionPromises = gauges.map(async ({address}): Promise<TGaugePosition> => {
			// todo: update once abi is available
			const veYFIGaugeContract = getContract({
				address,
				abi: VEYFI_GAUGE_ABI,
				chainId: chainID
			});
			
			const calls: TMulticallContract[] = [];
			['balanceOf', 'earned', 'nextBoostedBalanceOf'].forEach((functionName): void => {
				calls.push({...veYFIGaugeContract, functionName, args: [userAddress]});
			});

			const results = await multicall({
				contracts: calls,
				chainId: chainID
			});

			const [balance, earned, boostedBalance] = results.map(({result}): unknown => result) as bigint[];
			
			const depositPosition: TPosition = {
				balance,
				underlyingBalance: balance
			};

			const rewardPosition: TPosition = {
				balance: earned,
				underlyingBalance: earned // TODO: convert to underlying
			};

			const boostRatio = balance > 0n
				? FixedNumber.from(boostedBalance).divUnsafe(FixedNumber.from(balance)).toUnsafeFloat()
				: 0.1;
			const boost = Math.min(1, boostRatio) * 10;

			return {
				address,
				deposit: depositPosition,
				reward: rewardPosition,
				boost
			};
		});
		return Promise.all(positionPromises);
	}, [chainID, gauges, isActive, userAddress]);
	const {data: positions, mutate: refreshPositions, isLoading: isLoadingPositions} = useSWR(gauges && isActive ? 'gaugePositions' : null, positionsFetcher, {shouldRetryOnError: false});

	const allowancesFetcher = useCallback(async (): Promise<TDict<bigint>> => {
		if (!gauges || !isActive || !userAddress) {
			return {};
		}

		const allowanceCalls = gauges.map(({address, vaultAddress}): TMulticallContract => {
			const erc20Contract = getContract({
				address: vaultAddress,
				abi: erc20ABI,
				chainId: chainID
			});
			return {
				...erc20Contract,
				abi: erc20ABI,
				functionName: 'allowance',
				args: [userAddress, address]
			};
		});

		const results = await multicall({
			contracts: allowanceCalls,
			chainId: chainID
		});
		const allowances = results.map(({result}): unknown => result) as bigint[];
		
		const allowancesMap: TDict<bigint> = {};
		gauges.forEach(({address, vaultAddress}, index): void => {
			allowancesMap[allowanceKey(1, vaultAddress, address, userAddress)] = allowances[index];
		});

		return allowancesMap;
	}, [chainID, gauges, isActive, userAddress]);
	const	{data: allowancesMap, mutate: refreshAllowances, isLoading: isLoadingAllowances} = useSWR(gauges && isActive ? 'gaugeAllowances' : null, allowancesFetcher, {shouldRetryOnError: false});

	const refresh = useCallback((): void => {
		refreshVotingEscrow();
		refreshPositions();
		refreshAllowances();
	}, [refreshAllowances, refreshPositions, refreshVotingEscrow]);

	const contextValue = useMemo((): TGaugeContext => ({
		gaugeAddresses: gauges?.map(({address}): TAddress => address) ?? [],
		gaugesMap: keyBy(gauges ?? [], 'address'),
		positionsMap: keyBy(positions ?? [], 'address'),
		allowancesMap: allowancesMap ?? {},
		isLoading: isLoadingGauges || isLoadingPositions || isLoadingAllowances,
		refresh
	}), [allowancesMap, gauges, isLoadingAllowances, isLoadingGauges, isLoadingPositions, positions, refresh]);

	return (
		<GaugeContext.Provider value={contextValue}>
			{children}
		</GaugeContext.Provider>
	);
});

export const useGauge = (): TGaugeContext => useContext(GaugeContext);
export default useGauge;
