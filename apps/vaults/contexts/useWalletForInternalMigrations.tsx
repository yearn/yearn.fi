import React, {createContext, memo, useCallback, useContext, useMemo, useState} from 'react';
import {useVaultsMigrations} from '@vaults/contexts/useVaultsMigrations';
import {useUI} from '@yearn-finance/web-lib/contexts/useUI';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useBalances} from '@yearn-finance/web-lib/hooks/useBalances';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {useClientEffect} from '@yearn-finance/web-lib/hooks/useClientEffect';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {getProvider} from '@yearn-finance/web-lib/utils/web3/providers';
import {useYearn} from '@common/contexts/useYearn';

import type {ReactElement} from 'react';
import type {TBalanceData, TUseBalancesTokens} from '@yearn-finance/web-lib/hooks/types';
import type {TDict} from '@yearn-finance/web-lib/utils/types';
import type {TYearnVault} from '@common/types/yearn';

export type	TWalletForInternalMigrations = {
	balances: TDict<TBalanceData>,
	cumulatedValueInVaults: number,
	useWalletNonce: number,
	isLoading: boolean,
	refresh: (tokenList?: TUseBalancesTokens[]) => Promise<TDict<TBalanceData>>,
}

const	defaultProps = {
	balances: {},
	cumulatedValueInVaults: 0,
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
	const	[nonce, set_nonce] = useState(0);
	const	{provider} = useWeb3();
	const	{prices} = useYearn();
	const	{chainID} = useChainID();
	const	{possibleVaultsMigrations, isLoading: isLoadingVaultList} = useVaultsMigrations();
	const	{onLoadStart, onLoadDone} = useUI();

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

	const	{data: balances, update, updateSome, isLoading} = useBalances({
		key: chainID,
		provider: provider || getProvider(1),
		tokens: availableTokens,
		prices
	});

	const	cumulatedValueInVaults = useMemo((): number => {
		if (isLoadingVaultList || isLoading) {
			return 0;
		}
		return (
			Object.entries(balances).reduce((acc, [token, balance]): number => {
				const	vault = possibleVaultsMigrations?.[toAddress(token)] ;
				if (vault) {
					acc += balance.normalizedValue;
				}
				return acc;
			}, 0)
		);
	}, [possibleVaultsMigrations, balances, isLoadingVaultList, isLoading]);

	const	onRefresh = useCallback(async (tokenToUpdate?: TUseBalancesTokens[]): Promise<TDict<TBalanceData>> => {
		if (tokenToUpdate) {
			const updatedBalances = await updateSome(tokenToUpdate);
			return updatedBalances;
		} 
		const updatedBalances = await update();
		return updatedBalances;
		
	}, [update, updateSome]);

	useClientEffect((): void => {
		if (isLoading) {
			if (!balances) {
				set_nonce(nonce + 1);
			}
			onLoadStart();
		} else {
			onLoadDone();
		}
	}, [isLoading]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const	contextValue = useMemo((): TWalletForInternalMigrations => ({
		balances: balances,
		cumulatedValueInVaults,
		isLoading: isLoading || false,
		refresh: onRefresh,
		useWalletNonce: nonce
	}), [balances, cumulatedValueInVaults, isLoading, onRefresh, nonce]);

	return (
		<WalletForInternalMigrations.Provider value={contextValue}>
			{children}
		</WalletForInternalMigrations.Provider>
	);
});

export const useWalletForInternalMigrations = (): TWalletForInternalMigrations => useContext(WalletForInternalMigrations);
export default useWalletForInternalMigrations;
