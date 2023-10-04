import {createContext, memo, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {useChainId} from 'wagmi';
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
	cumulatedValueInVaults: number;
	balancesNonce: number;
	isLoading: boolean;
	refresh: (tokenList?: TUseBalancesTokens[]) => Promise<TChainTokens>;
};

const defaultToken: TToken = {
	address: zeroAddress,
	name: '',
	symbol: '',
	decimals: 18,
	chainID: 1,
	value: 0,
	price: toNormalizedBN(0),
	balance: toNormalizedBN(0)
};

const defaultProps = {
	getToken: (): TToken => defaultToken,
	getBalance: (): TNormalizedBN => toNormalizedBN(0),
	getPrice: (): TNormalizedBN => toNormalizedBN(0),
	balances: {},
	cumulatedValueInVaults: 0,
	balancesNonce: 0,
	isLoading: true,
	refresh: async (): Promise<TChainTokens> => ({})
};

/* 🔵 - Yearn Finance **********************************************************
 ** This context controls most of the user's wallet data we may need to
 ** interact with our app, aka mostly the balances and the token prices.
 ******************************************************************************/
const WalletContext = createContext<TWalletContext>(defaultProps);
export const WalletContextApp = memo(function WalletContextApp({children}: {children: ReactElement}): ReactElement {
	const chain = useChainId();
	const {vaults, vaultsMigrations, vaultsRetired, isLoadingVaultList, prices} = useYearn();
	const {onLoadStart, onLoadDone} = useUI();
	const [balances, set_balances] = useState<TChainTokens>({});

	//List all tokens related to yearn vaults
	const availableTokens = useMemo((): TUseBalancesTokens[] => {
		if (isLoadingVaultList) {
			return [];
		}
		const tokens: TUseBalancesTokens[] = [];
		const tokensExists: TDict<boolean> = {};
<<<<<<< HEAD
		const extraTokens: TUseBalancesTokens[] = [{token: ETH_TOKEN_ADDRESS}];
		if (safeChainID === 1) {
			extraTokens.push(
				...[
					{token: YCRV_TOKEN_ADDRESS},
					{token: LPYCRV_TOKEN_ADDRESS},
					{token: CRV_TOKEN_ADDRESS},
					{token: YVBOOST_TOKEN_ADDRESS},
					{token: YVECRV_TOKEN_ADDRESS},
					{token: CVXCRV_TOKEN_ADDRESS},
					{token: BAL_TOKEN_ADDRESS},
					{token: YBAL_TOKEN_ADDRESS},
					{token: BALWETH_TOKEN_ADDRESS},
					{token: STYBAL_TOKEN_ADDRESS},
					{token: LPYBAL_TOKEN_ADDRESS},
					{token: YCRV_CURVE_POOL_V2_ADDRESS},
					{token: LPYCRV_V2_TOKEN_ADDRESS}
				]
			);
		}
		if (safeChainID === 10) {
			extraTokens.push({token: OPT_YVETH_STAKING_CONTRACT, symbol: 'yvETH', decimals: 18});
			extraTokens.push({token: OPT_YVDAI_STAKING_CONTRACT, symbol: 'yvDAI', decimals: 18});
			extraTokens.push({token: OPT_YVUSDT_STAKING_CONTRACT, symbol: 'yvUSDT', decimals: 6});
			extraTokens.push({token: OPT_YVUSDC_STAKING_CONTRACT, symbol: 'yvUSDC', decimals: 6});
			extraTokens.push({token: OPT_YVSUSCUSDC_STAKING_CONTRACT, symbol: 'yvVelo-USDC-sUSD', decimals: 18});
			extraTokens.push({token: OPT_YVDOLAUSDC_STAKING_CONTRACT, symbol: 'yvVelo-DOLA-USDC', decimals: 18});
			extraTokens.push({token: OPT_YVMAIUSDC_STAKING_CONTRACT, symbol: 'yvVelo-MAI-USDC', decimals: 18});
			extraTokens.push({token: OPT_YVMAI_STAKING_CONTRACT, symbol: 'yvMAI', decimals: 18});
			extraTokens.push({token: OPT_YVMAI_USDC_STAKING_CONTRACT, symbol: 'yvMAI-USDC', decimals: 18});
			extraTokens.push({token: OPT_YVMAI_DOLA_STAKING_CONTRACT, symbol: 'yvMAI-DOLA', decimals: 18});
			extraTokens.push({token: OPT_YVLDO_WSTETH_STAKING_CONTRACT, symbol: 'yvLDO-WSTETH', decimals: 18});
			extraTokens.push({token: OPT_YVWUSDR_USDC_STAKING_CONTRACT, symbol: 'yvWUSDR-USDC', decimals: 18});
			extraTokens.push({token: OPT_YVVELO_USDC_STAKING_CONTRACT, symbol: 'yvVELO-USDC', decimals: 18});
			extraTokens.push({token: OPT_YVMAI_ALUSD_STAKING_CONTRACT, symbol: 'yvVelo-MAI-alUSD', decimals: 18});
			extraTokens.push({token: OPT_YVALUSD_FRAX_STAKING_CONTRACT, symbol: 'yvVelo-alUSD-FRAX', decimals: 18});
			extraTokens.push({token: OPT_YVALETH_FRXETH_STAKING_CONTRACT, symbol: 'yvVelo-alETH-frxETH', decimals: 18});
			extraTokens.push({token: OPT_YVALETH_WETH_STAKING_CONTRACT, symbol: 'yvVelo-alETH-WETH', decimals: 18});
			extraTokens.push({token: OPT_YVERN_DOLA_STAKING_CONTRACT, symbol: 'yvVelo-ERN-DOLA', decimals: 18});
			extraTokens.push({token: OPT_YVERN_LUSD_STAKING_CONTRACT, symbol: 'yvVelo-ERN-LUSD', decimals: 18});
			extraTokens.push({token: OPT_YVLUSD_WETH_STAKING_CONTRACT, symbol: 'yvVelo-LUSD-WETH', decimals: 18});
			extraTokens.push({token: OPT_YVAGEUR_USDC_STAKING_CONTRACT, symbol: 'yvVelo-agEUR-USDC', decimals: 18});
			extraTokens.push({token: OPT_YVMIM_USDC_STAKING_CONTRACT, symbol: 'yvVelo-MIM-USDC', decimals: 18});
			extraTokens.push({token: OPT_YVDOLA_USDC_STAKING_CONTRACT, symbol: 'yvVelo-DOLA-USDC', decimals: 18});
			extraTokens.push({token: OPT_YVOP_USDC_STAKING_CONTRACT, symbol: 'yvVelo-OP-USDC', decimals: 18});
			extraTokens.push({token: OPT_YVOP_VELO_STAKING_CONTRACT, symbol: 'yvVelo-OP-VELO', decimals: 18});
			extraTokens.push({token: OPT_YVSNX_USDC_STAKING_CONTRACT, symbol: 'yvVelo-SNX-USDC', decimals: 18});
			extraTokens.push({token: OPT_YVFRAX_DOLA_STAKING_CONTRACT, symbol: 'yvVelo-DOLA-FRAX', decimals: 18});
			extraTokens.push({token: OPT_YVALUSD_USDC_STAKING_CONTRACT, symbol: 'yvVelo-ALUSD-USDC', decimals: 18});
			extraTokens.push({token: OPT_YVMTA_USDC_STAKING_CONTRACT, symbol: 'yvVelo-MTA-USDC', decimals: 18});
			extraTokens.push({token: OPT_YVIB_WETH_STAKING_CONTRACT, symbol: 'yvVelo-IB-WETH', decimals: 18});
			extraTokens.push({token: OPT_YVEXA_WETH_STAKING_CONTRACT, symbol: 'yvVelo-EXA-WETH', decimals: 18});
			extraTokens.push({token: OPT_YVTBTC_WETH_STAKING_CONTRACT, symbol: 'yvVelo-tBTC-WETH', decimals: 18});
			extraTokens.push({token: OPT_YVTBTC_WBTC_STAKING_CONTRACT, symbol: 'yvVelo-tBTC-WBTC', decimals: 18});
			extraTokens.push({token: OPT_YVOP_WETH_STAKING_CONTRACT, symbol: 'yvVelo-OP-WETH', decimals: 18});
			extraTokens.push({token: OPT_YVWUSDRV2_USDC_STAKING_CONTRACT, symbol: 'yvVelo-wUSDRv2-USDC', decimals: 18});
			extraTokens.push({token: OPT_YVSTERN_ERN_STAKING_CONTRACT, symbol: 'yvVelo-stERN-ERN', decimals: 18});
		}
=======
		const extraTokens: TUseBalancesTokens[] = [{chainID: 1, address: toAddress(ETH_TOKEN_ADDRESS)}];
		extraTokens.push(
			...[
				{chainID: 1, address: toAddress(YCRV_TOKEN_ADDRESS)},
				{chainID: 1, address: toAddress(LPYCRV_TOKEN_ADDRESS)},
				{chainID: 1, address: toAddress(CRV_TOKEN_ADDRESS)},
				{chainID: 1, address: toAddress(YVBOOST_TOKEN_ADDRESS)},
				{chainID: 1, address: toAddress(YVECRV_TOKEN_ADDRESS)},
				{chainID: 1, address: toAddress(CVXCRV_TOKEN_ADDRESS)},
				{chainID: 1, address: toAddress(BAL_TOKEN_ADDRESS)},
				{chainID: 1, address: toAddress(YBAL_TOKEN_ADDRESS)},
				{chainID: 1, address: toAddress(BALWETH_TOKEN_ADDRESS)},
				{chainID: 1, address: toAddress(STYBAL_TOKEN_ADDRESS)},
				{chainID: 1, address: toAddress(LPYBAL_TOKEN_ADDRESS)},
				{chainID: 1, address: toAddress(YCRV_CURVE_POOL_V2_ADDRESS)},
				{chainID: 1, address: toAddress(LPYCRV_V2_TOKEN_ADDRESS)},
				{chainID: 10, address: toAddress(OPT_YVETH_STAKING_CONTRACT), symbol: 'yvETH', decimals: 18},
				{chainID: 10, address: toAddress(OPT_YVDAI_STAKING_CONTRACT), symbol: 'yvDAI', decimals: 18},
				{chainID: 10, address: toAddress(OPT_YVUSDT_STAKING_CONTRACT), symbol: 'yvUSDT', decimals: 6},
				{chainID: 10, address: toAddress(OPT_YVUSDC_STAKING_CONTRACT), symbol: 'yvUSDC', decimals: 6},
				{
					chainID: 10,
					address: toAddress(OPT_YVSUSCUSDC_STAKING_CONTRACT),
					symbol: 'yvVelo-USDC-sUSD',
					decimals: 18
				},
				{
					chainID: 10,
					address: toAddress(OPT_YVDOLAUSDC_STAKING_CONTRACT),
					symbol: 'yvVelo-DOLA-USDC',
					decimals: 18
				},
				{
					chainID: 10,
					address: toAddress(OPT_YVMAIUSDC_STAKING_CONTRACT),
					symbol: 'yvVelo-MAI-USDC',
					decimals: 18
				},
				{chainID: 10, address: toAddress(OPT_YVMAI_STAKING_CONTRACT), symbol: 'yvMAI', decimals: 18},
				{chainID: 10, address: toAddress(OPT_YVMAI_USDC_STAKING_CONTRACT), symbol: 'yvMAI-USDC', decimals: 18},
				{chainID: 10, address: toAddress(OPT_YVMAI_DOLA_STAKING_CONTRACT), symbol: 'yvMAI-DOLA', decimals: 18},
				{
					chainID: 10,
					address: toAddress(OPT_YVLDO_WSTETH_STAKING_CONTRACT),
					symbol: 'yvLDO-WSTETH',
					decimals: 18
				},
				{
					chainID: 10,
					address: toAddress(OPT_YVWUSDR_USDC_STAKING_CONTRACT),
					symbol: 'yvWUSDR-USDC',
					decimals: 18
				},
				{
					chainID: 10,
					address: toAddress(OPT_YVVELO_USDC_STAKING_CONTRACT),
					symbol: 'yvVELO-USDC',
					decimals: 18
				},
				{
					chainID: 10,
					address: toAddress(OPT_YVMAI_ALUSD_STAKING_CONTRACT),
					symbol: 'yvVelo-MAI-alUSD',
					decimals: 18
				},
				{
					chainID: 10,
					address: toAddress(OPT_YVALUSD_FRAX_STAKING_CONTRACT),
					symbol: 'yvVelo-alUSD-FRAX',
					decimals: 18
				},
				{
					chainID: 10,
					address: toAddress(OPT_YVALETH_FRXETH_STAKING_CONTRACT),
					symbol: 'yvVelo-alETH-frxETH',
					decimals: 18
				},
				{
					chainID: 10,
					address: toAddress(OPT_YVALETH_WETH_STAKING_CONTRACT),
					symbol: 'yvVelo-alETH-WETH',
					decimals: 18
				},
				{
					chainID: 10,
					address: toAddress(OPT_YVERN_DOLA_STAKING_CONTRACT),
					symbol: 'yvVelo-ERN-DOLA',
					decimals: 18
				},
				{
					chainID: 10,
					address: toAddress(OPT_YVERN_LUSD_STAKING_CONTRACT),
					symbol: 'yvVelo-ERN-LUSD',
					decimals: 18
				},
				{
					chainID: 10,
					address: toAddress(OPT_YVLUSD_WETH_STAKING_CONTRACT),
					symbol: 'yvVelo-LUSD-WETH',
					decimals: 18
				},
				{
					chainID: 10,
					address: toAddress(OPT_YVAGEUR_USDC_STAKING_CONTRACT),
					symbol: 'yvVelo-agEUR-USDC',
					decimals: 18
				},
				{
					chainID: 10,
					address: toAddress(OPT_YVMIM_USDC_STAKING_CONTRACT),
					symbol: 'yvVelo-MIM-USDC',
					decimals: 18
				},
				{
					chainID: 10,
					address: toAddress(OPT_YVDOLA_USDC_STAKING_CONTRACT),
					symbol: 'yvVelo-DOLA-USDC',
					decimals: 18
				},
				{
					chainID: 10,
					address: toAddress(OPT_YVOP_USDC_STAKING_CONTRACT),
					symbol: 'yvVelo-OP-USDC',
					decimals: 18
				},
				{
					chainID: 10,
					address: toAddress(OPT_YVOP_VELO_STAKING_CONTRACT),
					symbol: 'yvVelo-OP-VELO',
					decimals: 18
				},
				{
					chainID: 10,
					address: toAddress(OPT_YVSNX_USDC_STAKING_CONTRACT),
					symbol: 'yvVelo-SNX-USDC',
					decimals: 18
				},
				{
					chainID: 10,
					address: toAddress(OPT_YVFRAX_DOLA_STAKING_CONTRACT),
					symbol: 'yvVelo-DOLA-FRAX',
					decimals: 18
				},
				{
					chainID: 10,
					address: toAddress(OPT_YVALUSD_USDC_STAKING_CONTRACT),
					symbol: 'yvVelo-ALUSD-USDC',
					decimals: 18
				},
				{
					chainID: 10,
					address: toAddress(OPT_YVMTA_USDC_STAKING_CONTRACT),
					symbol: 'yvVelo-MTA-USDC',
					decimals: 18
				},
				{
					chainID: 10,
					address: toAddress(OPT_YVIB_WETH_STAKING_CONTRACT),
					symbol: 'yvVelo-IB-WETH',
					decimals: 18
				},
				{
					chainID: 10,
					address: toAddress(OPT_YVEXA_WETH_STAKING_CONTRACT),
					symbol: 'yvVelo-EXA-WETH',
					decimals: 18
				},
				{
					chainID: 10,
					address: toAddress(OPT_YVTBTC_WETH_STAKING_CONTRACT),
					symbol: 'yvVelo-tBTC-WETH',
					decimals: 18
				},
				{
					chainID: 10,
					address: toAddress(OPT_YVTBTC_WBTC_STAKING_CONTRACT),
					symbol: 'yvVelo-tBTC-WBTC',
					decimals: 18
				},
				{
					chainID: 10,
					address: toAddress(OPT_YVOP_WETH_STAKING_CONTRACT),
					symbol: 'yvVelo-OP-WETH',
					decimals: 18
				},
				{
					chainID: 10,
					address: toAddress(OPT_YVWUSDRV2_USDC_STAKING_CONTRACT),
					symbol: 'yvVelo-wUSDRv2-USDC',
					decimals: 18
				}
			]
		);

>>>>>>> e03b5eb3 (feat: refactor)
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
	}, [isLoadingVaultList, chain, vaults]);

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

	// Fetch the balances
	const {
		data: balancesRaw,
		update,
		updateSome,
		nonce,
		isLoading
	} = useBalances({
		tokens: [...availableTokens, ...migratableTokens, ...retiredTokens],
		prices
	});

	useEffect((): void => {
		const _balances = {...balancesRaw};
		for (const [token] of Object.entries(_balances)) {
			if (STACKING_TO_VAULT[token] && _balances?.[10]?.[STACKING_TO_VAULT[token]]) {
				_balances[10][token].value = (_balances[10][token].value || 0) + (_balances[10][STACKING_TO_VAULT[token]].value || 0);
			}
		}
		set_balances(_balances);
	}, [balancesRaw]);

	const cumulatedValueInVaults = useMemo((): number => {
		nonce; //Suppress warning
		let cumulatedValueInVaults = 0;

		for (const perChain of Object.values(balances)) {
			for (const [tokenAddress, balanceData] of Object.entries(perChain)) {
				if (vaults?.[toAddress(tokenAddress)]) {
					cumulatedValueInVaults += balanceData.value || 0;
				} else if (vaultsMigrations?.[toAddress(tokenAddress)]) {
					cumulatedValueInVaults += balanceData.value || 0;
				}
			}
		}
		return cumulatedValueInVaults;
	}, [vaults, vaultsMigrations, balances, nonce]);

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
			return balances?.[chainID || 1]?.[address] || defaultToken;
		},
		[balances]
	);
	const getBalance = useCallback(
		({address, chainID}: {address: TAddress; chainID: number}): TNormalizedBN => {
			return balances?.[chainID || 1]?.[address]?.balance || toNormalizedBN(0);
		},
		[balances]
	);
	const getPrice = useCallback(
		({address, chainID}: {address: TAddress; chainID: number}): TNormalizedBN => {
			return balances?.[chainID || 1]?.[address]?.price || toNormalizedBN(0);
		},
		[balances]
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
			balancesNonce: nonce,
			cumulatedValueInVaults,
			isLoading: isLoading || false,
			refresh: onRefresh
		}),
		[balances, cumulatedValueInVaults, isLoading, onRefresh, nonce]
	);

	return <WalletContext.Provider value={contextValue}>{children}</WalletContext.Provider>;
});

export const useWallet = (): TWalletContext => useContext(WalletContext);
