import {useCallback, useMemo, useRef, useState} from 'react';
import {erc20Abi} from 'viem';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {useAsyncTrigger} from '@builtbymom/web3/hooks/useAsyncTrigger';
import {AGGREGATE3_ABI} from '@builtbymom/web3/utils/abi/aggregate.abi';
import {MULTICALL3_ADDRESS} from '@builtbymom/web3/utils/constants';
import {decodeAsBigInt, decodeAsNumber, decodeAsString} from '@builtbymom/web3/utils/decoder';
import {toBigInt, toNormalizedBN, toNormalizedValue} from '@builtbymom/web3/utils/format';
import {toAddress} from '@builtbymom/web3/utils/tools.address';
import {isEthAddress, isZero, isZeroAddress} from '@builtbymom/web3/utils/tools.is';
import {retrieveConfig} from '@builtbymom/web3/utils/wagmi';
import {getNetwork} from '@builtbymom/web3/utils/wagmi/utils';
import {useDeepCompareMemo} from '@react-hookz/web';
import {deserialize, multicall, serialize} from '@wagmi/core';
import {type MulticallParameters} from '@wagmi/core';
import {useWhyDidYouUpdate} from '@common/hooks/useWhyDidYouUpdate';

import type {DependencyList} from 'react';
import type {Connector} from 'wagmi';
import type {TAddress} from '@builtbymom/web3/types/address';
import type {TChainTokens, TDefaultStatus, TDict, TNDict, TToken} from '@builtbymom/web3/types/mixed';
import type {TPricesChain} from '@builtbymom/web3/types/prices';

/*******************************************************************************
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
	prices?: TPricesChain;
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

type TUpdates = TDict<TToken & {lastUpdate: number}>; // key=chainID/address, value=timestamp
const TOKEN_UPDATE: TUpdates = {};

/*******************************************************************************
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
	calls: MulticallParameters['contracts'][],
	tokens: TUseBalancesTokens[],
	prices?: TPricesChain,
	hasOwnerAddress = true
): Promise<[TDict<TToken>, Error | undefined]> {
	const _data: TDict<TToken> = {};
	const results = await multicall(retrieveConfig(), {
		contracts: calls as never[],
		chainId: chainID
	});

	let rIndex = 0;
	for (const element of tokens) {
		const {address, decimals: injectedDecimals, name: injectedName, symbol: injectedSymbol} = element;
		let balanceOf = 0n;
		if (hasOwnerAddress) {
			balanceOf = decodeAsBigInt(results[rIndex++]);
		}
		const decimals = decodeAsNumber(results[rIndex++]) || injectedDecimals || 18;
		const rawPrice = toBigInt(prices?.[chainID]?.[address]);
		let symbol = decodeAsString(results[rIndex++]) || injectedSymbol || '';
		let name = decodeAsString(results[rIndex++]) || injectedName || '';
		if (isEthAddress(address)) {
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
			value: toNormalizedValue(balanceOf, decimals) * toNormalizedValue(rawPrice, 6)
		};
		TOKEN_UPDATE[`${chainID}/${address}`] = {
			..._data[address],
			lastUpdate: Date.now()
		};
	}
	return [_data, undefined];
}

async function getBalances(
	chainID: number,
	address: TAddress | undefined,
	tokens: TUseBalancesTokens[],
	prices?: TPricesChain
): Promise<[TDict<TToken>, Error | undefined]> {
	let result: TDict<TToken> = {};
	const calls: MulticallParameters['contracts'][] = [];
	const ownerAddress = address;

	for (const element of tokens) {
		const {address: token} = element;
		if (isEthAddress(token)) {
			const nativeTokenWrapper = toAddress(getNetwork(chainID)?.contracts?.wrappedToken?.address);
			if (isZeroAddress(nativeTokenWrapper)) {
				console.error('No native token wrapper found for chainID', chainID);
				continue;
			}
			const multicall3Contract = {address: MULTICALL3_ADDRESS, abi: AGGREGATE3_ABI};
			const baseContract = {address: nativeTokenWrapper, abi: erc20Abi};
			if (ownerAddress) {
				calls.push({...multicall3Contract, functionName: 'getEthBalance', args: [ownerAddress]} as never);
			}
			calls.push({...baseContract, functionName: 'decimals'} as never);
			calls.push({...baseContract, functionName: 'symbol'} as never);
			calls.push({...baseContract, functionName: 'name'} as never);
		} else {
			const baseContract = {address: token, abi: erc20Abi};
			if (ownerAddress) {
				calls.push({...baseContract, functionName: 'balanceOf', args: [ownerAddress]} as never);
			}
			calls.push({...baseContract, functionName: 'decimals'} as never);
			calls.push({...baseContract, functionName: 'symbol'} as never);
			calls.push({...baseContract, functionName: 'name'} as never);
		}
	}

	try {
		const [callResult] = await performCall(
			chainID,
			calls,
			tokens,
			prices,
			Boolean(ownerAddress) && !isZeroAddress(ownerAddress)
		);
		result = {...result, ...callResult};
		return [result, undefined];
	} catch (_error) {
		console.error(_error);
		return [result, _error as Error];
	}
}

/***************************************************************************
 ** This hook can be used to fetch balance information for any ERC20 tokens.
 **************************************************************************/
