import React, {createContext, memo, useCallback, useContext, useMemo, useState} from 'react';
// eslint-disable-next-line import/no-named-as-default
import NProgress from 'nprogress';
import {useVaultsMigrations} from '@vaults/contexts/useVaultsMigrations';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useBalances} from '@yearn-finance/web-lib/hooks/useBalances';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {useClientEffect} from '@yearn-finance/web-lib/hooks/useClientEffect';
import {getProvider} from '@yearn-finance/web-lib/utils/web3/providers';
import {useYearn} from '@common/contexts/useYearn';

import type {ReactElement} from 'react';
import type {TBalanceData, TUseBalancesTokens} from '@yearn-finance/web-lib/hooks/types';
import type {TDict} from '@yearn-finance/web-lib/utils/types';
import type {TYearnVault} from '@common/types/yearn';

export type	TWalletForInternalMigrations = {
	balances: TDict<TBalanceData>,
	useWalletNonce: number,
	isLoading: boolean,
	refresh: (tokenList?: TUseBalancesTokens[]) => Promise<TDict<TBalanceData>>,
}

const	defaultProps = {
	balances: {},
	useWalletNonce: 0,
	isLoading: true,
	refresh: async (): Promise<TDict<TBalanceData>> => ({})
};


/* 🔵 - Yearn Finance **********************************************************
** This context is used to fetch the balances for the internal migrations,
** aka the migrations between two Yearn vaults.
******************************************************************************/
const	WalletForInternalMigrations = createContext<TWalletForInternalMigrations>(defaultProps);
export const WalletForInternalMigrationsApp = memo(function WalletForInternalMigrationsApp({children}: {children: ReactElement}): ReactElement {
	const	[nonce, set_nonce] = useState<number>(0);
	const	{provider} = useWeb3();
	const	{prices} = useYearn();
	const	{chainID} = useChainID();
	const	{possibleVaultsMigrations, isLoading} = useVaultsMigrations();

	const	availableTokens = useMemo((): TUseBalancesTokens[] => {
		if (isLoading) {
			return [];
		}
		const	tokens: TUseBalancesTokens[] = [];
		Object.values(possibleVaultsMigrations || {}).forEach((vault?: TYearnVault): void => {
			if (!vault) {
				return;
			}
			tokens.push({token: vault?.address});
		});
		return tokens;
	}, [possibleVaultsMigrations, isLoading]);

	const	{data: balances, update: updateBalances, updateSome: updateSomeBalances, isLoading: isLoadingBalances} = useBalances({
		key: chainID,
		provider: provider || getProvider(1),
		tokens: availableTokens,
		prices
	});

	const	onRefresh = useCallback(async (tokenToUpdate?: TUseBalancesTokens[]): Promise<TDict<TBalanceData>> => {
		if (tokenToUpdate) {
			const updatedBalances = await updateSomeBalances(tokenToUpdate);
			return updatedBalances;
		} 
		const updatedBalances = await updateBalances();
		return updatedBalances;
		
	}, [updateBalances, updateSomeBalances]);

	useClientEffect((): () => void => {
		if (isLoadingBalances) {
			if (!balances) {
				set_nonce(nonce + 1);
			}
			NProgress.start();
		} else {
			NProgress.done();
		}
		return (): unknown => NProgress.done();
	}, [isLoadingBalances]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const	contextValue = useMemo((): TWalletForInternalMigrations => ({
		balances: balances,
		isLoading: isLoadingBalances,
		refresh: onRefresh,
		useWalletNonce: nonce
	}), [balances, isLoadingBalances, onRefresh, nonce]);

	return (
		<WalletForInternalMigrations.Provider value={contextValue}>
			{children}
		</WalletForInternalMigrations.Provider>
	);
});

export const useWalletForInternalMigrations = (): TWalletForInternalMigrations => useContext(WalletForInternalMigrations);
export default useWalletForInternalMigrations;
