import React, {createContext, useContext, useMemo, useState} from 'react';
import useSWR from 'swr';
import {useSettings} from '@yearn-finance/web-lib/contexts/useSettings';
import {LPYBAL_TOKEN_ADDRESS, STYBAL_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {baseFetcher} from '@yearn-finance/web-lib/utils/fetchers';
import {useFetch} from '@common/hooks/useFetch';
import {yDaemonVaultSchema} from '@common/schemas/yDaemonVaultsSchemas';
import {useAllowances} from '@yBal/contexts/useAllowanceHook';
import {defaultBalHoldings, useHoldings} from '@yBal/contexts/useHoldingsHook';

import type {ReactElement} from 'react';
import type {SWRResponse} from 'swr';
import type {TBalHoldings} from '@yBal/contexts/useHoldingsHook';
import type {TDict} from '@yearn-finance/web-lib/types';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';
import type {TYDaemonHarvests} from '@common/types/yearn';

type TYBalContext = {
	styBalAPY: number,
	slippage: number,
	allowances: TDict<bigint>,
	holdings: TBalHoldings,
	harvests: TYDaemonHarvests[],
	set_slippage: (slippage: number) => void,
	refetchAllowances: () => void
}

const defaultProps = {
	styBalAPY: 0,
	harvests: [],
	allowances: {},
	slippage: 0.6,
	holdings: defaultBalHoldings,
	set_slippage: (): void => undefined,
	refetchAllowances: (): void => undefined
};

/* 🔵 - Yearn Finance **********************************************************
** This context controls the Holdings computation.
******************************************************************************/
const YBalContext = createContext<TYBalContext>(defaultProps);

export const YBalContextApp = ({children}: {children: ReactElement}): ReactElement => {
	const {settings: baseAPISettings} = useSettings();
	const [slippage, set_slippage] = useState(0.6);
	const holdings = useHoldings();
	const allowances = useAllowances();

	const YDAEMON_BASE_URI = `${baseAPISettings.yDaemonBaseURI || process.env.YDAEMON_BASE_URI}`;

	const {data: styBalVault} = useFetch<TYDaemonVault>({
		endpoint: `${YDAEMON_BASE_URI}/1/vaults/${STYBAL_TOKEN_ADDRESS}`,
		schema: yDaemonVaultSchema
	});

	const {data: yBalHarvests} = useSWR(
		`${YDAEMON_BASE_URI}/1/vaults/harvests/${STYBAL_TOKEN_ADDRESS},${LPYBAL_TOKEN_ADDRESS}`,
		baseFetcher,
		{revalidateOnFocus: false}
	) as SWRResponse;

	/* 🔵 - Yearn Finance ******************************************************
	** Compute the styBal APY based on the experimental APY and the mega boost.
	**************************************************************************/
	const styBalAPY = useMemo((): number => (styBalVault?.apy?.net_apy || 0) * 100, [styBalVault]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const contextValue = useMemo((): TYBalContext => ({
		harvests: yBalHarvests,
		holdings: holdings,
		allowances: allowances[0],
		refetchAllowances: allowances[1],
		styBalAPY,
		slippage,
		set_slippage
	}), [yBalHarvests, holdings, allowances, styBalAPY, slippage, set_slippage]);

	return (
		<YBalContext.Provider value={contextValue}>
			{children}
		</YBalContext.Provider>
	);
};

export const useYBal = (): TYBalContext => useContext(YBalContext);
export default useYBal;
