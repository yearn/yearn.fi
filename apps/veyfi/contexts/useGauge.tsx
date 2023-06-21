import React, {createContext, memo, useCallback, useContext, useMemo} from 'react';
import {Contract} from 'ethcall';
import {FixedNumber} from 'ethers';
import useSWR from 'swr';
import {keyBy} from '@veYFI/utils';
import VEYFI_GAUGE_ABI from '@veYFI/utils/abi/veYFIGauge.abi';
import VEYFI_REGISTRY_ABI from '@veYFI/utils/abi/veYFIRegistry.abi';
import {VEYFI_REGISTRY_ADDRESS} from '@veYFI/utils/constants';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import ERC20_ABI from '@yearn-finance/web-lib/utils/abi/erc20.abi';
import {allowanceKey} from '@yearn-finance/web-lib/utils/address';
import {getProvider, newEthCallProvider} from '@yearn-finance/web-lib/utils/web3/providers';

import type {Call} from 'ethcall';
import type {ReactElement} from 'react';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';

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
	const {provider, address: userAddress, isActive} = useWeb3();

	const gaugesFetcher = useCallback(async (): Promise<TGauge[]> => {
		const currentProvider = getProvider(1);
		const ethcallProvider = await newEthCallProvider(currentProvider);
		const veYFIRegistryContract = new Contract(VEYFI_REGISTRY_ADDRESS, VEYFI_REGISTRY_ABI); // todo: update once abi is available
		const [vaultAddresses] = await ethcallProvider.tryAll([veYFIRegistryContract.getVaults()]) as [TAddress[]];
		const gaugeAddressCalls = vaultAddresses.map((address): Call => veYFIRegistryContract.gauges(address));
		const gaugeAddresses = await ethcallProvider.tryAll(gaugeAddressCalls) as TAddress[];
		const gaugePromises = gaugeAddresses.map(async (address): Promise<TGauge> => {
			const veYFIGaugeContract = new Contract(address, VEYFI_GAUGE_ABI); // todo: update once abi is available
			const [
				asset,
				name,
				symbol,
				decimals,
				totalAssets
			] = await ethcallProvider.tryAll([
				veYFIGaugeContract.asset(),
				veYFIGaugeContract.name(),
				veYFIGaugeContract.symbol(),
				veYFIGaugeContract.decimals(),
				veYFIGaugeContract.totalAssets()
			]) as [TAddress, string, string, number, bigint];
			
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
		const currentProvider = getProvider(1);
		const ethcallProvider = await newEthCallProvider(currentProvider);

		const positionPromises = gauges.map(async ({address}): Promise<TGaugePosition> => {
			const veYFIGaugeContract = new Contract(address, VEYFI_GAUGE_ABI); // todo: update once abi is available
			const [balance, earned, boostedBalance] = await ethcallProvider.tryAll([
				veYFIGaugeContract.balanceOf(userAddress), 
				veYFIGaugeContract.earned(userAddress),
				veYFIGaugeContract.nextBoostedBalanceOf(userAddress)
			]) as bigint[];
			
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
	}, [gauges, isActive, userAddress]);
	const {data: positions, mutate: refreshPositions, isLoading: isLoadingPositions} = useSWR(gauges && isActive && provider ? 'gaugePositions' : null, positionsFetcher, {shouldRetryOnError: false});

	const allowancesFetcher = useCallback(async (): Promise<TDict<bigint>> => {
		if (!gauges || !isActive || !userAddress) {
			return {};
		}
		const currentProvider = getProvider(1);
		const ethcallProvider = await newEthCallProvider(currentProvider);

		const allowanceCalls = gauges.map(({address, vaultAddress}): Call => {
			const erc20Contract = new Contract(vaultAddress, ERC20_ABI);
			return erc20Contract.allowance(userAddress, address);
		});
		const allowances = await ethcallProvider.tryAll(allowanceCalls) as bigint[];
		const allowancesMap: TDict<bigint> = {};
		gauges.forEach(({address, vaultAddress}, index): void => {
			allowancesMap[allowanceKey(1, vaultAddress, address, userAddress)] = allowances[index];
		});

		return allowancesMap;
	}, [gauges, isActive, userAddress]);
	const	{data: allowancesMap, mutate: refreshAllowances, isLoading: isLoadingAllowances} = useSWR(gauges && isActive && provider ? 'gaugeAllowances' : null, allowancesFetcher, {shouldRetryOnError: false});

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
