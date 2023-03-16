import React, {createContext, useContext, useMemo} from 'react';
import useSWR from 'swr';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {baseFetcher, curveFetcher} from '@yearn-finance/web-lib/utils/fetchers';

import type {SWRResponse} from 'swr';
import type {TDict} from '@yearn-finance/web-lib/types';
import type {TCurveGauges, TCurveGaugesFromYearn} from '@common/types/curves';

type TCurveWeeklyFees = {
	weeklyFeesTable: {
		date: string;
		ts: number;
		rawFees: number;
	}[];
	totalFees: {
		fees: number
	}
}
type TCoinGeckoPrices = {
	usd: number
}
export type TCurveContext = {
	curveWeeklyFees: TCurveWeeklyFees;
	cgPrices: TDict<TCoinGeckoPrices>;
	gauges: TCurveGauges[];
	isLoadingGauges: boolean;
	gaugesFromYearn: TCurveGaugesFromYearn[];
}
const	defaultProps: TCurveContext = {
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
export const CurveContextApp = ({children}: {children: React.ReactElement}): React.ReactElement => {
	/* 🔵 - Yearn Finance ******************************************************
	**	Fetch all the CurveGauges to be able to create some new if required
	***************************************************************************/
	const	{data: curveWeeklyFees} = useSWR(
		'https://api.curve.fi/api/getWeeklyFees',
		curveFetcher,
		{revalidateOnFocus: false}
	) as SWRResponse<TCurveWeeklyFees>;

	const	{data: cgPrices} = useSWR(
		'https://api.coingecko.com/api/v3/simple/price?ids=curve-dao-token&vs_currencies=usd',
		baseFetcher,
		{revalidateOnFocus: false}
	) as SWRResponse<TDict<TCoinGeckoPrices>>;

	const	{data: gaugesWrapper, isLoading: isLoadingGauges} = useSWR(
		'https://api.curve.fi/api/getAllGauges?blockchainId=ethereum',
		curveFetcher,
		{revalidateOnFocus: false}
	);

	const	{data: gaugesFromYearn} = useSWR(
		'https://api.yearn.finance/v1/chains/1/apy-previews/curve-factory',
		baseFetcher,
		{revalidateOnFocus: false}
	) as SWRResponse<TCurveGaugesFromYearn[]>;

	const	gauges = useMemo((): TCurveGauges[] => {
		const	_gaugesForMainnet: TCurveGauges[] = [];
		for (const gauge of Object.values(gaugesWrapper || {})) {
			if (gauge.is_killed) {
				continue;
			}
			if (gauge.side_chain) {
				continue;
			}

			const addressPart = /\([^()]*\)/;
			gauge.name = gauge.name.replace(addressPart, '');
			gauge.swap_token = toAddress(gauge.swap_token);
			gauge.gauge = toAddress(gauge.gauge);
			gauge.swap = toAddress(gauge.swap);
			_gaugesForMainnet.push(gauge);
		}
		return _gaugesForMainnet;
	}, [gaugesWrapper]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const	contextValue = useMemo((): TCurveContext => ({
		curveWeeklyFees: curveWeeklyFees || defaultProps.curveWeeklyFees,
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
