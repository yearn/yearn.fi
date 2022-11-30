import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {Contract} from 'ethcall';
import {ethers} from 'ethers';
// eslint-disable-next-line import/no-named-as-default
import NProgress from 'nprogress';
import {useWeb3} from '@yearn-finance/web-lib/contexts';
import {useClientEffect} from '@yearn-finance/web-lib/hooks';
import {useBalances} from '@yearn-finance/web-lib/hooks/useBalances';
import {ABI, ETH_TOKEN_ADDRESS, format, performBatchedUpdates, providers, toAddress} from '@yearn-finance/web-lib/utils';
import {useYearn} from '@common/contexts/useYearn';
import {allowanceKey} from '@common/utils';
import {CRV_TOKEN_ADDRESS, LPYCRV_TOKEN_ADDRESS, STYCRV_TOKEN_ADDRESS, YCRV_CURVE_POOL_ADDRESS, YCRV_TOKEN_ADDRESS, YVBOOST_TOKEN_ADDRESS, YVECRV_POOL_LP_ADDRESS, YVECRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS} from '@common/utils/constants';
import YVECRV_ABI from '@yCRV/utils/abi/yveCRV.abi';

import type {BigNumber} from 'ethers';
import type {ReactElement} from 'react';
import type {TClaimable} from '@common/types/types';
import type {TYearnVault} from '@common/types/yearn';
import type {TBalanceData, TUseBalancesTokens} from '@yearn-finance/web-lib/hooks/types';
import type {TDict} from '@yearn-finance/web-lib/utils';


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
	allowances: {[key: string]: BigNumber},
	cumulatedValueInVaults: number,
	yveCRVClaimable: TClaimable;
	useWalletNonce: number,
	slippage: number,
	isLoading: boolean,
	refresh: () => Promise<TDict<TBalanceData>>,
	set_slippage: (slippage: number) => void,
}

