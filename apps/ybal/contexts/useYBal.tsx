import {createContext, useContext, useMemo, useState} from 'react';
import {LPYBAL_TOKEN_ADDRESS, STYBAL_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {useFetch} from '@common/hooks/useFetch';
import {yDaemonVaultHarvestsSchema, yDaemonVaultSchema} from '@common/schemas/yDaemonVaultsSchemas';
import {useYDaemonBaseURI} from '@common/utils/getYDaemonBaseURI';
import {useAllowances} from '@yBal/contexts/useAllowanceHook';
import {defaultBalHoldings, useHoldings} from '@yBal/contexts/useHoldingsHook';

import type {ReactElement} from 'react';
import type {TBalHoldings} from '@yBal/contexts/useHoldingsHook';
import type {TDict} from '@yearn-finance/web-lib/types';
import type {TYDaemonVault, TYDaemonVaultHarvests} from '@common/schemas/yDaemonVaultsSchemas';

type TYBalContext = {
	styBalAPY: number,
	slippage: number,
	allowances: TDict<bigint>,
	holdings: TBalHoldings,
	harvests: TYDaemonVaultHarvests,
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
	const {yDaemonBaseUri} = useYDaemonBaseURI({chainID: 1});
	const [slippage, set_slippage] = useState(0.6);
	const holdings = useHoldings();
	const allowances = useAllowances();

	const {data: styBalVault} = useFetch<TYDaemonVault>({
		endpoint: `${yDaemonBaseUri}/vaults/${STYBAL_TOKEN_ADDRESS}`,
		schema: yDaemonVaultSchema
	});

	const {data: yBalHarvests} = useFetch<TYDaemonVaultHarvests>({
		endpoint: `${yDaemonBaseUri}/vaults/harvests/${STYBAL_TOKEN_ADDRESS},${LPYBAL_TOKEN_ADDRESS}`,
		schema: yDaemonVaultHarvestsSchema
	});

	/* 🔵 - Yearn Finance ******************************************************
	** Compute the styBal APY based on the experimental APY and the mega boost.
	**************************************************************************/
	const styBalAPY = useMemo((): number => (styBalVault?.apy?.net_apy || 0) * 100, [styBalVault]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const contextValue = useMemo((): TYBalContext => ({
		harvests: yBalHarvests ?? [],
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
