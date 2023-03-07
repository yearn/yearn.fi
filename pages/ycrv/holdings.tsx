import React, {Fragment, useCallback, useMemo} from 'react';
import {ethers} from 'ethers';
import {LPYCRV_TOKEN_ADDRESS, STYCRV_TOKEN_ADDRESS, YCRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount, formatPercent} from '@yearn-finance/web-lib/utils/format.number';
import {formatCounterValue, formatCounterValueRaw} from '@yearn-finance/web-lib/utils/format.value';
import ValueAnimation from '@common/components/ValueAnimation';
import {useCurve} from '@common/contexts/useCurve';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';
import {useBalance} from '@common/hooks/useBalance';
import {useClientOnlyFn} from '@common/hooks/useClientOnlyFn';
import {useTokenPrice} from '@common/hooks/useTokenPrice';
import {getVaultAPY} from '@common/utils';
import {Harvests} from '@yCRV/components/Harvests';
import {useYCRV} from '@yCRV/contexts/useYCRV';
import Wrapper from '@yCRV/Wrapper';

import type {BigNumber} from 'ethers';
import type {NextRouter} from 'next/router';
import type {ReactElement, ReactNode} from 'react';

function	HeaderPosition(): ReactElement {
	const {holdings} = useYCRV();
	const balanceOfStyCRV = useBalance(STYCRV_TOKEN_ADDRESS);
	const balanceOfLpyCRV = useBalance(LPYCRV_TOKEN_ADDRESS);
	const stycrvPrice = useTokenPrice(STYCRV_TOKEN_ADDRESS);
	const lpycrvPrice = useTokenPrice(LPYCRV_TOKEN_ADDRESS);
	
	const clientOnlyFormatAmount = useClientOnlyFn({fn: formatAmount, placeholder: '0,00'});
	const clientOnlyFormatCounterValueRaw = useClientOnlyFn({fn: formatCounterValueRaw, placeholder: '0,00'});

	const	formatedYearnHas = useMemo((): ReactNode => (
		holdings?.veCRVBalance ?
			clientOnlyFormatAmount(formatToNormalizedValue(holdings.veCRVBalance, 18), 0, 0)
			: ''
	), [clientOnlyFormatAmount, holdings?.veCRVBalance]);

	const	formatedYouHave = useMemo((): ReactNode => (
		clientOnlyFormatCounterValueRaw(
			(balanceOfStyCRV.normalized * stycrvPrice)
			+
			(balanceOfLpyCRV.normalized * lpycrvPrice),
			1
		)
	), [clientOnlyFormatCounterValueRaw, balanceOfStyCRV.normalized, stycrvPrice, balanceOfLpyCRV.normalized, lpycrvPrice]);

	return (
		<Fragment>
			<div className={'col-span-12 w-full md:col-span-8'}>
				<p className={'pb-2 text-lg text-neutral-900 md:pb-6 md:text-3xl'}>{'Yearn has'}</p>
				<b className={'font-number text-4xl text-neutral-900 md:text-7xl'}>
					<ValueAnimation
						identifier={'veCRVTreasury'}
						value={formatedYearnHas?.toString()}
						suffix={'veCRV'}
						defaultValue={'0,00'}
					/>
				</b>
			</div>
			<div className={'col-span-12 w-full md:col-span-4'}>
				<p className={'pb-2 text-lg text-neutral-900 md:pb-6 md:text-3xl'}>{'You have'}</p>
				<b className={'font-number text-3xl text-neutral-900 md:text-7xl'}>
					<ValueAnimation
						identifier={'youHave'}
						value={formatedYouHave?.toString()}
						prefix={'$'}
						defaultValue={'0,00'}
					/>
				</b>
			</div>
		</Fragment>
	);
}

