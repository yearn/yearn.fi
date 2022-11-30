import React from 'react';
import {Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {format} from '@yearn-finance/web-lib/utils';
import {formatWithUnit} from '@common/utils';

import type {ReactElement} from 'react';
import type {TMessariGraphData} from '@common/types/types';

type TGraphForVaultTVLProps = {
	messariData: TMessariGraphData[],
	height?: number,
}

function	GraphForVaultTVL({messariData, height = 312}: TGraphForVaultTVLProps): ReactElement {	
	return (
		<ResponsiveContainer width={'100%'} height={height}>
			<LineChart
				margin={{top: 0, right: -28, bottom: 0, left: 0}}
				data={messariData}>
				<Line
					className={'text-primary-600'}
					type={'step'}
					strokeWidth={2}
					dataKey={'tvl'}
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
								<div className={'recharts-tooltip'}>
									<div className={'mb-4'}>
										<p className={'text-xs'}>{label}</p>
									</div>
									<div className={'flex flex-row items-center justify-between'}>
										<p className={'text-xs text-neutral-600'}>{'TVL'}</p>
										<b className={'text-xs font-bold tabular-nums text-neutral-900'}>
											{`${format.amount(Number(value), 2, 2)} $`}
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

export {GraphForVaultTVL};