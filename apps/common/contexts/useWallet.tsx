import {createContext, memo, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {useDeepCompareMemo} from '@react-hookz/web';
import {onLoadDone, onLoadStart} from '@yearn-finance/web-lib/contexts/useUI';
import {toAddress, zeroAddress} from '@yearn-finance/web-lib/utils/address';
import {
	BAL_TOKEN_ADDRESS,
	BALWETH_TOKEN_ADDRESS,
	CRV_TOKEN_ADDRESS,
	CVXCRV_TOKEN_ADDRESS,
	ETH_TOKEN_ADDRESS,
	LPYBAL_TOKEN_ADDRESS,
	LPYCRV_TOKEN_ADDRESS,
	LPYCRV_V2_TOKEN_ADDRESS,
	STYBAL_TOKEN_ADDRESS,
	YBAL_TOKEN_ADDRESS,
	YCRV_CURVE_POOL_V2_ADDRESS,
	YCRV_TOKEN_ADDRESS,
	YVBOOST_TOKEN_ADDRESS,
	YVECRV_TOKEN_ADDRESS
} from '@yearn-finance/web-lib/utils/constants';
import {toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {useYearn} from '@common/contexts/useYearn';
import {type TUseBalancesTokens, useBalances} from '@common/hooks/useMultichainBalances';

import type {ReactElement} from 'react';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';
import type {TChainTokens, TNormalizedBN, TToken} from '@common/types/types';

export type TWalletContext = {
	getToken: ({address, chainID}: TTokenAndChain) => TToken;
	getBalance: ({address, chainID}: TTokenAndChain) => TNormalizedBN;
	getPrice: ({address, chainID}: TTokenAndChain) => TNormalizedBN;
	balances: TChainTokens;
	cumulatedValueInV2Vaults: number;
	cumulatedValueInV3Vaults: number;
	isLoading: boolean;
	shouldUseForknetBalances: boolean;
	refresh: (tokenList?: TUseBalancesTokens[]) => Promise<TChainTokens>;
	triggerForknetBalances: () => void;
};
type TTokenAndChain = {address: TAddress; chainID: number};

const defaultToken: TToken = {
	address: zeroAddress,
	name: '',
	symbol: '',
	decimals: 18,
	chainID: 1,
	value: 0,
	stakingValue: 0,
	price: toNormalizedBN(0),
	balance: toNormalizedBN(0)
};

const defaultProps = {
	getToken: (): TToken => defaultToken,
	getBalance: (): TNormalizedBN => toNormalizedBN(0),
	getPrice: (): TNormalizedBN => toNormalizedBN(0),
	balances: {},
	cumulatedValueInV2Vaults: 0,
	cumulatedValueInV3Vaults: 0,
	isLoading: true,
	shouldUseForknetBalances: false,
	refresh: async (): Promise<TChainTokens> => ({}),
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
				{chainID: 1, address: BAL_TOKEN_ADDRESS},
				{chainID: 1, address: YBAL_TOKEN_ADDRESS},
				{chainID: 1, address: BALWETH_TOKEN_ADDRESS},
				{chainID: 1, address: STYBAL_TOKEN_ADDRESS},
				{chainID: 1, address: LPYBAL_TOKEN_ADDRESS},
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
	tokens: TChainTokens;
	isLoading: boolean;
	onRefresh: (tokenToUpdate?: TUseBalancesTokens[]) => Promise<TChainTokens>;
} {
	const {prices} = useYearn();
	const allTokens = useYearnTokens({shouldUseForknetBalances});
	const {data: tokensRaw, onUpdate, onUpdateSome, isLoading} = useBalances({tokens: allTokens, prices});

	const tokens = useDeepCompareMemo((): TChainTokens => {
		const _tokens = {...tokensRaw};
		if (shouldUseForknetBalances) {
			_tokens[1] = _tokens[1337]; // eslint-disable-line prefer-destructuring
		}
		return _tokens;
	}, [tokensRaw, shouldUseForknetBalances]);

	const onRefresh = useCallback(
		async (tokenToUpdate?: TUseBalancesTokens[]): Promise<TChainTokens> => {
			if (tokenToUpdate) {
				const updatedBalances = await onUpdateSome(tokenToUpdate);
				return updatedBalances;
			}
			const updatedBalances = await onUpdate();
			return updatedBalances;
		},
		[onUpdate, onUpdateSome]
	);

	useEffect((): void => {
		if (isLoading) {
			onLoadStart();
		} else {
			onLoadDone();
		}
	}, [isLoading]);

	return {tokens, isLoading, onRefresh};
}

/* 🔵 - Yearn Finance **********************************************************
 ** This context controls most of the user's wallet data we may need to
 ** interact with our app, aka mostly the balances and the token prices.
 ******************************************************************************/
const WalletContext = createContext<TWalletContext>(defaultProps);
export const WalletContextApp = memo(function WalletContextApp({children}: {children: ReactElement}): ReactElement {
	const {vaults, prices, vaultsMigrations} = useYearn();
	const [shouldUseForknetBalances, set_shouldUseForknetBalances] = useState<boolean>(false);
	const {tokens, isLoading, onRefresh} = useYearnBalances({shouldUseForknetBalances});

	const [cumulatedValueInV2Vaults, cumulatedValueInV3Vaults] = useMemo((): [number, number] => {
		let cumulatedValueInV2Vaults = 0;
		let cumulatedValueInV3Vaults = 0;
		for (const [, perChain] of Object.entries(tokens)) {
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
	}, [vaults, vaultsMigrations, tokens]);

	const getToken = useCallback(
		({address, chainID}: TTokenAndChain): TToken => tokens?.[chainID || 1]?.[address] || defaultToken,
		[tokens]
	);
	const getBalance = useCallback(
		({address, chainID}: TTokenAndChain): TNormalizedBN =>
			tokens?.[chainID || 1]?.[address]?.balance || toNormalizedBN(0),
		[tokens]
	);
	const getPrice = useCallback(
		({address, chainID}: TTokenAndChain): TNormalizedBN => {
			const price = tokens?.[chainID || 1]?.[address]?.price;
			if (!price) {
				return toNormalizedBN(prices?.[chainID]?.[address] || 0, 6) || toNormalizedBN(0);
			}
			return price;
		},
		[prices, tokens]
	);

	/* 🔵 - Yearn Finance ******************************************************
	 **	Setup and render the Context provider to use in the app.
	 ***************************************************************************/
	const contextValue = useMemo(
		(): TWalletContext => ({
			getToken,
			getBalance,
			getPrice,
			balances: tokens,
			cumulatedValueInV2Vaults,
			cumulatedValueInV3Vaults,
			isLoading: isLoading || false,
			shouldUseForknetBalances,
			refresh: onRefresh,
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
			tokens,
			cumulatedValueInV2Vaults,
			cumulatedValueInV3Vaults,
			isLoading,
			shouldUseForknetBalances,
			onRefresh
		]
	);

	return <WalletContext.Provider value={contextValue}>{children}</WalletContext.Provider>;
});

export const useWallet = (): TWalletContext => useContext(WalletContext);
