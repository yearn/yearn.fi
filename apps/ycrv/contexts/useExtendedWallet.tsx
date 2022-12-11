import React, {createContext, memo, useCallback, useContext, useMemo, useState} from 'react';
// eslint-disable-next-line import/no-named-as-default
import NProgress from 'nprogress';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useBalances} from '@yearn-finance/web-lib/hooks/useBalances';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {useClientEffect} from '@yearn-finance/web-lib/hooks/useClientEffect';
import {getProvider} from '@yearn-finance/web-lib/utils/web3/providers';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';
import {CVXCRV_TOKEN_ADDRESS} from '@yCRV/utils/constants';

import type {ReactElement} from 'react';
import type {TBalanceData} from '@yearn-finance/web-lib/hooks/types';
import type {TDict} from '@yearn-finance/web-lib/utils/types';

export type	TExtendedWalletContext = {
	balances: TDict<TBalanceData>,
	useWalletNonce: number,
	isLoading: boolean,
	refresh: () => Promise<TDict<TBalanceData>>
}

const	defaultProps = {
	balances: {},
	useWalletNonce: 0,
	isLoading: true,
	refresh: async (): Promise<TDict<TBalanceData>> => ({})
};


/* 🔵 - Yearn Finance **********************************************************
** This context controls most of the user's wallet data we may need to
** interact with our app, aka mostly the balances and the token prices.
******************************************************************************/
const	ExtendedWalletContext = createContext<TExtendedWalletContext>(defaultProps);
export const ExtendedWalletContextApp = memo(function ExtendedWalletContextApp({children}: {children: ReactElement}): ReactElement {
	const	[nonce, set_nonce] = useState<number>(0);
	const	{provider} = useWeb3();
	const	{prices} = useYearn();
	const	{balances, isLoading: isLoadingBalances} = useWallet();
	const	{chainID} = useChainID();

	const	{data: extendedBalances, update: updateBalances, isLoading: isLoadingExtendedBalances} = useBalances({
		key: chainID,
		provider: provider || getProvider(1),
		tokens: [{token: CVXCRV_TOKEN_ADDRESS}],
		prices
	});

	const	onRefresh = useCallback(async (): Promise<TDict<TBalanceData>> => {
		const updatedBalances = await updateBalances();
		return updatedBalances;
	}, [updateBalances]);

	useClientEffect((): () => void => {
		if (isLoadingBalances || isLoadingExtendedBalances) {
			if (!balances) {
				set_nonce(nonce + 1);
			}
			NProgress.start();
		} else {
			NProgress.done();
		}
		return (): unknown => NProgress.done();
	}, [isLoadingBalances, isLoadingExtendedBalances]);

	const	mergedBalances = useMemo((): TDict<TBalanceData> => {
		if (!balances || !extendedBalances) {
			return {};
		}
		return {
			...balances,
			...extendedBalances
		};
	}, [balances, extendedBalances]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const	contextValue = useMemo((): TExtendedWalletContext => ({
		balances: mergedBalances,
		isLoading: isLoadingBalances && isLoadingExtendedBalances,
		refresh: onRefresh,
		useWalletNonce: nonce
	}), [mergedBalances, isLoadingBalances, isLoadingExtendedBalances, onRefresh, nonce]);

	return (
		<ExtendedWalletContext.Provider value={contextValue}>
			{children}
		</ExtendedWalletContext.Provider>
	);
});


export const useExtendedWallet = (): TExtendedWalletContext => useContext(ExtendedWalletContext);
export default useExtendedWallet;