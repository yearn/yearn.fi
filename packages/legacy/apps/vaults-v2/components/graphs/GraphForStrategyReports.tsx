import {Fragment, useMemo} from 'react';
import {Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {yDaemonReportsSchema} from '@vaults-v2/schemas/reportsSchema';
import {useFetch} from '@lib/hooks/useFetch';
import {useYDaemonBaseURI} from '@lib/hooks/useYDaemonBaseURI';
import {formatAmount, formatPercent, isZero, toBigInt, toNormalizedValue} from '@lib/utils';
import {formatDate} from '@lib/utils/format.time';

import type {ReactElement} from 'react';
import type {TYDaemonVaultStrategy} from '@lib/utils/schemas/yDaemonVaultsSchemas';
import type {TYDaemonReport, TYDaemonReports} from '@vaults-v2/schemas/reportsSchema';

export type TGraphForStrategyReportsProps = {
	strategy: TYDaemonVaultStrategy;
	vaultChainID: number;
	vaultDecimals: number;
	vaultTicker: string;
	height?: number;
};

export function GraphForStrategyReports({
	strategy,
	vaultChainID,
	vaultDecimals,
	vaultTicker,
	height = 127
}: TGraphForStrategyReportsProps): ReactElement {
	const {yDaemonBaseUri} = useYDaemonBaseURI({chainID: vaultChainID});

	const {data: reports} = useFetch<TYDaemonReports>({
		endpoint: `${yDaemonBaseUri}/reports/${strategy.address}`,
		schema: yDaemonReportsSchema
	});

	const strategyData = useMemo((): {
		name: number;
		value: number;
		gain: string;
		loss: string;
	}[] => {
		const _reports = [...(reports || [])];
		const reportsForGraph = _reports.reverse()?.map(
			(
				reports: TYDaemonReport
			): {
				name: number;
				value: number;
				gain: string;
				loss: string;
			} => ({
				name: Number(reports.timestamp),
				value: Number(reports.results?.[0]?.APR || 0) * 100,
				gain: reports?.gain || '0',
				loss: reports?.loss || '0'
			})
		);
		return reportsForGraph;
	}, [reports]);

	if (!strategyData || isZero(strategyData?.length)) {
		return <Fragment />;
	}

	return (
		<>
			<p className={'text-neutral-600'}>{'Historical APY'}</p>
			<div className={'mt-4 flex flex-row border-b border-l border-neutral-300'}>
				<ResponsiveContainer
					width={'100%'}
					height={height}>
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
							activeDot={(e: any): ReactElement => {
								e.className = `${e.className} activeDot`;
								delete e.dataKey;
								return <circle {...e}></circle>;
							}}
						/>
						<XAxis
							dataKey={'name'}
							hide
						/>
						<YAxis
							orientation={'right'}
							hide={false}
							tick={(props): React.ReactElement<SVGElement> => {
								const {
									payload: {value}
								} = props;
								props.fill = '#5B5B5B';
								props.className = 'text-xxs md:text-xs font-number z-10 ';
								props.alignmentBaseline = 'middle';
								delete props.verticalAnchor;
								delete props.visibleTicksCount;
								delete props.tickFormatter;
								const formatedValue = formatPercent(value);
								return <text {...props}>{formatedValue}</text>;
							}}
						/>
						<Tooltip
							content={(e): ReactElement => {
								const {active: isTooltipActive, payload, label} = e;
								if (!isTooltipActive || !payload) {
									return <></>;
								}
								if (payload.length > 0) {
									const [{value, payload: innerPayload}] = payload;
									const {gain, loss} = innerPayload;
									const diff = toBigInt(gain) - toBigInt(loss);
									const normalizedDiff = toNormalizedValue(diff, vaultDecimals);

									return (
										<div className={'recharts-tooltip'}>
											<div className={'mb-4'}>
												<p className={'text-xs'}>{formatDate(label)}</p>
											</div>
											<div className={'flex flex-row items-center justify-between'}>
												<p className={'text-xs text-neutral-600'}>{'APY'}</p>
												<b className={'font-number text-xs font-bold text-neutral-900'}>
													{formatPercent(Number(value))}
												</b>
											</div>
											<div className={'flex flex-row items-center justify-between'}>
												<p className={'text-xs text-neutral-600'}>
													{normalizedDiff > 0 ? 'Gain' : 'Loss'}
												</p>
												<b className={'font-number text-xs font-bold text-neutral-900'}>
													{`${formatAmount(normalizedDiff)} ${vaultTicker}`}
												</b>
											</div>
										</div>
									);
								}
								return <div />;
							}}
						/>
					</LineChart>
				</ResponsiveContainer>
			</div>
		</>
	);
}
