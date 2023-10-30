import {createContext, memo, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {
	OPT_YVAGEUR_USDC_STAKING_CONTRACT,
	OPT_YVALETH_FRXETH_STAKING_CONTRACT,
	OPT_YVALETH_WETH_STAKING_CONTRACT,
	OPT_YVALUSD_FRAX_STAKING_CONTRACT,
	OPT_YVALUSD_USDC_STAKING_CONTRACT,
	OPT_YVDAI_STAKING_CONTRACT,
	OPT_YVDOLA_USDC_STAKING_CONTRACT,
	OPT_YVDOLAUSDC_STAKING_CONTRACT,
	OPT_YVERN_DOLA_STAKING_CONTRACT,
	OPT_YVERN_LUSD_STAKING_CONTRACT,
	OPT_YVETH_STAKING_CONTRACT,
	OPT_YVEXA_WETH_STAKING_CONTRACT,
	OPT_YVFRAX_DOLA_STAKING_CONTRACT,
	OPT_YVIB_WETH_STAKING_CONTRACT,
	OPT_YVLDO_WSTETH_STAKING_CONTRACT,
	OPT_YVLUSD_WETH_STAKING_CONTRACT,
	OPT_YVMAI_ALUSD_STAKING_CONTRACT,
	OPT_YVMAI_DOLA_STAKING_CONTRACT,
	OPT_YVMAI_STAKING_CONTRACT,
	OPT_YVMAI_USDC_STAKING_CONTRACT,
	OPT_YVMAIUSDC_STAKING_CONTRACT,
	OPT_YVMIM_USDC_STAKING_CONTRACT,
	OPT_YVMTA_USDC_STAKING_CONTRACT,
	OPT_YVOP_USDC_STAKING_CONTRACT,
	OPT_YVOP_VELO_STAKING_CONTRACT,
	OPT_YVOP_WETH_STAKING_CONTRACT,
	OPT_YVSNX_USDC_STAKING_CONTRACT,
	OPT_YVSTERN_ERN_STAKING_CONTRACT,
	OPT_YVSTG_USDC_STAKING_CONTRACT,
	OPT_YVSUSCUSDC_STAKING_CONTRACT,
	OPT_YVTBTC_WBTC_STAKING_CONTRACT,
	OPT_YVTBTC_WETH_STAKING_CONTRACT,
	OPT_YVUSDC_STAKING_CONTRACT,
	OPT_YVUSDT_STAKING_CONTRACT,
	OPT_YVVELO_USDC_STAKING_CONTRACT,
	OPT_YVWUSDR_USDC_STAKING_CONTRACT,
	OPT_YVWUSDRV2_USDC_STAKING_CONTRACT,
	STACKING_TO_VAULT
} from '@vaults/constants/optRewards';
import {useUI} from '@yearn-finance/web-lib/contexts/useUI';
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
	getToken: ({address, chainID}: {address: TAddress; chainID: number}) => TToken;
	getBalance: ({address, chainID}: {address: TAddress; chainID: number}) => TNormalizedBN;
	getPrice: ({address, chainID}: {address: TAddress; chainID: number}) => TNormalizedBN;
	balances: TChainTokens;
	cumulatedValueInV2Vaults: number;
	cumulatedValueInV3Vaults: number;
	balancesNonce: number;
	isLoading: boolean;
	shouldUseForknetBalances: boolean;
	refresh: (tokenList?: TUseBalancesTokens[]) => Promise<TChainTokens>;
	triggerForknetBalances: () => void;
};

const defaultToken: TToken = {
	address: zeroAddress,
	name: '',
	symbol: '',
	decimals: 18,
	chainID: 1,
	value: 0,
	stakingValue: 0,
	price: toNormalizedBN(0),
	balance: toNormalizedBN(0),
	stakingBalance: toNormalizedBN(0)
};

const defaultProps = {
	getToken: (): TToken => defaultToken,
	getBalance: (): TNormalizedBN => toNormalizedBN(0),
	getPrice: (): TNormalizedBN => toNormalizedBN(0),
	balances: {},
	cumulatedValueInV2Vaults: 0,
	cumulatedValueInV3Vaults: 0,
	balancesNonce: 0,
	isLoading: true,
	shouldUseForknetBalances: false,
	refresh: async (): Promise<TChainTokens> => ({}),
	triggerForknetBalances: (): void => {}
};

/* 🔵 - Yearn Finance **********************************************************
 ** This context controls most of the user's wallet data we may need to
 ** interact with our app, aka mostly the balances and the token prices.
 ******************************************************************************/
