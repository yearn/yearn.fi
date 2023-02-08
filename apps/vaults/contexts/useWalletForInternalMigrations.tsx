import React, {createContext, memo, useContext, useMemo, useState} from 'react';
import {useUpdateEffect} from '@react-hookz/web';
import {useVaultsMigrations} from '@vaults/contexts/useVaultsMigrations';
import {useUI} from '@yearn-finance/web-lib/contexts/useUI';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import {useWallet} from '@common/contexts/useWallet';

import type {ReactElement} from 'react';
import type {TBalanceData, TUseBalancesTokens} from '@yearn-finance/web-lib/hooks/types';
import type {TDict} from '@yearn-finance/web-lib/utils/types';
import type {TYearnVault} from '@common/types/yearn';

export type	TWalletForInternalMigrations = {
	balances: TDict<TBalanceData>,
	cumulatedValueInVaults: number,
	balancesNonce: number,
	isLoading: boolean,
	refresh: (tokenList?: TUseBalancesTokens[]) => Promise<TDict<TBalanceData>>,
}

const	defaultProps = {
	balances: {},
	cumulatedValueInVaults: 0,
	balancesNonce: 0,
	isLoading: true,
	refresh: async (): Promise<TDict<TBalanceData>> => ({})
};


/* 🔵 - Yearn Finance **********************************************************
** This context is used to fetch the balances for the internal migrations,
** aka the migrations between two Yearn vaults.
******************************************************************************/
const	WalletForInternalMigrations = createContext<TWalletForInternalMigrations>(defaultProps);
export const WalletForInternalMigrationsApp = memo(function WalletForInternalMigrationsApp({children}: {children: ReactElement}): ReactElement {
	const	{address, isActive} = useWeb3();
	const	{refresh, balancesNonce} = useWallet();
	const	{possibleVaultsMigrations, isLoading: isLoadingVaultList} = useVaultsMigrations();
	const	{onLoadStart, onLoadDone} = useUI();
	const	[isLoading, set_isLoading] = useState(false);
	const	[internalMigrationBalances, set_internalMigrationBalances] = useState<TDict<TBalanceData>>({});

	const	availableTokens = useMemo((): TUseBalancesTokens[] => {
		if (isLoadingVaultList) {
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
	}, [possibleVaultsMigrations, isLoadingVaultList]);

	useUpdateEffect((): void => {
		onLoadStart();
		set_isLoading(true);
		const	allToRefresh = availableTokens.map(({token}): TUseBalancesTokens => ({token}));
		refresh(allToRefresh).then((result): void => {
			performBatchedUpdates((): void => {
				set_isLoading(false);
				set_internalMigrationBalances(result);
				onLoadDone();
			});
		});
	}, [availableTokens, address, isActive]);

	const	cumulatedValueInVaults = useMemo((): number => {
		if (isLoadingVaultList || isLoading) {
			return 0;
		}
		return (
			Object.entries(internalMigrationBalances).reduce((acc, [token, balance]): number => {
				const	vault = possibleVaultsMigrations?.[toAddress(token)] ;
				if (vault) {
					acc += balance.normalizedValue;
				}
				return acc;
			}, 0)
		);
	}, [possibleVaultsMigrations, internalMigrationBalances, isLoadingVaultList, isLoading]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const	contextValue = useMemo((): TWalletForInternalMigrations => ({
		balances: internalMigrationBalances,
		cumulatedValueInVaults,
		isLoading: isLoading || false,
		refresh: refresh,
		balancesNonce: balancesNonce
	}), [internalMigrationBalances, cumulatedValueInVaults, isLoading, refresh, balancesNonce]);

	return (
		<WalletForInternalMigrations.Provider value={contextValue}>
			{children}
		</WalletForInternalMigrations.Provider>
	);
});

export const useWalletForInternalMigrations = (): TWalletForInternalMigrations => useContext(WalletForInternalMigrations);
export default useWalletForInternalMigrations;
