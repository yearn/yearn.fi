import React, {createContext, memo, useContext, useMemo} from 'react';
import {ethers} from 'ethers';
import useSWR from 'swr';
import {useWeb3} from '@yearn-finance/web-lib/contexts';
import {toAddress} from '@yearn-finance/web-lib/utils';
import {baseFetcher} from '@common/utils';

import type {ReactElement} from 'react';
import type {TAddress, TDict} from '@yearn-finance/web-lib/utils';
import type {TYdaemonEarned, TYDaemonToken, TYearnVault} from '@common/types/yearn';


export type	TYearnContext = {
	currentPartner: TAddress,
	earned: TYdaemonEarned,
	prices: TDict<string>,
	tokens: TDict<TYDaemonToken>,
	vaults: TDict<TYearnVault | undefined>,
	isLoadingVaultList: boolean,
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
	vaults: {[ethers.constants.AddressZero]: undefined},
	isLoadingVaultList: false
};

type TYearnVaultsMap = {
	[address: string]: TYearnVault
}

const	YearnContext = createContext<TYearnContext>(defaultProps);
export const YearnContextApp = memo(function YearnContextApp({children}: {children: ReactElement}): ReactElement {
	const	{address, currentPartner, safeChainID} = useWeb3();

	/* 🔵 - Yearn Finance ******************************************************
	**	We will play with the some Yearn vaults. To correctly play with them,
	**	we need to fetch the data from the API, especially to get the
	**	apy.net_apy
	***************************************************************************/
	const	{data: prices} = useSWR(
		`${process.env.YDAEMON_BASE_URI}/${safeChainID}/prices/all`,
		baseFetcher,
		{revalidateOnFocus: false}
	);

	const	{data: tokens} = useSWR(
		`${process.env.YDAEMON_BASE_URI}/${safeChainID}/tokens/all`,
		baseFetcher,
		{revalidateOnFocus: false}
	);

	const	{data: vaults, isValidating: isLoadingVaultList} = useSWR(
		`${process.env.YDAEMON_BASE_URI}/${safeChainID}/vaults/all?hideAlways=true&orderBy=apy.net_apy&orderDirection=desc&strategiesDetails=withDetails&strategiesRisk=withRisk&strategiesCondition=inQueue`,
		baseFetcher,
		{revalidateOnFocus: false}
	);

	const	{data: earned} = useSWR(
		address ? `${process.env.YDAEMON_BASE_URI}/${safeChainID}/earned/${address}` : null,
		baseFetcher,
		{revalidateOnFocus: false}
	);

	const	vaultsObject = useMemo((): TYearnVaultsMap => {
		const	_vaultsObject = (vaults || []).reduce((acc: TYearnVaultsMap, vault: TYearnVault): TYearnVaultsMap => {
			//Hide vaults with a migration available
			if (vault.migration.available) {
				return acc;
			}

			//Hide vaults with APY 0
			if (vault.apy.net_apy === 0) {
				return acc;
			}

			acc[toAddress(vault.address)] = vault;
			return acc;
		}, {});
		return _vaultsObject;
	}, [vaults]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	return (
		<YearnContext.Provider
			value={{
				currentPartner: currentPartner?.id ? toAddress(currentPartner.id) : toAddress(process.env.PARTNER_ID_ADDRESS as string),
				prices,
				tokens,
				earned,
				vaults: {...vaultsObject},
				isLoadingVaultList
			}}>
			{children}
		</YearnContext.Provider>
	);
});

export const useYearn = (): TYearnContext => useContext(YearnContext);
export default useYearn;