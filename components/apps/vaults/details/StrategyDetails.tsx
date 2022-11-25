import React, {ReactElement, useMemo} from 'react';
import useSWR from 'swr';
import {format, parseMarkdown} from '@yearn-finance/web-lib/utils';
import IconChevron from 'components/icons/IconChevron';
import {Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {baseFetcher} from 'utils';

import type {TYDaemonReports, TYearnVault, TYearnVaultStrategy} from 'types/yearn';

function	VaultDetailsStrategyGraph({strategy, vaultDecimals, vaultTicker}: {
	strategy: TYearnVaultStrategy,
	vaultDecimals: number,
	vaultTicker: string
}): ReactElement {
	const	{data: reports} = useSWR(`${process.env.YDAEMON_BASE_URI}/1/reports/${strategy.address}`, baseFetcher);

	const	data = useMemo((): {name: number; value: number, gain: string, loss: string}[] => {
		const	_reports = [...(reports || [])];
		const reportsForGraph = (
			_reports.reverse()?.map((reports: TYDaemonReports): {name: number; value: number, gain: string, loss: string} => ({
				name: Number(reports.timestamp),
				value: Number(reports.results?.[0]?.APR || 0) * 100,
				gain: reports?.gain || '0',
				loss: reports?.loss || '0'
			}))
		);


		// if (reportsForGraph.length > 0) {
		// 	const valueFor7Days = 60 * 60 * 24 * 14 * 1000;
		// 	const lastValidDate = reportsForGraph[reportsForGraph.length - 1].name;
		// 	console.warn({lastValidDate, date: Date.now().valueOf() - valueFor7Days});

		// 	//If the lastValidDate is before 7 days ago, set 7 days ago to 0
		// 	if (lastValidDate < Date.now().valueOf() - valueFor7Days) {
		// 		reportsForGraph.push({
		// 			name: Date.now().valueOf() - valueFor7Days
		// 			// value: 0
		// 		});
		// 	} else {
		// 		reportsForGraph.push({
		// 			name: Number(Date.now().valueOf())
		// 			// value: Number(reportsForGraph[reportsForGraph.length - 1]?.value || 0)
		// 		});
		// 	}
		// }

		return reportsForGraph;
	}, [reports]);

	return (
		<div className={'mt-4 flex flex-row space-x-8 border-b-2 border-l-2 border-neutral-300'}>
			<ResponsiveContainer width={'100%'} height={127}>
				<LineChart
					margin={{top: 0, right: -28, bottom: 0, left: 0}}
					data={data}>
					<Line
						type={'step'}
						className={'text-primary-600'}
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
						scale={'time'}
						// padding={{left: 8, right: 8}} 
						hide />
					<YAxis
						orientation={'right'}
						padding={{top: 8}}
						tick={(e): ReactElement => {
							const {payload: {value}} = e;
							e.fill = '#5B5B5B';
							e.style = {fontSize: 12};
							e.alignmentBaseline = 'middle';
							const	formatedValue = format.amount(value, 2, 2);
							return <text {...e}>{formatedValue}</text>;
						}}
						strokeWidth={2}
						tickFormatter={(value): string => format.amount(value, 2, 2)}
						hide={false} />
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
		</div>
	);
}

function	VaultDetailsStrategy({currentVault, strategy}: {currentVault: TYearnVault, strategy: TYearnVaultStrategy}): ReactElement {
	return (
		<details className={'p-0'}>
			<summary>
				<div>
					<b className={'text-neutral-900'}>{strategy.name}</b>
				</div>
				<div>
					<IconChevron className={'summary-chevron'} />
				</div>
			</summary>

			<div className={'bg-neutral-100 px-6'}>
				<div className={'mb-6 -mt-4 w-full space-y-6'}>
					<div>
						<p
							className={'text-neutral-600'}
							dangerouslySetInnerHTML={{__html: parseMarkdown(strategy.description.replaceAll('{{token}}', currentVault.token.symbol))}} />
						<p className={'text-neutral-600'}>{`Last report ${format.duration((strategy?.details?.lastReport * 1000) - new Date().valueOf(), true)}.`}</p>
					</div>
				</div>

				<div className={'grid grid-cols-12 gap-24 pb-8'}>
					<div className={'col-span-12 w-full space-y-4 md:col-span-6'}>
						<div className={'grid grid-cols-4 gap-4'}>
							<div className={'col-span-2 flex flex-col space-y-2 bg-neutral-200 p-4'}>
								<p className={'text-base text-neutral-600'}>{'Total Debt'}</p>
								<b className={'text-lg tabular-nums text-neutral-900'}>
									{`${format.amount(format.toNormalizedValue(format.BN(strategy?.details?.totalDebt), currentVault?.decimals), 0, 0)} ${currentVault.token.symbol}`}
								</b>
							</div>

							<div className={'col-span-2 flex flex-col space-y-2 bg-neutral-200 p-4'}>
								<p className={'text-base text-neutral-600'}>{'Total Gain'}</p>
								<b className={'text-lg tabular-nums text-neutral-900'}>
									{`${format.amount(format.toNormalizedValue(
										format.BN(strategy?.details?.totalGain).sub(format.BN(strategy?.details?.totalLoss)),
										currentVault?.decimals
									), 0, 0)} ${currentVault.token.symbol}`}
								</b>
							</div>
						</div>

						<div className={'flex flex-col space-y-4 bg-neutral-200 p-4'}>
							<p className={'text-base text-neutral-600'}>{'Stats'}</p>
							<div className={'mt-0 grid grid-cols-2 gap-x-12 gap-y-2'}>
								<div className={'flex flex-row items-center justify-between'}>
									<p className={'text-sm text-neutral-500'}>{'TVL Impact'}</p>
									<p className={'text-sm tabular-nums text-neutral-900'}>{strategy?.risk?.TVLImpact}</p>
								</div>
								<div className={'flex flex-row items-center justify-between'}>
									<p className={'text-sm text-neutral-500'}>{'Audit Score'}</p>
									<p className={'text-sm tabular-nums text-neutral-900'}>{strategy?.risk?.auditScore}</p>
								</div>
								<div className={'flex flex-row items-center justify-between'}>
									<p className={'text-sm text-neutral-500'}>{'Code Review Score'}</p>
									<p className={'text-sm tabular-nums text-neutral-900'}>{strategy?.risk?.codeReviewScore}</p>
								</div>
								<div className={'flex flex-row items-center justify-between'}>
									<p className={'text-sm text-neutral-500'}>{'Complexity Score'}</p>
									<p className={'text-sm tabular-nums text-neutral-900'}>{strategy?.risk?.complexityScore}</p>
								</div>
								<div className={'flex flex-row items-center justify-between'}>
									<p className={'text-sm text-neutral-500'}>{'Longevity Impact'}</p>
									<p className={'text-sm tabular-nums text-neutral-900'}>{strategy?.risk?.longevityImpact}</p>
								</div>
								<div className={'flex flex-row items-center justify-between'}>
									<p className={'text-sm text-neutral-500'}>{'Protocol Safety Score'}</p>
									<p className={'text-sm tabular-nums text-neutral-900'}>{strategy?.risk?.protocolSafetyScore}</p>
								</div>
								<div className={'flex flex-row items-center justify-between'}>
									<p className={'text-sm text-neutral-500'}>{'Team Knowledge Score'}</p>
									<p className={'text-sm tabular-nums text-neutral-900'}>{strategy?.risk?.teamKnowledgeScore}</p>
								</div>
								<div className={'flex flex-row items-center justify-between'}>
									<p className={'text-sm text-neutral-500'}>{'Testing Score'}</p>
									<p className={'text-sm tabular-nums text-neutral-900'}>{strategy?.risk?.testingScore}</p>
								</div>
							</div>
						</div>
					</div>
					<div className={'col-span-12 flex h-full w-full flex-col justify-between md:col-span-6'}>
						<div className={'grid grid-cols-6 gap-4'}>
							<div className={'col-span-2 flex flex-col space-y-2 p-4'}>
								<p className={'text-base text-neutral-600'}>{'APR'}</p>
								<b className={'text-lg tabular-nums text-neutral-900'}>
									{`${format.amount((strategy?.details?.apr || 0), 0, 2)} %`}
								</b>
							</div>

							<div className={'col-span-2 flex flex-col space-y-2 p-4'}>
								<p className={'text-base text-neutral-600'}>{'Debt Ratio'}</p>
								<b className={'text-lg tabular-nums text-neutral-900'}>
									{`${format.amount((strategy?.details?.debtRatio || 0) / 100, 0, 2)} %`}
								</b>
							</div>

							<div className={'col-span-2 flex flex-col space-y-2 p-4'}>
								<p className={'text-base text-neutral-600'}>{'Perfomance fee'}</p>
								<b className={'text-lg tabular-nums text-neutral-600'}>
									{`${format.amount((strategy?.details?.performanceFee || 0) * 100, 0, 2)} %`}
								</b>
							</div>
						</div>

						<div className={'mt-auto'}>
							<p className={'text-neutral-600'}>{'Historical APR'}</p>
							<VaultDetailsStrategyGraph
								vaultDecimals={currentVault.decimals}
								vaultTicker={currentVault?.token?.symbol || 'token'}
								strategy={strategy} />
						</div>
					</div>
				</div>
			</div>
		</details>	
	);
}

function	VaultDetailsStrategies({currentVault}: {currentVault: TYearnVault}): ReactElement {
	return (
		<div className={'grid grid-cols-1 bg-neutral-100'}>
			<div className={'col-span-1 w-full space-y-6 p-6'}>
				<div>
					<p className={'text-neutral-600'}>
						{'Strategies are the ways in which each Yearn Vault puts your assets to work within the DeFi ecosystem, returning the earned yield back to you.'}
					</p>
					<p className={'text-neutral-600'}>
						{'Vaults often have multiple strategies, which each go through comprehensive peer reviews and audits before being deployed.'}
					</p>
				</div>
			</div>
			<div className={'col-span-1 w-full border-t border-neutral-300'}>
				{(currentVault?.strategies || [])
					// .filter((strategy): boolean => (strategy?.details?.debtRatio || 0) > 0)
					.sort((a, b): number => (b?.details?.debtRatio || 0) - (a?.details?.debtRatio || 0))
					.map((strategy, index): ReactElement => (
						<VaultDetailsStrategy
							currentVault={currentVault}
							strategy={strategy}
							key={index} />
					))}
			</div>
		</div>
	);
}

export {VaultDetailsStrategies};