const	defaultProps = {
	balances: {},
	allowances: {[ethers.constants.AddressZero]: ethers.constants.Zero},
	cumulatedValueInVaults: 0,
	yveCRVClaimable: {raw: ethers.constants.Zero, normalized: 0},
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
export const WalletContextApp = ({children}: {children: ReactElement}): ReactElement => {
	const	[nonce, set_nonce] = useState<number>(0);
	const	{provider, address, isActive} = useWeb3();
	const	{vaults, prices} = useYearn();
	const	[yveCRVClaimable, set_yveCRVClaimable] = useState<TClaimable>({raw: ethers.constants.Zero, normalized: 0});
	const	[allowances, set_allowances] = useState<{[key: string]: BigNumber}>({[ethers.constants.AddressZero]: ethers.constants.Zero});
	const	[slippage, set_slippage] = useState<number>(1);

	const	availableTokens = useMemo((): TUseBalancesTokens[] => {
		const	tokens: TUseBalancesTokens[] = [];
		Object.values(vaults || {}).map((vault?: TYearnVault): void => {
			if (!vault) {
				return;
			}
			tokens.push({token: vault?.address});
			tokens.push({token: vault.token.address});
		});
		return tokens;
	}, [vaults]);

	const	{data: balances, update: updateBalances, isLoading} = useBalances({
		key: 0,
		provider: provider || providers.getProvider(1),
		tokens: [
			...availableTokens,
			availableTokens.length > 0 ? {token: ETH_TOKEN_ADDRESS} : {}
		] as TUseBalancesTokens[],
		prices,
		effectDependencies: [vaults]
	});

	const	cumulatedValueInVaults = useMemo((): number => (
		Object.entries(balances).reduce((acc, [token, balance]): number => {
			const	vault = vaults[toAddress(token)];
			if (vault) {
				acc += balance.normalizedValue;
			}
			return acc;
		}, 0)
	), [vaults, balances]);

	useClientEffect((): () => void => {
		if (isLoading) {
			if (!balances) {
				set_nonce(nonce + 1);
			}
			NProgress.start();
		} else {
			NProgress.done();
		}
		return (): unknown => NProgress.done();
	}, [isLoading]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Once the wallet is connected and a provider is available, we can fetch
	**	the informations for a specific wallet about the claimable amount
	***************************************************************************/
	const getExtraData = useCallback(async (): Promise<void> => {
		if (!isActive || !provider) {
			return;
		}
		const	currentProvider = provider || providers.getProvider(1);
		const	ethcallProvider = await providers.newEthCallProvider(currentProvider);
		const	userAddress = address;
		const	yCRVContract = new Contract(YCRV_TOKEN_ADDRESS as string, YVECRV_ABI);
		const	styCRVContract = new Contract(STYCRV_TOKEN_ADDRESS as string, YVECRV_ABI);
		const	lpyCRVContract = new Contract(LPYCRV_TOKEN_ADDRESS as string, YVECRV_ABI);
		const	yveCRVContract = new Contract(YVECRV_TOKEN_ADDRESS as string, YVECRV_ABI);
		const	crvContract = new Contract(CRV_TOKEN_ADDRESS as string, ABI.ERC20_ABI);
		const	yvBoostContract = new Contract(YVBOOST_TOKEN_ADDRESS as string, ABI.ERC20_ABI);
		const	yCRVPoolContract = new Contract(YCRV_CURVE_POOL_ADDRESS as string, YVECRV_ABI);

		const	[
			claimable,
			yCRVAllowanceZap, styCRVAllowanceZap, lpyCRVAllowanceZap,
			yveCRVAllowanceZap, crvAllowanceZap, yvBoostAllowanceZap,
			yveCRVAllowanceLP, crvAllowanceLP,
			yCRVPoolAllowanceVault
		] = await ethcallProvider.tryAll([
			yveCRVContract.claimable(userAddress),
			yCRVContract.allowance(userAddress, ZAP_YEARN_VE_CRV_ADDRESS),
			styCRVContract.allowance(userAddress, ZAP_YEARN_VE_CRV_ADDRESS),
			lpyCRVContract.allowance(userAddress, ZAP_YEARN_VE_CRV_ADDRESS),
			yveCRVContract.allowance(userAddress, ZAP_YEARN_VE_CRV_ADDRESS),
			crvContract.allowance(userAddress, ZAP_YEARN_VE_CRV_ADDRESS),
			yvBoostContract.allowance(userAddress, ZAP_YEARN_VE_CRV_ADDRESS),
			yveCRVContract.allowance(userAddress, YVECRV_POOL_LP_ADDRESS),
			crvContract.allowance(userAddress, YVECRV_POOL_LP_ADDRESS),
			yCRVPoolContract.allowance(userAddress, LPYCRV_TOKEN_ADDRESS)
		]) as [BigNumber, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber];

		performBatchedUpdates((): void => {
			set_yveCRVClaimable({
				raw: claimable,
				normalized: format.toNormalizedValue(claimable, 18)
			});
			set_allowances({
				// YCRV ECOSYSTEM
				[allowanceKey(YCRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS)]: yCRVAllowanceZap,
				[allowanceKey(STYCRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS)]: styCRVAllowanceZap,
				[allowanceKey(LPYCRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS)]: lpyCRVAllowanceZap,
				[allowanceKey(YCRV_CURVE_POOL_ADDRESS, LPYCRV_TOKEN_ADDRESS)]: yCRVPoolAllowanceVault,
				// CRV ECOSYSTEM
				[allowanceKey(YVECRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS)]: yveCRVAllowanceZap,
				[allowanceKey(CRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS)]:  crvAllowanceZap,
				[allowanceKey(YVBOOST_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS)]: yvBoostAllowanceZap,
				[allowanceKey(YVECRV_TOKEN_ADDRESS, YVECRV_POOL_LP_ADDRESS)]: yveCRVAllowanceLP,
				[allowanceKey(CRV_TOKEN_ADDRESS, YVECRV_POOL_LP_ADDRESS)]:  crvAllowanceLP
			});
		});
	}, [provider, address, isActive]);
	useEffect((): void => {
		getExtraData();
	}, [getExtraData]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	return (
		<WalletContext.Provider
			value={{
				balances: balances,
				cumulatedValueInVaults,
				yveCRVClaimable,
				allowances,
				isLoading,
				refresh: async (): Promise<TDict<TBalanceData>> => {
					const [updatedBalances] = await Promise.all([
						updateBalances(),
						getExtraData()
					]);
					return updatedBalances;
				},
				useWalletNonce: nonce,
				slippage,
				set_slippage
			}}>
			{children}
		</WalletContext.Provider>
	);
};


export const useWallet = (): TWalletContext => useContext(WalletContext);
export default useWallet;