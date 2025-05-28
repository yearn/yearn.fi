import {createContext, memo, useCallback, useContext, useMemo, useState} from 'react';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {useBalances} from '@builtbymom/web3/hooks/useBalances.multichains';
import {isZeroAddress, toAddress, toNormalizedBN, zeroNormalizedBN} from '@builtbymom/web3/utils';
import {useDeepCompareMemo} from '@react-hookz/web';

import {
	CRV_TOKEN_ADDRESS,
	CVXCRV_TOKEN_ADDRESS,
	ETH_TOKEN_ADDRESS,
	LPYCRV_TOKEN_ADDRESS,
	LPYCRV_V2_TOKEN_ADDRESS,
	YCRV_CURVE_POOL_V2_ADDRESS,
	YCRV_TOKEN_ADDRESS,
	YVBOOST_TOKEN_ADDRESS,
	YVECRV_TOKEN_ADDRESS
} from '../utils/constants';
import {useYearn} from './useYearn';

import type {ReactElement} from 'react';
import type {TUseBalancesTokens} from '@builtbymom/web3/hooks/useBalances.multichains';
import type {TAddress, TDict, TNormalizedBN} from '@builtbymom/web3/types';
import type {TYChainTokens, TYToken} from '../types';
import type {TYDaemonVault} from '../utils/schemas/yDaemonVaultsSchemas';

export type TWalletContext = {
	getToken: ({address, chainID}: TTokenAndChain) => TYToken;
	getBalance: ({address, chainID}: TTokenAndChain) => TNormalizedBN;
	getPrice: ({address, chainID}: TTokenAndChain) => TNormalizedBN;
	balances: TYChainTokens;
	cumulatedValueInV2Vaults: number;
	cumulatedValueInV3Vaults: number;
	isLoading: boolean;
	shouldUseForknetBalances: boolean;
	onRefresh: (tokenList?: TUseBalancesTokens[]) => Promise<TYChainTokens>;
	triggerForknetBalances: () => void;
};
type TTokenAndChain = {address: TAddress; chainID: number};

const defaultToken: TYToken = {
	address: toAddress(''),
	name: '',
	symbol: '',
	decimals: 18,
	chainID: 1,
	value: 0,
	stakingValue: 0,
	balance: zeroNormalizedBN
};

const defaultProps = {
	getToken: (): TYToken => defaultToken,
	getBalance: (): TNormalizedBN => zeroNormalizedBN,
	getPrice: (): TNormalizedBN => zeroNormalizedBN,
	balances: {},
	cumulatedValueInV2Vaults: 0,
	cumulatedValueInV3Vaults: 0,
	isLoading: true,
	shouldUseForknetBalances: false,
	onRefresh: async (): Promise<TYChainTokens> => ({}),
	triggerForknetBalances: (): void => {}
};

