import React, {createContext, memo, useCallback, useContext, useMemo} from 'react';
import {useUI} from '@yearn-finance/web-lib/contexts/useUI';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useClientEffect} from '@yearn-finance/web-lib/hooks/useClientEffect';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {CRV_TOKEN_ADDRESS, CVXCRV_TOKEN_ADDRESS, ETH_TOKEN_ADDRESS, LPYCRV_TOKEN_ADDRESS, YCRV_TOKEN_ADDRESS, YVBOOST_TOKEN_ADDRESS, YVECRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {getProvider} from '@yearn-finance/web-lib/utils/web3/providers';
import {useYearn} from '@common/contexts/useYearn';
import {useBalances} from '@common/hooks/useBalances';

import type {ReactElement} from 'react';
import type {TBalanceData, TUseBalancesTokens} from '@yearn-finance/web-lib/hooks/types';
import type {TDict} from '@yearn-finance/web-lib/utils/types';
import type {TYearnVault} from '@common/types/yearn';

export type	TWalletContext = {
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
** This context controls most of the user's wallet data we may need to
** interact with our app, aka mostly the balances and the token prices.
******************************************************************************/
const	WalletContext = createContext<TWalletContext>(defaultProps);
export const WalletContextApp = memo(function WalletContextApp({children}: {children: ReactElement}): ReactElement {
	const	{provider} = useWeb3();
	const	{vaults, vaultsMigrations, isLoadingVaultList, prices} = useYearn();
	const	{onLoadStart, onLoadDone} = useUI();

	//List all tokens related to yearn vaults
	const	availableTokens = useMemo((): TUseBalancesTokens[] => {
		if (isLoadingVaultList) {
			return [];
		}
		const	tokens: TUseBalancesTokens[] = [];
		const	tokensExists: TDict<boolean> = {};

		const	extraTokens = [
			ETH_TOKEN_ADDRESS,
			YCRV_TOKEN_ADDRESS,
			LPYCRV_TOKEN_ADDRESS,
			CRV_TOKEN_ADDRESS,
			YVBOOST_TOKEN_ADDRESS,
			YVECRV_TOKEN_ADDRESS,
			CVXCRV_TOKEN_ADDRESS
		];
		for (const token of extraTokens) {
			tokensExists[token] = true;
			tokens.push({token});
		}

		Object.values(vaults || {}).forEach((vault?: TYearnVault): void => {
			if (!vault) {
				return;
			}
			if (vault?.address && !tokensExists[toAddress(vault?.address)]) {
				tokens.push({token: vault.address});
			}
			if (vault?.token?.address && !tokensExists[toAddress(vault?.token?.address)]) {
				tokens.push({token: vault.token.address});
			}
		});
		return tokens;
	}, [vaults, isLoadingVaultList]);

	//List all vaults with a possible migration
	const	migratableTokens = useMemo((): TUseBalancesTokens[] => {
		const	tokens: TUseBalancesTokens[] = [];
		Object.values(vaultsMigrations || {}).forEach((vault?: TYearnVault): void => {
			if (!vault) {
				return;
			}
			tokens.push({token: vault?.address});
		});
		return tokens;
	}, [vaultsMigrations]);

	// Fetch the balances
	const	{data: balances, update, updateSome, nonce, isLoading} = useBalances({
		provider: provider || getProvider(1),
		tokens: [...availableTokens, ...migratableTokens],
		prices
	});

	//Compute the cumulatedValueInVaults
	const	cumulatedValueInVaults = useMemo((): number => {
		nonce; //Suppress warning

		return (
			Object.entries(balances).reduce((acc, [token, balance]): number => {
				if (vaults?.[toAddress(token)]) {
					acc += balance.normalizedValue;
				} else if (vaultsMigrations?.[toAddress(token)]) {
					acc += balance.normalizedValue;
				}
				return acc;
			}, 0)
		);
	}, [vaults, vaultsMigrations, balances, nonce]);

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
			onLoadStart();
		} else {
			onLoadDone();
		}
	}, [isLoading]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const	contextValue = useMemo((): TWalletContext => ({
		balances: balances,
		balancesNonce: nonce,
		cumulatedValueInVaults,
		isLoading: isLoading || false,
		refresh: onRefresh
	}), [balances, cumulatedValueInVaults, isLoading, onRefresh, nonce]);

	return (
		<WalletContext.Provider value={contextValue}>
			{children}
		</WalletContext.Provider>
	);
});


export const useWallet = (): TWalletContext => useContext(WalletContext);
export default useWallet;
