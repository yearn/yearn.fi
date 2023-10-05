import {createContext, memo, useContext, useEffect, useMemo} from 'react';
import {STACKING_TO_VAULT} from '@vaults/constants/optRewards';
import {toast} from '@yearn-finance/web-lib/components/yToast';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {useLocalStorage} from '@yearn-finance/web-lib/hooks/useLocalStorage';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {useFetch} from '@common/hooks/useFetch';
import {useYDaemonStatus} from '@common/hooks/useYDaemonStatus';
import {yDaemonEarnedSchema} from '@common/schemas/yDaemonEarnedSchema';
import {yDaemonPricesChainSchema} from '@common/schemas/yDaemonPricesSchema';
import {Solver} from '@common/schemas/yDaemonTokenListBalances';
import {yDaemonTokensChainSchema} from '@common/schemas/yDaemonTokensSchema';
import {yDaemonVaultsSchema} from '@common/schemas/yDaemonVaultsSchemas';
import {DEFAULT_SLIPPAGE} from '@common/utils/constants';
import {useYDaemonBaseURI} from '@common/utils/getYDaemonBaseURI';

import type {ReactElement} from 'react';
import type {KeyedMutator} from 'swr';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';
import type {TYDaemonEarned} from '@common/schemas/yDaemonEarnedSchema';
import type {TYDaemonPrices, TYDaemonPricesChain} from '@common/schemas/yDaemonPricesSchema';
import type {TSolver} from '@common/schemas/yDaemonTokenListBalances';
import type {TYDaemonTokens, TYDaemonTokensChain} from '@common/schemas/yDaemonTokensSchema';
import type {TYDaemonVault, TYDaemonVaults} from '@common/schemas/yDaemonVaultsSchemas';

export type TYearnContext = {
	currentPartner: TAddress;
	earned?: TYDaemonEarned;
	prices?: TYDaemonPrices;
	tokens?: TYDaemonTokens;
	vaults: TDict<TYDaemonVault>;
	vaultsMigrations: TDict<TYDaemonVault>;
	vaultsRetired: TDict<TYDaemonVault>;
	isLoadingVaultList: boolean;
	zapSlippage: number;
	zapProvider: TSolver;
	isStakingOpBoostedVaults: boolean;
	mutateVaultList: KeyedMutator<TYDaemonVaults>;
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
	zapSlippage: 0.1,
	zapProvider: Solver.enum.Cowswap,
	isStakingOpBoostedVaults: true,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	mutateVaultList: (): any => undefined,
	set_zapSlippage: (): void => undefined,
	set_zapProvider: (): void => undefined,
	set_isStakingOpBoostedVaults: (): void => undefined
});

