import {createContext, useContext, useMemo} from 'react';
import {useFetch} from '@common/hooks/useFetch';
import {coinGeckoPricesSchema} from '@common/schemas/coinGeckoSchemas';
import {curveAllGaugesSchema, curveGaugesFromYearnSchema, curveWeeklyFeesSchema} from '@common/schemas/curveSchemas';

import type {TCoinGeckoPrices} from '@common/schemas/coinGeckoSchemas';
import type {TCurveAllGauges, TCurveGauge, TCurveGaugesFromYearn, TCurveWeeklyFees} from '@common/schemas/curveSchemas';

export type TCurveContext = {
	curveWeeklyFees: TCurveWeeklyFees['data'];
	cgPrices: TCoinGeckoPrices;
	gauges: TCurveGauge[];
	isLoadingGauges: boolean;
	gaugesFromYearn: TCurveGaugesFromYearn;
}

const defaultProps: TCurveContext = {
	curveWeeklyFees: {
		weeklyFeesTable: [],
		totalFees: {
			fees: 0
		}
	},
	cgPrices: {},
	gauges: [],
	isLoadingGauges: false,
	gaugesFromYearn: []
};

const CurveContext = createContext<TCurveContext>(defaultProps);
export const CurveContextApp = ({children}: { children: React.ReactElement }): React.ReactElement => {
	const {data: curveWeeklyFees} = useFetch<TCurveWeeklyFees>({
		endpoint: 'https://api.curve.fi/api/getWeeklyFees',
		schema: curveWeeklyFeesSchema
	});

	const cgPricesQueryParams = new URLSearchParams({
		ids: 'curve-dao-token',
		vs_currencies: 'usd'
	});

	const {data: cgPrices} = useFetch<TCoinGeckoPrices>({
		endpoint: `https://api.coingecko.com/api/v3/simple/price?${cgPricesQueryParams}`,
		schema: coinGeckoPricesSchema
	});

	/* 🔵 - Yearn Finance ******************************************************
	**	Fetch all the CurveGauges to be able to create some new if required
	***************************************************************************/
	const {data: gaugesWrapper, isLoading: isLoadingGauges} = useFetch<TCurveAllGauges>({
		endpoint: 'https://api.curve.fi/api/getAllGauges?blockchainId=ethereum',
		schema: curveAllGaugesSchema
	});

	const {data: gaugesFromYearn} = useFetch<TCurveGaugesFromYearn>({
		endpoint: 'https://api.yearn.finance/v1/chains/1/apy-previews/curve-factory',
		schema: curveGaugesFromYearnSchema
	});

	const gauges = useMemo((): TCurveGauge[] => {
		const _gaugesForMainnet: TCurveGauge[] = [];
		for (const gauge of Object.values(gaugesWrapper?.data || {})) {
			if (gauge.is_killed) {
				continue;
			}
			if (gauge.side_chain) {
				continue;
			}

			const addressPart = /\([^()]*\)/;
			gauge.name = gauge.name.replace(addressPart, '');
			_gaugesForMainnet.push(gauge);
		}
		return _gaugesForMainnet;
	}, [gaugesWrapper]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const contextValue = useMemo((): TCurveContext => ({
		curveWeeklyFees: curveWeeklyFees?.data || defaultProps.curveWeeklyFees,
		cgPrices: cgPrices || defaultProps.cgPrices,
		gauges: gauges || defaultProps.gauges,
		isLoadingGauges: isLoadingGauges || defaultProps.isLoadingGauges,
		gaugesFromYearn: gaugesFromYearn || defaultProps.gaugesFromYearn
	}), [curveWeeklyFees, cgPrices, gauges, isLoadingGauges, gaugesFromYearn]);

	return (
		<CurveContext.Provider value={contextValue}>
			{children}
		</CurveContext.Provider>
	);
};

export const useCurve = (): TCurveContext => useContext(CurveContext);
export default useCurve;