function	Holdings(): ReactElement {
	const {balances} = useWallet();
	const {holdings, styCRVMegaBoost, styCRVAPY} = useYCRV();
	const {vaults} = useYearn();
	const {curveWeeklyFees, cgPrices} = useCurve();

	const lpCRVAPY = useMemo((): string => getVaultAPY(vaults, LPYCRV_TOKEN_ADDRESS), [vaults]);
	const ycrvPrice = useTokenPrice(YCRV_TOKEN_ADDRESS);
	const stycrvPrice = useTokenPrice(STYCRV_TOKEN_ADDRESS);
	const lpycrvPrice = useTokenPrice(LPYCRV_TOKEN_ADDRESS);
	const balanceOfStyCRV = useBalance(STYCRV_TOKEN_ADDRESS);
	const balanceOfLpyCRV = useBalance(LPYCRV_TOKEN_ADDRESS);
	
	const clientOnlyFormatAmount = useClientOnlyFn({fn: formatAmount, placeholder: '0,00'});
	const clientOnlyFormatPercent = useClientOnlyFn({fn: formatPercent, placeholder: '0,00'});
	const clientOnlyFormatCounterValue = useClientOnlyFn({fn: formatCounterValue, placeholder: '0,00'});

	const	formatBigNumberOver10K = useCallback((v: BigNumber): string => {
		if (formatBN(v)?.gt(ethers.constants.WeiPerEther.mul(10000))) {
			return clientOnlyFormatAmount(formatToNormalizedValue(v || 0, 18), 0, 0)?.toString() ?? '';
		}
		return clientOnlyFormatAmount(formatToNormalizedValue(v || 0, 18))?.toString() ?? '';
	}, [clientOnlyFormatAmount]);

	const	formatNumberOver10K = useCallback((v: number): string => {
		if (v >= 10000) {
			return clientOnlyFormatAmount(v, 0, 0)?.toString() ?? '';
		}
		return clientOnlyFormatAmount(v)?.toString() ?? '';
	}, [clientOnlyFormatAmount]);

	const	latestCurveFeesValue = useMemo((): number => {
		if (curveWeeklyFees?.weeklyFeesTable?.[0]?.rawFees > 0) {
			return curveWeeklyFees.weeklyFeesTable[0].rawFees;
		}
		return curveWeeklyFees?.weeklyFeesTable?.[1]?.rawFees || 0;

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

			<HeaderPosition />

			<div className={'col-span-12 flex w-full flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4'}>
				<div className={'w-full bg-neutral-100 p-6 md:w-[412px] md:min-w-[412px]'}>
					<div className={'grid w-full gap-6 md:col-span-5'}>
						<div>
							<b
								className={'font-number pb-2 text-3xl text-neutral-900'}>
								{holdings?.treasury ? `${formatBigNumberOver10K(holdings?.treasury || 0)} ` : '- '}
								<span className={'font-number text-base text-neutral-600 md:text-3xl md:text-neutral-900'}>{'veCRV'}</span>
							</b>
							<p className={'text-lg text-neutral-500'}>{'Yearn Treasury'}</p>
						</div>
						<div>
							<b
								className={'font-number pb-2 text-3xl text-neutral-900'}>
								{holdings?.legacy ? `${formatBigNumberOver10K(holdings?.legacy || 0)} ` : '- '}
								<span className={'font-number text-base text-neutral-600 md:text-3xl md:text-neutral-900'}>{'yveCRV'}</span>
							</b>
							<p className={'text-lg text-neutral-500'}>{'Legacy system'}</p>
						</div>
						<div>
							<b
								className={'font-number pb-2 text-3xl text-neutral-900'}>
								{holdings?.yCRVSupply ? `${formatBigNumberOver10K(holdings?.yCRVSupply || 0)} ` : '- '}
								<span className={'font-number text-base text-neutral-600 md:text-3xl md:text-neutral-900'}>{'yCRV'}</span>
							</b>

							<p
								className={'text-lg text-neutral-500'}>
								{`(Price = $${(clientOnlyFormatAmount(ycrvPrice || 0))} | Peg = ${(
									holdings?.crvYCRVPeg ? (clientOnlyFormatPercent(
										(formatToNormalizedValue(holdings?.crvYCRVPeg, 18) + 0.0015) * 100)
									): clientOnlyFormatPercent(0)
								)})`}
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
								className={'font-number text-base text-neutral-900'}>
								{styCRVAPY ? `${clientOnlyFormatPercent(styCRVAPY)}*` : `${clientOnlyFormatPercent(0)}`}
							</b>
						</div>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'Total Assets: '}</span>
							<p
								className={'font-number text-base text-neutral-900'}>
								{holdings?.styCRVSupply ? clientOnlyFormatCounterValue(
									formatToNormalizedValue(holdings.styCRVSupply, 18),
									stycrvPrice
								) : clientOnlyFormatAmount(0)}
							</p>
						</div>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'yCRV Deposits: '}</span>
							<p
								className={'font-number text-base text-neutral-900'}>
								{formatBigNumberOver10K(holdings?.styCRVSupply || 0)}
							</p>
						</div>
						<div className={'flex flex-row items-baseline justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'My Balance: '}</span>
							<div>
								<p
									className={'font-number text-base text-neutral-900'}>
									{formatNumberOver10K(balances[STYCRV_TOKEN_ADDRESS]?.normalized || 0)}
								</p>
								<p
									className={'font-number text-xs text-neutral-600'}>
									{clientOnlyFormatCounterValue(balanceOfStyCRV.normalized, stycrvPrice)}
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
								className={'font-number text-base text-neutral-900'}>
								{lpCRVAPY ? `${(lpCRVAPY || '').replace('APY', '')}` : `${clientOnlyFormatPercent(0)}`}
							</b>
						</div>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'Total Assets: '}</span>
							<p
								className={'font-number text-base text-neutral-900'}>
								{holdings?.lpyCRVSupply ? clientOnlyFormatCounterValue(
									formatToNormalizedValue(holdings?.lpyCRVSupply, 18),
									lpycrvPrice
								) : clientOnlyFormatAmount(0)}
							</p>
						</div>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'yCRV Deposits: '}</span>
							<p
								className={'font-number text-base text-neutral-900'}>
								{formatBigNumberOver10K(holdings?.lpyCRVSupply || 0)}
							</p>
						</div>
						<div className={'flex flex-row items-baseline justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'My Balance: '}</span>
							<div>
								<p
									className={'font-number text-base text-neutral-900'}>
									{formatNumberOver10K(balances[LPYCRV_TOKEN_ADDRESS]?.normalized || 0)}
								</p>
								<p
									className={'font-number text-xs text-neutral-600'}>
									{clientOnlyFormatCounterValue(
										balanceOfLpyCRV?.normalized,
										lpycrvPrice
									)}
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
							<b className={'font-number text-base text-neutral-900'}>
								{'N/A'}
							</b>
						</div>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'Total Assets: '}</span>
							<p className={'font-number text-base text-neutral-900'}>
								{'N/A'}
							</p>
						</div>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'yCRV Deposits: '}</span>
							<p className={'font-number text-base text-neutral-900'}>
								{'N/A'}
							</p>
						</div>
						<div className={'flex flex-row items-baseline justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'My Balance: '}</span>
							<div>
								<p className={'font-number text-base text-neutral-900'}>
									{'N/A'}
								</p>
								<p className={'font-number text-xs text-neutral-600'}>
									{'N/A'}
								</p>
							</div>
						</div>
					</div>

					<div>
						<p
							className={'font-number text-sm text-neutral-400 md:text-base'}>
							{styCRVAPY ? `*${clientOnlyFormatPercent(styCRVAPY)} APY: ` : `*${clientOnlyFormatPercent(0)} APY: `}
						</p>
						<p
							className={'font-number text-sm text-neutral-400 md:text-base'}>
							{`∙ ${curveAdminFeePercent ? clientOnlyFormatPercent(curveAdminFeePercent) : clientOnlyFormatPercent(0)} Curve Admin Fees (${clientOnlyFormatAmount(Number(holdings?.boostMultiplier) / 10000)}x boost)`}
						</p>
						<p
							className={'font-number text-sm text-neutral-400 md:text-base'}>
							{`∙ ${styCRVAPY && curveAdminFeePercent && styCRVMegaBoost ? clientOnlyFormatAmount(styCRVAPY - (curveAdminFeePercent + (styCRVMegaBoost * 100)), 2, 2) : '0.00'}% Gauge Voting Bribes`}
						</p>
						<p
							className={'font-number text-sm text-neutral-400 md:text-base'}>
							{`∙ ${styCRVMegaBoost ? clientOnlyFormatPercent(styCRVMegaBoost * 100) : clientOnlyFormatPercent(0)} Mega Boost`}
						</p>
					</div>
				</div>
			</div>

			<Harvests />

		</section>
	);
}

Holdings.getLayout = function getLayout(page: ReactElement, router: NextRouter): ReactElement {
	return <Wrapper router={router}>{page}</Wrapper>;
};


export default Holdings;
