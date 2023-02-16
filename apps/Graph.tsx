import React, {Fragment, useMemo, useState} from 'react';
import {Area, AreaChart, ResponsiveContainer, Tooltip} from 'recharts';
import {truncateHex} from '@yearn-finance/web-lib/utils/address';
import {formatToNormalizedBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {formatDate} from '@yearn-finance/web-lib/utils/format.time';
import {formatPercent} from '@common/utils';

import draftData from '../public/draftData.json';

import type {ReactElement} from 'react';
import type {TDict} from '@yearn-finance/web-lib/utils/types';

export type TStrategyReport = {
	TxHash: string;
	BlockHash: string;
	BlockNumber: number;
	Timestamp: number;
	TxIndex: number;
	LogIndex: number;
	Removed: boolean;
	Vault: string;
	Strategy: string;
	VaultVersion: string;
	VaultName: string;
	Gain: string;
	Loss: string;
	TotalGain: string;
	TotalLoss: string;
	TotalDebt: string;
	DebtLimit: string;
	DebtPaid: string;
	DebtAdded: string;
	DebtRatio: string;
	Duration: string;
	Fees: {
		ManagementFeeBPS: string;
		PerformanceFeeBPS: string;
		StrategistFeeBPS: string;
		TreasuryCollectedFee: string;
		StrategistCollectedFee: string;
		TotalCollectedFee: string;
		TreasuryFeeRatio: string;
		StrategistFeeRatio: string;
		TotalFeeRatio: string;
	}
}

function	Graph(): ReactElement {
	const	[selectedVault, set_selectedVault] = useState('0xe9dc63083c464d6edccff23444ff3cfc6886f6fb');

	const	strategyData = useMemo((): any[] => {
		const	_reports = (draftData as unknown as TDict<TStrategyReport[]>)[selectedVault];
		const reportsForGraph = (
			_reports?.map((reports: TStrategyReport): any => ({
				name: truncateHex(reports.TxHash, 6),
				value: Number(formatToNormalizedBN(reports.Gain || 0).normalized),
				totalFeeRatio: formatPercent(Number(reports.Fees?.TotalFeeRatio) * 100, 2, 2),
				treasuryFee: Number(formatToNormalizedBN(reports.Fees?.TreasuryCollectedFee || 0).normalized),
				strategistFee: Number(formatToNormalizedBN(reports.Fees?.StrategistCollectedFee || 0).normalized),
				total: reports.Fees?.TotalCollectedFee,
				treasury: reports.Fees?.TreasuryCollectedFee,
				strategist: reports.Fees?.StrategistCollectedFee,
				data: reports
			}))
		);
		return reportsForGraph;
	}, [selectedVault]);


	if (!strategyData || strategyData?.length === 0) {
		return <Fragment />;
	}

	return (
		<div>
			<select
				value={selectedVault}
				onChange={(e): void => set_selectedVault(e.target.value)}
				className={'h-10 w-fit border-neutral-900 bg-neutral-0'}>
				{Object.entries(draftData).map(([addr, data]): ReactElement => (
					<option key={addr} value={addr}>{`${data?.[0]?.VaultName || 'Missing Vault Name'} (v${data?.[0]?.VaultVersion || '???'}) - ${truncateHex(addr, 6)}`}</option>
				))}
			</select>
			<div className={'my-10 border border-neutral-900'}>
				<ResponsiveContainer width={'100%'} height={'100%'}>
					<AreaChart
						margin={{
							top: -58,
							right: 0,
							left: 0,
							bottom: 0
						}}
						stackOffset={'expand'}
						data={strategyData.filter((e): boolean => Number(e.value) > 0)}>
						<Area
							dataKey={'strategistFee'}
							type={'monotone'}
							stackId={'a'}
							fill={'#5acae680'}
							stroke={'#5acae6'}/>
						<Area
							dataKey={'treasuryFee'}
							type={'monotone'}
							stackId={'a'}
							fill={'#fb878180'}
							stroke={'#fb8781'}/>
						<Area
							dataKey={'value'}
							type={'monotone'}
							stackId={'a'}
							fill={'#000000'} />
						<Tooltip
							content={(e): ReactElement => {
								const {active: isTooltipActive, payload} = e;
								if (!isTooltipActive || !payload) {
									return <></>;
								}
								if (payload.length > 0) {
									const [{payload: innerPayload}] = payload;
									const {treasury, strategist, total, data, name} = innerPayload;

									return (
										<div className={'recharts-tooltip !w-96'}>
											<div className={'mb-4'}>
												<p className={'text-xs'}>
													{name}
												</p>
											</div>
											<div className={'flex flex-row items-center justify-between'}>
												<p className={'text-xs text-neutral-600'}>{'Gains'}</p>
												<b className={'font-number text-xs font-bold text-neutral-900'}>
													{formatToNormalizedValue(data.Gain)}
												</b>
											</div>
											<div className={'flex flex-row items-center justify-between'}>
												<p className={'text-xs text-neutral-600'}>{'Total Fee'}</p>
												<b className={'font-number text-xs font-bold text-neutral-900'}>
													{formatToNormalizedValue(total)}
												</b>
											</div>
											<div className={'flex flex-row items-center justify-between'}>
												<p className={'text-xs text-neutral-600'}>{'Strategist Fee'}</p>
												<b className={'font-number text-xs font-bold text-neutral-900'}>
													{`${formatToNormalizedValue(strategist)} - ${formatPercent(data.Fees?.StrategistFeeRatio * 100)}`}
												</b>
											</div>
											<div className={'flex flex-row items-center justify-between'}>
												<p className={'text-xs text-neutral-600'}>{'Treasury Fee'}</p>
												<b className={'font-number text-xs font-bold text-neutral-900'}>
													{`${formatToNormalizedValue(treasury)} - ${formatPercent(data.Fees?.TreasuryFeeRatio * 100)}`}
												</b>
											</div>
										</div>
									);
								}
								return <div />;
							}} />
					</AreaChart>
				</ResponsiveContainer>
			</div>
			<div className={'grid w-full grid-cols-1'}>
				<div className={'grid h-16 w-full grid-cols-5 flex-row items-center justify-between border-b border-neutral-900'}>
					<div className={'flex flex-col items-start'}>
						<p className={'text-xs font-bold text-neutral-900'}>{'STRATEGY - TX - TIME'}</p>
					</div>
					<div className={'flex justify-end'}>
						<p className={'text-xs font-bold text-neutral-900'}>{'GAINS'}</p>
					</div>
					<div className={'flex justify-end'}>
						<p className={'text-xs font-bold text-neutral-900'}>{'TOTAL FEES - RATIO'}</p>
					</div>
					<div className={'flex justify-end'}>
						<p className={'text-xs font-bold text-neutral-900'}>{'TREASURY FEE - RATIO'}</p>
					</div>
					<div className={'flex justify-end'}>
						<p className={'text-xs font-bold text-neutral-900'}>{'STRATEGIST FEE - RATIO'}</p>
					</div>
				</div>


				{strategyData.map(({data}, i): ReactElement => {
					return (
						<div key={i} className={'grid h-16 w-full grid-cols-5 flex-row items-center justify-between'}>
							<div className={'flex flex-col items-start'}>
								<span>
									<a
										href={`https://etherscan.io/address/${data.Strategy}`}
										className={'font-number text-sm font-bold text-neutral-900 hover:underline'}>
										{truncateHex(data.Strategy, 4)}
									</a>
									&nbsp;
									<a
										href={`https://etherscan.io/tx/${data.TxHash}`}
										className={'font-number text-xs text-neutral-400 hover:underline'}>
										{truncateHex(data.TxHash, 6)}
									</a>
								</span>
								<p className={'font-number text-xs text-neutral-400'}>
									{`${formatDate(data.Timestamp * 1000)}`}
								</p>
							</div>
							<div className={'flex flex-col items-end'}>
								<p className={'font-number text-sm font-bold text-neutral-900'}>
									{`${formatAmount(Number(formatToNormalizedBN(data.Gain).normalized), 6, 6)}`}
								</p>
								<p className={'font-number text-xs text-neutral-400'}>
									&nbsp;
								</p>
							</div>
							<div className={'flex flex-col items-end'}>
								<p className={'font-number text-sm font-bold text-neutral-900'}>
									{`${formatAmount(Number(formatToNormalizedBN(data.Fees.TotalCollectedFee).normalized), 6, 6)}`}
								</p>
								<p className={'font-number text-xs text-neutral-400'}>
									{`${formatPercent(Number(data.Fees.TotalFeeRatio) * 100)}`}
								</p>
							</div>
							<div className={'flex flex-col items-end'}>
								<p className={'font-number text-sm font-bold text-neutral-900'}>
									{`${formatAmount(Number(formatToNormalizedBN(data.Fees.TreasuryCollectedFee).normalized), 6, 6)}`}
								</p>
								<p className={'font-number text-xs text-neutral-400'}>
									{`${formatPercent(Number(data.Fees.TreasuryFeeRatio) * 100)}`}
								</p>
							</div>
							<div className={'flex flex-col items-end'}>
								<p className={'font-number text-sm font-bold text-neutral-900'}>
									{`${formatAmount(Number(formatToNormalizedBN(data.Fees.StrategistCollectedFee).normalized), 6, 6)}`}
								</p>
								<p className={'font-number text-xs text-neutral-400'}>
									{`${formatPercent(Number(data.Fees.StrategistFeeRatio) * 100)}`}
								</p>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);

}

export default Graph;
