import React, {createContext, memo, useContext, useMemo} from 'react';
import {Solver} from '@vaults/contexts/useSolver';
import {useSettings} from '@yearn-finance/web-lib/contexts/useSettings';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {useLocalStorage} from '@yearn-finance/web-lib/hooks/useLocalStorage';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {useZod} from '@common/hooks/useZod';
import {yDaemonEarnedSchema, yDaemonPricesSchema, yDaemonTokensSchema, yDaemonVaultsSchema} from '@common/schemas';
import {DEFAULT_SLIPPAGE} from '@common/utils/constants';

import type {ReactElement} from 'react';
import type {KeyedMutator} from 'swr';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';
import type {TYDaemonEarned, TYDaemonPrices, TYDaemonTokens, TYDaemonVault, TYDaemonVaults} from '@common/schemas';

export type TYearnContext = {
	currentPartner: TAddress,
	earned?: TYDaemonEarned,
	prices?: TYDaemonPrices,
	tokens?: TYDaemonTokens,
	vaults: TDict<TYDaemonVault>,
	vaultsMigrations: TDict<TYDaemonVault>,
	vaultsRetired: TDict<TYDaemonVault>,
	isLoadingVaultList: boolean,
	zapSlippage: number,
	zapProvider: Solver,
	mutateVaultList: KeyedMutator<TYDaemonVaults>,
	set_zapSlippage: (value: number) => void
	set_zapProvider: (value: Solver) => void
}

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
	zapProvider: Solver.COWSWAP,
	mutateVaultList: async (): Promise<TYDaemonVaults> => Promise.resolve([]),
	set_zapSlippage: (): void => undefined,
	set_zapProvider: (): void => undefined
});

export const YearnContextApp = memo(function YearnContextApp({children}: { children: ReactElement }): ReactElement {
	const {safeChainID} = useChainID();
	const {settings: baseAPISettings} = useSettings();
	const {address, currentPartner} = useWeb3();
	const [zapSlippage, set_zapSlippage] = useLocalStorage<number>('yearn.finance/zap-slippage', DEFAULT_SLIPPAGE);
	const [zapProvider, set_zapProvider] = useLocalStorage<Solver>('yearn.finance/zap-provider', Solver.COWSWAP);

	const YDAEMON_BASE_URI = `${baseAPISettings.yDaemonBaseURI || process.env.YDAEMON_BASE_URI}/${safeChainID}`;

	const {data: prices} = useZod<TYDaemonPrices>({
		endpoint: `${YDAEMON_BASE_URI}/prices/all`,
		schema: yDaemonPricesSchema
	});

	const {data: tokens} = useZod<TYDaemonTokens>({
		endpoint: `${YDAEMON_BASE_URI}/tokens/all`,
		schema: yDaemonTokensSchema
	});

	const {data: vaults, isLoading: isLoadingVaultList, mutate: mutateVaultList} = useZod<TYDaemonVaults>({
		endpoint: `${YDAEMON_BASE_URI}/vaults/all?${new URLSearchParams({
			hideAlways: 'true',
			orderBy: 'apy.net_apy',
			orderDirection: 'desc',
			strategiesDetails: 'withDetails',
			strategiesRisk: 'withRisk',
			strategiesCondition: 'inQueue'
		})}`,
		schema: yDaemonVaultsSchema
	});

	const {data: vaultsMigrations} = useZod<TYDaemonVaults>({
		endpoint: `${YDAEMON_BASE_URI}/vaults/all?${new URLSearchParams({migratable: 'nodust'})}`,
		schema: yDaemonVaultsSchema
	});

	const {data: vaultsRetired} = useZod<TYDaemonVaults>({
		endpoint: `${YDAEMON_BASE_URI}/vaults/retired`,
		schema: yDaemonVaultsSchema
	});

	const {data: earned} = useZod<TYDaemonEarned>({
		endpoint: `${YDAEMON_BASE_URI}/earned/${address}`,
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

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const contextValue = useMemo((): TYearnContext => ({
		currentPartner: currentPartner?.id ? toAddress(currentPartner.id) : toAddress(process.env.PARTNER_ID_ADDRESS),
		prices,
		tokens,
		earned,
		zapSlippage,
		set_zapSlippage,
		zapProvider,
		set_zapProvider,
		vaults: vaultsObject,
		vaultsMigrations: vaultsMigrationsObject,
		vaultsRetired: vaultsRetiredObject,
		isLoadingVaultList,
		mutateVaultList
	}), [currentPartner?.id, prices, tokens, earned, zapSlippage, set_zapSlippage, zapProvider, set_zapProvider, vaultsObject, vaultsMigrationsObject, isLoadingVaultList, mutateVaultList, vaultsRetiredObject]);

	return (
		<YearnContext.Provider value={contextValue}>
			{children}
		</YearnContext.Provider>
	);
});

export const useYearn = (): TYearnContext => useContext(YearnContext);
export default useYearn;
