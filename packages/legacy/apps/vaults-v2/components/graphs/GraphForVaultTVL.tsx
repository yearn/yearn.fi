import type {TMessariGraphData} from '@lib/types';
import {formatAmount, formatWithUnit, isZero} from '@lib/utils';
import type {ReactElement} from 'react';
import {Fragment} from 'react';
import {Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';

export type TGraphForVaultTVLProps = {
	messariData: TMessariGraphData[];
	height?: number;
};

export function GraphForVaultTVL({messariData, height = 312}: TGraphForVaultTVLProps): ReactElement {
	if (isZero(messariData?.length)) {
		return <Fragment />;
	}

	return (
		<ResponsiveContainer width={'100%'} height={height}>
			<LineChart margin={{top: 0, right: -28, bottom: 0, left: 0}} data={messariData}>
				<Line
					className={'text-primary-600'}
					type={'step'}
					strokeWidth={2}
					dataKey={'tvl'}
					stroke={'currentcolor'}
					dot={false}
					activeDot={(e: unknown): ReactElement => {
						const dotProps = e as React.SVGProps<SVGCircleElement> & {dataKey?: string};
						dotProps.className = `${dotProps.className} activeDot`;
						delete dotProps.dataKey;
						return <circle {...dotProps}></circle>;
					}}
				/>
				<XAxis dataKey={'name'} hide />
				<YAxis
					orientation={'right'}
					domain={['dataMin', 'auto']}
					hide={false}
					tick={(props): React.ReactElement<SVGElement> => {
						const {
							payload: {value}
						} = props;
						props.fill = '#5B5B5B';
						props.className = 'text-xxs md:text-xs font-number';
						props.alignmentBaseline = 'middle';
						delete props.verticalAnchor;
						delete props.visibleTicksCount;
						delete props.tickFormatter;
						const formatedValue = formatWithUnit(value, 0, 0);
						return <text {...props}>{formatedValue}</text>;
					}}
				/>
				<Tooltip
					content={(e): ReactElement => {
						const {active: isTooltipActive, payload, label} = e;
						if (!isTooltipActive || !payload) {
							return <Fragment />;
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
										<b className={'font-number text-xs font-bold text-neutral-900'}>
											{`${formatAmount(Number(value))} $`}
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
	);
}
