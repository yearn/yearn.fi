import {createContext, memo, useContext, useMemo, useState} from 'react';
import {useDeepCompareEffect} from '@react-hookz/web';
import {useUI} from '@yearn-finance/web-lib/contexts/useUI';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {isZeroAddress} from '@yearn-finance/web-lib/utils/address';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import {useWallet} from '@common/contexts/useWallet';
import {useFetch} from '@common/hooks/useFetch';
import {yDaemonTokenListBalances} from '@common/schemas/yDaemonTokenListBalances';
import {useYDaemonBaseURI} from '@common/utils/getYDaemonBaseURI';

import type {ReactElement} from 'react';
import type {TDict} from '@yearn-finance/web-lib/types';
import type {TBalanceData} from '@yearn-finance/web-lib/types/hooks';
import type {TUseBalancesTokens} from '@common/hooks/useBalances';
import type {TYDaemonTokenListBalances} from '@common/schemas/yDaemonTokenListBalances';

export type TWalletForZap = {
	tokensList: TYDaemonTokenListBalances,
	balances: TDict<TBalanceData>,
	balancesNonce: number,
	isLoading: boolean,
	refresh: (tokenList?: TUseBalancesTokens[]) => Promise<TDict<TBalanceData>>,
}

const defaultProps = {
	tokensList: {},
	balances: {},
	balancesNonce: 0,
	isLoading: true,
	refresh: async (): Promise<TDict<TBalanceData>> => ({})
};

/* 🔵 - Yearn Finance **********************************************************
** This context controls most of the user's wallet data we may need to
** interact with our app, aka mostly the balances and the token prices.
******************************************************************************/
const WalletForZap = createContext<TWalletForZap>(defaultProps);
export const WalletForZapApp = memo(function WalletForZapApp({children}: {children: ReactElement}): ReactElement {
	const {address, isActive} = useWeb3();
	const {refresh, balancesNonce} = useWallet();
	const {safeChainID} = useChainID();
	const {yDaemonBaseUri} = useYDaemonBaseURI({chainID: safeChainID});
	const {onLoadStart, onLoadDone} = useUI();
	const [isLoading, set_isLoading] = useState(false);
	const [zapBalances, set_zapMigrationBalances] = useState<TDict<TBalanceData>>({});

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
			if (token.chainID !== safeChainID) {
				return;
			}
			if (isZeroAddress(token.address)) {
				return;
			}
			tokens.push({token: token.address});
		});
		return tokens;
	}, [tokensList, safeChainID]);

	useDeepCompareEffect((): void => {
		onLoadStart();
		set_isLoading(true);
		const allToRefresh = availableTokens.map(({token}): TUseBalancesTokens => ({token}));
		refresh(allToRefresh).then((result): void => {
			performBatchedUpdates((): void => {
				set_isLoading(false);
				set_zapMigrationBalances(result);
				onLoadDone();
			});
		});
	}, [availableTokens, address, isActive]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const contextValue = useMemo((): TWalletForZap => ({
		tokensList: tokensList || {},
		balances: zapBalances,
		balancesNonce: balancesNonce,
		isLoading: isLoading,
		refresh: refresh
	}), [zapBalances, isLoading, balancesNonce, refresh, tokensList]);

	return (
		<WalletForZap.Provider value={contextValue}>
			{children}
		</WalletForZap.Provider>
	);
});

export const useWalletForZap = (): TWalletForZap => useContext(WalletForZap);
export default useWalletForZap;
