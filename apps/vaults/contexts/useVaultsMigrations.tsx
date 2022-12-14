import React, {createContext, memo, useContext, useMemo} from 'react';
import {ethers} from 'ethers';
import useSWR from 'swr';
import {useSettings} from '@yearn-finance/web-lib/contexts/useSettings';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {baseFetcher} from '@yearn-finance/web-lib/utils/fetchers';

import type {ReactElement} from 'react';
import type {SWRResponse} from 'swr';
import type {TDict} from '@yearn-finance/web-lib/utils/types';
import type {TYearnVault} from '@common/types/yearn';

export type	TVaultsMigrationsContext = {
	possibleVaultsMigrations: TDict<TYearnVault | undefined>,
	isLoading: boolean,
}
const	defaultProps: TVaultsMigrationsContext = {
	possibleVaultsMigrations: {[ethers.constants.AddressZero]: undefined},
	isLoading: false
};

const	VaultMigrationContext = createContext<TVaultsMigrationsContext>(defaultProps);
export const VaultMigrationContextApp = memo(function VaultMigrationContextApp({children}: {children: ReactElement}): ReactElement {
	const {safeChainID} = useChainID();
	const {settings: baseAPISettings} = useSettings();

	/* 🔵 - Yearn Finance ******************************************************
	**	We will play with the some Yearn vaults. To correctly play with them,
	**	we need to fetch the data from the API, especially to get the
	**	apy.net_apy
	***************************************************************************/
	const	{data: migrableVaults, isLoading} = useSWR(
		`${baseAPISettings.yDaemonBaseURI}/${safeChainID}/vaults/all?migrable=nodust`,
		baseFetcher,
		{revalidateOnFocus: false}
	) as SWRResponse;

	const	migrableVaultsObject = useMemo((): TDict<TYearnVault> => {
		const	_migrableVaultsObject = (migrableVaults || []).reduce((acc: TDict<TYearnVault>, vault: TYearnVault): TDict<TYearnVault> => {
			acc[toAddress(vault.address)] = vault;
			return acc;
		}, {});
		return _migrableVaultsObject;
	}, [migrableVaults]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const	contextValue = useMemo((): TVaultsMigrationsContext => ({
		possibleVaultsMigrations: {...migrableVaultsObject},
		isLoading
	}), [migrableVaultsObject, isLoading]);

	return (
		<VaultMigrationContext.Provider value={contextValue}>
			{children}
		</VaultMigrationContext.Provider>
	);
});

export const useVaultsMigrations = (): TVaultsMigrationsContext => useContext(VaultMigrationContext);
export default useVaultsMigrations;