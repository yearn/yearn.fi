import React, {ReactElement, useMemo, useState} from 'react';
import useSWR from 'swr';
import {useSettings, useWeb3} from '@yearn-finance/web-lib/contexts';
import IconAddToMetamask from '@yearn-finance/web-lib/icons/IconAddToMetamask';
import IconLinkOut from '@yearn-finance/web-lib/icons/IconLinkOut';
import {format} from '@yearn-finance/web-lib/utils';
import {Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {baseFetcher} from 'utils';

import {VaultDetailsStrategies} from './details/StrategyDetails';

import type {TSettingsForNetwork, TYDaemonHarvests, TYearnVault} from 'types/yearn';

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

function	VaultDetailsTabsWrapper({currentVault}: {currentVault: TYearnVault}): ReactElement {
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

export {VaultDetailsTabsWrapper};
