import React, {createContext, memo, useCallback, useContext, useMemo} from 'react';
import {migrationTable} from '@vaults/utils/migrationTable';
import {useUI} from '@yearn-finance/web-lib/contexts/useUI';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {useClientEffect} from '@yearn-finance/web-lib/hooks/useClientEffect';
import {useYearn} from '@common/contexts/useYearn';
import {useBalances} from '@common/hooks/useBalances';

import type {ReactElement} from 'react';
import type {TDict} from '@yearn-finance/web-lib/types';
import type {TBalanceData} from '@yearn-finance/web-lib/types/hooks';
import type {TUseBalancesTokens} from '@common/hooks/useBalances';
import type {TMigrationTable} from '@vaults/utils/migrationTable';

export type	TWalletForExternalMigrations = {
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
const	WalletForExternalMigrations = createContext<TWalletForExternalMigrations>(defaultProps);
export const WalletForExternalMigrationsApp = memo(function WalletForExternalMigrationsApp({children}: {children: ReactElement}): ReactElement {
	const	{prices} = useYearn();
	const	{chainID} = useChainID();
	const	{onLoadStart, onLoadDone} = useUI();

	const availableTokens = useMemo((): TUseBalancesTokens[] => {
		const	tokens: TUseBalancesTokens[] = [];
		Object.values(migrationTable || {}).forEach((possibleMigrations: TMigrationTable[]): void => {
			for (const element of possibleMigrations) {
				tokens.push({token: element.tokenToMigrate});
			}
		});
		return tokens;
	}, []);

	const {data: balances, update: updateBalances, isLoading, nonce} = useBalances({
		key: chainID,
		tokens: availableTokens,
		prices
	});

	const onRefresh = useCallback(async (): Promise<TDict<TBalanceData>> => {
		const updatedBalances = await updateBalances();
		return updatedBalances;
	}, [updateBalances]);

	useClientEffect((): VoidFunction => {
		if (isLoading) {
			onLoadStart();
		} else {
			onLoadDone();
		}
		return (): unknown => onLoadDone();
	}, [isLoading]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const	contextValue = useMemo((): TWalletForExternalMigrations => ({
		balances: balances,
		isLoading: isLoading,
		refresh: onRefresh,
		balancesNonce: nonce
	}), [balances, isLoading, onRefresh, nonce]);

	return (
		<WalletForExternalMigrations.Provider value={contextValue}>
			{children}
		</WalletForExternalMigrations.Provider>
	);
});


export const useWalletForExternalMigrations = (): TWalletForExternalMigrations => useContext(WalletForExternalMigrations);
export default useWalletForExternalMigrations;
