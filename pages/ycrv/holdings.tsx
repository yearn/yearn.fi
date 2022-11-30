import React, {useCallback, useMemo} from 'react';
import {Contract} from 'ethcall';
import {ethers} from 'ethers';
import useSWR from 'swr';
import {useWeb3} from '@yearn-finance/web-lib/contexts';
import IconLinkOut from '@yearn-finance/web-lib/icons/IconLinkOut';
import {format, providers, toAddress, truncateHex} from '@yearn-finance/web-lib/utils';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import ValueAnimation from '@common/components/ValueAnimation';
import {useCurve} from '@common/contexts/useCurve';
import {useWallet} from '@common/contexts/useWallet';
import {useYCRV} from '@common/contexts/useYCRV';
import {useYearn} from '@common/contexts/useYearn';
import {getCounterValue, getCounterValueRaw, getVaultAPY, getVaultRawAPY} from '@common/utils';
import {LPYCRV_TOKEN_ADDRESS, STYCRV_TOKEN_ADDRESS, VECRV_ADDRESS, VECRV_YEARN_TREASURY_ADDRESS, YCRV_CURVE_POOL_ADDRESS, YCRV_TOKEN_ADDRESS, YVECRV_TOKEN_ADDRESS} from '@common/utils/constants';
import CURVE_CRV_YCRV_LP_ABI from '@yCRV/utils/abi/curveCrvYCrvLp.abi';
import STYCRV_ABI from '@yCRV/utils/abi/styCRV.abi';
import YVECRV_ABI from '@yCRV/utils/abi/yveCRV.abi';
import Wrapper from '@yCRV/Wrapper';

import type {BigNumber} from 'ethers';
import type {ReactElement} from 'react';
import type {TYDaemonHarvests} from '@common/types/yearn';

