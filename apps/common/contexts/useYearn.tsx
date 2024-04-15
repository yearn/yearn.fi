import {createContext, memo, useCallback, useContext, useMemo} from 'react';
import {deserialize, serialize} from 'wagmi';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {isZeroAddress, toAddress, toNormalizedBN, zeroNormalizedBN} from '@builtbymom/web3/utils';
import {useLocalStorageValue} from '@react-hookz/web';
import {Solver, type TSolver} from '@vaults/types/solvers';
import {useFetchYearnEarnedForUser} from '@yearn-finance/web-lib/hooks/useFetchYearnEarnedForUser';
import {useFetchYearnPrices} from '@yearn-finance/web-lib/hooks/useFetchYearnPrices';
import {useFetchYearnVaults} from '@yearn-finance/web-lib/hooks/useFetchYearnVaults';

import {useYearnBalances} from './useYearn.helper';

import type {ReactElement} from 'react';
import type {KeyedMutator} from 'swr';
import type {TYChainTokens, TYToken} from '@yearn-finance/web-lib/types';
import type {TYDaemonEarned} from '@yearn-finance/web-lib/utils/schemas/yDaemonEarnedSchema';
import type {TYDaemonPricesChain} from '@yearn-finance/web-lib/utils/schemas/yDaemonPricesSchema';
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
	vaults: TDict<TYDaemonVault>;
	vaultsMigrations: TDict<TYDaemonVault>;
	vaultsRetired: TDict<TYDaemonVault>;
	isLoadingVaultList: boolean;
	zapSlippage: number;
	maxLoss: bigint;
	zapProvider: TSolver;
	isAutoStakingEnabled: boolean;
	mutateVaultList: KeyedMutator<TYDaemonVaults>;
	set_maxLoss: (value: bigint) => void;
	set_zapSlippage: (value: number) => void;
	set_zapProvider: (value: TSolver) => void;
	set_isAutoStakingEnabled: (value: boolean) => void;
	//
	//Yearn wallet context
	getToken: ({address, chainID}: TTokenAndChain) => TYToken;
	getBalance: ({address, chainID}: TTokenAndChain) => TNormalizedBN;
	getPrice: ({address, chainID}: TTokenAndChain) => TNormalizedBN;
	balances: TYChainTokens;
	cumulatedValueInV2Vaults: number;
	cumulatedValueInV3Vaults: number;
	isLoading: boolean;
	onRefresh: (tokenList?: TUseBalancesTokens[]) => Promise<TYChainTokens>;
};

const defaultToken: TYToken = {
	address: toAddress(''),
	name: '',
	symbol: '',
	decimals: 18,
	chainID: 1,
	value: 0,
	stakingValue: 0,
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
	vaults: {},
	vaultsMigrations: {},
	vaultsRetired: {},
	isLoadingVaultList: false,
	maxLoss: DEFAULT_MAX_LOSS,
	zapSlippage: 0.1,
	zapProvider: Solver.enum.Cowswap,
	isAutoStakingEnabled: true,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	mutateVaultList: (): any => undefined,
	set_maxLoss: (): void => undefined,
	set_zapSlippage: (): void => undefined,
	set_zapProvider: (): void => undefined,
	set_isAutoStakingEnabled: (): void => undefined,
	//
	//Yearn wallet context
	getToken: (): TYToken => defaultToken,
	getBalance: (): TNormalizedBN => zeroNormalizedBN,
	getPrice: (): TNormalizedBN => zeroNormalizedBN,
	balances: {},
	cumulatedValueInV2Vaults: 0,
	cumulatedValueInV3Vaults: 0,
	isLoading: true,
	onRefresh: async (): Promise<TYChainTokens> => ({})
});

export const YearnContextApp = memo(function YearnContextApp({children}: {children: ReactElement}): ReactElement {
	const {address: userAddress} = useWeb3();
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
	const {value: isAutoStakingEnabled, set: set_isAutoStakingEnabled} = useLocalStorageValue<boolean>(
		'yearn.fi/staking-op-boosted-vaults',
		{
			defaultValue: true
		}
	);

	const prices = useFetchYearnPrices();
	const earned = useFetchYearnEarnedForUser();
	const {vaults: rawVaults, vaultsMigrations, vaultsRetired, isLoading, mutate} = useFetchYearnVaults();

	const vaults = useMemo(() => {
		const vaults: TDict<TYDaemonVault> = {};
		for (const vault of Object.values(rawVaults)) {
			vaults[toAddress(vault.address)] = {...vault};
		}
		return vaults;
	}, [rawVaults]);

	const {balances, isLoadingBalances, onRefresh} = useYearnBalances({
		vaults,
		vaultsMigrations,
		vaultsRetired,
		isLoadingVaultList: isLoading
	});

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

	const [cumulatedValueInV2Vaults, cumulatedValueInV3Vaults] = useMemo((): [number, number] => {
		let cumulatedValueInV2Vaults = 0;
		let cumulatedValueInV3Vaults = 0;

		for (const perChain of Object.values(balances)) {
			for (const [tokenAddress, tokenData] of Object.entries(perChain)) {
				if (!vaults?.[toAddress(tokenData.address)]) {
					continue;
				}
				const tokenBalance = getBalance({address: tokenData.address, chainID: tokenData.chainID});
				const tokenPrice = getPrice({address: tokenData.address, chainID: tokenData.chainID});
				const tokenValue = tokenBalance.normalized * tokenPrice.normalized;

				let stakingValue = 0;
				const hasStaking = vaults[toAddress(tokenData.address)].staking.available;
				if (hasStaking) {
					const stakingAddress = vaults[toAddress(tokenData.address)].staking.address;
					const stakingBalance = getBalance({address: stakingAddress, chainID: tokenData.chainID});
					stakingValue = stakingBalance.normalized * tokenPrice.normalized;
				}
				// console.log(tokenValue, stakingValue, tokenBalance.normalized, tokenPrice.normalized);

				if (vaults?.[toAddress(tokenAddress)]) {
					if (vaults[toAddress(tokenAddress)].version.split('.')?.[0] === '3') {
						cumulatedValueInV3Vaults += tokenValue + stakingValue;
					} else {
						cumulatedValueInV2Vaults += tokenValue + stakingValue;
					}
				} else if (vaultsMigrations?.[toAddress(tokenAddress)]) {
					if (vaultsMigrations[toAddress(tokenAddress)].version.split('.')?.[0] === '3') {
						cumulatedValueInV3Vaults += tokenValue + stakingValue;
					} else {
						cumulatedValueInV2Vaults += tokenValue + stakingValue;
					}
				}
			}
		}
		return [cumulatedValueInV2Vaults, cumulatedValueInV3Vaults];
	}, [balances, getBalance, getPrice, vaults, vaultsMigrations]);

	return (
		<YearnContext.Provider
			value={{
				currentPartner: toAddress(process.env.PARTNER_ID_ADDRESS),
				prices,
				earned,
				zapSlippage: zapSlippage ?? DEFAULT_SLIPPAGE,
				maxLoss: maxLoss ?? DEFAULT_MAX_LOSS,
				zapProvider: zapProvider ?? Solver.enum.Cowswap,
				isAutoStakingEnabled: isAutoStakingEnabled ?? true,
				set_zapSlippage,
				set_maxLoss,
				set_zapProvider,
				set_isAutoStakingEnabled,
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
				onRefresh
			}}>
			{children}
		</YearnContext.Provider>
	);
});

export const useYearn = (): TYearnContext => useContext(YearnContext);
