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

export type	TMigrableContext = {
	migrable: TDict<TYearnVault | undefined>,
	isLoadingMigrableList: boolean,
}
const	defaultProps: TMigrableContext = {
	migrable: {[ethers.constants.AddressZero]: undefined},
	isLoadingMigrableList: false
};

const	MigrableContext = createContext<TMigrableContext>(defaultProps);
export const MigrableContextApp = memo(function MigrableContextApp({children}: {children: ReactElement}): ReactElement {
	const {safeChainID} = useChainID();
	const {settings: baseAPISettings} = useSettings();

	/* 🔵 - Yearn Finance ******************************************************
	**	We will play with the some Yearn vaults. To correctly play with them,
	**	we need to fetch the data from the API, especially to get the
	**	apy.net_apy
	***************************************************************************/
	const	{data: migrableVaults, isLoading: isLoadingMigrableList} = useSWR(
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
	const	contextValue = useMemo((): TMigrableContext => ({
		migrable: {...migrableVaultsObject},
		isLoadingMigrableList
	}), [migrableVaultsObject, isLoadingMigrableList]);

	return (
		<MigrableContext.Provider value={contextValue}>
			{children}
		</MigrableContext.Provider>
	);
});

export const useMigrable = (): TMigrableContext => useContext(MigrableContext);
export default useMigrable;