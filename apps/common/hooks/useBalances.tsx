import {useCallback, useMemo, useRef, useState} from 'react';
import {Contract} from 'ethcall';
import axios from 'axios';
import {useUpdateEffect} from '@react-hookz/web';
import {useUI} from '@yearn-finance/web-lib/contexts/useUI';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {VoidTBalanceData} from '@yearn-finance/web-lib/hooks/useBalances';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import ERC20_ABI from '@yearn-finance/web-lib/utils/abi/erc20.abi';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatToNormalizedValue, toBigInt, toNumber} from '@yearn-finance/web-lib/utils/format';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import {getProvider, newEthCallProvider} from '@yearn-finance/web-lib/utils/web3/providers';

import type {AxiosResponse} from 'axios';
import type {Call, Provider} from 'ethcall';
import type {TGetBatchBalancesResp} from 'pages/api/getBatchBalances';
import type {DependencyList} from 'react';
import type {TWeb3Provider} from '@yearn-finance/web-lib/contexts/types';
import type {TBalanceData, TDefaultStatus} from '@yearn-finance/web-lib/hooks/types';
import type {Maybe, TAddress, TDict, TNDict} from '@yearn-finance/web-lib/types';

/* 🔵 - Yearn Finance **********************************************************
** Request, Response and helpers for the useBalances hook.
******************************************************************************/
type	TDefaultReqArgs = {
	chainID?: number,
	provider?: TWeb3Provider,
}
export type	TUseBalancesTokens = {
	token: string,
	for?: string,
}
export type	TUseBalancesReq = {
	key?: string | number,
	tokens: TUseBalancesTokens[]
	prices?: TDict<string>,
	effectDependencies?: DependencyList
} & TDefaultReqArgs

export type	TUseBalancesRes = {
	data: TDict<TBalanceData>,
	update: () => Promise<TDict<TBalanceData>>,
	updateSome: (token: TUseBalancesTokens[]) => Promise<TDict<TBalanceData>>,
	error?: Error,
	status: 'error' | 'loading' | 'success' | 'unknown',
	nonce: number
} & TDefaultStatus

type TDataRef = {
	nonce: number,
	address: TAddress,
	balances: TDict<TBalanceData>,
}

/* 🔵 - Yearn Finance **********************************************************
** Default status for the loading state.
******************************************************************************/
const		defaultStatus = {
	isLoading: false,
	isFetching: false,
	isSuccess: false,
	isError: false,
	isFetched: false,
	isRefetching: false
};

async function performCall(
	ethcallProvider: Provider,
	calls: Call[],
	tokens: TUseBalancesTokens[],
	prices?: TDict<string>
): Promise<[TDict<TBalanceData>, Maybe<Error>]> {
	const	_data: TDict<TBalanceData> = {};
	const	results = await ethcallProvider.tryAll(calls);

	let		rIndex = 0;
	for (const element of tokens) {
		const	{token} = element;
		const	balanceOf = toBigInt(results[rIndex++] as bigint);
		const	decimals = toBigInt(results[rIndex++] as bigint);
		const	rawPrice = toBigInt(prices?.[toAddress(token)]);
		let symbol = results[rIndex++] as string;

		if (toAddress(token) === ETH_TOKEN_ADDRESS) {
			symbol = 'ETH';
		}
		_data[toAddress(token)] = {
			decimals: decimals,
			symbol: symbol,
			raw: balanceOf,
			rawPrice,
			normalized: formatToNormalizedValue(balanceOf, decimals),
			normalizedPrice: formatToNormalizedValue(rawPrice, 6),
			normalizedValue: formatToNormalizedValue(balanceOf, decimals) * formatToNormalizedValue(rawPrice, 6)
		};
	}
	return [_data, undefined];
}

async function getBalances(
	provider: TWeb3Provider,
	fallBackProvider: TWeb3Provider,
	ownerAddress: TAddress,
	tokens: TUseBalancesTokens[],
	prices?: TDict<string>
): Promise<[TDict<TBalanceData>, Maybe<Error>]> {
	const	result: TDict<TBalanceData> = {};
	const	currentProvider = provider;
	const	calls = [];
	const	ethcallProvider = await newEthCallProvider(currentProvider);

	for (const {token} of tokens) {
		if (toAddress(token) === ETH_TOKEN_ADDRESS) {
			const	tokenContract = new Contract(WETH_TOKEN_ADDRESS, ERC20_ABI);
			calls.push(
				ethcallProvider.getEthBalance(ownerAddress),
				tokenContract.decimals(),
				tokenContract.symbol()
			);
		} else {
			const	tokenContract = new Contract(token, ERC20_ABI);
			calls.push(
				tokenContract.balanceOf(ownerAddress),
				tokenContract.decimals(),
				tokenContract.symbol()
			);
		}
	}

	try {
		const	[callResult, error] = await performCall(ethcallProvider, calls, tokens, prices);
		return [{...result, ...callResult}, error];
	} catch (error) {
		if (fallBackProvider) {
			const	ethcallProviderOverride = await newEthCallProvider(fallBackProvider);
			const	[callResult, error] = await performCall(ethcallProviderOverride, calls, tokens, prices);
			return [{...result, ...callResult}, error];
		}
		console.error(error);
		return [result, error as Error];
	}
}


