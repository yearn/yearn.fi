import React, {ReactElement, useMemo, useState} from 'react';
import useSWR from 'swr';
import {useSettings, useWeb3} from '@yearn-finance/web-lib/contexts';
import IconAddToMetamask from '@yearn-finance/web-lib/icons/IconAddToMetamask';
import IconLinkOut from '@yearn-finance/web-lib/icons/IconLinkOut';
import {format, parseMarkdown} from '@yearn-finance/web-lib/utils';
import IconChevron from 'components/icons/IconChevron';
import {useYearn} from 'contexts/useYearn';
import {Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {baseFetcher} from 'utils';

import type {TSettingsForNetwork, TYDaemonHarvests, TYearnVault} from 'types/yearn.d';

function	VaultDetailsAbout({currentVault}: {currentVault: TYearnVault}): ReactElement {
	const	{data: harvests} = useSWR(`${process.env.YDAEMON_BASE_URI}/1/vaults/harvests/${currentVault.address}`, baseFetcher);
	const	harvestList = useMemo((): TYDaemonHarvests[] => harvests, [harvests]);

	const	data = useMemo((): {name: string; value: number}[] => {
		const	_harvestList = [...(harvestList || [])];
		return (
			_harvestList.reverse()?.map((harvest): {name: string; value: number} => ({
				name: format.date(Number(harvest.timestamp) * 1000),
				value: format.toNormalizedValue(format.BN(harvest.profit).sub(format.BN(harvest.loss)), 18)
			}))
		);
	}, [harvestList]);

	// Save in cumulativeData the sum of all previous values
	const	cumulativeData = useMemo((): {name: string; value: number}[] => {
		let	cumulativeValue = 0;
		return (
			data.map((item): {name: string; value: number} => {
				cumulativeValue += item.value;
				return ({
					name: item.name,
					value: cumulativeValue
				});
			})
		);
	}, [data]);


	return (
		<div className={'grid grid-cols-1 gap-10 bg-neutral-100 p-8 md:grid-cols-2 md:gap-32'}>
			<div className={'col-span-1 w-full space-y-6'}>
				<div>
					<b className={'text-neutral-900'}>{'Description'}</b>
					<p className={'mt-4 text-neutral-600'}>
						{'Yearn Finance is a suite of products in Decentralized Finance (DeFi) that provides yield aggregation, a decentralized money market, and several other DeFi building blocks on the Ethereum blockchain. The protocol is maintained by various independent developers and is governed by YFI holders.'}
					</p>
				</div>
				<div>
					<b className={'text-neutral-900'}>{'Trust score: 6.9'}</b>
					<p className={'mt-4 text-neutral-600'}>
						{'Yearn Finance is a suite of products in Decentralized Finance (DeFi) that provides yield aggregation, a decentralized money market, and several other DeFi building blocks on the Ethereum blockchain. The protocol is maintained by various independent developers and is governed by YFI holders.'}
					</p>
				</div>
			</div>
			<div className={'col-span-1 w-full space-y-8'}>
				<div>
					<b className={'text-neutral-900'}>{'Yearn Fees'}</b>
					<div className={'mt-4 flex flex-row space-x-8'}>
						<div className={'flex flex-col space-y-2'}>
							<p className={'text-xs text-neutral-600'}>{'Deposit/Withdrawal fee'}</p>
							<b className={'text-xl tabular-nums text-neutral-900'}>{'0 %'}</b>
						</div>
						<div className={'flex flex-col space-y-2'}>
							<p className={'text-xs text-neutral-600'}>{'Management fee'}</p>
							<b className={'text-xl tabular-nums text-neutral-900'}>{`${format.amount((currentVault?.apy?.fees?.management || 0) * 100, 0, 2)} %`}</b>
						</div>
						<div className={'flex flex-col space-y-2'}>
							<p className={'text-xs text-neutral-600'}>{'Perfomance fee'}</p>
							<b className={'text-xl tabular-nums text-neutral-500'}>{`${format.amount((currentVault?.apy?.fees?.performance || 0) * 100, 0, 2)} %`}</b>
						</div>
					</div>
				</div>
				<div>
					<b className={'text-neutral-900'}>{'Historical apy'}</b>
					<div className={'mt-4 flex flex-row space-x-8 border-b border-l border-neutral-300'}>
						<ResponsiveContainer width={'100%'} height={160}>
							<LineChart
								margin={{top: 0, right: -28, bottom: 0, left: 0}}
								data={cumulativeData}>
								<Line
									className={'text-primary-600'}
									type={'monotone'}
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
									padding={{left: 0, right: 8}} 
									hide />
								<YAxis
									orientation={'right'}
									min={55000}
									padding={{top: 8}} 
									domain={['dataMin', 'auto']}
									tick={(e): ReactElement => {
										const {payload: {value}} = e;
										e.fill = '#5B5B5B';
										e.style = {fontSize: 12};
										e.alignmentBaseline = 'middle';
										const	formatedValue = format.amount(value / 100000, 2, 2);
										return <text {...e}>{formatedValue}</text>;
									}}
									tickFormatter={(value): string => format.amount(value / 100000, 2, 2)}
									hide={false} />
								<Tooltip
									content={(e): ReactElement => {
										const {active: isTooltipActive, payload, label} = e;
										if (!isTooltipActive || !payload) {
											return <></>;
										}
										const [{value}] = payload;
										return (
											<div className={'recharts-tooltip'}>
												<div className={'mb-4'}>
													<p className={'text-xs'}>{label}</p>
												</div>
												<div className={'flex flex-row items-center justify-between'}>
													<p className={'text-xs text-neutral-600'}>{'APY'}</p>
													<b className={'text-xs font-bold tabular-nums text-neutral-900'}>
														{`${format.amount(Number(value) / 100000, 2, 2)} %`}
													</b>
												</div>
												<div className={'flex flex-row items-center justify-between'}>
													<p className={'text-xs text-neutral-600'}>{'Average'}</p>
													<b className={'text-xs font-bold tabular-nums text-neutral-900'}>
														{`${format.amount((currentVault?.apy?.fees?.performance || 0) * 100, 0, 2)} %`}
													</b>
												</div>
											</div>
										);
									}} />
							</LineChart>
						</ResponsiveContainer>
					</div>
				</div>
			</div>
		</div>
	);
}

function	VaultDetailsStrategies({currentVault}: {currentVault: TYearnVault}): ReactElement {
	const	{yCRVHarvests} = useYearn();

	const	data = useMemo((): {name: string; value: number}[] => {
		return (
			(yCRVHarvests || []).reverse()?.map((harvest): {name: string; value: number} => ({
				name: format.date(Number(harvest.timestamp) * 1000),
				value: format.toNormalizedValue(format.BN(harvest.profit).sub(format.BN(harvest.loss)), 18)
			}))
		);
	}, [yCRVHarvests]);

	// Save in cumulativeData the sum of all previous values
	const	cumulativeData = useMemo((): {name: string; value: number}[] => {
		let	cumulativeValue = 0;
		return (
			data.map((item): {name: string; value: number} => {
				console.log(item.name);
				cumulativeValue += item.value;
				return ({
					name: item.name,
					value: cumulativeValue
				});
			})
		);
	}, [data]);


	return (
		<div className={'grid grid-cols-1 bg-neutral-100'}>
			<div className={'col-span-1 w-full'}>
				{(currentVault?.strategies || [])
					// .filter((strategy): boolean => (strategy?.details?.debtRatio || 0) > 0)
					.sort((a, b): number => (b?.details?.debtRatio || 0) - (a?.details?.debtRatio || 0))
					.map((strategy, index): ReactElement => (
						<details key={index} className={'p-0'}>
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
										<p className={'text-neutral-600'}>{`Harvested ${format.duration((strategy?.details?.lastReport * 1000) - new Date().valueOf(), true)}.`}</p>
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
											<p className={'text-neutral-600'}>{'Historical apy'}</p>
											<div className={'mt-4 flex flex-row space-x-8 border-b-2 border-l-2 border-neutral-300'}>
												<ResponsiveContainer width={'100%'} height={127}>
													<LineChart
														margin={{top: 0, right: -28, bottom: 0, left: 0}}
														data={cumulativeData}>
														<Line
															className={'text-primary-600'}
															type={'monotone'}
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
															padding={{left: 8, right: 8}} 
															hide />
														<YAxis
															orientation={'right'}
															min={55000}
															padding={{top: 8}}
															domain={['dataMin', 'auto']}
															tick={(e): ReactElement => {
																const {payload: {value}} = e;
																e.fill = '#5B5B5B';
																e.style = {fontSize: 12};
																e.alignmentBaseline = 'middle';
																const	formatedValue = format.amount(value / 100000, 2, 2);
																return <text {...e}>{formatedValue}</text>;
															}}
															strokeWidth={2}
															tickFormatter={(value): string => format.amount(value / 100000, 2, 2)}
															hide={false} />
														<Tooltip
															content={(e): ReactElement => {
																const {active: isTooltipActive, payload, label} = e;
																if (!isTooltipActive || !payload) {
																	return <></>;
																}
																const [{value}] = payload;
																return (
																	<div className={'recharts-tooltip'}>
																		<div className={'mb-4'}>
																			<p className={'text-xs'}>{label}</p>
																		</div>
																		<div className={'flex flex-row items-center justify-between'}>
																			<p className={'text-xs text-neutral-600'}>{'APY'}</p>
																			<b className={'text-xs font-bold tabular-nums text-neutral-900'}>
																				{`${format.amount(Number(value) / 100000, 2, 2)} %`}
																			</b>
																		</div>
																		<div className={'flex flex-row items-center justify-between'}>
																			<p className={'text-xs text-neutral-600'}>{'Average'}</p>
																			<b className={'text-xs font-bold tabular-nums text-neutral-900'}>
																				{`${format.amount((currentVault?.apy?.fees?.performance || 0) * 100, 0, 2)} %`}
																			</b>
																		</div>
																	</div>
																);
															}} />
													</LineChart>
												</ResponsiveContainer>
											</div>
										</div>
									</div>
								</div>
							</div>
						</details>	
					))}
			</div>
		</div>
	);
}

function	VaultDetailsWrapper({currentVault}: {currentVault: TYearnVault}): ReactElement {
	const	{provider, safeChainID} = useWeb3();
	const	{networks} = useSettings();
	const	[selectedAboutTabIndex, set_selectedAboutTabIndex] = useState(0);
	const	networkSettings = useMemo((): TSettingsForNetwork => networks[safeChainID], [networks, safeChainID]);

	async function onAddTokenToMetamask(address: string, symbol: string, decimals: number, image: string): Promise<void> {
		try {
			await (provider as any).send('wallet_watchAsset', {
				type: 'ERC20',
				options: {
					address,
					symbol,
					decimals,
					image
				}
			});
		} catch (error) {
			// Token has not been added to MetaMask.
		}
	}

	return (
		<div aria-label={'Vault Details'} className={'col-span-12 mb-4 flex flex-col bg-neutral-100'}>
			<div className={'relative flex w-full flex-row items-center justify-between px-8 pt-4'}>
				<nav className={'flex flex-row items-center space-x-10'}>
					<button onClick={(): void => set_selectedAboutTabIndex(0)}>
						<p
							title={'About'}
							aria-selected={selectedAboutTabIndex === 0}
							className={'hover-fix tab'}>
							{'About'}
						</p>
					</button>
					<button onClick={(): void => set_selectedAboutTabIndex(1)}>
						<p
							title={'Strategies'}
							aria-selected={selectedAboutTabIndex === 1}
							className={'hover-fix tab'}>
							{'Strategies'}
						</p>
					</button>
					<button onClick={(): void => set_selectedAboutTabIndex(2)}>
						<p
							title={'Historical rates'}
							aria-selected={selectedAboutTabIndex === 2}
							className={'hover-fix tab'}>
							{'Historical rates'}
						</p>
					</button>
					<button onClick={(): void => set_selectedAboutTabIndex(3)}>
						<p
							title={'Performance'}
							aria-selected={selectedAboutTabIndex === 3}
							className={'hover-fix tab'}>
							{'Performance'}
						</p>
					</button>
				</nav>

				<div className={'flex flex-row items-center justify-end space-x-4 pb-4'}>
					<button
						onClick={(): void => {
							onAddTokenToMetamask(
								currentVault.address,
								currentVault.symbol,
								currentVault.decimals,
								currentVault.icon
							);
						}
						}>
						<IconAddToMetamask className={'h-6 w-6 text-neutral-600 transition-colors hover:text-neutral-900'} />
					</button>
					<a
						href={networkSettings?.explorerBaseURI as string}
						target={'_blank'}
						rel={'noopener noreferrer'}>
						<IconLinkOut className={'h-6 w-6 cursor-alias text-neutral-600 transition-colors hover:text-neutral-900'} />
					</a>
				</div>
			</div>

			<div className={'-mt-0.5 h-0.5 w-full bg-neutral-300'} />

			{currentVault && selectedAboutTabIndex === 0 ? <VaultDetailsAbout currentVault={currentVault} /> : null}
			{currentVault && selectedAboutTabIndex === 1 ? <VaultDetailsStrategies currentVault={currentVault} /> : null}

		</div>
	);
}

export default VaultDetailsWrapper;
