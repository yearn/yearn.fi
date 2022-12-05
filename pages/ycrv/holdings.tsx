import React, {useCallback, useMemo, useState} from 'react';
import Image from 'next/image';
import {ethers} from 'ethers';
import {Button} from '@yearn-finance/web-lib/components';
import IconLinkOut from '@yearn-finance/web-lib/icons/IconLinkOut';
import {toAddress, truncateHex} from '@yearn-finance/web-lib/utils/address';
import {LPYCRV_TOKEN_ADDRESS, STYCRV_TOKEN_ADDRESS, YCRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {formatDate} from '@yearn-finance/web-lib/utils/format.time';
import {formatCounterValue, formatCounterValueRaw} from '@yearn-finance/web-lib/utils/format.value';
import ValueAnimation from '@common/components/ValueAnimation';
import {useCurve} from '@common/contexts/useCurve';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';
import {getVaultAPY} from '@common/utils';
import {useYCRV} from '@yCRV/contexts/useYCRV';
import Wrapper from '@yCRV/Wrapper';

import type {BigNumber} from 'ethers';
import type {ReactElement} from 'react';
import type {TYDaemonHarvests} from '@common/types/yearn';

function	Harvests(): ReactElement {
	const	{harvests} = useYCRV();
	const	[category, set_category] = useState('all');

	const	filteredHarvests = useMemo((): TYDaemonHarvests[] => {
		const	_harvests = [...(harvests || [])];
		if (category === 'st-yCRV') {
			return _harvests.filter((harvest): boolean => toAddress(harvest.vaultAddress) === STYCRV_TOKEN_ADDRESS);
		}
		if (category === 'lp-yCRV') {
			return _harvests.filter((harvest): boolean => toAddress(harvest.vaultAddress) === LPYCRV_TOKEN_ADDRESS);
		}
		return _harvests;
	}, [category, harvests]);

	return (
		<div className={'col-span-12 flex w-full flex-col bg-neutral-100'}>
			<div className={'flex flex-row items-center justify-between space-x-6 px-4 pt-4 pb-2 md:space-x-0 md:px-10 md:pt-10 md:pb-8'}>
				<div className={'w-1/2 md:w-auto'}>
					<h2 className={'text-lg font-bold md:text-3xl'}>{'Harvests'}</h2>
				</div>
				<div className={'hidden flex-row space-x-4 md:flex'}>
					<Button
						onClick={(): void => set_category('all')}
						variant={category === 'all' ? 'filled' : 'outlined'}
						className={'yearn--button-smaller'}>
						{'All'}
					</Button>
					<Button
						onClick={(): void => set_category('st-yCRV')}
						variant={category === 'st-yCRV' ? 'filled' : 'outlined'}
						className={'yearn--button-smaller'}>
						{'st-yCRV'}
					</Button>
					<Button
						onClick={(): void => set_category('lp-yCRV')}
						variant={category === 'lp-yCRV' ? 'filled' : 'outlined'}
						className={'yearn--button-smaller'}>
						{'lp-yCRV'}
					</Button>
				</div>
			</div>
			<div className={'grid w-full grid-cols-1'}>
				<div className={'mb-6 hidden w-full grid-cols-5 px-6 md:grid'}>
					<p className={'text-base text-neutral-400'}>{'Product'}</p>
					<p className={'text-base text-neutral-400'}>{'Gain'}</p>
					<p className={'text-base text-neutral-400'}>{'Value'}</p>
					<p className={'text-base text-neutral-400'}>{'Date'}</p>
					<p className={'text-base text-neutral-400'}>{'Transaction'}</p>
				</div>
				{(filteredHarvests || [])?.map((harvest: TYDaemonHarvests): ReactElement => {
					return (
						<div
							key={`${harvest.vaultAddress}_${harvest.timestamp}`}
							className={'grid w-full cursor-pointer grid-cols-1 border-t border-neutral-200 py-4 px-6 transition-colors hover:bg-neutral-200/30 md:grid-cols-5 md:border-none'}>
							<div className={'mb-2 flex flex-row items-center justify-between md:mb-0'}>
								<div className={'flex flex-row items-center space-x-0 md:space-x-4'}>
									<div className={'hidden h-8 w-8 rounded-full bg-neutral-200 md:flex md:h-9 md:w-9'}>
										<Image
											alt={toAddress(harvest.vaultAddress) === STYCRV_TOKEN_ADDRESS ? 'st-yCRV' : 'lp-yCRV'}
											width={36}
											height={36}
											quality={90}
											src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${toAddress(harvest.vaultAddress)}/logo-128.png`}
											loading={'eager'} />
									</div>
									<b>
										{toAddress(harvest.vaultAddress) === STYCRV_TOKEN_ADDRESS ? 'st-yCRV' : 'lp-yCRV'}
									</b>
								</div>
								<div className={'flex md:hidden'}>
									<p className={'text-sm tabular-nums text-neutral-400 md:text-base md:text-neutral-900'}>
										{formatDate(Number(harvest.timestamp) * 1000)}
									</p>
								</div>
							</div>
							<div className={'flex h-9 flex-row items-center justify-between'}>
								<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'Gain: '}</span>
								<p className={'text-base tabular-nums text-neutral-900'}>
									{formatAmount(formatToNormalizedValue(formatBN(harvest.profit).sub(formatBN(harvest.loss)), 18), 2, 2)}
								</p>
							</div>

							<div className={'flex h-9 flex-row items-center justify-between'}>
								<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'Value: '}</span>
								<p className={'text-base tabular-nums text-neutral-900'}>
									{`$ ${formatAmount(Number(harvest.profitValue) - Number(harvest.lossValue), 2, 2)}`}
								</p>
							</div>

							<div className={'hidden h-9 items-center md:flex'}>
								<p className={'text-base tabular-nums text-neutral-900'}>
									{formatDate(Number(harvest.timestamp) * 1000)}
								</p>
							</div>

							<div className={'flex h-9 flex-row items-center justify-between'}>
								<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'Hash: '}</span>
								<a
									href={`https://etherscan.io/tx/${harvest.txHash}`}
									target={'_blank'}
									rel={'noreferrer'}>
									<div
										className={'flex flex-row items-center space-x-2 font-mono text-sm tabular-nums text-neutral-900'}
										style={{lineHeight: '24px'}}>
										{truncateHex(harvest.txHash, 6)}
										<IconLinkOut className={'ml-2 h-4 w-4 md:ml-4'} />
									</div>
								</a>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function	Holdings(): ReactElement {
	const	{balances} = useWallet();
	const	{holdings, styCRVMegaBoost, styCRVAPY} = useYCRV();
	const	{vaults, prices} = useYearn();
	const	{curveWeeklyFees, cgPrices} = useCurve();

	const	lpCRVAPY = useMemo((): string => getVaultAPY(vaults, LPYCRV_TOKEN_ADDRESS), [vaults]);

	const	ycrvPrice = useMemo((): number => (
		formatToNormalizedValue(
			formatBN(prices?.[YCRV_TOKEN_ADDRESS] || 0),
			6
		)
	), [prices]);

	const	formatBigNumberOver10K = useCallback((v: BigNumber): string => {
		if (v.gt(ethers.constants.WeiPerEther.mul(10000))) {
			return formatAmount(formatToNormalizedValue(v || 0, 18), 0, 0);
		}
		return formatAmount(formatToNormalizedValue(v || 0, 18), 2, 2);
	}, []);

	const	formatNumberOver10K = useCallback((v: number): string => {
		if (v >= 10000) {
			return formatAmount(v, 0, 0);
		}
		return formatAmount(v, 2, 2);
	}, []);

	const	formatedYearnHas = useMemo((): string => (
		holdings?.veCRVBalance ?
			formatAmount(formatToNormalizedValue(holdings.veCRVBalance, 18), 0, 0)
			: ''
	), [holdings]);

	const	formatedYouHave = useMemo((): string => (
		formatCounterValueRaw(
			(Number(balances[STYCRV_TOKEN_ADDRESS]?.normalized) || 0) * (vaults?.[STYCRV_TOKEN_ADDRESS]?.tvl?.price || 0)
			+
			(Number(balances[LPYCRV_TOKEN_ADDRESS]?.normalized) || 0) * (vaults?.[LPYCRV_TOKEN_ADDRESS]?.tvl?.price || 0),
			1
		)
	), [balances, vaults]);

	const	latestCurveFeesValue = useMemo((): number => {
		if (curveWeeklyFees?.weeklyFeesTable?.[0]?.rawFees > 0) {
			return curveWeeklyFees.weeklyFeesTable[0].rawFees;
		} else {
			return curveWeeklyFees?.weeklyFeesTable?.[1]?.rawFees || 0;
		}
	}, [curveWeeklyFees]);

	const	currentVeCRVAPY = useMemo((): number => {
		return (
			latestCurveFeesValue / (
				formatToNormalizedValue(formatBN(holdings?.veCRVTotalSupply), 18) * cgPrices?.['curve-dao-token']?.usd
			) * 52 * 100
		);
	}, [holdings, latestCurveFeesValue, cgPrices]);

	const	curveAdminFeePercent = useMemo((): number => {
		return (currentVeCRVAPY * Number(holdings?.boostMultiplier) / 10000);
	}, [holdings, currentVeCRVAPY]);

	return (
		<section className={'mt-4 grid w-full grid-cols-12 gap-y-10 pb-10 md:mt-20 md:gap-x-10 md:gap-y-20'}>

			<div className={'col-span-12 w-full md:col-span-8'}>
				<p className={'pb-2 text-lg text-neutral-900 md:pb-6 md:text-3xl'}>{'Yearn has'}</p>
				<b className={'text-4xl tabular-nums text-neutral-900 md:text-7xl'}>
					<ValueAnimation
						identifier={'veCRVTreasury'}
						value={formatedYearnHas}
						suffix={'veCRV'} />
				</b>
			</div>
			<div className={'col-span-12 w-full md:col-span-4'}>
				<p className={'pb-2 text-lg text-neutral-900 md:pb-6 md:text-3xl'}>{'You have'}</p>
				<b className={'text-3xl tabular-nums text-neutral-900 md:text-7xl'}>
					<ValueAnimation
						identifier={'youHave'}
						value={formatedYouHave ? formatedYouHave : ''}
						prefix={'$'} />
				</b>
			</div>

			<div className={'col-span-12 flex w-full flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4'}>
				<div className={'w-full bg-neutral-100 p-6 md:w-[412px] md:min-w-[412px]'}>
					<div className={'grid w-full gap-6 md:col-span-5'}>
						<div>
							<b
								suppressHydrationWarning
								className={'pb-2 text-3xl tabular-nums text-neutral-900'}>
								{holdings?.treasury ? `${formatBigNumberOver10K(holdings?.treasury || 0)} ` : '- '}
								<span className={'text-base tabular-nums text-neutral-600 md:text-3xl md:text-neutral-900'}>{'veCRV'}</span>
							</b>
							<p className={'text-lg text-neutral-500'}>{'Yearn Treasury'}</p>
						</div>
						<div>
							<b
								suppressHydrationWarning
								className={'pb-2 text-3xl tabular-nums text-neutral-900'}>
								{holdings?.legacy ? `${formatBigNumberOver10K(holdings?.legacy || 0)} ` : '- '}
								<span className={'text-base tabular-nums text-neutral-600 md:text-3xl md:text-neutral-900'}>{'yveCRV'}</span>
							</b>
							<p className={'text-lg text-neutral-500'}>{'Legacy system'}</p>
						</div>
						<div>
							<b
								suppressHydrationWarning
								className={'pb-2 text-3xl tabular-nums text-neutral-900'}>
								{holdings?.yCRVSupply ? `${formatBigNumberOver10K(holdings?.yCRVSupply || 0)} ` : '- '}
								<span className={'text-base tabular-nums text-neutral-600 md:text-3xl md:text-neutral-900'}>{'yCRV'}</span>
							</b>

							<p
								suppressHydrationWarning
								className={'text-lg text-neutral-500'}>
								{`(Price = $${(
									ycrvPrice ? formatAmount(ycrvPrice, 2, 2) : '0.00'
								)} | Peg = ${(
									holdings?.crvYCRVPeg ? (
										formatAmount(
											(formatToNormalizedValue(holdings?.crvYCRVPeg || ethers.constants.Zero, 18) + 0.0015) * 100, 2, 2)
									): '0.0000'
								)}%)`}
							</p>
						</div>
					</div>
				</div> 

				<div className={'grid w-full bg-neutral-100 p-6'}>
					<div className={'mb-6 hidden w-full grid-cols-5 md:grid'}>
						<p className={'text-base text-neutral-400'}>{'Product'}</p>
						<p className={'text-base text-neutral-400'}>{'APY'}</p>
						<p className={'text-base text-neutral-400'}>{'Total Assets'}</p>
						<p className={'text-base text-neutral-400'}>{'yCRV Deposits'}</p>
						<p className={'text-base text-neutral-400'}>{'My Balance'}</p>
					</div>

					<div className={'mb-8 grid w-full grid-cols-1 md:grid-cols-5'}>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'Product: '}</span>
							<p className={'text-base text-neutral-900'}>
								{'st-yCRV'}
							</p>
						</div>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'mr-auto inline font-normal text-neutral-400 md:hidden'}>{'APY: '}</span>
							<b
								suppressHydrationWarning
								className={'text-base tabular-nums text-neutral-900'}>
								{styCRVAPY ? `${formatAmount(styCRVAPY, 2, 2)}%*` : '0.00%'}
							</b>
						</div>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'Total Assets: '}</span>
							<p
								suppressHydrationWarning
								className={'text-base tabular-nums text-neutral-900'}>
								{holdings?.styCRVSupply ? formatCounterValue(
									formatToNormalizedValue(holdings.styCRVSupply || ethers.constants.Zero, 18),
									vaults?.[STYCRV_TOKEN_ADDRESS]?.tvl?.price || 0
								) : '0.00'}
							</p>
						</div>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'yCRV Deposits: '}</span>
							<p
								suppressHydrationWarning
								className={'text-base tabular-nums text-neutral-900'}>
								{holdings?.styCRVSupply ? `${formatBigNumberOver10K(holdings?.styCRVSupply || 0)} ` : '0.00'}
							</p>
						</div>
						<div className={'flex flex-row items-baseline justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'My Balance: '}</span>
							<div>
								<p
									suppressHydrationWarning
									className={'text-base tabular-nums text-neutral-900'}>
									{balances[STYCRV_TOKEN_ADDRESS]?.normalized ? (
										formatNumberOver10K(balances[STYCRV_TOKEN_ADDRESS]?.normalized || 0)
									) : '0.00'}
								</p>
								<p
									suppressHydrationWarning
									className={'text-xs tabular-nums text-neutral-600'}>
									{balances[STYCRV_TOKEN_ADDRESS] ? formatCounterValue(
										balances[STYCRV_TOKEN_ADDRESS]?.normalized,
										vaults?.[STYCRV_TOKEN_ADDRESS]?.tvl?.price || 0
									) : '0.00'}
								</p>
							</div>
						</div>
					</div>

					<div className={'mb-8 grid w-full grid-cols-1 md:grid-cols-5'}>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'Product: '}</span>
							<p className={'text-base text-neutral-900'}>
								{'lp-yCRV'}
							</p>
						</div>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'mr-auto inline font-normal text-neutral-400 md:hidden'}>{'APY: '}</span>
							<b
								suppressHydrationWarning
								className={'text-base tabular-nums text-neutral-900'}>
								{lpCRVAPY ? `${(lpCRVAPY || '').replace('APY', '')}` : '0.00%'}
							</b>
						</div>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'Total Assets: '}</span>
							<p
								suppressHydrationWarning
								className={'text-base tabular-nums text-neutral-900'}>
								{holdings?.lpyCRVSupply ? formatCounterValue(
									formatToNormalizedValue(holdings?.lpyCRVSupply || ethers.constants.Zero, 18),
									vaults?.[LPYCRV_TOKEN_ADDRESS]?.tvl?.price || 0
								) : '0.00'}
							</p>
						</div>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'yCRV Deposits: '}</span>
							<p
								suppressHydrationWarning
								className={'text-base tabular-nums text-neutral-900'}>
								{holdings?.lpyCRVSupply ? `${formatBigNumberOver10K(holdings?.lpyCRVSupply || 0)} ` : '0.00'}
							</p>
						</div>
						<div className={'flex flex-row items-baseline justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'My Balance: '}</span>
							<div>
								<p
									suppressHydrationWarning
									className={'text-base tabular-nums text-neutral-900'}>
									{balances[LPYCRV_TOKEN_ADDRESS]?.normalized ? (
										formatNumberOver10K(balances[LPYCRV_TOKEN_ADDRESS]?.normalized || 0)
									) : '0.00'}
								</p>
								<p
									suppressHydrationWarning
									className={'text-xs tabular-nums text-neutral-600'}>
									{balances[LPYCRV_TOKEN_ADDRESS] ? formatCounterValue(
										balances[LPYCRV_TOKEN_ADDRESS]?.normalized,
										vaults?.[LPYCRV_TOKEN_ADDRESS]?.tvl?.price || 0
									) : '0.00'}
								</p>
							</div>
						</div>
					</div>

					<div className={'mb-8 grid w-full grid-cols-1 md:grid-cols-5'}>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'Product: '}</span>
							<p className={'text-base text-neutral-900'}>
								{'vl-yCRV'}
							</p>
						</div>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'mr-auto inline font-normal text-neutral-400 md:hidden'}>{'APY: '}</span>
							<b className={'text-base tabular-nums text-neutral-900'}>
								{'N/A'}
							</b>
						</div>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'Total Assets: '}</span>
							<p className={'text-base tabular-nums text-neutral-900'}>
								{'N/A'}
							</p>
						</div>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'yCRV Deposits: '}</span>
							<p className={'text-base tabular-nums text-neutral-900'}>
								{'N/A'}
							</p>
						</div>
						<div className={'flex flex-row items-baseline justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'My Balance: '}</span>
							<div>
								<p className={'text-base tabular-nums text-neutral-900'}>
									{'N/A'}
								</p>
								<p className={'text-xs tabular-nums text-neutral-600'}>
									{'N/A'}
								</p>
							</div>
						</div>
					</div>

					<div>
						<p
							suppressHydrationWarning
							className={'text-sm tabular-nums text-neutral-400 md:text-base'}>
							{styCRVAPY ? `*${formatAmount(styCRVAPY, 2, 2)}% APY: ` : '*0.00% APY: '}
						</p>
						<p
							suppressHydrationWarning
							className={'text-sm tabular-nums text-neutral-400 md:text-base'}>
							{`∙ ${curveAdminFeePercent ? formatAmount(curveAdminFeePercent, 2, 2) : '0.00'}% Curve Admin Fees (${formatAmount(Number(holdings?.boostMultiplier) / 10000, 2, 2)}x boost)`}
						</p>
						<p
							suppressHydrationWarning
							className={'text-sm tabular-nums text-neutral-400 md:text-base'}>
							{`∙ ${styCRVAPY && curveAdminFeePercent ? formatAmount(styCRVAPY - curveAdminFeePercent, 2, 2) : '0.00'}% Gauge Voting Bribes`}
						</p>
						<p
							suppressHydrationWarning
							className={'text-sm tabular-nums text-neutral-400 md:text-base'}>
							{`∙ ${styCRVMegaBoost ? formatAmount(styCRVMegaBoost * 100, 2, 2) : '0.00'}% Mega Boost`}
						</p>
					</div>
				</div>
			</div>

			<Harvests />

		</section>
	);
}

Holdings.getLayout = function getLayout(page: ReactElement): ReactElement {
	return <Wrapper>{page}</Wrapper>;
};


export default Holdings;
