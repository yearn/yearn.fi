import {createContext, memo, useContext} from 'react';
import {deserialize, serialize} from 'wagmi';
import {useDeepCompareMemo, useLocalStorageValue} from '@react-hookz/web';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {useFetch} from '@common/hooks/useFetch';
import {yDaemonEarnedSchema} from '@common/schemas/yDaemonEarnedSchema';
import {yDaemonPricesChainSchema} from '@common/schemas/yDaemonPricesSchema';
import {Solver} from '@common/schemas/yDaemonTokenListBalances';
import {yDaemonTokensChainSchema} from '@common/schemas/yDaemonTokensSchema';
import {yDaemonVaultsSchema} from '@common/schemas/yDaemonVaultsSchemas';
import {DEFAULT_MAX_LOSS, DEFAULT_SLIPPAGE} from '@common/utils/constants';
import {useYDaemonBaseURI} from '@common/utils/getYDaemonBaseURI';

import type {ReactElement} from 'react';
import type {KeyedMutator} from 'swr';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';
import type {TYDaemonEarned} from '@common/schemas/yDaemonEarnedSchema';
import type {TYDaemonPricesChain} from '@common/schemas/yDaemonPricesSchema';
import type {TSolver} from '@common/schemas/yDaemonTokenListBalances';
import type {TYDaemonTokens, TYDaemonTokensChain} from '@common/schemas/yDaemonTokensSchema';
import type {TYDaemonVault, TYDaemonVaults} from '@common/schemas/yDaemonVaultsSchemas';

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
	set_isStakingOpBoostedVaults: (): void => undefined
});

function useYearnPrices(): TYDaemonPricesChain {
	const {yDaemonBaseUri: yDaemonBaseUriWithoutChain} = useYDaemonBaseURI();
	const {data: prices} = useFetch<TYDaemonPricesChain>({
		endpoint: `${yDaemonBaseUriWithoutChain}/prices/all`,
		schema: yDaemonPricesChainSchema
	});

	const pricesUpdated = useDeepCompareMemo((): TYDaemonPricesChain => {
		if (!prices) {
			return {};
		}
		return prices;
	}, [prices]);

	return pricesUpdated;
}

function useYearnTokens(): TYDaemonTokens {
	const {yDaemonBaseUri: yDaemonBaseUriWithoutChain} = useYDaemonBaseURI();
	const {data: tokens} = useFetch<TYDaemonTokensChain>({
		endpoint: `${yDaemonBaseUriWithoutChain}/tokens/all`,
		schema: yDaemonTokensChainSchema
	});

	const tokensUpdated = useDeepCompareMemo((): TYDaemonTokens => {
		if (!tokens) {
			return {};
		}
		const _tokens: TYDaemonTokens = {};
		for (const [, tokensData] of Object.entries(tokens)) {
			for (const [tokenAddress, token] of Object.entries(tokensData)) {
				if (token) {
					_tokens[toAddress(tokenAddress)] = token;
				}
			}
		}
		return _tokens;
	}, [tokens]);

	return tokensUpdated;
}

function useYearnEarned(): TYDaemonEarned {
	const {address} = useWeb3();
	const {yDaemonBaseUri: yDaemonBaseUriWithoutChain} = useYDaemonBaseURI();

	const {data: earned} = useFetch<TYDaemonEarned>({
		endpoint: address
			? `${yDaemonBaseUriWithoutChain}/earned/${address}?${new URLSearchParams({
					chainIDs: [1, 10].join(',')
				})}`
			: null,
		schema: yDaemonEarnedSchema
	});

	const memorizedEarned = useDeepCompareMemo((): TYDaemonEarned => {
		if (!earned) {
			return {
				earned: {},
				totalRealizedGainsUSD: 0,
				totalUnrealizedGainsUSD: 0
			};
		}
		return earned;
	}, [earned]);

	return memorizedEarned;
}

