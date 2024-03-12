import {createContext, memo, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {deserialize, serialize} from 'wagmi';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {isZeroAddress, toAddress, toNormalizedBN, zeroNormalizedBN} from '@builtbymom/web3/utils';
import {useLocalStorageValue} from '@react-hookz/web';
import {useFetchYearnEarnedForUser} from '@yearn-finance/web-lib/hooks/useFetchYearnEarnedForUser';
import {useFetchYearnPrices} from '@yearn-finance/web-lib/hooks/useFetchYearnPrices';
import {useFetchYearnTokens} from '@yearn-finance/web-lib/hooks/useFetchYearnTokens';
import {useFetchYearnVaults} from '@yearn-finance/web-lib/hooks/useFetchYearnVaults';
import {Solver} from '@yearn-finance/web-lib/utils/schemas/yDaemonTokenListBalances';

import {useYearnBalances} from './useYearn.helper';

import type {ReactElement} from 'react';
import type {KeyedMutator} from 'swr';
import type {TYChainTokens, TYToken} from '@yearn-finance/web-lib/types';
import type {TYDaemonEarned} from '@yearn-finance/web-lib/utils/schemas/yDaemonEarnedSchema';
import type {TYDaemonPricesChain} from '@yearn-finance/web-lib/utils/schemas/yDaemonPricesSchema';
import type {TSolver} from '@yearn-finance/web-lib/utils/schemas/yDaemonTokenListBalances';
import type {TYDaemonTokens} from '@yearn-finance/web-lib/utils/schemas/yDaemonTokensSchema';
import type {TYDaemonVault, TYDaemonVaults} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TUseBalancesTokens} from '@builtbymom/web3/hooks/useBalances.multichains';
import type {TAddress, TDict, TNormalizedBN} from '@builtbymom/web3/types';

export const DEFAULT_SLIPPAGE = 0.5;
export const DEFAULT_MAX_LOSS = 1n;

type TTokenAndChain = {address: TAddress; chainID: number};
export type TYearnContext = {
	currentPartner: TAddress;
	earned?: TYDaemonEarned;
	prices?: TYDaemonPricesChain;
	tokens?: TYDaemonTokens;
	vaults: TDict<TYDaemonVault>;
	vaultsMigrations: TDict<TYDaemonVault>;
	vaultsRetired: TDict<TYDaemonVault>;
	isLoadingVaultList: boolean;
	zapSlippage: number;
	maxLoss: bigint;
	zapProvider: TSolver;
	isStakingOpBoostedVaults: boolean;
	mutateVaultList: KeyedMutator<TYDaemonVaults>;
	set_maxLoss: (value: bigint) => void;
	set_zapSlippage: (value: number) => void;
	set_zapProvider: (value: TSolver) => void;
	set_isStakingOpBoostedVaults: (value: boolean) => void;
	//
	//Yearn wallet context
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

const defaultToken: TYToken = {
	address: toAddress(''),
	name: '',
	symbol: '',
	decimals: 18,
	chainID: 1,
	value: 0,
	stakingValue: 0,
	price: zeroNormalizedBN,
	balance: zeroNormalizedBN,
	supportedZaps: []
};

const YearnContext = createContext<TYearnContext>({
	currentPartner: toAddress(process.env.PARTNER_ID_ADDRESS),
	earned: {
		earned: {},
		totalRealizedGainsUSD: 0,
		totalUnrealizedGainsUSD: 0
	},
	prices: {},
	tokens: {},
	vaults: {},
	vaultsMigrations: {},
	vaultsRetired: {},
	isLoadingVaultList: false,
	maxLoss: DEFAULT_MAX_LOSS,
	zapSlippage: 0.1,
	zapProvider: Solver.enum.Cowswap,
	isStakingOpBoostedVaults: true,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	mutateVaultList: (): any => undefined,
	set_maxLoss: (): void => undefined,
	set_zapSlippage: (): void => undefined,
	set_zapProvider: (): void => undefined,
	set_isStakingOpBoostedVaults: (): void => undefined,
	//
	//Yearn wallet context
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
});

export const YearnContextApp = memo(function YearnContextApp({children}: {children: ReactElement}): ReactElement {
	const {address: userAddress} = useWeb3();
	const [shouldUseForknetBalances, set_shouldUseForknetBalances] = useState<boolean>(false);
	const {value: maxLoss, set: set_maxLoss} = useLocalStorageValue<bigint>('yearn.fi/max-loss', {
		defaultValue: DEFAULT_MAX_LOSS,
		parse: (str, fallback): bigint => (str ? deserialize(str) : fallback ?? DEFAULT_MAX_LOSS),
		stringify: (data: bigint): string => serialize(data)
	});
	const {value: zapSlippage, set: set_zapSlippage} = useLocalStorageValue<number>('yearn.fi/zap-slippage', {
		defaultValue: DEFAULT_SLIPPAGE
	});
	const {value: zapProvider, set: set_zapProvider} = useLocalStorageValue<TSolver>('yearn.fi/zap-provider', {
		defaultValue: Solver.enum.Cowswap
	});
	const {value: isStakingOpBoostedVaults, set: set_isStakingOpBoostedVaults} = useLocalStorageValue<boolean>(
		'yearn.fi/staking-op-boosted-vaults',
		{
			defaultValue: true
		}
	);

	const prices = useFetchYearnPrices();
	const tokens = useFetchYearnTokens();
	const earned = useFetchYearnEarnedForUser();
	const {vaults, vaultsMigrations, vaultsRetired, isLoading, mutate} = useFetchYearnVaults();
	const {tokens: balances, isLoading: isLoadingBalances, onRefresh} = useYearnBalances({shouldUseForknetBalances});

	useEffect(() => {
		const tokensToRefresh: TUseBalancesTokens[] = [];
		for (const [chainID, tokensData] of Object.entries(tokens)) {
			if (tokensData) {
				for (const [address, token] of Object.entries(tokensData)) {
					if (token) {
						tokensToRefresh.push({address: toAddress(address), chainID: Number(chainID)});
					}
				}
			}
		}

		onRefresh(tokensToRefresh);
	}, [tokens, onRefresh]);

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
			const price = balances?.[chainID || 1]?.[address]?.price;
			if (!price) {
				return toNormalizedBN(prices?.[chainID]?.[address] || 0, 6) || zeroNormalizedBN;
			}
			return price;
		},
		[prices, balances]
	);

	return (
		<YearnContext.Provider
			value={{
				currentPartner: toAddress(process.env.PARTNER_ID_ADDRESS),
				prices,
				tokens,
				earned,
				zapSlippage: zapSlippage ?? DEFAULT_SLIPPAGE,
				maxLoss: maxLoss ?? DEFAULT_MAX_LOSS,
				zapProvider: zapProvider ?? Solver.enum.Cowswap,
				isStakingOpBoostedVaults: isStakingOpBoostedVaults ?? true,
				set_zapSlippage,
				set_maxLoss,
				set_zapProvider,
				set_isStakingOpBoostedVaults,
				vaults,
				vaultsMigrations,
				vaultsRetired,
				isLoadingVaultList: isLoading,
				mutateVaultList: mutate,
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
			}}>
			{children}
		</YearnContext.Provider>
	);
});

export const useYearn = (): TYearnContext => useContext(YearnContext);
