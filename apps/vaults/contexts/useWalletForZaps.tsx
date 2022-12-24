import React, {createContext, memo, useCallback, useContext, useMemo} from 'react';
import useSWR from 'swr';
import {useSettings} from '@yearn-finance/web-lib/contexts/useSettings';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useBalances} from '@yearn-finance/web-lib/hooks';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {baseFetcher} from '@yearn-finance/web-lib/utils/fetchers';
import {getProvider} from '@yearn-finance/web-lib/utils/web3/providers';
import {useYearn} from '@common/contexts/useYearn';

import type {ReactElement} from 'react';
import type {SWRResponse} from 'swr';
import type {TBalanceData, TUseBalancesTokens} from '@yearn-finance/web-lib/hooks/types';
import type {TDict} from '@yearn-finance/web-lib/utils/types';
import type {TNormalizedBN} from '@common/types/types';
import type {TYDaemonTokensList} from '@vaults/types/yearn';

export type	TWalletForZap = {
	tokensList: TDict<TYDaemonTokensList>,
	balances: TDict<TBalanceData>,
	isLoading: boolean,
	refresh: () => Promise<TDict<TNormalizedBN>>
}

const	defaultProps = {
	tokensList: {},
	balances: {},
	isLoading: true,
	refresh: async (): Promise<TDict<TNormalizedBN>> => ({})
};

/* 🔵 - Yearn Finance **********************************************************
** This context controls most of the user's wallet data we may need to
** interact with our app, aka mostly the balances and the token prices.
******************************************************************************/
const	WalletForZap = createContext<TWalletForZap>(defaultProps);
export const WalletForZapApp = memo(function WalletForZapApp({children}: {children: ReactElement}): ReactElement {
	const {address, provider} = useWeb3();
	const {prices} = useYearn();
	const {safeChainID} = useChainID();
	const {settings: baseAPISettings} = useSettings();

	/* 🔵 - Yearn Finance ******************************************************
	**	Fetching, for this user, the list of tokens available for zaps
	***************************************************************************/
	const	{data: tokensList, isLoading} = useSWR(
		address ? `${baseAPISettings.yDaemonBaseURI}/${safeChainID}/tokenlistbalances/${address}` : null,
		baseFetcher,
		{revalidateOnFocus: false}
	) as SWRResponse<TDict<TYDaemonTokensList>>;

	// console.log(tokensList, isLoading);

	const	availableTokens = useMemo((): TUseBalancesTokens[] => {
		const	tokens: TUseBalancesTokens[] = [];
		Object.values(tokensList || {}).forEach((token): void => {
			if (token.chainID !== safeChainID) {
				return;
			}
			tokens.push({token: token.address});
		});
		return tokens;
	}, [tokensList, safeChainID]);

	const	{data: balances, update: updateBalances, isLoading: isLoadingBalances} = useBalances({
		key: safeChainID,
		provider: provider || getProvider(1),
		tokens: availableTokens,
		prices
	});

	const	onRefresh = useCallback(async (): Promise<TDict<TBalanceData>> => {
		const updatedBalances = await updateBalances();
		return updatedBalances;
	}, [updateBalances]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const	contextValue = useMemo((): TWalletForZap => ({
		tokensList: tokensList || {}, 
		balances: balances,
		isLoading: isLoading || isLoadingBalances,
		refresh: onRefresh
	}), [balances, isLoading, isLoadingBalances, onRefresh, tokensList]);

	return (
		<WalletForZap.Provider value={contextValue}>
			{children}
		</WalletForZap.Provider>
	);
});


export const useWalletForZap = (): TWalletForZap => useContext(WalletForZap);
export default useWalletForZap;
