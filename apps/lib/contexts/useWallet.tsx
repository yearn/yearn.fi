'use client';

import {createContext, memo, useCallback, useContext, useMemo} from 'react';
import {serialize} from 'wagmi';
import {useDeepCompareMemo, useLocalStorageValue} from '@react-hookz/web';

import {useWeb3} from '../contexts/useWeb3';
import {useAsyncTrigger} from '../hooks/useAsyncTrigger';
import {useBalances} from '../hooks/useBalances.multichains';
import {DEFAULT_ERC20, ETH_TOKEN_ADDRESS, isZeroAddress, toAddress, zeroNormalizedBN} from '../utils';
import {createUniqueID} from '../utils/tools.identifier';
import {retrieveConfig} from '../utils/wagmi';
import {toTokenListToken, toTToken, useTokenList} from './WithTokenList';

import type {ReactElement} from 'react';
import type {TUseBalancesTokens} from '../hooks/useBalances.multichains';
import type {TAddress, TChainTokens, TDict, TNormalizedBN, TToken, TTokenList} from '../types';

type TTokenAndChain = {address: TAddress; chainID: number};
type TWalletContext = {
	getToken: ({address, chainID}: TTokenAndChain) => TToken;
	getBalance: ({address, chainID}: TTokenAndChain) => TNormalizedBN;
	balances: TChainTokens;
	balanceHash: string;
	isLoading: boolean;
	isLoadingOnCurrentChain: boolean;
	isLoadingOnChain: (chainID?: number) => boolean;
	onRefresh: (
		tokenList?: TUseBalancesTokens[],
		shouldSaveInStorage?: boolean,
		shouldForceFetch?: boolean
	) => Promise<TChainTokens>;
	onRefreshWithList: (tokenList: TDict<TToken>) => Promise<TChainTokens>;
};

const defaultProps = {
	getToken: (): TToken => DEFAULT_ERC20,
	getBalance: (): TNormalizedBN => zeroNormalizedBN,
	balances: {},
	balanceHash: '',
	isLoading: true,
	isLoadingOnCurrentChain: true,
	isLoadingOnChain: (): boolean => true,
	onRefresh: async (): Promise<TChainTokens> => ({}),
	onRefreshWithList: async (): Promise<TChainTokens> => ({})
};

/*******************************************************************************
 ** This context controls most of the user's wallet data we may need to
 ** interact with our app, aka mostly the balances and the token prices.
 ******************************************************************************/
