import {createContext, memo, useCallback, useContext, useMemo, useState} from 'react';
import {useDeepCompareEffect} from '@react-hookz/web';
import {useUI} from '@yearn-finance/web-lib/contexts/useUI';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {isZeroAddress, toAddress, zeroAddress} from '@yearn-finance/web-lib/utils/address';
import {type TNormalizedBN, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {useWallet} from '@common/contexts/useWallet';
import {useFetch} from '@common/hooks/useFetch';
import {yDaemonTokenListBalances} from '@common/schemas/yDaemonTokenListBalances';
import {useYDaemonBaseURI} from '@common/utils/getYDaemonBaseURI';

import type {ReactElement} from 'react';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';
import type {TUseBalancesTokens} from '@common/hooks/useMultichainBalances';
import type {TYDaemonTokenListBalances} from '@common/schemas/yDaemonTokenListBalances';
import type {TChainTokens, TToken} from '@common/types/types';

export type TWalletForZap = {
	tokensList: TYDaemonTokenListBalances;
	listTokens: ({chainID}: {chainID: number}) => TDict<TToken>;
	getToken: ({address, chainID}: {address: TAddress; chainID: number}) => TToken;
	getBalance: ({address, chainID}: {address: TAddress; chainID: number}) => TNormalizedBN;
	getPrice: ({address, chainID}: {address: TAddress; chainID: number}) => TNormalizedBN;
	refresh: (tokenList?: TUseBalancesTokens[]) => Promise<TChainTokens>;
};

const defaultToken: TToken = {
	address: zeroAddress,
	name: '',
	symbol: '',
	decimals: 18,
	chainID: 1,
	value: 0,
	stakingValue: 0,
	price: toNormalizedBN(0),
	balance: toNormalizedBN(0),
	stakingBalance: toNormalizedBN(0)
};

const defaultProps = {
	tokensList: {},
	listTokens: (): TDict<TToken> => ({}),
	getToken: (): TToken => defaultToken,
	getBalance: (): TNormalizedBN => toNormalizedBN(0),
	getPrice: (): TNormalizedBN => toNormalizedBN(0),
	refresh: async (): Promise<TChainTokens> => ({})
};

/* 🔵 - Yearn Finance **********************************************************
 ** This context controls most of the user's wallet data we may need to
 ** interact with our app, aka mostly the balances and the token prices.
 ******************************************************************************/
const WalletForZap = createContext<TWalletForZap>(defaultProps);
export const WalletForZapAppContextApp = memo(function WalletForZapAppContextApp({
	children
}: {
	children: ReactElement;
}): ReactElement {
	const {address} = useWeb3();
	const {refresh} = useWallet();
	const {safeChainID} = useChainID();
	const {yDaemonBaseUri} = useYDaemonBaseURI({chainID: safeChainID});
	const {onLoadStart, onLoadDone} = useUI();
	const [zapTokens, set_zapTokens] = useState<TChainTokens>({});

	/* 🔵 - Yearn Finance ******************************************************
	 **	Fetching, for this user, the list of tokens available for zaps
	 ***************************************************************************/
	const {data: tokensList} = useFetch<TYDaemonTokenListBalances>({
		endpoint: address ? `${yDaemonBaseUri}/tokenlistbalances/${address}` : null,
		schema: yDaemonTokenListBalances
	});

	const availableTokens = useMemo((): TUseBalancesTokens[] => {
		const tokens: TUseBalancesTokens[] = [];
		Object.values(tokensList || {}).forEach((token): void => {
			if (!token) {
				return;
			}
			if (isZeroAddress(token.address)) {
				return;
			}
			tokens.push({address: toAddress(token.address), chainID: Number(token.chainID)});
		});
		return tokens;
	}, [tokensList]);

	useDeepCompareEffect((): void => {
		onLoadStart();
		const allToRefresh = availableTokens.map(({address, chainID}): TUseBalancesTokens => ({address, chainID}));
		refresh(allToRefresh).then((result): void => {
			set_zapTokens(result);
			onLoadDone();
		});
	}, [availableTokens]);

	const listTokens = useCallback(
		({chainID}: {chainID: number}): TDict<TToken> => {
			return zapTokens?.[chainID || 1] || {};
		},
		[zapTokens]
	);

	const getToken = useCallback(
		({address, chainID}: {address: TAddress; chainID: number}): TToken => {
			return zapTokens?.[chainID || 1]?.[address] || defaultToken;
		},
		[zapTokens]
	);
	const getBalance = useCallback(
		({address, chainID}: {address: TAddress; chainID: number}): TNormalizedBN => {
			return zapTokens?.[chainID || 1]?.[address]?.balance || toNormalizedBN(0);
		},
		[zapTokens]
	);
	const getPrice = useCallback(
		({address, chainID}: {address: TAddress; chainID: number}): TNormalizedBN => {
			return zapTokens?.[chainID || 1]?.[address]?.price || toNormalizedBN(0);
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
			refresh: refresh
		}),
		[listTokens, getToken, getBalance, getPrice, refresh, tokensList]
	);

	return <WalletForZap.Provider value={contextValue}>{children}</WalletForZap.Provider>;
});

export const useWalletForZap = (): TWalletForZap => useContext(WalletForZap);