function useYearnTokens({shouldUseForknetBalances}: {shouldUseForknetBalances: boolean}): TUseBalancesTokens[] {
	const {vaults, vaultsMigrations, vaultsRetired, isLoadingVaultList} = useYearn();

	const availableTokens = useMemo((): TUseBalancesTokens[] => {
		if (isLoadingVaultList) {
			return [];
		}
		const tokens: TUseBalancesTokens[] = [];
		const tokensExists: TDict<boolean> = {};
		const extraTokens: TUseBalancesTokens[] = [];
		extraTokens.push(
			...[
				{chainID: 1, address: ETH_TOKEN_ADDRESS},
				{chainID: 10, address: ETH_TOKEN_ADDRESS},
				{chainID: 137, address: ETH_TOKEN_ADDRESS},
				{chainID: 250, address: ETH_TOKEN_ADDRESS},
				{chainID: 8453, address: ETH_TOKEN_ADDRESS},
				{chainID: 42161, address: ETH_TOKEN_ADDRESS},
				{chainID: 1, address: YCRV_TOKEN_ADDRESS},
				{chainID: 1, address: LPYCRV_TOKEN_ADDRESS},
				{chainID: 1, address: CRV_TOKEN_ADDRESS},
				{chainID: 1, address: YVBOOST_TOKEN_ADDRESS},
				{chainID: 1, address: YVECRV_TOKEN_ADDRESS},
				{chainID: 1, address: CVXCRV_TOKEN_ADDRESS},
				{chainID: 1, address: YCRV_CURVE_POOL_V2_ADDRESS},
				{chainID: 1, address: LPYCRV_V2_TOKEN_ADDRESS}
			]
		);

		for (const token of extraTokens) {
			tokensExists[token.address] = true;
			tokens.push(token);
		}

		Object.values(vaults || {}).forEach((vault?: TYDaemonVault): void => {
			if (!vault) {
				return;
			}
			if (vault?.address && !tokensExists[toAddress(vault?.address)]) {
				tokens.push({address: vault.address, chainID: vault.chainID});
				tokensExists[vault.address] = true;
			}
			if (vault?.token?.address && !tokensExists[toAddress(vault?.token?.address)]) {
				tokens.push({address: vault.token.address, chainID: vault.chainID});
				tokensExists[vault.token.address] = true;
			}
			if (vault?.staking?.available && !tokensExists[toAddress(vault?.staking?.address)]) {
				tokens.push({
					address: vault?.staking?.address,
					chainID: vault.chainID,
					symbol: vault.symbol,
					decimals: vault.decimals,
					name: vault.name
				});
				tokensExists[vault?.staking?.address] = true;
			}
		});

		return tokens;
	}, [isLoadingVaultList, vaults]);

	//List all vaults with a possible migration
	const migratableTokens = useMemo((): TUseBalancesTokens[] => {
		const tokens: TUseBalancesTokens[] = [];
		Object.values(vaultsMigrations || {}).forEach((vault?: TYDaemonVault): void => {
			if (!vault) {
				return;
			}
			tokens.push({address: vault.address, chainID: vault.chainID});
		});
		return tokens;
	}, [vaultsMigrations]);

	const retiredTokens = useMemo((): TUseBalancesTokens[] => {
		const tokens: TUseBalancesTokens[] = [];
		Object.values(vaultsRetired || {}).forEach((vault?: TYDaemonVault): void => {
			if (!vault) {
				return;
			}
			tokens.push({address: vault.address, chainID: vault.chainID});
		});
		return tokens;
	}, [vaultsRetired]);

	const allTokens = useMemo((): TUseBalancesTokens[] => {
		const tokens = [...availableTokens, ...migratableTokens, ...retiredTokens];
		if (!shouldUseForknetBalances) {
			return tokens;
		}
		for (const token of tokens) {
			if (token.chainID === 1) {
				//remove it
				tokens.push({...token, chainID: 1337});
			}
		}
		return tokens;
	}, [availableTokens, migratableTokens, retiredTokens, shouldUseForknetBalances]);

	return allTokens;
}

function useYearnBalances({shouldUseForknetBalances}: {shouldUseForknetBalances: boolean}): {
	tokens: TYChainTokens;
	isLoading: boolean;
	onRefresh: (tokenToUpdate?: TUseBalancesTokens[]) => Promise<TYChainTokens>;
} {
	const allTokens = useYearnTokens({shouldUseForknetBalances});
	const {data: tokensRaw, onUpdate, onUpdateSome, isLoading} = useBalances({tokens: allTokens});

	const tokens = useDeepCompareMemo((): TYChainTokens => {
		const _tokens = {...tokensRaw};
		if (shouldUseForknetBalances) {
			_tokens[1] = _tokens[1337]; // eslint-disable-line prefer-destructuring
		}

		return _tokens as TYChainTokens;
	}, [tokensRaw, shouldUseForknetBalances]);

	const onRefresh = useCallback(
		async (tokenToUpdate?: TUseBalancesTokens[]): Promise<TYChainTokens> => {
			if (tokenToUpdate) {
				const updatedBalances = await onUpdateSome(tokenToUpdate);
				return updatedBalances as TYChainTokens;
			}
			const updatedBalances = await onUpdate();
			return updatedBalances as TYChainTokens;
		},
		[onUpdate, onUpdateSome]
	);

	return {tokens, isLoading, onRefresh};
}