export const YearnContextApp = memo(function YearnContextApp({children}: {children: ReactElement}): ReactElement {
	const {safeChainID} = useChainID();
	const {yDaemonBaseUri} = useYDaemonBaseURI({chainID: safeChainID});
	const {yDaemonBaseUri: yDaemonBaseUriWithoutChain} = useYDaemonBaseURI();
	const result = useYDaemonStatus({chainID: safeChainID});
	const {address, currentPartner} = useWeb3();
	const [zapSlippage, set_zapSlippage] = useLocalStorage<number>('yearn.fi/zap-slippage', DEFAULT_SLIPPAGE);
	const [zapProvider, set_zapProvider] = useLocalStorage<TSolver>('yearn.fi/zap-provider', Solver.enum.Cowswap);
	const [isStakingOpBoostedVaults, set_isStakingOpBoostedVaults] = useLocalStorage<boolean>('yearn.fi/staking-op-boosted-vaults', true);

	useEffect((): void => {
		if (result?.error?.code === 'ERR_NETWORK') {
			toast({type: 'error', content: 'AxiosError: Network Error'});
		}
	}, [result?.error?.code]);

	const {data: prices} = useFetch<TYDaemonPricesChain>({
		endpoint: `${yDaemonBaseUriWithoutChain}/prices/all`,
		schema: yDaemonPricesChainSchema
	});

	const {data: tokens} = useFetch<TYDaemonTokensChain>({
		endpoint: `${yDaemonBaseUriWithoutChain}/tokens/all`,
		schema: yDaemonTokensChainSchema
	});

	const {
		data: vaults,
		isLoading: isLoadingVaultList,
		mutate: mutateVaultList
	} = useFetch<TYDaemonVaults>({
		endpoint: `${yDaemonBaseUriWithoutChain}/vaults/all?${new URLSearchParams({
			hideAlways: 'true',
			orderBy: 'apy.net_apy',
			orderDirection: 'desc',
			strategiesDetails: 'withDetails',
			strategiesRisk: 'withRisk',
			strategiesCondition: 'inQueue'
		})}&chainIDs=${[1, 10].join(',')}&limit=2500`,
		schema: yDaemonVaultsSchema
	});

	const {data: vaultsMigrations} = useFetch<TYDaemonVaults>({
		endpoint: `${yDaemonBaseUriWithoutChain}/vaults/all?${new URLSearchParams({
			migratable: 'nodust'
		})}`,
		schema: yDaemonVaultsSchema
	});

	const {data: vaultsRetired} = useFetch<TYDaemonVaults>({
		endpoint: `${yDaemonBaseUriWithoutChain}/vaults/retired`,
		schema: yDaemonVaultsSchema
	});

	const {data: earned} = useFetch<TYDaemonEarned>({
		endpoint: address ? `${yDaemonBaseUri}/earned/${address}` : null,
		schema: yDaemonEarnedSchema
	});

	const vaultsObject = useMemo((): TDict<TYDaemonVault> => {
		const _vaultsObject = (vaults ?? []).reduce((acc: TDict<TYDaemonVault>, vault): TDict<TYDaemonVault> => {
			if (!vault.migration.available) {
				acc[toAddress(vault.address)] = vault;
			}
			return acc;
		}, {});
		return _vaultsObject;
	}, [vaults]);

	const vaultsMigrationsObject = useMemo((): TDict<TYDaemonVault> => {
		const _migratableVaultsObject = (vaultsMigrations ?? []).reduce((acc: TDict<TYDaemonVault>, vault): TDict<TYDaemonVault> => {
			if (toAddress(vault.address) !== toAddress(vault.migration.address)) {
				acc[toAddress(vault.address)] = vault;
			}
			return acc;
		}, {});
		return _migratableVaultsObject;
	}, [vaultsMigrations]);

	const vaultsRetiredObject = useMemo((): TDict<TYDaemonVault> => {
		const _retiredVaultsObject = (vaultsRetired ?? []).reduce((acc: TDict<TYDaemonVault>, vault): TDict<TYDaemonVault> => {
			acc[toAddress(vault.address)] = vault;
			return acc;
		}, {});
		return _retiredVaultsObject;
	}, [vaultsRetired]);

	const pricesUpdated = useMemo((): TYDaemonPrices => {
		if (!prices) {
			return {};
		}
		const allPrices: TYDaemonPrices = {};
		const allNetworksPrices = Object.values(prices).flat();
		for (const priceForChain of allNetworksPrices) {
			if (priceForChain) {
				for (const [tokenAddress, price] of Object.entries(priceForChain)) {
					if (price) {
						allPrices[toAddress(tokenAddress)] = price;
					}
				}
			}
		}
		Object.entries(STACKING_TO_VAULT).forEach(([vaultAddress, stackingAddress]): void => {
			allPrices[toAddress(stackingAddress)] = allPrices[toAddress(vaultAddress)];
		});
		return allPrices;
	}, [prices]);

	const toTokens = (obj: TYDaemonTokensChain | undefined): TYDaemonTokens => {
		if (!obj) {
			return {};
		}
		const _tokens: TYDaemonTokens = {};
		for (const [, tokens] of Object.entries(obj)) {
			for (const [tokenAddress, token] of Object.entries(tokens)) {
				if (token) {
					_tokens[toAddress(tokenAddress)] = token;
				}
			}
		}
		return _tokens;
	};

	/* 🔵 - Yearn Finance ******************************************************
	 **	Setup and render the Context provider to use in the app.
	 ***************************************************************************/
	const contextValue = useMemo(
		(): TYearnContext => ({
			currentPartner: currentPartner?.id ? toAddress(currentPartner.id) : toAddress(process.env.PARTNER_ID_ADDRESS),
			prices: pricesUpdated,
			tokens: toTokens(tokens),
			earned,
			zapSlippage,
			set_zapSlippage,
			zapProvider,
			set_zapProvider,
			isStakingOpBoostedVaults,
			set_isStakingOpBoostedVaults,
			vaults: vaultsObject,
			vaultsMigrations: vaultsMigrationsObject,
			vaultsRetired: vaultsRetiredObject,
			isLoadingVaultList,
			mutateVaultList
		}),
		[
			currentPartner?.id,
			pricesUpdated,
			tokens,
			earned,
			zapSlippage,
			set_zapSlippage,
			zapProvider,
			set_zapProvider,
			isStakingOpBoostedVaults,
			set_isStakingOpBoostedVaults,
			vaultsObject,
			vaultsMigrationsObject,
			isLoadingVaultList,
			mutateVaultList,
			vaultsRetiredObject
		]
	);

	return <YearnContext.Provider value={contextValue}>{children}</YearnContext.Provider>;
});

export const useYearn = (): TYearnContext => useContext(YearnContext);
