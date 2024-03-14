import {createContext, memo, useCallback, useContext, useMemo, useState} from 'react';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {useFetch} from '@builtbymom/web3/hooks/useFetch';
import {isZeroAddress, toAddress, zeroNormalizedBN} from '@builtbymom/web3/utils';
import {useDeepCompareEffect} from '@react-hookz/web';
import {useYDaemonBaseURI} from '@yearn-finance/web-lib/hooks/useYDaemonBaseURI';
import {
	type TSupportedZaps,
	type TYDaemonTokenListBalances,
	yDaemonTokenListBalances
} from '@yearn-finance/web-lib/utils/schemas/yDaemonTokenListBalances';
import {useYearn} from '@common/contexts/useYearn';

import type {ReactElement} from 'react';
import type {TYChainTokens, TYToken} from '@yearn-finance/web-lib/types';
import type {TUseBalancesTokens} from '@builtbymom/web3/hooks/useBalances.multichains';
import type {TAddress, TDict, TNormalizedBN} from '@builtbymom/web3/types';

export type TWalletForZap = {
	tokensList: TYDaemonTokenListBalances;
	listTokens: ({chainID}: {chainID: number}) => TDict<TYToken>;
	getToken: ({address, chainID}: {address: TAddress; chainID: number}) => TYToken;
	getBalance: ({address, chainID}: {address: TAddress; chainID: number}) => TNormalizedBN;
	getPrice: ({address, chainID}: {address: TAddress; chainID: number}) => TNormalizedBN;
	refresh: (tokenList?: TUseBalancesTokens[]) => Promise<TYChainTokens>;
};

const defaultToken: TYToken & {supportedZaps: TSupportedZaps[]} = {
	address: toAddress(''),
	name: '',
	symbol: '',
	decimals: 18,
	chainID: 1,
	value: 0,
	stakingValue: 0,
	price: zeroNormalizedBN,
	balance: zeroNormalizedBN,
	supportedZaps: []
};

const defaultProps = {
	tokensList: {},
	listTokens: (): TDict<TYToken & {supportedZaps: TSupportedZaps[]}> => ({}),
	getToken: (): TYToken & {supportedZaps: TSupportedZaps[]} => ({...defaultToken, supportedZaps: []}),
	getBalance: (): TNormalizedBN => zeroNormalizedBN,
	getPrice: (): TNormalizedBN => zeroNormalizedBN,
	refresh: async (): Promise<TYChainTokens> => ({})
};

/* 🔵 - Yearn Finance **********************************************************
 ** This context controls most of the user's wallet data we may need to
 ** interact with our app, aka mostly the balances and the token prices.
 ******************************************************************************/
const WalletForZap = createContext<TWalletForZap>(defaultProps);
export const WalletForZapAppContextApp = memo(function WalletForZapAppContextApp(props: {
	children: ReactElement;
}): ReactElement {
	const {address} = useWeb3();
	const {onRefresh} = useYearn();
	const {yDaemonBaseUri} = useYDaemonBaseURI();
	const [zapTokens, set_zapTokens] = useState<TYChainTokens>({});

	/* 🔵 - Yearn Finance ******************************************************
	 **	Fetching, for this user, the list of tokens available for zaps
	 ***************************************************************************/
	const {data: tokensList} = useFetch<TYDaemonTokenListBalances>({
		endpoint: address ? `${yDaemonBaseUri}/balancesN/${address}` : null,
		schema: yDaemonTokenListBalances
	});

	const availableTokens = useMemo((): TUseBalancesTokens[] => {
		const tokens: TUseBalancesTokens[] = [];
		if (!tokensList) {
			return tokens;
		}
		for (const perChainID of Object.values(tokensList)) {
			for (const token of Object.values(perChainID)) {
				if (!token || isZeroAddress(token.address)) {
					continue;
				}
				tokens.push({address: toAddress(token.address), chainID: Number(token.chainID)});
			}
		}
		return tokens;
	}, [tokensList]);

	useDeepCompareEffect((): void => {
		const allToRefresh = availableTokens.map(({address, chainID}): TUseBalancesTokens => ({address, chainID}));
		onRefresh(allToRefresh).then((results): void => {
			for (const item of Object.values(results)) {
				for (const element of Object.values(item)) {
					const {address, chainID} = element;
					if (!tokensList) {
						continue;
					}
					const token = tokensList[chainID || 1]?.[address];
					if (!token) {
						continue;
					}
					const supportedZapsElement = element as TYToken & {supportedZaps: TSupportedZaps[]};
					supportedZapsElement.supportedZaps = token.supportedZaps || [];
					results[chainID][address] = supportedZapsElement;
				}
			}

			set_zapTokens(prev => ({...prev, ...(results as TYChainTokens)}));
		});
	}, [availableTokens, onRefresh, tokensList]);

	const listTokens = useCallback(
		({chainID}: {chainID: number}): TDict<TYToken & {supportedZaps: TSupportedZaps[]}> => {
			return zapTokens?.[chainID || 1] || {};
		},
		[zapTokens]
	);

	const getToken = useCallback(
		({address, chainID}: {address: TAddress; chainID: number}): TYToken & {supportedZaps: TSupportedZaps[]} => {
			return zapTokens?.[chainID || 1]?.[address] || defaultToken;
		},
		[zapTokens]
	);
	const getBalance = useCallback(
		({address, chainID}: {address: TAddress; chainID: number}): TNormalizedBN => {
			return zapTokens?.[chainID || 1]?.[address]?.balance || zeroNormalizedBN;
		},
		[zapTokens]
	);
	const getPrice = useCallback(
		({address, chainID}: {address: TAddress; chainID: number}): TNormalizedBN => {
			return zapTokens?.[chainID || 1]?.[address]?.price || zeroNormalizedBN;
		},
		[zapTokens]
	);

	/* 🔵 - Yearn Finance ******************************************************
	 **	Setup and render the Context provider to use in the app.
	 ***************************************************************************/
	const contextValue = useMemo(
		(): TWalletForZap => ({
			tokensList: tokensList || {},
			listTokens,
			getToken,
			getBalance,
			getPrice,
			refresh: onRefresh
		}),
		[listTokens, getToken, getBalance, getPrice, onRefresh, tokensList]
	);

	return <WalletForZap.Provider value={contextValue}>{props.children}</WalletForZap.Provider>;
});

export const useWalletForZap = (): TWalletForZap => useContext(WalletForZap);
