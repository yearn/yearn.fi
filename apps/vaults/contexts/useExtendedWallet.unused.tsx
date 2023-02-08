import React, {createContext, memo, useCallback, useContext, useMemo} from 'react';
import {useWalletForExternalMigrations} from '@vaults/contexts/useWalletForExternalMigrations';
import {useWallet} from '@common/contexts/useWallet';

import type {ReactElement} from 'react';
import type {TBalanceData} from '@yearn-finance/web-lib/hooks/types';
import type {TDict} from '@yearn-finance/web-lib/utils/types';

export type	TExtendedWalletContext = {
	balances: TDict<TBalanceData>,
	balancesNonce: number,
	isLoading: boolean,
	refresh: () => Promise<TDict<TBalanceData>>
}

const	defaultProps = {
	balances: {},
	balancesNonce: 0,
	isLoading: true,
	refresh: async (): Promise<TDict<TBalanceData>> => ({})
};


/* 🔵 - Yearn Finance **********************************************************
** This context controls most of the user's wallet data we may need to
** interact with our app, aka mostly the balances and the token prices.
******************************************************************************/
const	ExtendedWalletContext = createContext<TExtendedWalletContext>(defaultProps);
export const ExtendedWalletContextApp = memo(function ExtendedWalletContextApp({children}: {children: ReactElement}): ReactElement {
	const	{balances, isLoading, refresh} = useWallet();
	const	{balances: defiBalances, isLoading: isLoadingDefiBalances, refresh: refreshDefiBalances, balancesNonce} = useWalletForExternalMigrations();

	const	onRefresh = useCallback(async (): Promise<TDict<TBalanceData>> => {
		const [updatedBalances, updatedDefiBalances] = await Promise.all([
			refresh(),
			refreshDefiBalances()
		]);
		return {...updatedBalances, ...updatedDefiBalances};
	}, [refresh, refreshDefiBalances]);

	const	mergedBalances = useMemo((): TDict<TBalanceData> => {
		if (!balances || !defiBalances) {
			return {};
		}
		return {
			...balances,
			...defiBalances
		};
	}, [balances, defiBalances]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const	contextValue = useMemo((): TExtendedWalletContext => ({
		balances: mergedBalances,
		isLoading: isLoading && isLoadingDefiBalances,
		refresh: onRefresh,
		balancesNonce: balancesNonce
	}), [mergedBalances, isLoading, isLoadingDefiBalances, onRefresh, balancesNonce]);

	return (
		<ExtendedWalletContext.Provider value={contextValue}>
			{children}
		</ExtendedWalletContext.Provider>
	);
});


export const useExtendedWallet = (): TExtendedWalletContext => useContext(ExtendedWalletContext);
export default useExtendedWallet;
