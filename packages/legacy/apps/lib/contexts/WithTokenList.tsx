'use client';

import {createContext, useCallback, useContext, useMemo, useState} from 'react';
import {isAddressEqual} from 'viem';
import axios from 'axios';
import {useLocalStorageValue} from '@react-hookz/web';

import {useAsyncTrigger} from '../hooks/useAsyncTrigger';
import {zeroNormalizedBN} from '../utils/format';
import {toAddress} from '../utils/tools.address';
import {useWeb3} from './useWeb3';

import type {AxiosResponse} from 'axios';
import type {Dispatch, ReactElement, SetStateAction} from 'react';
import type {TAddress} from '../types/address';
import type {TDict, TNDict, TToken, TTokenList} from '../types/mixed';

export type TTokenListProps = {
	tokenLists: TNDict<TDict<TToken>>;
	currentNetworkTokenList: TDict<TToken>;
	isInitialized: boolean;
	isFromExtraList: (props: {address: TAddress; chainID: number}) => boolean;
	isCustomToken: (props: {address: TAddress; chainID: number}) => boolean;
	getToken: (props: {address: TAddress; chainID: number}) => TToken | undefined;
	addCustomToken: (token: TToken) => void;
	set_tokenList: Dispatch<SetStateAction<TNDict<TDict<TToken>>>>;
};
const defaultProps: TTokenListProps = {
	tokenLists: {},
	currentNetworkTokenList: {},
	isInitialized: false,
	isFromExtraList: (): boolean => false,
	isCustomToken: (): boolean => false,
	getToken: (): TToken | undefined => undefined,
	addCustomToken: (): void => undefined,
	set_tokenList: (): void => undefined
};

/******************************************************************************
 ** Helper function to convert a token from the TToken type to the token list
 ** type.
 ******************************************************************************/
export function toTokenListToken(token: TToken): TTokenList['tokens'][0] {
	return {
		address: token.address,
		chainId: token.chainID,
		decimals: token.decimals,
		logoURI: token.logoURI,
		name: token.name,
		symbol: token.symbol
	};
}

/******************************************************************************
 ** Helper function to convert a token from the token list to a TToken type
 ******************************************************************************/
export function toTToken(token: TTokenList['tokens'][0]): TToken {
	return {
		address: token.address,
		chainID: token.chainId,
		decimals: token.decimals,
		logoURI: token.logoURI,
		name: token.name,
		symbol: token.symbol,
		value: 0,
		balance: zeroNormalizedBN
	};
}