export function useBalances(props?: TUseBalancesReq): TUseBalancesRes {
	const {address: userAddress} = useWeb3();
	const [status, set_status] = useState<TDefaultStatus>(defaultStatus);
	const [error, set_error] = useState<Error | undefined>(undefined);
	const [balances, set_balances] = useState<TChainTokens>({});
	const data = useRef<TDataRef>({nonce: 0, address: toAddress(), balances: {}});
	const stringifiedTokens = useMemo((): string => serialize(props?.tokens || []), [props?.tokens]);

	const updateBalancesCall = useCallback(
		(currentUserAddress: TAddress, chainID: number, newRawData: TDict<TToken>): TChainTokens => {
			if (toAddress(currentUserAddress) !== data?.current?.address) {
				data.current = {
					address: toAddress(currentUserAddress),
					balances: {},
					nonce: 0
				};
			}
			data.current.address = toAddress(currentUserAddress);

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
		[]
	);

	/***************************************************************************
	 ** onUpdate will take the stringified tokens and fetch the balances for each
	 ** token. It will then update the balances state with the new balances.
	 ** This takes the whole list and is not optimized for performance, aka not
	 ** send in a worker.
	 **************************************************************************/
	const onUpdate = useCallback(async (): Promise<TChainTokens> => {
		const tokenList = (deserialize(stringifiedTokens) || []) as TUseBalancesTokens[];
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
			const tokenUpdateLastUpdate = TOKEN_UPDATE[`${chainID}/${toAddress(userAddress)}`]?.lastUpdate;
			if (tokenUpdateLastUpdate && Date.now() - tokenUpdateLastUpdate < 60_000) {
				const tokenData = TOKEN_UPDATE[`${chainID}/${toAddress(userAddress)}`];
				const {lastUpdate, ...noTimeStamp} = tokenData;
				lastUpdate;
				if (!data.current.balances[chainID]) {
					data.current.balances[chainID] = {};
				}
				data.current.balances[chainID][noTimeStamp.address] = {
					...data.current.balances[chainID][noTimeStamp.address],
					...noTimeStamp
				};
				continue;
			}

			const chunks = [];
			for (let i = 0; i < tokens.length; i += 5_000) {
				chunks.push(tokens.slice(i, i + 5_000));
			}

			for (const chunkTokens of chunks) {
				const [newRawData, err] = await getBalances(chainID || 1, userAddress, chunkTokens);
				if (err) {
					set_error(err as Error);
				}

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

		return updated;
	}, [stringifiedTokens, userAddress]);

	/***************************************************************************
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
			const chains: number[] = [];
			const tokens = tokenList.filter(({address}: TUseBalancesTokens): boolean => !isZeroAddress(address));
			const tokensPerChainID: TNDict<TUseBalancesTokens[]> = {};
			for (const token of tokens) {
				if (!tokensPerChainID[token.chainID]) {
					tokensPerChainID[token.chainID] = [];
				}
				tokensPerChainID[token.chainID].push(token);
				if (!chains.includes(token.chainID)) {
					chains.push(token.chainID);
				}
			}

			const updated: TChainTokens = {};
			for (const [chainIDStr, tokens] of Object.entries(tokensPerChainID)) {
				const chainID = Number(chainIDStr);
				const tokenUpdateLastUpdate = TOKEN_UPDATE[`${chainID}/${toAddress(userAddress)}`]?.lastUpdate;
				if (tokenUpdateLastUpdate && Date.now() - tokenUpdateLastUpdate < 60_000) {
					const tokenData = TOKEN_UPDATE[`${chainID}/${toAddress(userAddress)}`];
					const {lastUpdate, ...noTimeStamp} = tokenData;
					lastUpdate;
					if (!data.current.balances[chainID]) {
						data.current.balances[chainID] = {};
					}
					data.current.balances[chainID][noTimeStamp.address] = {
						...data.current.balances[chainID][noTimeStamp.address],
						...noTimeStamp
					};
					continue;
				}

				const chunks = [];
				for (let i = 0; i < tokens.length; i += 5_000) {
					chunks.push(tokens.slice(i, i + 5_000));
				}
				for (const chunkTokens of chunks) {
					const [newRawData, err] = await getBalances(chainID || 1, toAddress(userAddress), chunkTokens);
					if (err) {
						set_error(err as Error);
					}
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

			set_balances(previous => {
				const updated = {...previous};
				for (const [chainID, chainData] of Object.entries(data.current.balances)) {
					updated[Number(chainID)] = {...updated[Number(chainID)], ...chainData};
				}
				return updated;
			});
			set_status({...defaultStatus, isSuccess: true, isFetched: true});
			return updated;
		},
		[userAddress]
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

	useWhyDidYouUpdate('useBalances', {stringifiedTokens});

	/***************************************************************************
	 ** Everytime the stringifiedTokens change, we need to update the balances.
	 ** This is the main hook and is optimized for performance, using a worker
	 ** to fetch the balances, preventing the UI to freeze.
	 **************************************************************************/
	useAsyncTrigger(async (): Promise<void> => {
		set_status({
			...defaultStatus,
			isLoading: true,
			isFetching: true,
			isRefetching: defaultStatus.isFetched
		});

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
			const tokenUpdateLastUpdate = TOKEN_UPDATE[`${chainID}/${toAddress(userAddress)}`]?.lastUpdate;
			if (tokenUpdateLastUpdate && Date.now() - tokenUpdateLastUpdate < 60_000) {
				const tokenData = TOKEN_UPDATE[`${chainID}/${toAddress(userAddress)}`];
				const {lastUpdate, ...noTimeStamp} = tokenData;
				lastUpdate;
				if (!data.current.balances[chainID]) {
					data.current.balances[chainID] = {};
				}
				data.current.balances[chainID][noTimeStamp.address] = {
					...data.current.balances[chainID][noTimeStamp.address],
					...noTimeStamp
				};
				continue;
			}

			const chunks = [];
			for (let i = 0; i < tokens.length; i += 5_000) {
				chunks.push(tokens.slice(i, i + 5_000));
			}
			const allPromises = [];
			for (const chunkTokens of chunks) {
				allPromises.push(
					getBalances(chainID, userAddress, chunkTokens).then(async ([newRawData, err]): Promise<void> => {
						updateBalancesCall(toAddress(userAddress), chainID, newRawData);
						set_error(err);
					})
				);
			}
			await Promise.all(allPromises);
		}
		set_status({...defaultStatus, isSuccess: true, isFetched: true});
	}, [stringifiedTokens, userAddress, updateBalancesCall]);

	const contextValue = useDeepCompareMemo(
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
