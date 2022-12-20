import React, {Fragment, useMemo} from 'react';
import {Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import useSWR from 'swr';
import {useSettings} from '@yearn-finance/web-lib/contexts/useSettings';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {baseFetcher} from '@yearn-finance/web-lib/utils/fetchers';
import {formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {formatDate} from '@yearn-finance/web-lib/utils/format.time';
import {formatPercent} from '@common/utils';

import type {ReactElement} from 'react';
import type {SWRResponse} from 'swr';
import type {TYDaemonReports, TYearnVaultStrategy} from '@common/types/yearn';

type TGraphForStrategyReportsProps = {
	strategy: TYearnVaultStrategy,
	vaultDecimals: number,
	vaultTicker: string
	height?: number,
}

function	GraphForStrategyReports({strategy, vaultDecimals, vaultTicker, height = 127}: TGraphForStrategyReportsProps): ReactElement {
	const {safeChainID} = useChainID();
	const {settings: baseAPISettings} = useSettings();
	const {data: reports} = useSWR(
		`${baseAPISettings.yDaemonBaseURI}/${safeChainID}/reports/${strategy.address}`,
		baseFetcher,
		{revalidateOnFocus: false}
	) as SWRResponse;

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

	if (!strategyData || strategyData?.length === 0) {
		return <Fragment />;
	}

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
						e.className = 'text-xxs md:text-xs font-number z-10 ';
						e.alignmentBaseline = 'middle';
						const	formatedValue = formatPercent(value);
						return <text {...e}>{formatedValue}</text>;
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
							const	diff = formatBN(gain).sub(formatBN(loss));
							const	normalizedDiff = formatToNormalizedValue(diff, vaultDecimals);
							
							return (
								<div className={'recharts-tooltip'}>
									<div className={'mb-4'}>
										<p className={'text-xs'}>
											{formatDate(label)}
										</p>
									</div>
									<div className={'flex flex-row items-center justify-between'}>
										<p className={'text-xs text-neutral-600'}>{'APR'}</p>
										<b className={'font-number text-xs font-bold text-neutral-900'}>
											{formatPercent(Number(value))}
										</b>
									</div>
									<div className={'flex flex-row items-center justify-between'}>
										<p className={'text-xs text-neutral-600'}>{normalizedDiff > 0 ? 'Gain' : 'Loss'}</p>
										<b className={'font-number text-xs font-bold text-neutral-900'}>
											{`${formatAmount(normalizedDiff)} ${vaultTicker}`}
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
export default GraphForStrategyReports;