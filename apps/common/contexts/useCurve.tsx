import React, {createContext, useContext, useMemo} from 'react';
import useSWR from 'swr';
import {baseFetcher, curveFetcher} from '@yearn-finance/web-lib/utils/fetchers';

import type {SWRResponse} from 'swr';
import type {TDict} from '@yearn-finance/web-lib/utils/types';
import type {TCurveGauges} from '@common/types/curves';

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
	curveWeeklyFees: TCurveWeeklyFees,
	gauges: TCurveGauges[],
	cgPrices: TDict<TCoinGeckoPrices>
}
const	defaultProps: TCurveContext = {
	curveWeeklyFees: {
		weeklyFeesTable: [],
		totalFees: {
			fees: 0
		}
	},
	cgPrices: {},
	gauges: []
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
	) as unknown as SWRResponse<TDict<TCoinGeckoPrices>>;

	const	{data: gaugesWrapper} = useSWR(
		'https://api.curve.fi/api/getGauges?blockchainId=ethereum',
		curveFetcher,
		{revalidateOnFocus: false}
	) as SWRResponse<{gauges: TDict<TCurveGauges>}>;

	const	gauges = useMemo((): TCurveGauges[] => {
		const	_gaugesForMainnet: TCurveGauges[] = [];
		for (const gauge of Object.values(gaugesWrapper?.gauges || {})) {
			const	currentGauge = gauge as TCurveGauges;
			if (currentGauge.is_killed) {
				continue;
			}
			if (currentGauge.side_chain) {
				continue;
			}
			_gaugesForMainnet.push(currentGauge);
		}
		return _gaugesForMainnet;
	}, [gaugesWrapper]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const	contextValue = useMemo((): TCurveContext => ({
		curveWeeklyFees: curveWeeklyFees || defaultProps.curveWeeklyFees,
		cgPrices: cgPrices || defaultProps.cgPrices,
		gauges: gauges || defaultProps.gauges
	}), [curveWeeklyFees, cgPrices, gauges]);

	return (
		<CurveContext.Provider value={contextValue}>
			{children}
		</CurveContext.Provider>
	);
};


export const useCurve = (): TCurveContext => useContext(CurveContext);
export default useCurve;