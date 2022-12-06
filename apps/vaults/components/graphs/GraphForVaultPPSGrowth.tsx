import React, {Fragment} from 'react';
import {Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';

import type {ReactElement} from 'react';
import type {TMessariGraphData} from '@common/types/types';

type TGraphForVaultPPSGrowthProps = {
	messariData: TMessariGraphData[],
	height?: number,
}

function	GraphForVaultPPSGrowth({messariData, height = 312}: TGraphForVaultPPSGrowthProps): ReactElement {
	if (messariData?.length === 0) {
		return <Fragment />;
	}

	return (
		<ResponsiveContainer width={'100%'} height={height}>
			<LineChart
				margin={{top: 0, right: -26, bottom: 0, left: 0}}
				data={messariData}>
				<Line
					className={'text-primary-600'}
					type={'step'}
					strokeWidth={2}
					dataKey={'pps'}
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
						const	formatedValue = formatAmount(value, 3, 3);
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
										<p className={'text-xs text-neutral-600'}>{'Growth'}</p>
										<b className={'text-xs font-bold tabular-nums text-neutral-900'}>
											{`${formatAmount(Number(value) - 1, 4, 4)}%`}
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

export {GraphForVaultPPSGrowth};
export default GraphForVaultPPSGrowth;