const WalletContext = createContext<TWalletContext>(defaultProps);
export const WalletContextApp = memo(function WalletContextApp(props: {
	children: ReactElement;
	shouldWorkOnTestnet?: boolean;
}): ReactElement {
	const {isInitialized, tokenLists} = useTokenList();
	const {chainID, address} = useWeb3();
	const {value: extraTokens, set: saveExtraTokens} = useLocalStorageValue<TTokenList['tokens']>('extraTokens', {
		defaultValue: []
	});

	/**************************************************************************
	 ** Define the list of available tokens. This list is retrieved from the
	 ** tokenList context and filtered to only keep the tokens of the current
	 ** network.
	 **************************************************************************/
	const availableTokens = useMemo((): TUseBalancesTokens[] => {
		if (!isInitialized) {
			return [];
		}
		const tokens: TUseBalancesTokens[] = [];
		for (const forChainID of Object.values(tokenLists)) {
			for (const token of Object.values(forChainID)) {
				tokens.push({
					address: toAddress(token.address),
					chainID: token.chainID,
					decimals: Number(token.decimals),
					name: token.name,
					symbol: token.symbol
				});
				if (chainID === 1337) {
					tokens.push({
						address: toAddress(token.address),
						chainID: 1337,
						decimals: Number(token.decimals),
						name: token.name,
						symbol: token.symbol
					});
				}
			}
		}

		const config = retrieveConfig();
		for (const chain of config.chains) {
			if (chain.testnet && !props.shouldWorkOnTestnet) {
				continue;
			}
			if (chain.id === 1337 && !props.shouldWorkOnTestnet) {
				continue;
			}
			tokens.push({
				address: toAddress(ETH_TOKEN_ADDRESS),
				chainID: chain.id,
				decimals: chain.nativeCurrency.decimals,
				name: chain.nativeCurrency.name,
				symbol: chain.nativeCurrency.symbol
			});
		}
		return tokens;
	}, [tokenLists, chainID, isInitialized, props.shouldWorkOnTestnet]);

	/**************************************************************************
	 ** This hook triggers the fetching of the balances of the available tokens
	 ** and stores them in a state. It also provides a function to refresh the
	 ** balances of the tokens.
	 **************************************************************************/
	const {
		data: balances,
		onUpdate,
		onUpdateSome,
		isLoading,
		chainLoadingStatus
	} = useBalances({
		tokens: availableTokens,
		priorityChainID: chainID
	});

	/**************************************************************************
	 ** onRefresh is a function that allows to refresh the balances of the
	 ** tokens. It takes an optional list of tokens to refresh, and a boolean
	 ** to indicate if the list of tokens should be saved in the local storage.
	 ** This can also be used to add new tokens to the list of available tokens.
	 **************************************************************************/
	const onRefresh = useCallback(
		async (
			tokenToUpdate?: TUseBalancesTokens[],
			shouldSaveInStorage?: boolean,
			shouldForceFetch = false
		): Promise<TChainTokens> => {
			if (tokenToUpdate && tokenToUpdate.length > 0) {
				const updatedBalances = await onUpdateSome(tokenToUpdate, shouldForceFetch);
				if (shouldSaveInStorage) {
					saveExtraTokens([...(extraTokens || []), ...tokenToUpdate.map(t => toTokenListToken(t as TToken))]);
				}
				return updatedBalances;
			}
			const updatedBalances = await onUpdate(shouldForceFetch);
			return updatedBalances;
		},
		[extraTokens, onUpdate, onUpdateSome, saveExtraTokens]
	);

	/**************************************************************************
	 ** onRefreshWithList is a function that allows to refresh the balances of
	 ** the tokens matching the tokenlist structure. It takes a list of tokens
	 ** to refresh and triggers the fetching of the balances of the tokens.
	 **************************************************************************/
	const onRefreshWithList = useCallback(
		async (newTokenList: TDict<TToken>): Promise<TChainTokens> => {
			const withDefaultTokens = [...Object.values(newTokenList)];
			const tokens: TUseBalancesTokens[] = [];
			withDefaultTokens.forEach((token): void => {
				tokens.push({
					address: toAddress(token.address),
					chainID: token.chainID,
					decimals: Number(token.decimals),
					name: token.name,
					symbol: token.symbol
				});
			});
			const tokensToFetch = tokens.filter((token): boolean => {
				return !availableTokens.find((availableToken): boolean => availableToken.address === token.address);
			});
			if (tokensToFetch.length > 0) {
				return await onRefresh(tokensToFetch);
			}
			return balances;
		},
		[balances, onRefresh, availableTokens]
	);

	/**************************************************************************
	 ** This useAsyncTrigger function is used to refresh the balances of the
	 ** tokens that are saved in the local storage. It is triggered when the
	 ** wallet is active.
	 **************************************************************************/
	useAsyncTrigger(async (): Promise<void> => {
		if (extraTokens && !isZeroAddress(address)) {
			await onUpdateSome(extraTokens.map(t => toTToken(t)));
		}
	}, [address, extraTokens, onUpdateSome]);

	/**************************************************************************
	 ** getToken is a safe retrieval of a token from the balances state
	 **************************************************************************/
	const getToken = useCallback(
		({address, chainID}: TTokenAndChain): TToken => balances?.[chainID || 1]?.[address] || DEFAULT_ERC20,
		[balances]
	);

	/**************************************************************************
	 ** getBalance is a safe retrieval of a balance from the balances state
	 **************************************************************************/
	const getBalance = useCallback(
		({address, chainID}: TTokenAndChain): TNormalizedBN =>
			balances?.[chainID || 1]?.[address]?.balance || zeroNormalizedBN,
		[balances]
	);

	/**************************************************************************
	 ** isLoadingOnChain is a safe retrieval of the loading status of a chain
	 **************************************************************************/
	const isLoadingOnChain = useCallback(
		(_chainID?: number): boolean => {
			if (!_chainID) {
				return chainLoadingStatus?.[chainID] || false;
			}
			return chainLoadingStatus?.[_chainID] || false;
		},
		[chainID, chainLoadingStatus]
	);

	/**********************************************************************************************
	 ** Balances is an object with multiple level of depth. We want to create a unique hash from
	 ** it to know when it changes. This new hash will be used to trigger the useEffect hook.
	 ** We will use classic hash function to create a hash from the balances object.
	 *********************************************************************************************/
	const balanceHash = useMemo(() => {
		const hash = createUniqueID(serialize(balances));
		return hash;
	}, [balances]);

	/***************************************************************************
	 **	Setup and render the Context provider to use in the app.
	 ***************************************************************************/
	const contextValue = useDeepCompareMemo(
		(): TWalletContext => ({
			getToken,
			getBalance,
			balances,
			balanceHash,
			isLoading: isLoading || false,
			isLoadingOnCurrentChain: chainLoadingStatus?.[chainID] || false,
			isLoadingOnChain,
			onRefresh,
			onRefreshWithList
		}),
		[
			getToken,
			getBalance,
			balances,
			balanceHash,
			isLoading,
			chainLoadingStatus,
			chainID,
			isLoadingOnChain,
			onRefresh,
			onRefreshWithList
		]
	);

	return <WalletContext.Provider value={contextValue}>{props.children}</WalletContext.Provider>;
});

export const useWallet = (): TWalletContext => useContext(WalletContext);
export default useWallet;
