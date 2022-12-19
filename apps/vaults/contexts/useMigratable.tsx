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

export type	TMigratableContext = {
	migratable: TDict<TYearnVault | undefined>,
	isLoadingMigratableList: boolean,
}
const	defaultProps: TMigratableContext = {
	migratable: {[ethers.constants.AddressZero]: undefined},
	isLoadingMigratableList: false
};

const	MigratableContext = createContext<TMigratableContext>(defaultProps);
export const MigratableContextApp = memo(function MigratableContextApp({children}: {children: ReactElement}): ReactElement {
	const {safeChainID} = useChainID();
	const {settings: baseAPISettings} = useSettings();

	/* 🔵 - Yearn Finance ******************************************************
	**	We will play with the some Yearn vaults. To correctly play with them,
	**	we need to fetch the data from the API, especially to get the
	**	apy.net_apy
	***************************************************************************/
	const	{data: migratableVaults, isLoading: isLoadingMigratableList} = useSWR(
		`${baseAPISettings.yDaemonBaseURI}/${safeChainID}/vaults/all?migratable=nodust`,
		baseFetcher,
		{revalidateOnFocus: false}
	) as SWRResponse;

	const	migratableVaultsObject = useMemo((): TDict<TYearnVault> => {
		const	_migratableVaultsObject = (migratableVaults || []).reduce((acc: TDict<TYearnVault>, vault: TYearnVault): TDict<TYearnVault> => {
			acc[toAddress(vault.address)] = vault;
			return acc;
		}, {});
		return _migratableVaultsObject;
	}, [migratableVaults]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const	contextValue = useMemo((): TMigratableContext => ({
		migratable: {...migratableVaultsObject},
		isLoadingMigratableList
	}), [migratableVaultsObject, isLoadingMigratableList]);

	return (
		<MigratableContext.Provider value={contextValue}>
			{children}
		</MigratableContext.Provider>
	);
});

export const useMigratable = (): TMigratableContext => useContext(MigratableContext);
export default useMigratable;