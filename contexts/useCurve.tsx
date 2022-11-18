import React, {createContext, useContext} from 'react';
import axios from 'axios';
import useSWR from 'swr';

import type {TCurveGauges} from 'types/curves.d';

export type TCurveContext = {
	curveWeeklyFees: any,
	gauges: TCurveGauges[],
	cgPrices: {[key: string]: {usd: number}}
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const	curveFetcher = async (url: string): Promise<any> => axios.get(url).then((res): any => res.data?.data);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const	fetcher = async (url: string): Promise<any> => axios.get(url).then((res): any => res.data);

const	CurveContext = createContext<TCurveContext>(defaultProps);
export const CurveContextApp = ({children}: {children: React.ReactElement}): React.ReactElement => {
	/* 🔵 - Yearn Finance ******************************************************
	**	Fetch all the CurveGauges to be able to create some new if required
	***************************************************************************/
	// const	{data} = useSWR('https://api.curve.fi/api/getGauges', curveFetcher);
	const	{data: curveWeeklyFees} = useSWR('https://api.curve.fi/api/getWeeklyFees', curveFetcher);
	const	{data: cgPrices} = useSWR('https://api.coingecko.com/api/v3/simple/price?ids=curve-dao-token&vs_currencies=usd', fetcher);
	
	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	return (
		<CurveContext.Provider
			value={{
				curveWeeklyFees,
				cgPrices,
				// gauges: Object.values(data?.data?.gauges || [])
				gauges: []
			}}>
			{children}
		</CurveContext.Provider>
	);
};


export const useCurve = (): TCurveContext => useContext(CurveContext);
export default useCurve;