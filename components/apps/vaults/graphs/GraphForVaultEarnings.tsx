import React, {ReactElement, useMemo} from 'react';
import {format} from '@yearn-finance/web-lib/utils';
import {Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {formatWithUnit} from 'utils';

import type {TGraphData} from 'types/types';
import type {TYearnVault} from 'types/yearn';

type TGraphForVaultEarningsProps = {
	currentVault: TYearnVault,
	harvestData: TGraphData[],
	height?: number,
	isCumulative?: boolean,
}

function	GraphForVaultEarnings({currentVault, harvestData, height = 312, isCumulative = true}: TGraphForVaultEarningsProps): ReactElement {
	const	cumulativeData = useMemo((): {name: string; value: number}[] => {
		let	cumulativeValue = 0;
		return (
			harvestData.map((item: {name: string; value: number}): {name: string; value: number} => {
				cumulativeValue += item.value;
				return ({
					name: item.name,
					value: cumulativeValue
				});
			})
		);
	}, [harvestData]);

	return (
		<ResponsiveContainer width={'100%'} height={height}>
			<LineChart
				margin={{top: 0, right: -28, bottom: 0, left: 0}}
				data={isCumulative ? cumulativeData : harvestData}>
				<Line
					className={'text-primary-600'}
					type={'step'}
					dot={false}
					activeDot={(e): ReactElement => {
						e.className = `${e.className} activeDot`;
						return <circle {...e}></circle>;
					}}
					strokeWidth={2}
					dataKey={'value'}
					stroke={'currentcolor'} />
				<XAxis
					dataKey={'name'}
					hide />
				<YAxis
					orientation={'right'}
					domain={['dataMin', 'auto']}
					hide={false}
					tick={(e): ReactElement => {
						const {payload: {value}} = e;
						e.fill = '#5B5B5B';
						e.class = 'text-xxs md:text-xs tabular-nums';
						e.alignmentBaseline = 'middle';
						const	formatedValue = formatWithUnit(value, 0, 0);
						return <text {...e}>{formatedValue}</text>;
					}} />
				<Tooltip
					content={(e): ReactElement => {
						const {active: isTooltipActive, payload, label} = e;
						if (!isTooltipActive || !payload) {
							return <></>;
						}
						if (payload.length > 0) {
							const [{value}] = payload;

							return (
								<div className={'recharts-tooltip w-48'}>
									<div className={'mb-4'}>
										<p className={'text-xs'}>{label}</p>
									</div>
									<div className={'flex flex-row items-center justify-between'}>
										<p className={'text-xs text-neutral-600'}>{'Earnings'}</p>
										<b className={'text-xs font-bold tabular-nums text-neutral-900'}>
											{`${format.amount(Number(value), 2, 2)} ${currentVault.token.symbol}`}
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

export {GraphForVaultEarnings};