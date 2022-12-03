import React, {useMemo} from 'react';
import {Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import useSWR from 'swr';
import {useWeb3} from '@yearn-finance/web-lib/contexts';
import {format} from '@yearn-finance/web-lib/utils';
import {baseFetcher} from '@common/utils';

import type {ReactElement} from 'react';
import type {TYDaemonReports, TYearnVaultStrategy} from '@common/types/yearn';


type TGraphForStrategyReportsProps = {
	strategy: TYearnVaultStrategy,
	vaultDecimals: number,
	vaultTicker: string
	height?: number,
}

function	GraphForStrategyReports({strategy, vaultDecimals, vaultTicker, height = 127}: TGraphForStrategyReportsProps): ReactElement {
	const	{safeChainID} = useWeb3();
	const	{data: reports} = useSWR(
		`${process.env.YDAEMON_BASE_URI}/${safeChainID}/reports/${strategy.address}`,
		baseFetcher,
		{revalidateOnFocus: false}
	);

	const	strategyData = useMemo((): {name: number; value: number, gain: string, loss: string}[] => {
		const	_reports = [...(reports || [])];
		const reportsForGraph = (
			_reports.reverse()?.map((reports: TYDaemonReports): {name: number; value: number, gain: string, loss: string} => ({
				name: Number(reports.timestamp),
				value: Number(reports.results?.[0]?.APR || 0) * 100,
				gain: reports?.gain || '0',
				loss: reports?.loss || '0'
			}))
		);
		return reportsForGraph;
	}, [reports]);

	return (
		<ResponsiveContainer width={'100%'} height={height}>
			<LineChart
				margin={{top: 0, right: -28, bottom: 0, left: 0}}
				data={strategyData}>
				<Line
					className={'text-primary-600'}
					type={'step'}
					strokeWidth={2}
					dataKey={'value'}
					stroke={'currentcolor'} 
					dot={false}
					activeDot={(e): ReactElement => {
						e.className = `${e.className} activeDot`;
						return <circle {...e}></circle>;
					}} />
				<XAxis
					dataKey={'name'}
					hide />
				<YAxis
					orientation={'right'}
					hide={false} 
					tick={(e): ReactElement => {
						const {payload: {value}} = e;
						e.fill = '#5B5B5B';
						e.class = 'text-xxs md:text-xs tabular-nums z-10 ';
						e.alignmentBaseline = 'middle';
						const	formatedValue = format.amount(value, 2, 2);
						return <text {...e}>{`${formatedValue}%`}</text>;
					}} />
				<Tooltip
					content={(e): ReactElement => {
						const {active: isTooltipActive, payload, label} = e;
						if (!isTooltipActive || !payload) {
							return <></>;
						}
						if (payload.length > 0) {
							const [{value, payload: innerPayload}] = payload;
							const	{gain, loss} = innerPayload;
							const	diff = format.BN(gain).sub(format.BN(loss));
							const	normalizedDiff = format.toNormalizedValue(diff, vaultDecimals);
							
							return (
								<div className={'recharts-tooltip'}>
									<div className={'mb-4'}>
										<p className={'text-xs'}>
											{format.date(label)}
										</p>
									</div>
									<div className={'flex flex-row items-center justify-between'}>
										<p className={'text-xs text-neutral-600'}>{'APR'}</p>
										<b className={'text-xs font-bold tabular-nums text-neutral-900'}>
											{`${format.amount(Number(value), 2, 2)} %`}
										</b>
									</div>
									<div className={'flex flex-row items-center justify-between'}>
										<p className={'text-xs text-neutral-600'}>{normalizedDiff > 0 ? 'Gain' : 'Loss'}</p>
										<b className={'text-xs font-bold tabular-nums text-neutral-900'}>
											{`${format.amount(normalizedDiff, 2, 2)} ${vaultTicker}`}
										</b>
									</div>
								</div>
							);
						}
						return <div />;
					}} />
			</LineChart>
		</ResponsiveContainer>
	);
}

export {GraphForStrategyReports};