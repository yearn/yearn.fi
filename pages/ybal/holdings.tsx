import React, {Fragment, useCallback, useMemo} from 'react';
import {ethers} from 'ethers';
import {LPYBAL_TOKEN_ADDRESS, STYBAL_TOKEN_ADDRESS, YBAL_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount, formatPercent} from '@yearn-finance/web-lib/utils/format.number';
import {formatCounterValue, formatCounterValueRaw} from '@yearn-finance/web-lib/utils/format.value';
import ValueAnimation from '@common/components/ValueAnimation';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';
import {useBalance} from '@common/hooks/useBalance';
import {useTokenPrice} from '@common/hooks/useTokenPrice';
import {getVaultAPY} from '@common/utils';
import {Harvests} from '@yBal/components/Harvests';
import {useYBal} from '@yBal/contexts/useYBal';
import Wrapper from '@yBal/Wrapper';

import type {BigNumber} from 'ethers';
import type {NextRouter} from 'next/router';
import type {ReactElement, ReactNode} from 'react';

function	HeaderPosition(): ReactElement {
	const balanceOfStyBal = useBalance(STYBAL_TOKEN_ADDRESS);
	const balanceOfLpyBal = useBalance(LPYBAL_TOKEN_ADDRESS);
	const styBalPrice = useTokenPrice(STYBAL_TOKEN_ADDRESS);
	const lpyBalPrice = useTokenPrice(LPYBAL_TOKEN_ADDRESS);

	const	formatedYouHave = useMemo((): ReactNode => (
		formatCounterValueRaw(
			(balanceOfStyBal.normalized * styBalPrice)
			+
			(balanceOfLpyBal.normalized * lpyBalPrice),
			1
		)
	), [balanceOfStyBal.normalized, styBalPrice, balanceOfLpyBal.normalized, lpyBalPrice]);

	return (
		<Fragment>
			<div className={'col-span-12 w-full md:col-span-8'}>
				<p className={'pb-2 text-lg text-neutral-900 md:pb-6 md:text-3xl'}>{'Yearn has'}</p>
				<b className={'font-number text-4xl text-neutral-900 md:text-7xl'}>
					<ValueAnimation
						identifier={'veBalTreasury'}
						value={'TODO'}
						suffix={'veBal'}
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
	const {holdings, styBalMegaBoost, styBalAPY} = useYBal();
	const {vaults} = useYearn();

	const lpBalAPY = useMemo((): string => getVaultAPY(vaults, LPYBAL_TOKEN_ADDRESS), [vaults]);
	const yBalPrice = useTokenPrice(YBAL_TOKEN_ADDRESS);
	const styBalPrice = useTokenPrice(STYBAL_TOKEN_ADDRESS);
	const lpyBalPrice = useTokenPrice(LPYBAL_TOKEN_ADDRESS);
	const balanceOfStyBal = useBalance(STYBAL_TOKEN_ADDRESS);
	const balanceOfLpyBal = useBalance(LPYBAL_TOKEN_ADDRESS);

	const	formatBigNumberOver10K = useCallback((v: BigNumber): string => {
		if (formatBN(v)?.gt(ethers.constants.WeiPerEther.mul(10000))) {
			return formatAmount(formatToNormalizedValue(v || 0, 18), 0, 0)?.toString() ?? '';
		}
		return formatAmount(formatToNormalizedValue(v || 0, 18))?.toString() ?? '';
	}, []);

	const	formatNumberOver10K = useCallback((v: number): string => {
		if (v >= 10000) {
			return formatAmount(v, 0, 0)?.toString() ?? '';
		}
		return formatAmount(v)?.toString() ?? '';
	}, []);

	return (
		<section className={'mt-4 grid w-full grid-cols-12 gap-y-10 pb-10 md:mt-20 md:gap-x-10 md:gap-y-20'}>

			<HeaderPosition />

			<div className={'col-span-12 flex w-full flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4'}>
				<div className={'w-full bg-neutral-100 p-6 md:w-[412px] md:min-w-[412px]'}>
					<div className={'grid w-full gap-6 md:col-span-5'}>
						<div>
							<b
								className={'font-number pb-2 text-3xl text-neutral-900'}>
								{holdings?.yBalSupply ? `${formatBigNumberOver10K(holdings?.yBalSupply || 0)} ` : '- '}
								<span className={'font-number text-base text-neutral-600 md:text-3xl md:text-neutral-900'}>{'yBal'}</span>
							</b>

							<p
								className={'text-lg text-neutral-500'}>
								{`(Price = $${(formatAmount(yBalPrice || 0))} | Peg = ${(
									holdings?.balYBalPeg ? (formatPercent(
										(formatToNormalizedValue(holdings?.balYBalPeg, 18) + 0.0015) * 100)
									): formatPercent(0)
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
						<p className={'text-base text-neutral-400'}>{'yBal Deposits'}</p>
						<p className={'text-base text-neutral-400'}>{'My Balance'}</p>
					</div>

					<div className={'mb-8 grid w-full grid-cols-1 md:grid-cols-5'}>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'Product: '}</span>
							<p className={'text-base text-neutral-900'}>
								{'st-yBal'}
							</p>
						</div>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'mr-auto inline font-normal text-neutral-400 md:hidden'}>{'APY: '}</span>
							<b
								className={'font-number text-base text-neutral-900'}>
								{styBalAPY ? `${formatPercent(styBalAPY)}*` : `${formatPercent(0)}`}
							</b>
						</div>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'Total Assets: '}</span>
							<p
								className={'font-number text-base text-neutral-900'}>
								{holdings?.styBalSupply ? formatCounterValue(
									formatToNormalizedValue(holdings.styBalSupply, 18),
									yBalPrice
								) : formatAmount(0)}
							</p>
						</div>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'yBal Deposits: '}</span>
							<p
								className={'font-number text-base text-neutral-900'}>
								{formatBigNumberOver10K(holdings?.styBalSupply || 0)}
							</p>
						</div>
						<div className={'flex flex-row items-baseline justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'My Balance: '}</span>
							<div>
								<p
									className={'font-number text-base text-neutral-900'}>
									{formatNumberOver10K(balances[STYBAL_TOKEN_ADDRESS]?.normalized || 0)}
								</p>
								<p
									className={'font-number text-xs text-neutral-600'}>
									{formatCounterValue(balanceOfStyBal.normalized, styBalPrice)}
								</p>
							</div>
						</div>
					</div>

					<div className={'mb-8 grid w-full grid-cols-1 md:grid-cols-5'}>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'Product: '}</span>
							<p className={'text-base text-neutral-900'}>
								{'lp-yBal'}
							</p>
						</div>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'mr-auto inline font-normal text-neutral-400 md:hidden'}>{'APY: '}</span>
							<b
								className={'font-number text-base text-neutral-900'}>
								{lpBalAPY ? `${(lpBalAPY || '').replace('APY', '')}` : `${formatPercent(0)}`}
							</b>
						</div>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'Total Assets: '}</span>
							<p
								className={'font-number text-base text-neutral-900'}>
								{holdings?.lpyBalSupply ? formatCounterValue(
									formatToNormalizedValue(holdings?.lpyBalSupply, 18),
									lpyBalPrice
								) : formatAmount(0)}
							</p>
						</div>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'yBal Deposits: '}</span>
							<p
								className={'font-number text-base text-neutral-900'}>
								{formatBigNumberOver10K(holdings?.lpyBalSupply || 0)}
							</p>
						</div>
						<div className={'flex flex-row items-baseline justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'My Balance: '}</span>
							<div>
								<p
									className={'font-number text-base text-neutral-900'}>
									{formatNumberOver10K(balances[LPYBAL_TOKEN_ADDRESS]?.normalized || 0)}
								</p>
								<p
									className={'font-number text-xs text-neutral-600'}>
									{formatCounterValue(
										balanceOfLpyBal?.normalized,
										lpyBalPrice
									)}
								</p>
							</div>
						</div>
					</div>

					<div>
						<p
							className={'font-number text-sm text-neutral-400 md:text-base'}>
							{styBalAPY ? `*${formatPercent(styBalAPY)} APY: ` : `*${formatPercent(0)} APY: `}
						</p>
						<p
							className={'font-number text-sm text-neutral-400 md:text-base'}>
							{`∙ ${styBalMegaBoost ? formatPercent(styBalMegaBoost * 100) : formatPercent(0)} Mega Boost`}
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