const TokenList = createContext<TTokenListProps>(defaultProps);
type TTokenListProviderProps = {
	children: ReactElement;
	lists?: string[];
};
export const WithTokenList = ({
	children,
	lists = [
		'https://raw.githubusercontent.com/yearn/tokenLists/main/lists/etherscan.json',
		'https://raw.githubusercontent.com/yearn/tokenLists/main/lists/tokenlistooor.json'
	]
}: TTokenListProviderProps): ReactElement => {
	const {chainID} = useWeb3();
	const {value: extraTokenlist} = useLocalStorageValue<string[]>('extraTokenlists');
	const {value: extraTokens, set: set_extraTokens} = useLocalStorageValue<TTokenList['tokens']>('extraTokens');
	const [tokenList, set_tokenList] = useState<TNDict<TDict<TToken>>>({});
	const [tokenListExtra, set_tokenListExtra] = useState<TNDict<TDict<TToken>>>({});
	const [tokenListCustom, set_tokenListCustom] = useState<TNDict<TDict<TToken>>>({});
	const [isInitialized, set_isInitialized] = useState([false, false, false]);
	const hashList = useMemo((): string => lists.join(','), [lists]);

	/************************************************************************************
	 ** This is the main function that will be called when the component mounts and
	 ** whenever the hashList changes. It will fetch all the token lists from the
	 ** hashList and then add them to the tokenList state.
	 ** This is the list coming from the props.
	 ************************************************************************************/
	useAsyncTrigger(async (): Promise<void> => {
		const unhashedLists = hashList.split(',');
		const responses = await Promise.allSettled(
			unhashedLists.map(async (eachURI: string): Promise<AxiosResponse> => axios.get(eachURI))
		);
		const tokens: TTokenList['tokens'] = [];
		const fromList: TTokenList[] = [];

		for (const [index, response] of responses.entries()) {
			if (response.status === 'fulfilled') {
				tokens.push(...(response.value.data as TTokenList).tokens);
				fromList.push({...(response.value.data as TTokenList), uri: unhashedLists[index]});
			}
		}

		const tokenListTokens: TNDict<TDict<TToken>> = {};
		for (const eachToken of tokens) {
			if (!tokenListTokens[eachToken.chainId]) {
				tokenListTokens[eachToken.chainId] = {};
			}
			if (!tokenListTokens[eachToken.chainId][toAddress(eachToken.address)]) {
				tokenListTokens[eachToken.chainId][toAddress(eachToken.address)] = {
					address: eachToken.address,
					name: eachToken.name,
					symbol: eachToken.symbol,
					decimals: eachToken.decimals,
					chainID: eachToken.chainId,
					logoURI: eachToken.logoURI,
					value: 0,
					balance: zeroNormalizedBN
				};
			}

			/**************************************************************************************
			 ** If we are in development mode, we also want to add the token to our list, but only
			 ** if the token's chainID is 1 (Ethereum).
			 *************************************************************************************/
			if (
				process.env.NODE_ENV === 'development' &&
				Boolean(process.env.SHOULD_USE_FORKNET) &&
				eachToken.chainId === 1
			) {
				if (!tokenListTokens[1337]) {
					tokenListTokens[1337] = {};
				}
				if (!tokenListTokens[1337][toAddress(eachToken.address)]) {
					tokenListTokens[1337][toAddress(eachToken.address)] = {
						address: eachToken.address,
						name: eachToken.name,
						symbol: eachToken.symbol,
						decimals: eachToken.decimals,
						chainID: 1337,
						logoURI: eachToken.logoURI,
						value: 0,
						balance: zeroNormalizedBN
					};
				}
			}
		}
		set_tokenList(tokenListTokens);
		set_isInitialized(prev => [true, prev[1], prev[2]]);
	}, [hashList]);

	/************************************************************************************
	 ** This trigger will load the lists from the extraTokenlist state. It's not about
	 ** individual tokens, but about the whole list, that can be added by the user from
	 ** the Smol tokenlist repository.
	 ************************************************************************************/
	useAsyncTrigger(async (): Promise<void> => {
		const tokenListTokens: TNDict<TDict<TToken>> = {};
		const fromList: TTokenList[] = [];

		for (const eachURI of extraTokenlist || []) {
			const [fromUserList] = await Promise.allSettled([axios.get(eachURI)]);

			if (fromUserList.status === 'fulfilled') {
				fromList.push({...(fromUserList.value.data as TTokenList), uri: eachURI});
				const {tokens} = fromUserList.value.data;
				for (const eachToken of tokens) {
					if (!tokenListTokens[eachToken.chainId ?? eachToken.chainID]) {
						tokenListTokens[eachToken.chainId ?? eachToken.chainID] = {};
					}
					if (!tokenListTokens[eachToken.chainId ?? eachToken.chainID][toAddress(eachToken.address)]) {
						tokenListTokens[eachToken.chainId ?? eachToken.chainID][toAddress(eachToken.address)] = {
							address: eachToken.address,
							name: eachToken.name,
							symbol: eachToken.symbol,
							decimals: eachToken.decimals,
							chainID: eachToken.chainID ?? eachToken.chainId,
							logoURI: eachToken.logoURI,
							value: 0,
							balance: zeroNormalizedBN
						};
					}

					/**************************************************************************************
					 ** If we are in development mode, we also want to add the token to our list, but only
					 ** if the token's chainID is 1 (Ethereum).
					 *************************************************************************************/
					if (
						process.env.NODE_ENV === 'development' &&
						Boolean(process.env.SHOULD_USE_FORKNET) &&
						(eachToken.chainID ?? eachToken.chainId) === 1
					) {
						if (!tokenListTokens[1337]) {
							tokenListTokens[1337] = {};
						}
						if (!tokenListTokens[1337][toAddress(eachToken.address)]) {
							tokenListTokens[1337][toAddress(eachToken.address)] = {
								address: eachToken.address,
								name: eachToken.name,
								symbol: eachToken.symbol,
								decimals: eachToken.decimals,
								chainID: 1337,
								logoURI: eachToken.logoURI,
								value: 0,
								balance: zeroNormalizedBN
							};
						}
					}
				}
			}
		}
		set_tokenListExtra(tokenListTokens);
		set_isInitialized(prev => [prev[0], true, prev[2]]);
	}, [extraTokenlist]);

	/************************************************************************************
	 ** This trigger will load the lists from the extraTokens state. It's about individual
	 ** tokens, that can be added by the user.
	 ************************************************************************************/
	useAsyncTrigger(async (): Promise<void> => {
		if (extraTokens === undefined) {
			return;
		}
		if ((extraTokens || []).length > 0) {
			const tokenListTokens: TNDict<TDict<TToken>> = {};
			for (const eachToken of extraTokens || []) {
				if (!tokenListTokens[eachToken.chainId]) {
					tokenListTokens[eachToken.chainId] = {};
				}
				if (!tokenListTokens[eachToken.chainId][toAddress(eachToken.address)]) {
					tokenListTokens[eachToken.chainId][toAddress(eachToken.address)] = {
						address: eachToken.address,
						name: eachToken.name,
						symbol: eachToken.symbol,
						decimals: eachToken.decimals,
						chainID: eachToken.chainId,
						logoURI: eachToken.logoURI,
						value: 0,
						balance: zeroNormalizedBN
					};
				}
				/**************************************************************************************
				 ** If we are in development mode, we also want to add the token to our list, but only
				 ** if the token's chainID is 1 (Ethereum).
				 *************************************************************************************/
				if (
					process.env.NODE_ENV === 'development' &&
					Boolean(process.env.SHOULD_USE_FORKNET) &&
					eachToken.chainId === 1
				) {
					if (!tokenListTokens[1337]) {
						tokenListTokens[1337] = {};
					}
					if (!tokenListTokens[1337][toAddress(eachToken.address)]) {
						tokenListTokens[1337][toAddress(eachToken.address)] = {
							address: eachToken.address,
							name: eachToken.name,
							symbol: eachToken.symbol,
							decimals: eachToken.decimals,
							chainID: 1337,
							logoURI: eachToken.logoURI,
							value: 0,
							balance: zeroNormalizedBN
						};
					}
				}
			}
			set_tokenListCustom(tokenListTokens);
		}
		set_isInitialized(prev => [prev[0], prev[1], true]);
	}, [extraTokens]);

	/************************************************************************************
	 ** This will aggregate all the token lists into one big list, that will be used
	 ** by the app.
	 ************************************************************************************/
	const aggregatedTokenList = useMemo((): TNDict<TDict<TToken>> => {
		const aggregatedTokenList: TNDict<TDict<TToken>> = {};
		for (const eachChainID of Object.keys(tokenList)) {
			if (!aggregatedTokenList[Number(eachChainID)]) {
				aggregatedTokenList[Number(eachChainID)] = {};
			}
			for (const eachToken of Object.values(tokenList[Number(eachChainID)])) {
				aggregatedTokenList[Number(eachChainID)][toAddress(eachToken.address)] = eachToken;
			}
		}

		for (const eachChainID of Object.keys(tokenListExtra)) {
			if (!aggregatedTokenList[Number(eachChainID)]) {
				aggregatedTokenList[Number(eachChainID)] = {};
			}
			for (const eachToken of Object.values(tokenListExtra[Number(eachChainID)])) {
				aggregatedTokenList[Number(eachChainID)][toAddress(eachToken.address)] = eachToken;
			}
		}

		for (const eachChainID of Object.keys(tokenListCustom)) {
			if (!aggregatedTokenList[Number(eachChainID)]) {
				aggregatedTokenList[Number(eachChainID)] = {};
			}
			for (const eachToken of Object.values(tokenListCustom[Number(eachChainID)])) {
				aggregatedTokenList[Number(eachChainID)][toAddress(eachToken.address)] = eachToken;
			}
		}
		return aggregatedTokenList;
	}, [tokenList, tokenListCustom, tokenListExtra]);

	/************************************************************************************
	 ** This will return the token list for the current network.
	 ************************************************************************************/
	const currentNetworkList: TDict<TToken> = useMemo(
		() => aggregatedTokenList?.[chainID] || {},
		[aggregatedTokenList, chainID]
	);

	/************************************************************************************
	 ** This will return a specific token from the token list, or an empty object if the
	 ** token is not found.
	 ************************************************************************************/
	const getToken = useCallback(
		(props: {address: TAddress; chainID: number}): TToken => {
			const fromTokenList = aggregatedTokenList?.[props.chainID]?.[toAddress(props.address)];
			if (fromTokenList) {
				return fromTokenList;
			}
			return {} as TToken;
		},
		[aggregatedTokenList]
	);

	/************************************************************************************
	 ** This will return true if the token is from the tokenListExtra.
	 ************************************************************************************/
	const isFromExtraList = useCallback(
		(props: {address: TAddress; chainID: number}): boolean => {
			return Boolean(tokenListExtra?.[props.chainID]?.[toAddress(props.address)]);
		},
		[tokenListExtra]
	);

	/************************************************************************************
	 ** This will return true if the token is from the tokenListCustom, aka added by the
	 ** user as an individual token.
	 ************************************************************************************/
	const isCustomToken = useCallback(
		(props: {address: TAddress; chainID: number}): boolean => {
			return Boolean(tokenListCustom?.[props.chainID]?.[toAddress(props.address)]);
		},
		[tokenListCustom]
	);

	/************************************************************************************
	 ** This will add a token to the tokenListCustom.
	 ************************************************************************************/
	const addCustomToken = useCallback(
		(token: TToken) => {
			const arr = extraTokens ?? [];
			if (!arr.some(t => isAddressEqual(t.address, token.address) && t.chainId === token.chainID)) {
				set_extraTokens([...arr, toTokenListToken(token)]);
			}
		},
		[extraTokens, set_extraTokens]
	);

	const contextValue = useMemo(
		(): TTokenListProps => ({
			tokenLists: aggregatedTokenList,
			currentNetworkTokenList: currentNetworkList,
			isFromExtraList,
			isCustomToken,
			isInitialized: isInitialized[0] && isInitialized[1] && isInitialized[2],
			set_tokenList,
			addCustomToken,
			getToken
		}),
		[
			addCustomToken,
			aggregatedTokenList,
			currentNetworkList,
			getToken,
			isCustomToken,
			isInitialized,
			isFromExtraList
		]
	);

	return <TokenList.Provider value={contextValue}>{children}</TokenList.Provider>;
};

export const useTokenList = (): TTokenListProps => useContext(TokenList);
