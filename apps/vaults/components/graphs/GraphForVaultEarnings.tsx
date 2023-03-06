import React, {Fragment, useMemo} from 'react';
import {Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {formatAmount, formatWithUnit} from '@yearn-finance/web-lib/utils/format.number';

import type {ReactElement} from 'react';
import type {TGraphData} from '@common/types/types';
import type {TYearnVault} from '@common/types/yearn';

export type TGraphForVaultEarningsProps = {
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


	if (isCumulative && cumulativeData?.length === 0) {
		return <Fragment />;
	}
	if (!isCumulative && harvestData?.length === 0) {
		return <Fragment />;
	}
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
						delete e.dataKey;
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
						e.className = 'text-xxs md:text-xs font-number';
						e.alignmentBaseline = 'middle';
						delete e.verticalAnchor;
						delete e.visibleTicksCount;
						delete e.tickFormatter;
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
										<b className={'font-number text-xs font-bold text-neutral-900'}>
											{`${formatAmount(Number(value))} ${currentVault.token.symbol}`}
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
export default GraphForVaultEarnings;
