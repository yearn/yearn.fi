import React, {createContext, memo, useCallback, useContext, useState} from 'react';
import {FixedNumber} from 'ethers';
import {useDeepCompareMemo} from '@react-hookz/web';
import {VEYFI_GAUGE_ABI} from '@veYFI/utils/abi/veYFIGauge.abi';
import {VEYFI_CHAIN_ID} from '@veYFI/utils/constants';
import {erc20ABI, readContracts} from '@wagmi/core';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {allowanceKey, toAddress} from '@yearn-finance/web-lib/utils/address';
import {decodeAsAddress, decodeAsBigInt, decodeAsNumber, decodeAsString} from '@yearn-finance/web-lib/utils/decoder';
import {toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {useAsyncTrigger} from '@common/hooks/useAsyncTrigger';
import {keyBy} from '@common/utils';

import type {ReactElement} from 'react';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';
import type {TNormalizedBN} from '@common/types/types';

export type TGauge = {
	address: TAddress,
	vaultAddress: TAddress,
	name: string,
	symbol: string,
	decimals: number,
	totalStaked: TNormalizedBN,
	// apy?: number;
}

export type TPosition = {
	balance: TNormalizedBN,
	underlyingBalance: TNormalizedBN,
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
	allowancesMap: TDict<TNormalizedBN>,
	refresh: () => void,
}
const defaultProps: TGaugeContext = {
	gaugeAddresses: [],
	gaugesMap: {},
	positionsMap: {},
	allowancesMap: {},
	refresh: (): void => undefined
};

const GaugeContext = createContext<TGaugeContext>(defaultProps);
export const GaugeContextApp = memo(function GaugeContextApp({children}: {children: ReactElement}): ReactElement {
	const {address, isActive} = useWeb3();
	const [gauges, set_gauges] = useState<TGauge[]>([]);
	const [allowancesMap, set_allowancesMap] = useState<TDict<TNormalizedBN>>({});
	const [positionsMap, set_positionsMap] = useState<TDict<TGaugePosition>>({});

	// const {data: vaultAddresses} = useContractRead({
	// 	address: VEYFI_REGISTRY_ADDRESS,
	// 	abi: VEYFI_REGISTRY_ABI,
	// 	functionName: 'getVaults',
	// 	chainId: VEYFI_CHAIN_ID
	// });
	// const vaultAddresses = [
	// 	toAddress('0x28D374F0cdabb327A034BA41B9A2967E2959fb1F'),
	// 	toAddress('0xb8E45b5C3E49A9a4C2A086deAF59f7De19c100cC'),
	// 	toAddress('0x2Cc4b29771fcAA71313dC946a89eDd1AA68292E2'),
	// 	toAddress('0x9Cb511D44930c0C3D3114FFAaBedC3e0876D791a')
	// ];

	const refreshVotingEscrow = useAsyncTrigger(async (): Promise<void> => {
		const gaugeAddresses = [
			toAddress('0xbADfbF563C6C85F76e086E7a1915A1A46d683810'),
			toAddress('0xd5947C01dBaEFeFF05186FE34A976b2E28d90542'),
			toAddress('0x2262ef7F5A0171D9dBC16963727249787575cE42'),
			toAddress('0x79a37e400bC591f1B38e4Fe020Ec1f985F670218')
		];
		const gaugePromises = gaugeAddresses.map(async (gaugeAddress): Promise<TGauge> => {
			const results = await readContracts({
				contracts: [
					{address: gaugeAddress, abi: VEYFI_GAUGE_ABI, chainId: VEYFI_CHAIN_ID, functionName: 'asset'},
					{address: gaugeAddress, abi: VEYFI_GAUGE_ABI, chainId: VEYFI_CHAIN_ID, functionName: 'name'},
					{address: gaugeAddress, abi: VEYFI_GAUGE_ABI, chainId: VEYFI_CHAIN_ID, functionName: 'symbol'},
					{address: gaugeAddress, abi: VEYFI_GAUGE_ABI, chainId: VEYFI_CHAIN_ID, functionName: 'decimals'},
					{address: gaugeAddress, abi: VEYFI_GAUGE_ABI, chainId: VEYFI_CHAIN_ID, functionName: 'totalAssets'}
				]
			});
			const decimals = Number(decodeAsBigInt(results[3])) || decodeAsNumber(results[3]);
			return ({
				address: gaugeAddress,
				vaultAddress: decodeAsAddress(results[0]),
				name: decodeAsString(results[1]),
				symbol: decodeAsString(results[2]),
				decimals: decimals,
				totalStaked: toNormalizedBN(decodeAsBigInt(results[4]), decimals)
			});
		});

		const allGauges = await Promise.all(gaugePromises);
		set_gauges(allGauges);
	}, []);

	const refreshAllowances = useAsyncTrigger(async (): Promise<void> => {
		if (!gauges || !address) {
			return;
		}
		const calls = [];
		for (const gauge of Object.values(gauges)) {
			calls.push({
				address: gauge.vaultAddress,
				abi: erc20ABI,
				chainId: VEYFI_CHAIN_ID,
				functionName: 'allowance',
				args: [toAddress(address), gauge.address]
			});
			calls.push({
				address: gauge.vaultAddress,
				abi: erc20ABI,
				chainId: VEYFI_CHAIN_ID,
				functionName: 'decimals'
			});

		}
		const results = await readContracts({contracts: calls});
		const _allowancesMap: TDict<TNormalizedBN> = {};
		let index = 0;
		for (const gauge of Object.values(gauges)) {
			const allowance = decodeAsBigInt(results[index++]);
			const decimals = Number(decodeAsBigInt(results[index++])) || decodeAsNumber(results[index++]);
			_allowancesMap[allowanceKey(VEYFI_CHAIN_ID, gauge.vaultAddress, gauge.address, toAddress(address))] = toNormalizedBN(allowance, decimals);
		}
		set_allowancesMap(_allowancesMap);
	}, [address, gauges]);

	const refreshPositions = useAsyncTrigger(async (): Promise<void> => {
		if (!gauges || !isActive || !address) {
			return;
		}
		const positionPromises = gauges.map(async (gauge): Promise<TGaugePosition> => {
			const results = await readContracts({
				contracts: [
					{
						address: toAddress(gauge.address),
						abi: VEYFI_GAUGE_ABI,
						chainId: VEYFI_CHAIN_ID,
						functionName: 'balanceOf',
						args: [toAddress(address)]
					},
					{
						address: toAddress(gauge.address),
						abi: VEYFI_GAUGE_ABI,
						chainId: VEYFI_CHAIN_ID,
						functionName: 'earned',
						args: [toAddress(address)]
					},
					{
						address: toAddress(gauge.address),
						abi: VEYFI_GAUGE_ABI,
						chainId: VEYFI_CHAIN_ID,
						functionName: 'nextBoostedBalanceOf',
						args: [toAddress(address)]
					},
					{
						address: toAddress(gauge.address),
						abi: VEYFI_GAUGE_ABI,
						chainId: VEYFI_CHAIN_ID,
						functionName: 'decimals'
					}
				]
			});

			const balance = decodeAsBigInt(results[0]);
			const earned = decodeAsBigInt(results[1]);
			const boostedBalance = decodeAsBigInt(results[2]);
			const decimals = Number(decodeAsBigInt(results[3])) || decodeAsNumber(results[3]);
			const depositPosition: TPosition = {
				balance: toNormalizedBN(balance, decimals),
				underlyingBalance: toNormalizedBN(balance, decimals) // TODO: convert to underlying
			};

			const rewardPosition: TPosition = {
				balance: toNormalizedBN(earned, decimals),
				underlyingBalance: toNormalizedBN(earned, decimals) // TODO: convert to underlying
			};

			const boostRatio = balance > 0n
				? FixedNumber.from(boostedBalance).divUnsafe(FixedNumber.from(balance)).toUnsafeFloat()
				: 0.1;
			const boost = Math.min(1, boostRatio) * 10;

			return {
				address: gauge.address,
				deposit: depositPosition,
				reward: rewardPosition,
				boost
			};
		});
		const allPositions = await Promise.all(positionPromises);
		const allPositionsAsMap: TDict<TGaugePosition> = {};
		for (const positions of allPositions) {
			allPositionsAsMap[positions.address] = positions;
		}
		set_positionsMap(allPositionsAsMap);
	}, [address, gauges, isActive]);

	const refresh = useCallback((): void => {
		refreshVotingEscrow();
		refreshPositions();
		refreshAllowances();
	}, [refreshAllowances, refreshPositions, refreshVotingEscrow]);

	const contextValue = useDeepCompareMemo((): TGaugeContext => ({
		gaugeAddresses: gauges.map((gauge): TAddress => toAddress(gauge.address)),
		gaugesMap: keyBy(gauges, 'address'),
		positionsMap: positionsMap,
		allowancesMap: allowancesMap ?? {},
		refresh
	}), [allowancesMap, gauges, positionsMap, refresh]);

	return (
		<GaugeContext.Provider value={contextValue}>
			{children}
		</GaugeContext.Provider>
	);
});

export const useGauge = (): TGaugeContext => useContext(GaugeContext);
