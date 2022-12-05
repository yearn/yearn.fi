import React, {createContext, useContext, useMemo} from 'react';
import axios from 'axios';
import useSWR from 'swr';
import {baseFetcher} from '@yearn-finance/web-lib/utils/fetchers';

import type {SWRResponse} from 'swr';
import type {TCurveGauges} from '@common/types/curves';

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

const	CurveContext = createContext<TCurveContext>(defaultProps);
export const CurveContextApp = ({children}: {children: React.ReactElement}): React.ReactElement => {
	/* 🔵 - Yearn Finance ******************************************************
	**	Fetch all the CurveGauges to be able to create some new if required
	***************************************************************************/
	const	{data: curveWeeklyFees} = useSWR(
		'https://api.curve.fi/api/getWeeklyFees',
		curveFetcher,
		{revalidateOnFocus: false}
	);
	const	{data: cgPrices} = useSWR(
		'https://api.coingecko.com/api/v3/simple/price?ids=curve-dao-token&vs_currencies=usd',
		baseFetcher,
		{revalidateOnFocus: false}
	) as SWRResponse;

	const	{data: gaugesWrapper} = useSWR(
		'https://api.curve.fi/api/getGauges?blockchainId=ethereum',
		curveFetcher,
		{revalidateOnFocus: false}
	);

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
	return (
		<CurveContext.Provider
			value={{
				curveWeeklyFees,
				cgPrices,
				gauges: gauges || []
			}}>
			{children}
		</CurveContext.Provider>
	);
};


export const useCurve = (): TCurveContext => useContext(CurveContext);
export default useCurve;