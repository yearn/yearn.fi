import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Contract} from 'ethcall';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import ERC20_ABI from '@yearn-finance/web-lib/utils/abi/erc20.abi';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import * as format from '@yearn-finance/web-lib/utils/format';
import {formatBN} from '@yearn-finance/web-lib/utils/format';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import * as providers from '@yearn-finance/web-lib/utils/web3/providers';

import type {Call, Provider} from 'ethcall';
import type {BigNumber, ethers} from 'ethers';
import type {DependencyList} from 'react';
import type {TBalanceData, TDefaultStatus} from '@yearn-finance/web-lib/hooks/types';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';
import type {TDict, TNDict} from '@yearn-finance/web-lib/utils/types';

/* 🔵 - Yearn Finance **********************************************************
** Request, Response and helpers for the useBalances hook.
******************************************************************************/
type	TDefaultReqArgs = {
	chainID?: number,
	provider?: ethers.providers.Provider,
}
export type	TUseBalancesTokens = {
	token: string,
	for?: string,
}
export type	TUseBalancesReq = {
	key?: string | number,
	tokens: TUseBalancesTokens[]
	prices?: TDict<string>,
	refreshEvery?: 'block' | 'second' | 'minute' | 'hour' | number,
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

/* 🔵 - Yearn Finance ******************************************************
** This hook can be used to fetch balance information for any ERC20 tokens.
**************************************************************************/
export function	useBalances(props?: TUseBalancesReq): TUseBalancesRes {
	const	{address: web3Address, isActive, provider} = useWeb3();
	const	{chainID: web3ChainID} = useChainID();
	const	[nonce, set_nonce] = useState(0);
	const	[status, set_status] = useState<TDefaultStatus>(defaultStatus);
	const	[error, set_error] = useState<Error | undefined>(undefined);
	const	[balances, set_balances] = useState<TNDict<TDict<TBalanceData>>>({});
	const	data = useRef<TNDict<TDataRef>>({1: {nonce: 0, address: toAddress(), balances: {}}});
	const	interval = useRef<NodeJS.Timer>();
	const	effectDependencies = props?.effectDependencies || [];

	/* 🔵 - Yearn Finance ******************************************************
	** When this hook is called, it will fetch the informations for the
	** specified list of tokens. If no props are specified, the default values
	** will be used.
	**************************************************************************/
	const stringifiedTokens = useMemo((): string => JSON.stringify(props?.tokens || []), [props?.tokens]);

	async function performCall(
		ethcallProvider: Provider,
		calls: Call[],
		tokens: TUseBalancesTokens[]
	): Promise<[TDict<TBalanceData>, Error | undefined]> {
		const	_data: TDict<TBalanceData> = {};
		const	results = await ethcallProvider.tryAll(calls);

		let		rIndex = 0;
		for (const element of tokens) {
			const	{token} = element;
			const	balanceOf = results[rIndex++] as BigNumber;
			const	decimals = results[rIndex++] as number;
			const	rawPrice = formatBN(props?.prices?.[toAddress(token)]);
			let symbol = results[rIndex++] as string;

			if (toAddress(token) === ETH_TOKEN_ADDRESS) {
				symbol = 'ETH';
			}
			_data[toAddress(token)] = {
				decimals: Number(decimals),
				symbol: symbol,
				raw: balanceOf,
				rawPrice,
				normalized: format.toNormalizedValue(balanceOf, Number(decimals)),
				normalizedPrice: format.toNormalizedValue(rawPrice, 6),
				normalizedValue: (format.toNormalizedValue(balanceOf, Number(decimals)) * format.toNormalizedValue(rawPrice, 6))
			};
		}
		return [_data, undefined];
	}

	const getBalances = useCallback(async (tokenList: string): Promise<[TDict<TBalanceData>, Error | undefined]> => {
		let		currentProvider = provider;
		let		shouldUseWalletProvider = true;
		const	tokens = JSON.parse(tokenList) || [];
		if (!isActive || !web3Address || tokens.length === 0) {
			return [{}, undefined];
		}

		if (!provider) {
			currentProvider = providers.getProvider(props?.chainID || web3ChainID || 1);
			shouldUseWalletProvider = false;
		}
		if (props?.chainID && props.chainID !== web3ChainID) {
			currentProvider = providers.getProvider(props?.chainID);
		}

		const	calls = [];
		const	ethcallProvider = await providers.newEthCallProvider(currentProvider);
		for (const element of tokens) {
			const	{token} = element;
			const	ownerAddress = (element?.for || web3Address) as string;
			const	isEth = toAddress(token) === ETH_TOKEN_ADDRESS;
			if (isEth) {
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
			return await performCall(ethcallProvider, calls, tokens);
		} catch (_error) {
			if (shouldUseWalletProvider) {
				const	ethcallProviderOverride = await providers.newEthCallProvider(providers.getProvider(props?.chainID || web3ChainID || 1));
				return await performCall(ethcallProviderOverride, calls, tokens);
			}
			return [{}, _error as Error];
		}
	}, [isActive, web3Address, props?.chainID, props?.prices, web3ChainID, provider, ...effectDependencies]);

	/* 🔵 - Yearn Finance ******************************************************
	** Add an interval to update the balance every X time, based on the
	** refreshEvery prop. This specific effect is not used if the refresh is
	** not set or if it is set to 'block'.
	**************************************************************************/
	useEffect((): () => void => {
		if (props?.refreshEvery && props?.refreshEvery !== 'block') {
			let	delay = props.refreshEvery;
			if (delay === 'second') {
				delay = 1 * 1000;
			} else if (delay === 'minute') {
				delay = 60 * 1000;
			} else if (delay === 'hour') {
				delay = 60 * 60 * 1000;
			}
			interval.current = setInterval((): void => {
				getBalances(stringifiedTokens);
			}, delay as number);
			return (): void => clearInterval(interval.current);
		}
		return (): void => undefined;
	}, [getBalances, props?.refreshEvery, stringifiedTokens]);

	/* 🔵 - Yearn Finance ******************************************************
	** Add an interval to update the balance every X block, based on the
	** refreshEvery prop. This specific effect is not used if the refresh is
	** not set or if it is NOT set to 'block'.
	**************************************************************************/
	useEffect((): () => void => {
		if (!props?.refreshEvery || props?.refreshEvery !== 'block') {
			return (): void => undefined;
		}

		let	currentProvider = props?.provider || providers.getProvider(props?.chainID || web3ChainID || 1);
		if (!props?.provider && props?.chainID === web3ChainID && provider) {
			currentProvider = provider as ethers.providers.BaseProvider | ethers.providers.Web3Provider;
		}
		currentProvider.on('block', async (): Promise<unknown> => getBalances(stringifiedTokens));

		return (): void => {
			currentProvider.off('block', async (): Promise<unknown> => getBalances(stringifiedTokens));
		};
	}, [provider, props?.chainID, props?.provider, props?.refreshEvery, web3ChainID, getBalances, stringifiedTokens]);

	const	onUpdate = useCallback(async (): Promise<TDict<TBalanceData>> => {
		set_status({...defaultStatus, isLoading: true, isFetching: true, isRefetching: defaultStatus.isFetched});

		const	[newRawData, err] = await getBalances(stringifiedTokens);
		if (toAddress(web3Address as string) !== data?.current?.[web3ChainID]?.address) {
			data.current[web3ChainID] = {
				address: toAddress(web3Address as string),
				balances: {},
				nonce: 0
			};
		}
		data.current[web3ChainID].address = toAddress(web3Address as string);

		for (const [address, element] of Object.entries(newRawData)) {
			data.current[web3ChainID].balances[address] = {
				...data.current[web3ChainID].balances[address],
				...element
			};
		}
		data.current[web3ChainID].nonce += 1;

		performBatchedUpdates((): void => {
			set_nonce((n): number => n + 1);
			set_balances((b): TNDict<TDict<TBalanceData>> => ({...b, [web3ChainID]: data.current[web3ChainID].balances}));
			set_error(err as Error);
			set_status({...defaultStatus, isSuccess: true, isFetched: true});
		});
		return data.current[web3ChainID].balances;
	}, [getBalances, stringifiedTokens, web3Address, web3ChainID]);

	const	onUpdateSome = useCallback(async (tokenList: TUseBalancesTokens[]): Promise<TDict<TBalanceData>> => {
		set_status({...defaultStatus, isLoading: true, isFetching: true, isRefetching: defaultStatus.isFetched});

		const	stringifiedSomeTokens = JSON.stringify(tokenList);
		const	[newRawData, err] = await getBalances(stringifiedSomeTokens);
		if (toAddress(web3Address as string) !== data?.current?.[web3ChainID]?.address) {
			data.current[web3ChainID] = {
				address: toAddress(web3Address as string),
				balances: {},
				nonce: 0
			};
		}
		data.current[web3ChainID].address = toAddress(web3Address as string);

		for (const [address, element] of Object.entries(newRawData)) {
			data.current[web3ChainID].balances[address] = {
				...data.current[web3ChainID].balances[address],
				...element
			};
		}
		data.current[web3ChainID].nonce += 1;

		performBatchedUpdates((): void => {
			set_nonce((n): number => n + 1);
			set_balances((b): TNDict<TDict<TBalanceData>> => ({...b, [web3ChainID]: data.current[web3ChainID].balances}));
			set_error(err as Error);
			set_status({...defaultStatus, isSuccess: true, isFetched: true});
		});
		return data.current[web3ChainID].balances;
	}, [getBalances, web3Address, web3ChainID]);

	const assignPrices = useCallback((_rawData: TDict<TBalanceData>): TDict<TBalanceData> => {
		for (const key of Object.keys(_rawData)) {
			const	tokenAddress = toAddress(key);
			const	rawPrice = formatBN(props?.prices?.[tokenAddress]);
			_rawData[tokenAddress] = {
				..._rawData[tokenAddress],
				rawPrice,
				normalizedPrice: format.toNormalizedValue(rawPrice, 6),
				normalizedValue: ((_rawData?.[tokenAddress] || 0).normalized * format.toNormalizedValue(rawPrice, 6))
			};
		}
		return _rawData;
	}, [props?.prices]);

	useEffect((): void => {
		onUpdate();
	}, [onUpdate]);

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
		status: (
			status.isError ? 'error' :
				(status.isLoading || status.isFetching) ? 'loading' :
					(status.isSuccess) ? 'success' : 'unknown'
		)
	}), [assignPrices, balances, error, nonce, onUpdate, onUpdateSome, status.isError, status.isFetched, status.isFetching, status.isLoading, status.isRefetching, status.isSuccess, web3ChainID]);

	return (contextValue);
}