export const YearnContextApp = memo(function YearnContextApp({children}: {children: ReactElement}): ReactElement {
	const {yDaemonBaseUri: yDaemonBaseUriWithoutChain} = useYDaemonBaseURI();
	const {currentPartner} = useWeb3();
	const {value: maxLoss, set: set_maxLoss} = useLocalStorageValue<bigint>('yearn.fi/max-loss', {
		defaultValue: DEFAULT_MAX_LOSS,
		parse: (str, fallback): bigint => (str ? deserialize(str) : fallback),
		stringify: (data): string => serialize(data)
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

	const prices = useYearnPrices();
	const tokens = useYearnTokens();
	const earned = useYearnEarned();

	const {
		data: vaults,
		isLoading: isLoadingVaultList,
		mutate: mutateVaultList
	} = useFetch<TYDaemonVaults>({
		endpoint: `${yDaemonBaseUriWithoutChain}/vaults?${new URLSearchParams({
			hideAlways: 'true',
			orderBy: 'featuringScore',
			orderDirection: 'desc',
			strategiesDetails: 'withDetails',
			strategiesRisk: 'withRisk',
			strategiesCondition: 'inQueue',
			chainIDs: [1, 10, 137, 250, 8453, 42161].join(','),
			limit: `2500`
		})}`,
		schema: yDaemonVaultsSchema
	});

	const {data: vaultsMigrations} = useFetch<TYDaemonVaults>({
		endpoint: `${yDaemonBaseUriWithoutChain}/vaults?${new URLSearchParams({
			migratable: 'nodust'
		})}`,
		schema: yDaemonVaultsSchema
	});

	const {data: vaultsRetired} = useFetch<TYDaemonVaults>({
		endpoint: `${yDaemonBaseUriWithoutChain}/vaults/retired`,
		schema: yDaemonVaultsSchema
	});

	const vaultsObject = useDeepCompareMemo((): TDict<TYDaemonVault> => {
		const _vaultsObject = (vaults ?? []).reduce((acc: TDict<TYDaemonVault>, vault): TDict<TYDaemonVault> => {
			if (!vault.migration.available) {
				acc[toAddress(vault.address)] = vault;
			}
			return acc;
		}, {});
		return _vaultsObject;
	}, [vaults]);

	const vaultsMigrationsObject = useDeepCompareMemo((): TDict<TYDaemonVault> => {
		const _migratableVaultsObject = (vaultsMigrations ?? []).reduce(
			(acc: TDict<TYDaemonVault>, vault): TDict<TYDaemonVault> => {
				if (toAddress(vault.address) !== toAddress(vault.migration.address)) {
					acc[toAddress(vault.address)] = vault;
				}
				return acc;
			},
			{}
		);
		return _migratableVaultsObject;
	}, [vaultsMigrations]);

	const vaultsRetiredObject = useDeepCompareMemo((): TDict<TYDaemonVault> => {
		const _retiredVaultsObject = (vaultsRetired ?? []).reduce(
			(acc: TDict<TYDaemonVault>, vault): TDict<TYDaemonVault> => {
				acc[toAddress(vault.address)] = vault;
				return acc;
			},
			{}
		);
		return _retiredVaultsObject;
	}, [vaultsRetired]);

	/* 🔵 - Yearn Finance ******************************************************
	 **	Setup and render the Context provider to use in the app.
	 ***************************************************************************/
	const contextValue = useDeepCompareMemo(
		(): TYearnContext => ({
			currentPartner: currentPartner?.id
				? toAddress(currentPartner.id)
				: toAddress(process.env.PARTNER_ID_ADDRESS),
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
			vaults: vaultsObject,
			vaultsMigrations: vaultsMigrationsObject,
			vaultsRetired: vaultsRetiredObject,
			isLoadingVaultList,
			mutateVaultList
		}),
		[
			currentPartner,
			prices,
			tokens,
			earned,
			zapSlippage,
			maxLoss,
			zapProvider,
			isStakingOpBoostedVaults,
			set_zapSlippage,
			set_maxLoss,
			set_zapProvider,
			set_isStakingOpBoostedVaults,
			vaultsObject,
			vaultsMigrationsObject,
			vaultsRetiredObject,
			isLoadingVaultList,
			mutateVaultList
		]
	);

	return <YearnContext.Provider value={contextValue}>{children}</YearnContext.Provider>;
});

export const useYearn = (): TYearnContext => useContext(YearnContext);
