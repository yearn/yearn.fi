import React, {createContext, memo, useContext, useMemo} from 'react';
import useSWR from 'swr';
import {Solver} from '@vaults/contexts/useSolver';
import {useSettings} from '@yearn-finance/web-lib/contexts/useSettings';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useLocalStorage} from '@yearn-finance/web-lib/hooks';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {addressZero, toAddress} from '@yearn-finance/web-lib/utils/address';
import {baseFetcher} from '@yearn-finance/web-lib/utils/fetchers';

import type {ReactElement} from 'react';
import type {SWRResponse} from 'swr';
import type {TAddress} from '@yearn-finance/web-lib/utils/address';
import type {TDict, VoidPromiseFunction} from '@yearn-finance/web-lib/utils/types';
import type {TYdaemonEarned, TYDaemonToken, TYearnVault} from '@common/types/yearn';

export type	TYearnContext = {
	currentPartner: TAddress,
	earned: TYdaemonEarned,
	prices: TDict<string>,
	tokens: TDict<TYDaemonToken>,
	vaults: TDict<TYearnVault | undefined>,
	isLoadingVaultList: boolean,
	mutateVaultList: VoidPromiseFunction
	zapSlippage: number,
	set_zapSlippage: (value: number) => void
	zapProvider: Solver,
	set_zapProvider: (value: Solver) => void
}
const	defaultProps: TYearnContext = {
	currentPartner: toAddress(process.env.PARTNER_ID_ADDRESS as string),
	earned: {
		earned: {},
		totalRealizedGainsUSD: 0,
		totalUnrealizedGainsUSD: 0
	},
	prices: {},
	tokens: {},
	vaults: {[addressZero]: undefined},
	isLoadingVaultList: false,
	mutateVaultList: async (): Promise<void> => Promise.resolve(),
	zapSlippage: 0.1,
	set_zapSlippage: (): void => undefined,
	zapProvider: Solver.COWSWAP,
	set_zapProvider: (): void => undefined
};

type TYearnVaultsMap = {
	[address: string]: TYearnVault
}

const	YearnContext = createContext<TYearnContext>(defaultProps);
export const YearnContextApp = memo(function YearnContextApp({children}: {children: ReactElement}): ReactElement {
	const {safeChainID} = useChainID();
	const {settings: baseAPISettings} = useSettings();
	const {address, currentPartner} = useWeb3();
	const [zapSlippage, set_zapSlippage] = useLocalStorage<number>('yearn.finance/zap-slippage', 0.5);
	const [zapProvider, set_zapProvider] = useLocalStorage<Solver>('yearn.finance/zap-provider', Solver.COWSWAP);

	/* 🔵 - Yearn Finance ******************************************************
	**	We will play with the some Yearn vaults. To correctly play with them,
	**	we need to fetch the data from the API, especially to get the
	**	apy.net_apy
	***************************************************************************/
	const	{data: prices} = useSWR(
		`${baseAPISettings.yDaemonBaseURI}/${safeChainID}/prices/all`,
		baseFetcher,
		{revalidateOnFocus: false}
	) as SWRResponse;

	const	{data: tokens} = useSWR(
		`${baseAPISettings.yDaemonBaseURI}/${safeChainID}/tokens/all`,
		baseFetcher,
		{revalidateOnFocus: false}
	) as SWRResponse;

	const	{data: vaults, isLoading: isLoadingVaultList, mutate: mutateVaultList} = useSWR(
		`${baseAPISettings.yDaemonBaseURI}/${safeChainID}/vaults/all?hideAlways=true&orderBy=apy.net_apy&orderDirection=desc&strategiesDetails=withDetails&strategiesRisk=withRisk&strategiesCondition=inQueue`,
		baseFetcher,
		{revalidateOnFocus: false}
	) as SWRResponse;

	const	{data: earned} = useSWR(
		address ? `${baseAPISettings.yDaemonBaseURI}/${safeChainID}/earned/${address}` : null,
		baseFetcher,
		{revalidateOnFocus: false}
	) as SWRResponse;

	const	vaultsObject = useMemo((): TYearnVaultsMap => {
		const	_vaultsObject = (vaults || []).reduce((acc: TYearnVaultsMap, vault: TYearnVault): TYearnVaultsMap => {
			//Hide vaults with a migration available
			if (vault.migration.available) {
				return acc;
			}

			//Hide vaults with APY 0
			// if (vault.apy.net_apy === 0) {
			// 	return acc;
			// }

			acc[toAddress(vault.address)] = vault;
			return acc;
		}, {});
		return _vaultsObject;
	}, [vaults]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const	contextValue = useMemo((): TYearnContext => ({
		currentPartner: currentPartner?.id ? toAddress(currentPartner.id) : toAddress(process.env.PARTNER_ID_ADDRESS as string),
		prices,
		tokens,
		earned,
		zapSlippage,
		set_zapSlippage,
		zapProvider,
		set_zapProvider,
		vaults: {...vaultsObject},
		isLoadingVaultList,
		mutateVaultList
	}), [currentPartner?.id, prices, tokens, earned, vaultsObject, isLoadingVaultList, mutateVaultList, zapSlippage, set_zapSlippage, zapProvider, set_zapProvider]);

	return (
		<YearnContext.Provider value={contextValue}>
			{children}
		</YearnContext.Provider>
	);
});

export const useYearn = (): TYearnContext => useContext(YearnContext);
export default useYearn;
