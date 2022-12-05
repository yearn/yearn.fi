import React, {createContext, memo, useContext, useMemo, useState} from 'react';
// eslint-disable-next-line import/no-named-as-default
import NProgress from 'nprogress';
import {useWeb3} from '@yearn-finance/web-lib/contexts';
import {useBalances, useClientEffect} from '@yearn-finance/web-lib/hooks';
import {ETH_TOKEN_ADDRESS, providers} from '@yearn-finance/web-lib/utils';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {useYearn} from '@common/contexts/useYearn';

import type {BigNumber} from 'ethers';
import type {ReactElement} from 'react';
import type {TBalanceData, TUseBalancesTokens} from '@yearn-finance/web-lib/hooks/types';
import type {TDict} from '@yearn-finance/web-lib/utils';
import type {TYearnVault} from '@common/types/yearn';


export type	TBalances = {
	[address: string]: {
		decimals: number,
		symbol: string,
		raw: BigNumber,
		rawPrice: BigNumber,
		normalized: number,
		normalizedPrice: number,
		normalizedValue: number
	}
}

export type	TWalletContext = {
	balances: TBalances,
	cumulatedValueInVaults: number,
	useWalletNonce: number,
	slippage: number,
	isLoading: boolean,
	refresh: () => Promise<TDict<TBalanceData>>,
	set_slippage: (slippage: number) => void,
}

const	defaultProps = {
	balances: {},
	cumulatedValueInVaults: 0,
	useWalletNonce: 0,
	slippage: 0.6,
	isLoading: true,
	refresh: async (): Promise<TDict<TBalanceData>> => ({}),
	set_slippage: (): void => undefined
};


/* 🔵 - Yearn Finance **********************************************************
** This context controls most of the user's wallet data we may need to
** interact with our app, aka mostly the balances and the token prices.
******************************************************************************/
const	WalletContext = createContext<TWalletContext>(defaultProps);
export const WalletContextApp = memo(function WalletContextApp({children}: {children: ReactElement}): ReactElement {
	const	[nonce, set_nonce] = useState<number>(0);
	const	{provider} = useWeb3();
	const	{vaults, isLoadingVaultList, prices} = useYearn();
	const	[slippage, set_slippage] = useState<number>(1);

	const	availableTokens = useMemo((): TUseBalancesTokens[] => {
		if (isLoadingVaultList) {
			return [];
		}
		const	tokens: TUseBalancesTokens[] = [];
		Object.values(vaults || {}).map((vault?: TYearnVault): void => {
			if (!vault) {
				return;
			}
			tokens.push({token: vault?.address});
			tokens.push({token: vault.token.address});
		});
		tokens.push({token: ETH_TOKEN_ADDRESS});
		return tokens;
	}, [vaults, isLoadingVaultList]);

	const	{data: balances, update: updateBalances, isLoading: isLoadingBalances} = useBalances({
		key: 0,
		provider: provider || providers.getProvider(1),
		tokens: availableTokens,
		prices,
		effectDependencies: []
	});

	const	cumulatedValueInVaults = useMemo((): number => {
		if (isLoadingVaultList || isLoadingBalances) {
			return 0;
		}
		return (
			Object.entries(balances).reduce((acc, [token, balance]): number => {
				const	vault = vaults?.[toAddress(token)] ;
				if (vault) {
					acc += balance.normalizedValue;
				}
				return acc;
			}, 0)
		);
	}, [vaults, balances, isLoadingVaultList, isLoadingBalances]);

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
	return (
		<WalletContext.Provider
			value={{
				balances: balances,
				cumulatedValueInVaults,
				isLoading: isLoadingBalances,
				refresh: async (): Promise<TDict<TBalanceData>> => {
					const updatedBalances = await updateBalances();
					return updatedBalances;
				},
				useWalletNonce: nonce,
				slippage,
				set_slippage
			}}>
			{children}
		</WalletContext.Provider>
	);
});


export const useWallet = (): TWalletContext => useContext(WalletContext);
export default useWallet;