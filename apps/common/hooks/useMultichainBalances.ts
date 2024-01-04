import {useCallback, useMemo, useRef, useState} from 'react';
import {erc20ABI, useChainId} from 'wagmi';
import {deserialize, multicall, serialize} from '@wagmi/core';
import {useUI} from '@yearn-finance/web-lib/contexts/useUI';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {AGGREGATE3_ABI} from '@yearn-finance/web-lib/utils/abi/aggregate.abi';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {MULTICALL3_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {decodeAsBigInt, decodeAsNumber, decodeAsString} from '@yearn-finance/web-lib/utils/decoder';
import {toBigInt, toNormalizedBN, toNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {isEth} from '@yearn-finance/web-lib/utils/isEth';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {getNetwork} from '@yearn-finance/web-lib/utils/wagmi/utils';

import {useAsyncTrigger} from './useAsyncEffect';

import type {DependencyList} from 'react';
import type {ContractFunctionConfig} from 'viem';
import type {Connector} from 'wagmi';
import type {TAddress, TDict, TNDict} from '@yearn-finance/web-lib/types';
import type {TDefaultStatus} from '@yearn-finance/web-lib/types/hooks';
import type {TYDaemonPricesChain} from '@common/schemas/yDaemonPricesSchema';
import type {TChainTokens, TToken} from '@common/types/types';

/* 🔵 - Yearn Finance **********************************************************
 ** Request, Response and helpers for the useBalances hook.
 ******************************************************************************/
export type TUseBalancesTokens = {
	address: TAddress;
	chainID: number;
	decimals?: number;
	name?: string;
	symbol?: string;
	for?: string;
};
export type TUseBalancesReq = {
	key?: string | number;
	tokens: TUseBalancesTokens[];
	prices?: TYDaemonPricesChain;
	effectDependencies?: DependencyList;
	provider?: Connector;
};

export type TUseBalancesRes = {
	data: TChainTokens;
	onUpdate: () => Promise<TChainTokens>;
	onUpdateSome: (token: TUseBalancesTokens[]) => Promise<TChainTokens>;
	error?: Error;
	status: 'error' | 'loading' | 'success' | 'unknown';
} & TDefaultStatus;

type TDataRef = {
	nonce: number;
	address: TAddress;
	balances: TChainTokens;
};

/* 🔵 - Yearn Finance **********************************************************
 ** Default status for the loading state.
 ******************************************************************************/
const defaultStatus = {
	isLoading: false,
	isFetching: false,
	isSuccess: false,
	isError: false,
	isFetched: false,
	isRefetching: false
};

async function performCall(
	chainID: number,
	calls: ContractFunctionConfig[],
	tokens: TUseBalancesTokens[],
	prices?: TYDaemonPricesChain
): Promise<[TDict<TToken>, Error | undefined]> {
	const _data: TDict<TToken> = {};
	const results = await multicall({
		contracts: calls as never[],
		chainId: chainID
	});

	let rIndex = 0;
	for (const element of tokens) {
		const {address, decimals: injectedDecimals, name: injectedName, symbol: injectedSymbol} = element;
		const balanceOf = decodeAsBigInt(results[rIndex++]);
		const decimals = decodeAsNumber(results[rIndex++]) || injectedDecimals || 18;
		const rawPrice = toBigInt(prices?.[chainID]?.[address]);
		let symbol = decodeAsString(results[rIndex++]) || injectedSymbol || '';
		let name = decodeAsString(results[rIndex++]) || injectedName || '';
		if (isEth(address)) {
			const nativeTokenWrapper = getNetwork(chainID)?.contracts?.wrappedToken;
			if (nativeTokenWrapper) {
				symbol = nativeTokenWrapper.coinSymbol;
				name = nativeTokenWrapper.coinName;
			}
		}

		_data[address] = {
			address: address,
			name: name,
			symbol: symbol,
			decimals: decimals,
			chainID: chainID,
			balance: toNormalizedBN(balanceOf, decimals),
			price: toNormalizedBN(rawPrice, 6),
			value: toNormalizedValue(balanceOf, decimals) * toNormalizedValue(rawPrice, 6),
			stakingValue: 0
		};
	}
	return [_data, undefined];
}

async function getBalances(
	chainID: number,
	address: TAddress,
	tokens: TUseBalancesTokens[],
	prices?: TYDaemonPricesChain
): Promise<[TDict<TToken>, Error | undefined]> {
	let result: TDict<TToken> = {};
	const calls: ContractFunctionConfig[] = [];

	for (const element of tokens) {
		const {address: token} = element;
		const ownerAddress = address;
		if (isEth(token)) {
			const nativeTokenWrapper = getNetwork(chainID)?.contracts?.wrappedToken;
			if (!nativeTokenWrapper) {
				console.error('No native token wrapper found for chainID', chainID);
				continue;
			}
			const multicall3Contract = {address: MULTICALL3_ADDRESS, abi: AGGREGATE3_ABI};
			const baseContract = {address: nativeTokenWrapper.address, abi: erc20ABI};
			calls.push({...multicall3Contract, functionName: 'getEthBalance', args: [ownerAddress]});
			calls.push({...baseContract, functionName: 'decimals'});
			calls.push({...baseContract, functionName: 'symbol'});
			calls.push({...baseContract, functionName: 'name'});
		} else {
			const baseContract = {address: token, abi: erc20ABI};
			calls.push({...baseContract, functionName: 'balanceOf', args: [ownerAddress]});
			calls.push({...baseContract, functionName: 'decimals'});
			calls.push({...baseContract, functionName: 'symbol'});
			calls.push({...baseContract, functionName: 'name'});
		}
	}

	try {
		const [callResult] = await performCall(chainID, calls, tokens, prices);
		result = {...result, ...callResult};
		return [result, undefined];
	} catch (_error) {
		console.error(_error);
		return [result, _error as Error];
	}
}

/* 🔵 - Yearn Finance ******************************************************
 ** This hook can be used to fetch balance information for any ERC20 tokens.
 **************************************************************************/
export function useBalances(props?: TUseBalancesReq): TUseBalancesRes {
	const {address: userAddress} = useWeb3();
	const chainID = useChainId();
	const {onLoadStart, onLoadDone} = useUI();
	const [status, set_status] = useState<TDefaultStatus>(defaultStatus);
	const [error, set_error] = useState<Error | undefined>(undefined);
	const [balances, set_balances] = useState<TChainTokens>({});
	const data = useRef<TDataRef>({nonce: 0, address: toAddress(), balances: {}});
	const stringifiedTokens = useMemo((): string => serialize(props?.tokens || []), [props?.tokens]);

	const updateBalancesCall = useCallback(
		(chainID: number, newRawData: TDict<TToken>): TChainTokens => {
			if (toAddress(userAddress) !== data?.current?.address) {
				data.current = {
					address: toAddress(userAddress),
					balances: {},
					nonce: 0
				};
			}
			data.current.address = toAddress(userAddress);

			for (const [address, element] of Object.entries(newRawData)) {
				if (!data.current.balances[chainID]) {
					data.current.balances[chainID] = {};
				}
				data.current.balances[chainID][address] = {
					...data.current.balances[chainID][address],
					...element
				};
			}
			data.current.nonce += 1;

			set_balances(
				(b): TChainTokens => ({
					...b,
					[chainID]: {
						...(b[chainID] || {}),
						...data.current.balances[chainID]
					}
				})
			);
			return data.current.balances;
		},
		[userAddress]
	);

	/* 🔵 - Yearn Finance ******************************************************
	 ** onUpdate will take the stringified tokens and fetch the balances for each
	 ** token. It will then update the balances state with the new balances.
	 ** This takes the whole list and is not optimized for performance, aka not
	 ** send in a worker.
	 **************************************************************************/
	const onUpdate = useCallback(async (): Promise<TChainTokens> => {
		if (!userAddress) {
			return {};
		}
		const tokenList = deserialize(stringifiedTokens) || [];
		const tokens = tokenList.filter(({address}: TUseBalancesTokens): boolean => !isZeroAddress(address));
		if (isZero(tokens.length)) {
			return {};
		}
		set_status({
			...defaultStatus,
			isLoading: true,
			isFetching: true,
			isRefetching: defaultStatus.isFetched
		});
		onLoadStart();

		const tokensPerChainID: TNDict<TUseBalancesTokens[]> = {};
		for (const token of tokens) {
			if (!tokensPerChainID[token.chainID]) {
				tokensPerChainID[token.chainID] = [];
			}
			tokensPerChainID[token.chainID].push(token);
		}

		const updated: TChainTokens = {};
		for (const [chainIDStr, tokens] of Object.entries(tokensPerChainID)) {
			const chainID = Number(chainIDStr);
			const chunks = [];
			for (let i = 0; i < tokens.length; i += 5_000) {
				chunks.push(tokens.slice(i, i + 5_000));
			}

			for (const chunkTokens of chunks) {
				const [newRawData, err] = await getBalances(chainID || 1, userAddress, chunkTokens);
				if (err) set_error(err as Error);

				if (toAddress(userAddress) !== data?.current?.address) {
					data.current = {
						address: toAddress(userAddress),
						balances: {},
						nonce: 0
					};
				}
				data.current.address = toAddress(userAddress);
				for (const [address, element] of Object.entries(newRawData)) {
					if (!updated[chainID]) {
						updated[chainID] = {};
					}
					updated[chainID][address] = element;

					if (!data.current.balances[chainID]) {
						data.current.balances[chainID] = {};
					}
					data.current.balances[chainID][address] = {
						...data.current.balances[chainID][address],
						...element
					};
				}
				data.current.nonce += 1;
			}

			set_balances(
				(b): TChainTokens => ({
					...b,
					[chainID]: {
						...(b[chainID] || {}),
						...data.current.balances[chainID]
					}
				})
			);
			set_status({...defaultStatus, isSuccess: true, isFetched: true});
		}
		onLoadDone();

		return updated;
	}, [onLoadDone, onLoadStart, stringifiedTokens, userAddress]);

	/* 🔵 - Yearn Finance ******************************************************
	 ** onUpdateSome takes a list of tokens and fetches the balances for each
	 ** token. Even if it's not optimized for performance, it should not be an
	 ** issue as it should only be used for a little list of tokens.
	 **************************************************************************/
	const onUpdateSome = useCallback(
		async (tokenList: TUseBalancesTokens[]): Promise<TChainTokens> => {
			set_status({
				...defaultStatus,
				isLoading: true,
				isFetching: true,
				isRefetching: defaultStatus.isFetched
			});
			onLoadStart();
			const tokens = tokenList.filter(({address}: TUseBalancesTokens): boolean => !isZeroAddress(address));
			const tokensPerChainID: TNDict<TUseBalancesTokens[]> = {};
			for (const token of tokens) {
				if (!tokensPerChainID[token.chainID]) {
					tokensPerChainID[token.chainID] = [];
				}
				tokensPerChainID[token.chainID].push(token);
			}

			const updated: TChainTokens = {};
			for (const [chainIDStr, tokens] of Object.entries(tokensPerChainID)) {
				const chainID = Number(chainIDStr);
				const chunks = [];
				for (let i = 0; i < tokens.length; i += 2_000) {
					chunks.push(tokens.slice(i, i + 2_000));
				}

				for (const chunkTokens of chunks) {
					const [newRawData, err] = await getBalances(chainID || 1, toAddress(userAddress), chunkTokens);
					if (err) set_error(err as Error);
					if (toAddress(userAddress) !== data?.current?.address) {
						data.current = {
							address: toAddress(userAddress),
							balances: {},
							nonce: 0
						};
					}
					data.current.address = toAddress(userAddress);

					for (const [address, element] of Object.entries(newRawData)) {
						if (!updated[chainID]) {
							updated[chainID] = {};
						}
						updated[chainID][address] = element;

						if (!data.current.balances[chainID]) {
							data.current.balances[chainID] = {};
						}
						data.current.balances[chainID][address] = {
							...data.current.balances[chainID][address],
							...element
						};
					}
					data.current.nonce += 1;
				}
			}

			set_balances(
				(b): TChainTokens => ({
					...b,
					[chainID]: {
						...(b[chainID] || {}),
						...data.current.balances[chainID]
					}
				})
			);
			set_status({...defaultStatus, isSuccess: true, isFetched: true});
			onLoadDone();
			return updated;
		},
		[onLoadDone, onLoadStart, userAddress, chainID]
	);

	const assignPrices = useCallback(
		(_rawData: TChainTokens): TChainTokens => {
			const newData = {..._rawData};
			for (const chainIDStr of Object.keys(newData)) {
				const chainID = Number(chainIDStr);
				for (const address of Object.keys(newData[chainID])) {
					const tokenAddress = toAddress(address);
					const rawPrice = toBigInt(props?.prices?.[chainID]?.[tokenAddress]);
					if (!newData[chainID]) {
						newData[chainID] = {};
					}
					newData[chainID][tokenAddress] = {
						...newData[chainID][tokenAddress],
						price: toNormalizedBN(rawPrice, 6),
						value:
							Number(newData?.[chainID]?.[tokenAddress]?.balance?.normalized || 0) *
							toNormalizedValue(rawPrice, 6)
					};
				}
			}
			return newData;
		},
		[props?.prices]
	);

	/* 🔵 - Yearn Finance ******************************************************
	 ** Everytime the stringifiedTokens change, we need to update the balances.
	 ** This is the main hook and is optimized for performance, using a worker
	 ** to fetch the balances, preventing the UI to freeze.
	 **************************************************************************/
	useAsyncTrigger(async (): Promise<void> => {
		if (!userAddress) {
			return;
		}
		set_status({
			...defaultStatus,
			isLoading: true,
			isFetching: true,
			isRefetching: defaultStatus.isFetched
		});
		onLoadStart();

		const tokens = (JSON.parse(stringifiedTokens) || []) as TUseBalancesTokens[];
		const tokensPerChainID: TNDict<TUseBalancesTokens[]> = {};
		for (const token of tokens) {
			if (!tokensPerChainID[token.chainID]) {
				tokensPerChainID[token.chainID] = [];
			}
			tokensPerChainID[token.chainID].push(token);
		}

		for (const [chainIDStr, tokens] of Object.entries(tokensPerChainID)) {
			const chainID = Number(chainIDStr);
			const chunks = [];
			for (let i = 0; i < tokens.length; i += 100) {
				chunks.push(tokens.slice(i, i + 100));
			}
			const allPromises = [];
			for (const chunkTokens of chunks) {
				allPromises.push(
					getBalances(chainID, userAddress, chunkTokens).then(async ([newRawData, err]): Promise<void> => {
						updateBalancesCall(chainID, newRawData);
						set_error(err);
					})
				);
			}
			await Promise.all(allPromises);
		}
		onLoadDone();
		set_status({...defaultStatus, isSuccess: true, isFetched: true});
	}, [stringifiedTokens, userAddress, onLoadStart, updateBalancesCall, onLoadDone]);

	const contextValue = useMemo(
		(): TUseBalancesRes => ({
			data: assignPrices(balances || {}),
			onUpdate: onUpdate,
			onUpdateSome: onUpdateSome,
			error,
			isLoading: status.isLoading,
			isFetching: status.isFetching,
			isSuccess: status.isSuccess,
			isError: status.isError,
			isFetched: status.isFetched,
			isRefetching: status.isRefetching,
			status: status.isError
				? 'error'
				: status.isLoading || status.isFetching
					? 'loading'
					: status.isSuccess
						? 'success'
						: 'unknown'
		}),
		[
			assignPrices,
			balances,
			error,
			onUpdate,
			onUpdateSome,
			status.isError,
			status.isFetched,
			status.isFetching,
			status.isLoading,
			status.isRefetching,
			status.isSuccess
		]
	);

	return contextValue;
}
