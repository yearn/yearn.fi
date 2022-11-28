import React, {createContext, useContext, useMemo} from 'react';
import {ethers} from 'ethers';
import useSWR from 'swr';
import {useWeb3} from '@yearn-finance/web-lib/contexts';
import {TAddress, toAddress} from '@yearn-finance/web-lib/utils';
import {baseFetcher} from 'utils';

import type {TDict} from '@yearn-finance/web-lib/utils';
import type {TYDaemonHarvests, TYearnVault} from 'types/yearn';


export type	TYearnContext = {
	currentPartner: TAddress,
	yCRVHarvests: TYDaemonHarvests[],
	prices: TDict<string>,
	vaults: TDict<TYearnVault | undefined>
}
const	defaultProps: TYearnContext = {
	currentPartner: toAddress(process.env.PARTNER_ID_ADDRESS as string),
	yCRVHarvests: [],
	prices: {},
	vaults: {[ethers.constants.AddressZero]: undefined}
};

type TYearnVaultsMap = {
	[address: string]: TYearnVault
}

const	YearnContext = createContext<TYearnContext>(defaultProps);
export const YearnContextApp = ({children}: {children: React.ReactElement}): React.ReactElement => {
	const	{currentPartner} = useWeb3();

	/* 🔵 - Yearn Finance ******************************************************
	**	We will play with the some Yearn vaults. To correctly play with them,
	**	we need to fetch the data from the API, especially to get the
	**	apy.net_apy
	***************************************************************************/
	const	{data: prices} = useSWR(
		`${process.env.YDAEMON_BASE_URI}/1/prices/all`,
		baseFetcher,
		{revalidateOnFocus: false}
	);

	const	{data: vaults} = useSWR(
		`${process.env.YDAEMON_BASE_URI}/1/vaults/all?hideAlways=true&orderBy=apy.net_apy&orderDirection=desc&strategiesDetails=withDetails&strategiesRisk=withRisk`,
		baseFetcher,
		{revalidateOnFocus: false}
	);

	const	{data: yCRVHarvests} = useSWR(
		`${process.env.YDAEMON_BASE_URI}/1/vaults/harvests/${process.env.STYCRV_TOKEN_ADDRESS},${process.env.LPYCRV_TOKEN_ADDRESS}`,
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
				yCRVHarvests,
				vaults: {...vaultsObject}
			}}>
			{children}
		</YearnContext.Provider>
	);
};


export const useYearn = (): TYearnContext => useContext(YearnContext);
export default useYearn;