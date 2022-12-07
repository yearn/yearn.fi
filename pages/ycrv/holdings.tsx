import React, {useCallback, useMemo} from 'react';
import {ethers} from 'ethers';
import {LPYCRV_TOKEN_ADDRESS, STYCRV_TOKEN_ADDRESS, YCRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {formatCounterValue, formatCounterValueRaw} from '@yearn-finance/web-lib/utils/format.value';
import ValueAnimation from '@common/components/ValueAnimation';
import {useCurve} from '@common/contexts/useCurve';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';
import {getVaultAPY} from '@common/utils';
import {Harvests} from '@yCRV/components/Harvests';
import {useYCRV} from '@yCRV/contexts/useYCRV';
import Wrapper from '@yCRV/Wrapper';

import type {BigNumber} from 'ethers';
import type {ReactElement} from 'react';

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