const WalletContext = createContext<TWalletContext>(defaultProps);
export const WalletContextApp = memo(function WalletContextApp({children}: {children: ReactElement}): ReactElement {
	const {vaults, vaultsMigrations, vaultsRetired, isLoadingVaultList, prices} = useYearn();
	const {onLoadStart, onLoadDone} = useUI();
	const [shouldUseForknetBalances, set_shouldUseForknetBalances] = useState<boolean>(false);

	//List all tokens related to yearn vaults
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
				{chainID: 1, address: LPYCRV_V2_TOKEN_ADDRESS},
				{chainID: 10, address: OPT_YVETH_STAKING_CONTRACT, symbol: 'yvETH', decimals: 18},
				{chainID: 10, address: OPT_YVDAI_STAKING_CONTRACT, symbol: 'yvDAI', decimals: 18},
				{chainID: 10, address: OPT_YVUSDT_STAKING_CONTRACT, symbol: 'yvUSDT', decimals: 6},
				{chainID: 10, address: OPT_YVUSDC_STAKING_CONTRACT, symbol: 'yvUSDC', decimals: 6},
				{chainID: 10, address: OPT_YVSUSCUSDC_STAKING_CONTRACT, symbol: 'yvVelo-USDC-sUSD', decimals: 18},
				{chainID: 10, address: OPT_YVDOLAUSDC_STAKING_CONTRACT, symbol: 'yvVelo-DOLA-USDC', decimals: 18},
				{chainID: 10, address: OPT_YVMAIUSDC_STAKING_CONTRACT, symbol: 'yvVelo-MAI-USDC', decimals: 18},
				{chainID: 10, address: OPT_YVMAI_STAKING_CONTRACT, symbol: 'yvMAI', decimals: 18},
				{chainID: 10, address: OPT_YVMAI_USDC_STAKING_CONTRACT, symbol: 'yvMAI-USDC', decimals: 18},
				{chainID: 10, address: OPT_YVMAI_DOLA_STAKING_CONTRACT, symbol: 'yvMAI-DOLA', decimals: 18},
				{chainID: 10, address: OPT_YVLDO_WSTETH_STAKING_CONTRACT, symbol: 'yvLDO-WSTETH', decimals: 18},
				{chainID: 10, address: OPT_YVWUSDR_USDC_STAKING_CONTRACT, symbol: 'yvWUSDR-USDC', decimals: 18},
				{chainID: 10, address: OPT_YVVELO_USDC_STAKING_CONTRACT, symbol: 'yvVELO-USDC', decimals: 18},
				{chainID: 10, address: OPT_YVMAI_ALUSD_STAKING_CONTRACT, symbol: 'yvVelo-MAI-alUSD', decimals: 18},
				{chainID: 10, address: OPT_YVALUSD_FRAX_STAKING_CONTRACT, symbol: 'yvVelo-alUSD-FRAX', decimals: 18},
				{
					chainID: 10,
					address: OPT_YVALETH_FRXETH_STAKING_CONTRACT,
					symbol: 'yvVelo-alETH-frxETH',
					decimals: 18
				},
				{chainID: 10, address: OPT_YVALETH_WETH_STAKING_CONTRACT, symbol: 'yvVelo-alETH-WETH', decimals: 18},
				{chainID: 10, address: OPT_YVERN_DOLA_STAKING_CONTRACT, symbol: 'yvVelo-ERN-DOLA', decimals: 18},
				{chainID: 10, address: OPT_YVERN_LUSD_STAKING_CONTRACT, symbol: 'yvVelo-ERN-LUSD', decimals: 18},
				{chainID: 10, address: OPT_YVLUSD_WETH_STAKING_CONTRACT, symbol: 'yvVelo-LUSD-WETH', decimals: 18},
				{chainID: 10, address: OPT_YVAGEUR_USDC_STAKING_CONTRACT, symbol: 'yvVelo-agEUR-USDC', decimals: 18},
				{chainID: 10, address: OPT_YVMIM_USDC_STAKING_CONTRACT, symbol: 'yvVelo-MIM-USDC', decimals: 18},
				{chainID: 10, address: OPT_YVDOLA_USDC_STAKING_CONTRACT, symbol: 'yvVelo-DOLA-USDC', decimals: 18},
				{chainID: 10, address: OPT_YVOP_USDC_STAKING_CONTRACT, symbol: 'yvVelo-OP-USDC', decimals: 18},
				{chainID: 10, address: OPT_YVOP_VELO_STAKING_CONTRACT, symbol: 'yvVelo-OP-VELO', decimals: 18},
				{chainID: 10, address: OPT_YVSNX_USDC_STAKING_CONTRACT, symbol: 'yvVelo-SNX-USDC', decimals: 18},
				{chainID: 10, address: OPT_YVFRAX_DOLA_STAKING_CONTRACT, symbol: 'yvVelo-DOLA-FRAX', decimals: 18},
				{chainID: 10, address: OPT_YVALUSD_USDC_STAKING_CONTRACT, symbol: 'yvVelo-ALUSD-USDC', decimals: 18},
				{chainID: 10, address: OPT_YVMTA_USDC_STAKING_CONTRACT, symbol: 'yvVelo-MTA-USDC', decimals: 18},
				{chainID: 10, address: OPT_YVIB_WETH_STAKING_CONTRACT, symbol: 'yvVelo-IB-WETH', decimals: 18},
				{chainID: 10, address: OPT_YVEXA_WETH_STAKING_CONTRACT, symbol: 'yvVelo-EXA-WETH', decimals: 18},
				{chainID: 10, address: OPT_YVTBTC_WETH_STAKING_CONTRACT, symbol: 'yvVelo-tBTC-WETH', decimals: 18},
				{chainID: 10, address: OPT_YVTBTC_WBTC_STAKING_CONTRACT, symbol: 'yvVelo-tBTC-WBTC', decimals: 18},
				{chainID: 10, address: OPT_YVOP_WETH_STAKING_CONTRACT, symbol: 'yvVelo-OP-WETH', decimals: 18},
				{
					chainID: 10,
					address: OPT_YVWUSDRV2_USDC_STAKING_CONTRACT,
					symbol: 'yvVelo-wUSDRv2-USDC',
					decimals: 18
				},
				{chainID: 10, address: OPT_YVSTERN_ERN_STAKING_CONTRACT, symbol: 'yvVelo-stERN-ERN', decimals: 18},
				{chainID: 10, address: OPT_YVSTG_USDC_STAKING_CONTRACT, symbol: 'yvVelo-STG-USDC', decimals: 18}
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

	// Fetch the balances
	const {
		data: tokensRaw,
		update,
		updateSome,
		nonce,
		isLoading
	} = useBalances({
		tokens: [...allTokens],
		prices
	});

	const tokens = useMemo((): TChainTokens => {
		const _tokens = {...tokensRaw};
		for (const [chainIDStr, perChain] of Object.entries(_tokens)) {
			const chainID = Number(chainIDStr);
			for (const [tokenAddress] of Object.entries(perChain)) {
				if (STACKING_TO_VAULT[tokenAddress] && _tokens?.[chainID]?.[STACKING_TO_VAULT[tokenAddress]]) {
					_tokens[chainID][tokenAddress].stakingBalance =
						_tokens[chainID][STACKING_TO_VAULT[tokenAddress]].balance;
					_tokens[chainID][tokenAddress].stakingValue =
						_tokens[chainID][STACKING_TO_VAULT[tokenAddress]].value;
				}
			}
		}

		if (shouldUseForknetBalances) {
			// eslint-disable-next-line prefer-destructuring
			_tokens[1] = _tokens[1337];
		}
		return _tokens;
	}, [tokensRaw, shouldUseForknetBalances]);

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
						console.log(tokenData);
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

	const onRefresh = useCallback(
		async (tokenToUpdate?: TUseBalancesTokens[]): Promise<TChainTokens> => {
			if (tokenToUpdate) {
				const updatedBalances = await updateSome(tokenToUpdate);
				return updatedBalances;
			}
			const updatedBalances = await update();
			return updatedBalances;
		},
		[update, updateSome]
	);

	useEffect((): void => {
		if (isLoading) {
			onLoadStart();
		} else {
			onLoadDone();
		}
	}, [isLoading, onLoadDone, onLoadStart]);

	const getToken = useCallback(
		({address, chainID}: {address: TAddress; chainID: number}): TToken => {
			return tokens?.[chainID || 1]?.[address] || defaultToken;
		},
		[tokens]
	);
	const getBalance = useCallback(
		({address, chainID}: {address: TAddress; chainID: number}): TNormalizedBN => {
			return tokens?.[chainID || 1]?.[address]?.balance || toNormalizedBN(0);
		},
		[tokens]
	);
	const getPrice = useCallback(
		({address, chainID}: {address: TAddress; chainID: number}): TNormalizedBN => {
			return tokens?.[chainID || 1]?.[address]?.price || toNormalizedBN(0);
		},
		[tokens]
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
			balancesNonce: nonce,
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
			nonce,
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
