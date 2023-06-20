import {Fragment, useMemo} from 'react';
import {LPYBAL_TOKEN_ADDRESS, STYBAL_TOKEN_ADDRESS, YBAL_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatBigNumberOver10K, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount, formatNumberOver10K, formatPercent} from '@yearn-finance/web-lib/utils/format.number';
import {formatCounterValue, formatCounterValueRaw} from '@yearn-finance/web-lib/utils/format.value';
import ValueAnimation from '@common/components/ValueAnimation';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';
import {useBalance} from '@common/hooks/useBalance';
import {useTokenPrice} from '@common/hooks/useTokenPrice';
import {getVaultAPY} from '@common/utils';
import CardZap from '@yBal/components/CardZap';
import {Harvests} from '@yBal/components/Harvests';
import {useYBal} from '@yBal/contexts/useYBal';
import Wrapper from '@yBal/Wrapper';

import type {NextRouter} from 'next/router';
import type {ReactElement} from 'react';

function HeaderPosition(): ReactElement {
	const {holdings} = useYBal();
	const balanceOfStyBal = useBalance(STYBAL_TOKEN_ADDRESS);
	const balanceOfLpyBal = useBalance(LPYBAL_TOKEN_ADDRESS);
	const styBalPrice = useTokenPrice(STYBAL_TOKEN_ADDRESS);
	const lpyBalPrice = useTokenPrice(LPYBAL_TOKEN_ADDRESS);

	const formatedYearnHas = useMemo((): string => (
		holdings?.veBalBalance ?
			formatAmount(formatToNormalizedValue(holdings.veBalBalance, 18), 0, 0)
			: ''
	), [holdings?.veBalBalance]);

	const formatedYouHave = useMemo((): string => (
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
				<p className={'pb-2 text-lg text-neutral-900 md:pb-6 md:text-3xl'}>
					{'Yearn has'}
				</p>
				<b className={'font-number text-4xl text-neutral-900 md:text-7xl'}>
					<ValueAnimation
						identifier={'veBalTreasury'}
						value={formatedYearnHas}
						suffix={'veBal'}
						defaultValue={formatAmount(0, 2, 2)} />
				</b>
			</div>
			<div className={'col-span-12 w-full md:col-span-4'}>
				<p className={'pb-2 text-lg text-neutral-900 md:pb-6 md:text-3xl'}>{'You have'}</p>
				<b className={'font-number text-3xl text-neutral-900 md:text-7xl'}>
					<ValueAnimation
						identifier={'youHave'}
						value={formatedYouHave}
						prefix={'$'}
						defaultValue={formatAmount(0, 2, 2)} />
				</b>
			</div>
		</Fragment>
	);
}

function Holdings(): ReactElement {
	const {balances} = useWallet();
	const {holdings, styBalAPY} = useYBal();
	const {vaults} = useYearn();

	const lpyBalAPY = useMemo((): number => Number(getVaultAPY(vaults, LPYBAL_TOKEN_ADDRESS)), [vaults]);
	const yBalPrice = useTokenPrice(YBAL_TOKEN_ADDRESS);
	const styBalPrice = useTokenPrice(STYBAL_TOKEN_ADDRESS);
	const lpyBalPrice = useTokenPrice(LPYBAL_TOKEN_ADDRESS);
	const balanceOfStyBal = useBalance(STYBAL_TOKEN_ADDRESS);
	const balanceOfLpyBal = useBalance(LPYBAL_TOKEN_ADDRESS);

	return (
		<section className={'mt-4 grid w-full grid-cols-12 gap-y-10 pb-10 md:mt-20 md:gap-x-10 md:gap-y-20'}>
			<HeaderPosition />

			<div className={'col-span-12 grid w-full grid-cols-12 gap-4'}>
				<CardZap className={'col-span-12 md:col-span-8'} />
				<div className={'col-span-12 flex flex-col gap-4 md:col-span-4'}>
					<div className={'w-full bg-neutral-100 p-4'}>
						<div className={'flex flex-row items-baseline justify-between pb-1'}>
							<span className={'inline text-sm font-normal text-neutral-400'}>
								{'PEG: '}
							</span>
							<p
								suppressHydrationWarning
								className={'font-number text-sm text-neutral-900'}>
								{holdings?.balYBalPeg ? (formatPercent((formatToNormalizedValue(holdings?.balYBalPeg, 18) + 0.0015) * 100)): formatPercent(0)}
							</p>
						</div>
					</div>

					<div className={'w-full bg-neutral-100 p-4'}>
						<div className={'flex flex-row items-center justify-between pb-3'}>
							<b className={'text-neutral-900'}>
								{'st-yBal'}
							</b>
						</div>

						<div className={'flex flex-row items-baseline justify-between pb-1'}>
							<span className={'inline text-sm font-normal text-neutral-400'}>
								{'My Balance: '}
							</span>
							<p
								suppressHydrationWarning
								className={'font-number text-sm text-neutral-900'}>
								{formatNumberOver10K(balances[STYBAL_TOKEN_ADDRESS]?.normalized || 0)}
							</p>
						</div>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400'}>
								{'Value: '}
							</span>
							<p
								suppressHydrationWarning
								className={'font-number text-sm text-neutral-900'}>
								{formatCounterValue(balanceOfStyBal.normalized, styBalPrice)}
							</p>
						</div>

						<div className={'my-2 h-px w-full bg-neutral-200'} />

						<div className={'flex flex-row items-center justify-between pb-1'}>
							<span className={'mr-auto text-sm font-normal text-neutral-400'}>{'APY: '}</span>
							<b
								suppressHydrationWarning
								className={'font-number text-sm text-neutral-900'}>
								{formatPercent(styBalAPY ?? 0)}
							</b>
						</div>
						<div className={'flex flex-row items-center justify-between pb-1'}>
							<span className={'inline text-sm font-normal text-neutral-400'}>
								{'Total Assets: '}
							</span>
							<p
								suppressHydrationWarning
								className={'font-number text-sm text-neutral-900'}>
								{holdings?.styBalSupply ? formatCounterValue(
									formatToNormalizedValue(holdings.styBalSupply, 18),
									yBalPrice
								) : formatAmount(0)}
							</p>
						</div>
						<div className={'flex flex-row items-center justify-between pb-1'}>
							<span className={'inline text-sm font-normal text-neutral-400'}>
								{'yBal Deposits: '}
							</span>
							<p
								suppressHydrationWarning
								className={'font-number text-sm text-neutral-900'}>
								{formatBigNumberOver10K(holdings.styBalSupply)}
							</p>
						</div>
					</div>

					<div className={'w-full bg-neutral-100 p-4'}>
						<div className={'flex flex-row items-center justify-between pb-3'}>
							<b className={'text-neutral-900'}>
								{'lp-yBal'}
							</b>
						</div>

						<div className={'flex flex-row items-baseline justify-between pb-1'}>
							<span className={'inline text-sm font-normal text-neutral-400'}>
								{'My Balance: '}
							</span>
							<p
								suppressHydrationWarning
								className={'font-number text-sm text-neutral-900'}>
								{formatNumberOver10K(balances[LPYBAL_TOKEN_ADDRESS]?.normalized || 0)}
							</p>
						</div>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400'}>
								{'Value: '}
							</span>
							<p
								suppressHydrationWarning
								className={'font-number text-sm text-neutral-900'}>
								{formatCounterValue(balanceOfLpyBal.normalized, lpyBalPrice)}
							</p>
						</div>

						<div className={'my-2 h-px w-full bg-neutral-200'} />

						<div className={'flex flex-row items-center justify-between pb-1'}>
							<span className={'mr-auto text-sm font-normal text-neutral-400'}>{'APY: '}</span>
							<b
								suppressHydrationWarning
								className={'font-number text-sm text-neutral-900'}>
								{formatPercent(lpyBalAPY ?? 0)}
							</b>
						</div>
						<div className={'flex flex-row items-center justify-between pb-1'}>
							<span className={'inline text-sm font-normal text-neutral-400'}>
								{'Total Assets: '}
							</span>
							<p
								suppressHydrationWarning
								className={'font-number text-sm text-neutral-900'}>
								{holdings?.lpyBalSupply ? formatCounterValue(
									formatToNormalizedValue(holdings.lpyBalSupply, 18),
									lpyBalPrice
								) : formatAmount(0)}
							</p>
						</div>
						<div className={'flex flex-row items-center justify-between pb-1'}>
							<span className={'inline text-sm font-normal text-neutral-400'}>
								{'yBal Deposits: '}
							</span>
							<p
								suppressHydrationWarning
								className={'font-number text-sm text-neutral-900'}>
								{formatBigNumberOver10K(holdings.lpyBalSupply)}
							</p>
						</div>
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