/* 🔵 - Yearn Finance **********************************************************
 ** This context controls most of the user's wallet data we may need to
 ** interact with our app, aka mostly the balances and the token prices.
 ******************************************************************************/
const YearnWalletContext = createContext<TWalletContext>(defaultProps);
export const YearnWalletContextApp = memo(function YearnWalletContextApp(props: {
	children: ReactElement;
}): ReactElement {
	const {address: userAddress} = useWeb3();
	const {vaults, prices, vaultsMigrations} = useYearn();
	const [shouldUseForknetBalances, set_shouldUseForknetBalances] = useState<boolean>(false);
	const {tokens: balances, isLoading: isLoadingBalances, onRefresh} = useYearnBalances({shouldUseForknetBalances});

	const [cumulatedValueInV2Vaults, cumulatedValueInV3Vaults] = useMemo((): [number, number] => {
		let cumulatedValueInV2Vaults = 0;
		let cumulatedValueInV3Vaults = 0;
		for (const [, perChain] of Object.entries(balances)) {
			for (const [tokenAddress, tokenData] of Object.entries(perChain)) {
				if (tokenData.value + tokenData.stakingValue === 0) {
					continue;
				}
				if (vaults?.[toAddress(tokenAddress)]) {
					if (vaults[toAddress(tokenAddress)].version.split('.')?.[0] === '3') {
						cumulatedValueInV3Vaults += tokenData.value + tokenData.stakingValue;
					} else {
						cumulatedValueInV2Vaults += tokenData.value + tokenData.stakingValue;
					}
				} else if (vaultsMigrations?.[toAddress(tokenAddress)]) {
					if (vaultsMigrations[toAddress(tokenAddress)].version.split('.')?.[0] === '3') {
						cumulatedValueInV3Vaults += tokenData.value + tokenData.stakingValue;
					} else {
						cumulatedValueInV2Vaults += tokenData.value + tokenData.stakingValue;
					}
				}
			}
		}
		return [cumulatedValueInV2Vaults, cumulatedValueInV3Vaults];
	}, [vaults, vaultsMigrations, balances]);

	const getToken = useCallback(
		({address, chainID}: TTokenAndChain): TYToken => balances?.[chainID || 1]?.[address] || defaultToken,
		[balances]
	);
	const getBalance = useCallback(
		({address, chainID}: TTokenAndChain): TNormalizedBN => {
			if (isZeroAddress(userAddress)) {
				return zeroNormalizedBN;
			}
			return balances?.[chainID || 1]?.[address]?.balance || zeroNormalizedBN;
		},
		[balances, userAddress]
	);

	const getPrice = useCallback(
		({address, chainID}: TTokenAndChain): TNormalizedBN => {
			return toNormalizedBN(prices?.[chainID]?.[address] || 0, 6) || zeroNormalizedBN;
		},
		[prices]
	);

	/* 🔵 - Yearn Finance ******************************************************
	 **	Setup and render the Context provider to use in the app.
	 ***************************************************************************/
	const contextValue = useMemo(
		(): TWalletContext => ({
			getToken,
			getBalance,
			getPrice,
			balances: balances,
			cumulatedValueInV2Vaults,
			cumulatedValueInV3Vaults,
			isLoading: isLoadingBalances || false,
			shouldUseForknetBalances,
			onRefresh,
			triggerForknetBalances: (): void =>
				set_shouldUseForknetBalances((s): boolean => {
					const isEnabled = !s;
					if (!(window as any).ethereum) {
						(window as any).ethereum = {};
					}
					(window as any).ethereum.useForknetForMainnet = isEnabled;
					return isEnabled;
				})
		}),
		[
			getToken,
			getBalance,
			getPrice,
			balances,
			cumulatedValueInV2Vaults,
			cumulatedValueInV3Vaults,
			isLoadingBalances,
			shouldUseForknetBalances,
			onRefresh
		]
	);

	return <YearnWalletContext.Provider value={contextValue}>{props.children}</YearnWalletContext.Provider>;
});

export const useYearnWallet = (): TWalletContext => useContext(YearnWalletContext);