function	Holdings(): ReactElement {
	const	{provider} = useWeb3();
	const	{balances} = useWallet();
	const	{vaults, prices} = useYearn();
	const	{yCRVHarvests} = useYCRV();
	const	{curveWeeklyFees, cgPrices} = useCurve();

	/* 🔵 - Yearn Finance ******************************************************
	** SWR hook to get the expected out for a given in/out pair with a specific
	** amount. This hook is called every 10s or when amount/in or out changes.
	** Calls the expectedOutFetcher callback.
	**************************************************************************/
	const numbersFetchers = useCallback(async (): Promise<{[key: string]: BigNumber}> => {
		const	currentProvider = provider || providers.getProvider(1);
		const	ethcallProvider = await providers.newEthCallProvider(currentProvider);

		const	yCRVContract = new Contract(YCRV_TOKEN_ADDRESS, YVECRV_ABI);
		const	styCRVContract = new Contract(STYCRV_TOKEN_ADDRESS, STYCRV_ABI);
		const	lpyCRVContract = new Contract(LPYCRV_TOKEN_ADDRESS, YVECRV_ABI);
		const	yveCRVContract = new Contract(YVECRV_TOKEN_ADDRESS, YVECRV_ABI);
		const	veEscrowContract = new Contract(VECRV_ADDRESS, YVECRV_ABI);
		const	crvYCRVLpContract = new Contract(YCRV_CURVE_POOL_ADDRESS, CURVE_CRV_YCRV_LP_ABI);

		const	[
			yveCRVTotalSupply,
			yveCRVInYCRV,
			veCRVBalance,
			veCRVTotalSupply,
			yCRVTotalSupply,
			styCRVTotalSupply,
			lpyCRVTotalSupply,
			crvYCRVPeg
		] = await ethcallProvider.tryAll([
			yveCRVContract.totalSupply(),
			yveCRVContract.balanceOf(YCRV_TOKEN_ADDRESS),
			veEscrowContract.balanceOf(VECRV_YEARN_TREASURY_ADDRESS),
			veEscrowContract.totalSupply(),
			yCRVContract.totalSupply(),
			styCRVContract.totalAssets(),
			lpyCRVContract.totalSupply(),
			crvYCRVLpContract.get_dy(1, 0, ethers.constants.WeiPerEther)
		]) as [BigNumber, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber];

		return ({
			['legacy']: yveCRVTotalSupply.sub(yveCRVInYCRV),
			['treasury']: veCRVBalance.sub(yveCRVTotalSupply.sub(yveCRVInYCRV)).sub(yCRVTotalSupply),
			['yCRVSupply']: yCRVTotalSupply,
			['styCRVSupply']: styCRVTotalSupply,
			['lpyCRVSupply']: lpyCRVTotalSupply,
			['crvYCRVPeg']: crvYCRVPeg,
			['boostMultiplier']: veCRVBalance.mul(1e4).div(styCRVTotalSupply),
			['veCRVTotalSupply']: veCRVTotalSupply,
			[VECRV_YEARN_TREASURY_ADDRESS]: veCRVBalance
		});
	}, [provider]);
	const	{data} = useSWR('numbers', numbersFetchers, {refreshInterval: 10000, shouldRetryOnError: false, revalidateOnFocus: false});

	const	stCRVRawAPY = useMemo((): number => getVaultRawAPY(vaults, STYCRV_TOKEN_ADDRESS), [vaults]);
	const	lpCRVAPY = useMemo((): string => getVaultAPY(vaults, LPYCRV_TOKEN_ADDRESS), [vaults]);

	const	formatBigNumberOver10K = useCallback((v: BigNumber): string => {
		if (v.gt(ethers.constants.WeiPerEther.mul(10000))) {
			return format.amount(format.toNormalizedValue(v || 0, 18), 0, 0);
		}
		return format.amount(format.toNormalizedValue(v || 0, 18), 2, 2);
	}, []);

	const	formatNumberOver10K = useCallback((v: number): string => {
		if (v >= 10000) {
			return format.amount(v, 0, 0);
		}
		return format.amount(v, 2, 2);
	}, []);

	const	formatedYearnHas = useMemo((): string => (
		data?.[VECRV_YEARN_TREASURY_ADDRESS] ?
			format.amount(format.toNormalizedValue(data[VECRV_YEARN_TREASURY_ADDRESS], 18), 0, 0)
			: ''
	), [data]);

	const	formatedYouHave = useMemo((): string => (
		getCounterValueRaw(
			(Number(balances[STYCRV_TOKEN_ADDRESS]?.normalized) || 0) * (vaults?.[STYCRV_TOKEN_ADDRESS]?.tvl?.price || 0)
			+
			(Number(balances[LPYCRV_TOKEN_ADDRESS]?.normalized) || 0) * (vaults?.[LPYCRV_TOKEN_ADDRESS]?.tvl?.price || 0),
			1
		)
	), [balances, vaults]);

	const	latestCurveFeesValue = useMemo((): number => {
		if (curveWeeklyFees?.weeklyFeesTable?.[0].rawFees > 0) {
			return curveWeeklyFees.weeklyFeesTable[0].rawFees;
		} else {
			return curveWeeklyFees?.weeklyFeesTable?.[1].rawFees || 0;
		}
	}, [curveWeeklyFees]);

	const	currentVeCRVAPY = useMemo((): number => {
		return (
			latestCurveFeesValue / (
				format.toNormalizedValue(format.BN(data?.veCRVTotalSupply), 18) * cgPrices?.['curve-dao-token'].usd
			) * 52 * 100
		);
	}, [data, latestCurveFeesValue, cgPrices]);

	const	curveAdminFeePercent = useMemo((): number => {
		return (
			currentVeCRVAPY
			*
			Number(data?.boostMultiplier) / 10000
		);
	}, [data, currentVeCRVAPY]);

	const	ycrvPrice = useMemo((): number => (
		format.toNormalizedValue(
			format.BN(prices?.[YCRV_TOKEN_ADDRESS] || 0),
			6
		)
	), [prices]);

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
							<b className={'pb-2 text-3xl tabular-nums text-neutral-900'}>
								{data?.treasury ? `${formatBigNumberOver10K(data?.treasury || 0)} ` : '- '}
								<span className={'text-base tabular-nums text-neutral-600 md:text-3xl md:text-neutral-900'}>{'veCRV'}</span>
							</b>
							<p className={'text-lg text-neutral-500'}>{'Yearn Treasury'}</p>
						</div>
						<div>
							<b className={'pb-2 text-3xl tabular-nums text-neutral-900'}>
								{data?.legacy ? `${formatBigNumberOver10K(data?.legacy || 0)} ` : '- '}
								<span className={'text-base tabular-nums text-neutral-600 md:text-3xl md:text-neutral-900'}>{'yveCRV'}</span>
							</b>
							<p className={'text-lg text-neutral-500'}>{'Legacy system'}</p>
						</div>
						<div>
							<b className={'pb-2 text-3xl tabular-nums text-neutral-900'}>
								{data?.yCRVSupply ? `${formatBigNumberOver10K(data?.yCRVSupply || 0)} ` : '- '}
								<span className={'text-base tabular-nums text-neutral-600 md:text-3xl md:text-neutral-900'}>{'yCRV'}</span>
							</b>

							<p className={'text-lg text-neutral-500'}>
								{`(Price = $${(
									ycrvPrice ? format.amount(ycrvPrice, 2, 2) : '0.00'
								)} | Peg = ${(
									data?.crvYCRVPeg ? (
										format.amount(
											(format.toNormalizedValue(data?.crvYCRVPeg || ethers.constants.Zero, 18) + 0.0015) * 100, 2, 2)
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
							<b className={'text-base tabular-nums text-neutral-900'}>
								{stCRVRawAPY ? `${format.amount(stCRVRawAPY, 2, 2)}%*` : '0.00%'}
							</b>
						</div>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'Total Assets: '}</span>
							<p className={'text-base tabular-nums text-neutral-900'}>
								{data?.styCRVSupply ? getCounterValue(
									format.toNormalizedValue(data?.styCRVSupply || ethers.constants.Zero, 18),
									vaults?.[STYCRV_TOKEN_ADDRESS]?.tvl?.price || 0
								) : '0.00'}
							</p>
						</div>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'yCRV Deposits: '}</span>
							<p className={'text-base tabular-nums text-neutral-900'}>
								{data?.styCRVSupply ? `${formatBigNumberOver10K(data?.styCRVSupply || 0)} ` : '0.00'}
							</p>
						</div>
						<div className={'flex flex-row items-baseline justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'My Balance: '}</span>
							<div>
								<p className={'text-base tabular-nums text-neutral-900'}>
									{balances[STYCRV_TOKEN_ADDRESS]?.normalized ? (
										formatNumberOver10K(balances[STYCRV_TOKEN_ADDRESS]?.normalized || 0)
									) : '0.00'}
								</p>
								<p className={'text-xs tabular-nums text-neutral-600'}>
									{balances[STYCRV_TOKEN_ADDRESS] ? getCounterValue(
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
							<b className={'text-base tabular-nums text-neutral-900'}>
								{lpCRVAPY ? `${(lpCRVAPY || '').replace('APY', '')}` : '0.00%'}
							</b>
						</div>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'Total Assets: '}</span>
							<p className={'text-base tabular-nums text-neutral-900'}>
								{data?.lpyCRVSupply ? getCounterValue(
									format.toNormalizedValue(data?.lpyCRVSupply || ethers.constants.Zero, 18),
									vaults?.[LPYCRV_TOKEN_ADDRESS]?.tvl?.price || 0
								) : '0.00'}
							</p>
						</div>
						<div className={'flex flex-row items-center justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'yCRV Deposits: '}</span>
							<p className={'text-base tabular-nums text-neutral-900'}>
								{data?.lpyCRVSupply ? `${formatBigNumberOver10K(data?.lpyCRVSupply || 0)} ` : '0.00'}
							</p>
						</div>
						<div className={'flex flex-row items-baseline justify-between'}>
							<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'My Balance: '}</span>
							<div>
								<p className={'text-base tabular-nums text-neutral-900'}>
									{balances[LPYCRV_TOKEN_ADDRESS]?.normalized ? (
										formatNumberOver10K(balances[LPYCRV_TOKEN_ADDRESS]?.normalized || 0)
									) : '0.00'}
								</p>
								<p className={'text-xs tabular-nums text-neutral-600'}>
									{balances[LPYCRV_TOKEN_ADDRESS] ? getCounterValue(
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
						<p className={'text-sm tabular-nums text-neutral-400 md:text-base'}>
							{stCRVRawAPY ? `*${format.amount(stCRVRawAPY, 2, 2)}% APY: ` : '*0.00% APY: '}
						</p>
						<p className={'text-sm tabular-nums text-neutral-400 md:text-base'}>
							{`∙ ${curveAdminFeePercent ? format.amount(curveAdminFeePercent, 2, 2) : '0.00'}% Curve Admin Fees (${format.amount(Number(data?.boostMultiplier) / 10000, 2, 2)}x boost)`}
						</p>
						<p className={'text-sm tabular-nums text-neutral-400 md:text-base'}>
							{`∙ ${stCRVRawAPY && curveAdminFeePercent ? format.amount(stCRVRawAPY - curveAdminFeePercent, 2, 2) : '0.00'}% Gauge Voting Bribes`}
						</p>
					</div>
				</div>
			</div>

			<div className={'col-span-12 flex w-full flex-col bg-neutral-100'}>
				<div className={'p-6'}>
					<h2 className={'text-3xl font-bold'}>{'Harvests'}</h2>
				</div>
				<div className={'grid w-full grid-cols-1'}>
					<div className={'mb-6 hidden w-full grid-cols-5 px-6 md:grid'}>
						<p className={'text-base text-neutral-400'}>{'Product'}</p>
						<p className={'text-base text-neutral-400'}>{'Gain'}</p>
						<p className={'text-base text-neutral-400'}>{'Value'}</p>
						<p className={'text-base text-neutral-400'}>{'Date'}</p>
						<p className={'text-base text-neutral-400'}>{'Transaction'}</p>
					</div>
					{(yCRVHarvests || [])?.map((harvest: TYDaemonHarvests): ReactElement => {
						return (
							<div
								key={`${harvest.vaultAddress}_${harvest.timestamp}`}
								className={'grid w-full cursor-pointer grid-cols-1 border-t border-neutral-200 py-4 px-6 transition-colors hover:bg-neutral-200/30 md:grid-cols-5 md:border-none'}>
								<div className={'mb-2 flex flex-row items-center justify-between md:mb-0'}>
									<div className={'flex flex-row items-center space-x-0 md:space-x-4'}>
										<div className={'hidden h-8 w-8 rounded-full bg-neutral-200 md:flex md:h-9 md:w-9'}>
											<ImageWithFallback
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
											{format.date(Number(harvest.timestamp) * 1000)}
										</p>
									</div>
								</div>
								<div className={'flex h-9 flex-row items-center justify-between'}>
									<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'Gain: '}</span>
									<p className={'text-base tabular-nums text-neutral-900'}>
										{format.amount(format.toNormalizedValue(format.BN(harvest.profit).sub(format.BN(harvest.loss)), 18), 2, 2)}
									</p>
								</div>

								<div className={'flex h-9 flex-row items-center justify-between'}>
									<span className={'inline text-sm font-normal text-neutral-400 md:hidden'}>{'Value: '}</span>
									<p className={'text-base tabular-nums text-neutral-900'}>
										{`$ ${format.amount(Number(harvest.profitValue) - Number(harvest.lossValue), 2, 2)}`}
									</p>
								</div>

								<div className={'hidden h-9 items-center md:flex'}>
									<p className={'text-base tabular-nums text-neutral-900'}>
										{format.date(Number(harvest.timestamp) * 1000)}
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

		</section>
	);
}

Holdings.getLayout = function getLayout(page: ReactElement): ReactElement {
	return <Wrapper>{page}</Wrapper>;
};

export default Holdings;
