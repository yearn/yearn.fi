import {Fragment, useMemo} from 'react';
import {Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {yDaemonReportsSchema} from '@vaults/schemas/reportsSchema';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {formatToNormalizedValue, toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount, formatPercent} from '@yearn-finance/web-lib/utils/format.number';
import {formatDate} from '@yearn-finance/web-lib/utils/format.time';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {useFetch} from '@common/hooks/useFetch';
import {useYDaemonBaseURI} from '@common/utils/getYDaemonBaseURI';

import type {ReactElement} from 'react';
import type {TYDaemonVaultStrategy} from '@common/schemas/yDaemonVaultsSchemas';
import type {TYDaemonReport, TYDaemonReports} from '@vaults/schemas/reportsSchema';

export type TGraphForStrategyReportsProps = {
	strategy: TYDaemonVaultStrategy,
	vaultDecimals: number,
	vaultTicker: string
	height?: number,
}

function GraphForStrategyReports({strategy, vaultDecimals, vaultTicker, height = 127}: TGraphForStrategyReportsProps): ReactElement {
	const {safeChainID} = useChainID();
	const {yDaemonBaseUri} = useYDaemonBaseURI({chainID: safeChainID});

	const {data: reports} = useFetch<TYDaemonReports>({
		endpoint: `${yDaemonBaseUri}/reports/${strategy.address}`,
		schema: yDaemonReportsSchema
	});

	const strategyData = useMemo((): {name: number; value: number, gain: string, loss: string}[] => {
		const	_reports = [...(reports || [])];
		const reportsForGraph = (
			_reports.reverse()?.map((reports: TYDaemonReport): {name: number; value: number, gain: string, loss: string} => ({
				name: Number(reports.timestamp),
				value: Number(reports.results?.[0]?.APR || 0) * 100,
				gain: reports?.gain || '0',
				loss: reports?.loss || '0'
			}))
		);
		return reportsForGraph;
	}, [reports]);

	if (!strategyData || isZero(strategyData?.length)) {
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
						delete e.dataKey;
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
						delete e.verticalAnchor;
						delete e.visibleTicksCount;
						delete e.tickFormatter;
						const formatedValue = formatPercent(value);
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
							const {gain, loss} = innerPayload;
							const diff = toBigInt(gain) - toBigInt(loss);
							const normalizedDiff = formatToNormalizedValue(diff, vaultDecimals);

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