/* 🔵 - Yearn Finance ******************************************************
** This hook can be used to fetch balance information for any ERC20 tokens.
**************************************************************************/
export function	useBalances(props?: TUseBalancesReq): TUseBalancesRes {
	const	{address: web3Address, isActive, provider} = useWeb3();
	const	{chainID: web3ChainID} = useChainID();
	const	{onLoadStart, onLoadDone} = useUI();
	const	[nonce, set_nonce] = useState(0);
	const	[status, set_status] = useState<TDefaultStatus>(defaultStatus);
	const	[error, set_error] = useState<Maybe<Error>>(undefined);
	const	[balances, set_balances] = useState<TNDict<TDict<TBalanceData>>>({});
	const	data = useRef<TNDict<TDataRef>>({});
	const	stringifiedTokens = useMemo((): string => JSON.stringify(props?.tokens || []), [props?.tokens]);

	const	initialDataRefValue = useMemo((): TDataRef => ({
		address: toAddress(web3Address),
		nonce: 0,
		balances: {}
	}), [web3Address]);

	const	updateBalancesCall = useCallback((chainID: number, newRawData: TDict<TBalanceData>): TDict<TBalanceData> => {
		const	currentState: TDataRef = data.current[chainID] || initialDataRefValue;
		if (toAddress(web3Address) !== currentState.address) {
			currentState.address = toAddress(web3Address);
			currentState.balances = {};
			currentState.nonce = 0;
		}

		for (const [address, element] of Object.entries(newRawData)) {
			if (element) {
				currentState.balances[address] = {
					...currentState.balances[address],
					...element
				};
			}
		}
		currentState.address = toAddress(web3Address);
		currentState.nonce += 1;

		performBatchedUpdates((): void => {
			set_balances((b): TNDict<TDict<TBalanceData>> => ({
				...b,
				[chainID]: {
					...b[chainID] || {},
					...currentState.balances
				}
			}));
			set_nonce((n): number => n + 1);
			set_status({...defaultStatus, isSuccess: true, isFetched: true});
		});
		onLoadDone();

		return currentState.balances;
	}, [initialDataRefValue, onLoadDone, web3Address]);

	/* 🔵 - Yearn Finance ******************************************************
	** onUpdateSome takes a list of tokens and fetches the balances for each
	** token. Even if it's not optimized for performance, it should not be an
	** issue as it should only be used for a little list of tokens.
	**************************************************************************/
	const	onUpdate = useCallback(async (): Promise<TDict<TBalanceData>> => {
		if (!isActive || !web3Address || !provider) {
			return {};
		}
		const	currentState: TDataRef = data.current[web3ChainID] || initialDataRefValue;
		const	tokenList = JSON.parse(stringifiedTokens) || [];
		const	tokens = tokenList.filter(({token}: TUseBalancesTokens): boolean => !isZeroAddress(token));
		if (tokens.length === 0) {
			return {};
		}
		set_status({...defaultStatus, isLoading: true, isFetching: true, isRefetching: defaultStatus.isFetched});
		onLoadStart();

		const	chunks = [];
		for (let i = 0; i < tokens.length; i += 5_000) {
			chunks.push(tokens.slice(i, i + 5_000));
		}

		for (const chunkTokens of chunks) {
			const	[newRawData, err] = await getBalances(
				provider,
				getProvider(props?.chainID || web3ChainID || 1),
				web3Address,
				chunkTokens,
				props?.prices
			);
			if (toAddress(web3Address as string) !== data?.current?.[web3ChainID]?.address) {
				data.current[web3ChainID] = {
					address: toAddress(web3Address as string),
					balances: {},
					nonce: 0
				};
			}

			for (const [address, element] of Object.entries(newRawData)) {
				if (element) {
					currentState.balances[address] = {
						...currentState.balances[address],
						...element
					};
				}
			}
			currentState.address = toAddress(web3Address as string);
			currentState.nonce += 1;

			performBatchedUpdates((): void => {
				set_balances((b): TNDict<TDict<TBalanceData>> => ({
					...b,
					[web3ChainID]: {
						...b[web3ChainID] || {},
						...currentState.balances
					}
				}));
				set_nonce((n): number => n + 1);
				set_error(err as Error);
				set_status({...defaultStatus, isSuccess: true, isFetched: true});
			});
			onLoadDone();
		}
		return currentState.balances;
	}, [initialDataRefValue, isActive, onLoadDone, onLoadStart, props?.chainID, props?.prices, provider, stringifiedTokens, web3Address, web3ChainID]);

	/* 🔵 - Yearn Finance ******************************************************
	** onUpdateSome takes a list of tokens and fetches the balances for each
	** token. Even if it's not optimized for performance, it should not be an
	** issue as it should only be used for a little list of tokens.
	**************************************************************************/
	const	onUpdateSome = useCallback(async (tokenList: TUseBalancesTokens[]): Promise<TDict<TBalanceData>> => {
		set_status({...defaultStatus, isLoading: true, isFetching: true, isRefetching: defaultStatus.isFetched});

		const	currentState: TDataRef = data.current[web3ChainID] || initialDataRefValue;
		const	tokens = tokenList.filter(({token}: TUseBalancesTokens): boolean => !isZeroAddress(token));
		const	[newRawData, err] = await getBalances(
			provider,
			getProvider(props?.chainID || web3ChainID || 1),
			toAddress(web3Address as string),
			tokens,
			props?.prices
		);
		if (toAddress(web3Address as string) !== data?.current?.[web3ChainID]?.address) {
			data.current[web3ChainID] = {
				address: toAddress(web3Address as string),
				balances: {},
				nonce: 0
			};
		}
		currentState.address = toAddress(web3Address as string);

		const tokensAdded: TDict<TBalanceData> = {};
		for (const [address, element] of Object.entries(newRawData)) {
			if (element) {
				tokensAdded[address] = element;
				currentState.balances[address] = {
					...currentState.balances[address],
					...element
				};
			}
		}
		currentState.nonce += 1;

		performBatchedUpdates((): void => {
			set_balances((b): TNDict<TDict<TBalanceData>> => ({
				...b,
				[web3ChainID]: {
					...b[web3ChainID] || {},
					...currentState.balances
				}
			}));
			set_nonce((n): number => n + 1);
			set_error(err as Error);
			set_status({...defaultStatus, isSuccess: true, isFetched: true});
		});
		//Returns the tokens added
		return tokensAdded;
	}, [initialDataRefValue, props?.chainID, props?.prices, provider, web3Address, web3ChainID]);

	const	assignPrices = useCallback((_rawData: TDict<TBalanceData>): TDict<TBalanceData> => {
		for (const key of Object.keys(_rawData)) {
			const	tokenAddress = toAddress(key);
			const	rawPrice = toBigInt(props?.prices?.[tokenAddress]);
			if (_rawData[tokenAddress]) {
				_rawData[tokenAddress] = {
					..._rawData[tokenAddress],
					rawPrice,
					normalizedPrice: formatToNormalizedValue(rawPrice, 6),
					normalizedValue: toNumber(_rawData?.[tokenAddress]?.normalized) * formatToNormalizedValue(rawPrice, 6)
				};
			} else {
				_rawData[tokenAddress] = {
					...VoidTBalanceData,
					rawPrice,
					normalizedPrice: formatToNormalizedValue(rawPrice, 6),
					normalizedValue: 0
				};
			}
		}
		return _rawData;
	}, [props?.prices]);

	/* 🔵 - Yearn Finance ******************************************************
	** Everytime the stringifiedTokens change, we need to update the balances.
	** This is the main hook and is optimized for performance, using a worker
	** to fetch the balances, preventing the UI to freeze.
	**************************************************************************/
	useUpdateEffect((): void => {
		if (!isActive || !web3Address || !provider) {
			return;
		}
		set_status({...defaultStatus, isLoading: true, isFetching: true, isRefetching: defaultStatus.isFetched});
		onLoadStart();

		const	tokens = JSON.parse(stringifiedTokens) || [];
		const	chainID = props?.chainID || web3ChainID || 1;
		axios.post('/api/getBatchBalances', {chainID, address: web3Address, tokens})
			.then((res: AxiosResponse<TGetBatchBalancesResp>): void => {
				updateBalancesCall(res.data.chainID, res.data.balances);
			})
			.catch((err): void => {
				console.error(err);
				onLoadDone();
				onUpdateSome(tokens);
			});
	}, [stringifiedTokens, isActive, web3Address, web3ChainID]);


	const	contextValue = useMemo((): TUseBalancesRes => ({
		data: assignPrices(balances[web3ChainID] || {}),
		nonce,
		update: onUpdate,
		updateSome: onUpdateSome,
		error,
		isLoading: status.isLoading,
		isFetching: status.isFetching,
		isSuccess: status.isSuccess,
		isError: status.isError,
		isFetched: status.isFetched,
		isRefetching: status.isRefetching,
		status:
			status.isError ? 'error' :
				status.isLoading || status.isFetching ? 'loading' :
					status.isSuccess ? 'success' : 'unknown'

	}), [assignPrices, balances, error, nonce, onUpdate, onUpdateSome, status.isError, status.isFetched, status.isFetching, status.isLoading, status.isRefetching, status.isSuccess, web3ChainID]);

	return contextValue;
}
