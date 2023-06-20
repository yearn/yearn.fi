import {createContext, useContext, useMemo, useState} from 'react';
import {formatUnits} from 'viem';
import {LPYCRV_TOKEN_ADDRESS, STYCRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {useFetch} from '@common/hooks/useFetch';
import {yDaemonVaultHarvestsSchema, yDaemonVaultSchema} from '@common/schemas/yDaemonVaultsSchemas';
import {useYDaemonBaseURI} from '@common/utils/getYDaemonBaseURI';
import {useAllowances} from '@yCRV/contexts/useAllowanceHook';
import {defaultHoldings, useHoldings} from '@yCRV/contexts/useHoldingsHook';

import type {ReactElement} from 'react';
import type {TCRVHoldings} from '@yCRV/contexts/useHoldingsHook';
import type {TDict} from '@yearn-finance/web-lib/types';
import type {TYDaemonVault, TYDaemonVaultHarvests} from '@common/schemas/yDaemonVaultsSchemas';

type TYCRVContext = {
	styCRVMegaBoost: number,
	styCRVAPY: number,
	slippage: number,
	allowances: TDict<bigint>,
	holdings: TCRVHoldings,
	harvests: TYDaemonVaultHarvests,
	set_slippage: (slippage: number) => void,
	refetchAllowances: () => void
}

const defaultProps = {
	styCRVMegaBoost: 0,
	styCRVAPY: 0,
	harvests: [],
	allowances: {},
	slippage: 0.6,
	holdings: defaultHoldings,
	set_slippage: (): void => undefined,
	refetchAllowances: (): void => undefined
};

/* 🔵 - Yearn Finance **********************************************************
** This context controls the Holdings computation.
******************************************************************************/
const YCRVContext = createContext<TYCRVContext>(defaultProps);
export const YCRVContextApp = ({children}: {children: ReactElement}): ReactElement => {
	const {yDaemonBaseUri} = useYDaemonBaseURI({chainID: 1});
	const [slippage, set_slippage] = useState<number>(0.6);
	const holdings = useHoldings();
	const allowances = useAllowances();

	const {data: styCRVVault} = useFetch<TYDaemonVault>({
		endpoint: `${yDaemonBaseUri}/vaults/${STYCRV_TOKEN_ADDRESS}`,
		schema: yDaemonVaultSchema
	});

	const {data: yCRVHarvests} = useFetch<TYDaemonVaultHarvests>({
		endpoint: `${yDaemonBaseUri}/vaults/harvests/${STYCRV_TOKEN_ADDRESS},${LPYCRV_TOKEN_ADDRESS}`,
		schema: yDaemonVaultHarvestsSchema
	});

	/* 🔵 - Yearn Finance ******************************************************
	** Compute the mega boost for the staked yCRV. This boost come from the
	** donator, with 30_000 per week.
	**************************************************************************/
	const styCRVMegaBoost = useMemo((): number => {
		if (!holdings || isZero(holdings.styCRVSupply)) {
			return 0;
		}
		const fromDonatorPerWeek = 30_000;
		const fromDonatorPerYear = fromDonatorPerWeek * 52;
		const fromDonatorPerYearScaled = fromDonatorPerYear * 0.9;
		const humanizedStyCRVSupply = Number(formatUnits(holdings.styCRVSupply, 18));
		const megaBoostAPR = fromDonatorPerYearScaled / humanizedStyCRVSupply;
		return megaBoostAPR;
	}, [holdings]);

	/* 🔵 - Yearn Finance ******************************************************
	** Compute the styCRV APY based on the experimental APY and the mega boost.
	**************************************************************************/
	const styCRVAPY = useMemo((): number => {
		return ((styCRVVault?.apy?.net_apy || 0) * 100);
	}, [styCRVVault]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const contextValue = useMemo((): TYCRVContext => ({
		harvests: yCRVHarvests ?? [],
		holdings: holdings,
		allowances: allowances[0],
		refetchAllowances: allowances[1],
		styCRVAPY,
		styCRVMegaBoost,
		slippage,
		set_slippage
	}), [yCRVHarvests, holdings, allowances, styCRVAPY, styCRVMegaBoost, slippage, set_slippage]);

	return (
		<YCRVContext.Provider value={contextValue}>
			{children}
		</YCRVContext.Provider>
	);
};


export const useYCRV = (): TYCRVContext => useContext(YCRVContext);
export default useYCRV;
