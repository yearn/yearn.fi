import React, {useMemo, useState} from 'react';
import {Button} from '@yearn-finance/web-lib/components';
import {useWeb3} from '@yearn-finance/web-lib/contexts';
import {defaultTxStatus, Transaction} from '@yearn-finance/web-lib/utils';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {CRV_TOKEN_ADDRESS, CURVE_BRIBE_V2_ADDRESS, CURVE_BRIBE_V3_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {useYearn} from '@common/contexts/useYearn';
import {useBribes} from '@yBribe/contexts/useBribes';
import {claimReward} from '@yBribe/utils/actions/claimReward';

import type {BigNumber} from 'ethers';
import type {ReactElement} from 'react';
import type {TDict} from '@yearn-finance/web-lib/utils';
import type {TCurveGauges} from '@common/types/curves';

function	GaugeRowItemWithExtraData({
	address,
	value,
	minDecimals = 5,
	isV2
}: {address: string, value: BigNumber, minDecimals?: number, isV2?: boolean}): ReactElement {
	const	{tokens, prices} = useYearn();

	const	tokenInfo = tokens?.[address];
	const	tokenPrice = Number(prices?.[address]) / 1000000;
	const	decimals = tokenInfo?.decimals || 18;
	const	symbol = tokenInfo?.symbol || '???';
	const	bribeAmount = formatToNormalizedValue(formatBN(value), decimals);
	const	bribeValue = bribeAmount * (Number(tokenPrice || 0));

	return (
		<div className={'flex h-auto flex-col items-end pt-0 md:h-16 md:pt-6'}>
			<div className={`${isV2 ? 'tooltip' : ''} inline-flex items-baseline text-base tabular-nums text-neutral-900`}>
				{`$ ${formatAmount(bribeValue, minDecimals, minDecimals)}`}
				<span className={'absolute -right-2 text-sm text-neutral-400'}>
					{`${isV2 ? '*' : ''}`}
				</span>
				{isV2 ? (
					<span className={'tooltiptext text-xs'}>
						<p>{'This number may be off!'}</p>
						<p>{'Because of a vulnerability in the BribeV2 contract, the amount of reward may be incorrect'}</p>
					</span>
				) : null}
			</div>
			<p className={'inline-flex items-baseline text-right text-xs tabular-nums text-neutral-400'}>
				{formatAmount(bribeAmount, minDecimals, minDecimals)}
				&nbsp;
				<span>{`${symbol}`}</span>
			</p>
		</div>
	);
}

function	GaugeRowItemAPR({address, value, isV2}: {address: string, value: BigNumber, isV2?: boolean}): ReactElement {
	const	{tokens, prices} = useYearn();

	const	crvPrice = useMemo((): number => {
		const	tokenPrice = Number(prices?.[CRV_TOKEN_ADDRESS] || 0);
		return tokenPrice;
	}, [prices]);

	const	tokenPrice = useMemo((): number => {
		const	tokenPrice = Number(prices?.[address] || 0);
		return tokenPrice;
	}, [address, prices]);

	const	APR = useMemo((): number => {
		const	tokenInfo = tokens?.[address];
		const	decimals = tokenInfo?.decimals || 18;
		if (tokenPrice === 0 || crvPrice === 0) {
			return 0;
		}
		if (isV2) {
			return formatToNormalizedValue(value, decimals) / 126144000 * tokenPrice / crvPrice * 52 * 100;
		}
		return formatToNormalizedValue(value, decimals) * tokenPrice / crvPrice * 52 * 100;
	}, [address, crvPrice, isV2, tokenPrice, tokens, value]);

	return (
		<div className={'flex h-auto flex-col items-end pt-0 md:h-16 md:pt-6'}>
			<b className={'inline-flex items-baseline whitespace-nowrap text-base tabular-nums text-neutral-900'}>
				{`${formatAmount(APR, 2, 2)} %`}
			</b>
		</div>
	);
}


function	GaugeTableRow({currentGauge, category}: {currentGauge: TCurveGauges, category: string}): ReactElement {
	const	{isActive, provider} = useWeb3();
	const	{currentRewards, nextRewards, claimable, refresh} = useBribes();
	const	[txStatusClaim, set_txStatusClaim] = useState(defaultTxStatus);

	const	currentRewardsForCurrentGauge = useMemo((): TDict<BigNumber> => {
		if (category === 'v2') {
			return currentRewards?.v2?.[toAddress(currentGauge.gauge)] || {};
		}
		return currentRewards?.v3?.[toAddress(currentGauge.gauge)] || {};
	}, [currentGauge.gauge, currentRewards, category]);
	
	const	nextRewardsForCurrentGauge = useMemo((): TDict<BigNumber> => {
		if (category === 'v2') {
			return {};
		}
		return nextRewards?.v3?.[toAddress(currentGauge.gauge)] || {};
	}, [currentGauge.gauge, nextRewards, category]);

	const	claimableForCurrentGauge = useMemo((): TDict<BigNumber> => {
		if (category === 'v2') {
			return claimable?.v2?.[toAddress(currentGauge.gauge)] || {};
		}
		return claimable?.v3?.[toAddress(currentGauge.gauge)] || {};
	}, [currentGauge.gauge, claimable, category]);

	const	claimableForCurrentGaugeMap = Object.entries(claimableForCurrentGauge || {}) || [];
	const	currentRewardsForCurrentGaugeMap = Object.entries(currentRewardsForCurrentGauge || {}) || [];
	const	nextRewardsForCurrentGaugeMap = Object.entries(nextRewardsForCurrentGauge || {}) || [];
	const	hasSomethingToClaim = claimableForCurrentGaugeMap.some(([, value]: [string, BigNumber]): boolean => value.gt(0));

	function	onClaimReward(token: string): void {
		new Transaction(provider, claimReward, set_txStatusClaim).populate(
			category === 'v2' ? CURVE_BRIBE_V2_ADDRESS : CURVE_BRIBE_V3_ADDRESS,
			currentGauge.gauge,
			token
		).onSuccess(async (): Promise<void> => {
			await refresh();
		}).perform();
	}

	return (
		<div className={'grid w-full grid-cols-2 border-t border-neutral-200 px-4 pb-4 md:grid-cols-7 md:px-10'}>
			<div className={'col-span-2 mb-2 flex h-16 flex-row items-center justify-between pt-6 md:col-span-2 md:mb-0'}>
				<div className={'flex flex-row items-center space-x-2 md:space-x-6'}>
					<div className={'flex h-6 w-6 rounded-full md:flex md:h-10 md:w-10'}>
						<ImageWithFallback
							alt={''}
							width={40}
							height={40}
							quality={90}
							src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${toAddress(currentGauge.swap_token)}/logo-128.png`}
							loading={'eager'} />
					</div>
					<p>{currentGauge.name}</p>
				</div>
			</div>

			<div className={'col-span-2 grid grid-cols-2 gap-0 md:col-span-5 md:grid-cols-10 md:gap-10'}>
				<div className={'col-span-2 hidden md:block'}>
					<div
						aria-label={'current rewards'}
						className={'col-span-8 flex flex-row justify-end pt-4 md:col-span-3 md:flex-col md:justify-start md:pt-0'}>
						<div className={'flex h-auto flex-col justify-center pt-0 md:h-16 md:pt-6'}>
							<p className={'items-baseline text-end text-sm tabular-nums text-neutral-400'}>
								{'Current Period'}
							</p>
						</div>
					</div>
					<div
						aria-label={'pending rewards'}
						className={'col-span-8 flex flex-row justify-end pt-4 md:col-span-3 md:flex-col md:justify-start md:pt-0'}>
						<div className={'flex h-auto flex-col justify-center pt-0 md:h-16 md:pt-6'}>
							<p className={'items-baseline text-end text-sm tabular-nums text-neutral-400'}>
								{'Pending Period'}
							</p>
						</div>
					</div>
				</div>

				<div className={'col-span-2 mb-0 md:mb-0'}>
					<div
						aria-label={'current rewards'}
						className={'col-span-8 flex flex-row justify-between pt-4 md:col-span-3 md:flex-col md:justify-start md:pt-0'}>
						<label className={'block text-sm leading-6 text-neutral-400 md:hidden'}>{'Current Rewards per veCRV'}</label>
						{
							!currentRewardsForCurrentGaugeMap || currentRewardsForCurrentGaugeMap.length === 0 ? (
								<div className={'flex h-auto flex-col items-end pt-0 md:h-16 md:pt-6'}>
									<p className={'inline-flex items-baseline text-base tabular-nums text-neutral-900'}>
										{'$ 0.00000'}
									</p>
									<p className={'inline-flex items-baseline text-right text-xs tabular-nums text-neutral-400'}>
										{'-'}
									</p>
								</div>
							) : currentRewardsForCurrentGaugeMap.map(([key, value]: [string, BigNumber]): ReactElement => (
								<GaugeRowItemWithExtraData
									isV2={category === 'v2'}
									key={`current-rewards-${currentGauge.gauge}-${key}`}
									address={toAddress(key)}
									value={category === 'v2' ? value.div(126144000) : value} />
							))
						}
					</div>
					<div
						aria-label={'pending rewards'}
						className={'col-span-8 flex flex-row justify-between pt-4 md:col-span-3 md:flex-col md:justify-start md:pt-0'}>
						<label className={'block text-sm leading-6 text-neutral-400 md:hidden'}>{'Pending Rewards per veCRV'}</label>
						{
							!nextRewardsForCurrentGaugeMap || nextRewardsForCurrentGaugeMap.length === 0 ? (
								<div className={'flex h-auto flex-col items-end pt-0 md:h-16 md:pt-6'}>
									<p className={'inline-flex items-baseline text-base tabular-nums text-neutral-900'}>
										{'$ 0.00000'}
									</p>
									<p className={'inline-flex items-baseline text-right text-xs tabular-nums text-neutral-400'}>
										{'-'}
									</p>
								</div>
							) : nextRewardsForCurrentGaugeMap.map(([key, value]: [string, BigNumber]): ReactElement => (
								<GaugeRowItemWithExtraData
									isV2={category === 'v2'}
									key={`pending-rewards-${currentGauge.gauge}-${key}`}
									address={toAddress(key)}
									value={category === 'v2' ? value.div(126144000) : value} />
							))
						}
					</div>
				</div>

				<div className={'col-span-2 mb-4 md:mb-0'}>
					<div
						aria-label={'current APR'}
						className={'col-span-8 flex flex-row justify-between pt-4 md:col-span-1 md:flex-col md:justify-start md:pt-0'}>
						<label className={'block text-sm leading-6 text-neutral-400 md:hidden'}>{'Current APR'}</label>
						{
							!currentRewardsForCurrentGaugeMap || currentRewardsForCurrentGaugeMap.length === 0 ? (
								<div className={'flex h-auto flex-col items-end pt-0 md:h-16 md:pt-6'}>
									<p className={'inline-flex items-baseline whitespace-nowrap text-base tabular-nums text-neutral-900'}>
										{'0.00 %'}
									</p>
								</div>
							) : currentRewardsForCurrentGaugeMap.map(([key, value]: [string, BigNumber]): ReactElement => (
								<GaugeRowItemAPR
									isV2={category === 'v2'}
									key={`apr-${currentGauge.gauge}-${key}`}
									address={toAddress(key)}
									value={value} />
							))
						}
					</div>
					<div
						aria-label={'pending APR'}
						className={'col-span-8 flex flex-row justify-between pt-4 md:col-span-1 md:flex-col md:justify-start md:pt-0'}>
						<label className={'block text-sm leading-6 text-neutral-400 md:hidden'}>{'Pending APR'}</label>
						{
							!nextRewardsForCurrentGaugeMap || nextRewardsForCurrentGaugeMap.length === 0 ? (
								<div className={'flex h-auto flex-col items-end pt-0 md:h-16 md:pt-6'}>
									<p className={'inline-flex items-baseline whitespace-nowrap text-base tabular-nums text-neutral-900'}>
										{'0.00 %'}
									</p>
								</div>
							) : nextRewardsForCurrentGaugeMap.map(([key, value]: [string, BigNumber]): ReactElement => (
								<GaugeRowItemAPR
									key={`apr-${currentGauge.gauge}-${key}`}
									address={toAddress(key)}
									value={value} />
							))
						}
					</div>
				</div>

				<div className={'col-span-2'}>
					<div className={'col-span-8 flex flex-row items-center justify-between md:col-span-2 md:flex-col md:items-end md:justify-start'}>
						<label className={'block text-sm leading-6 text-neutral-400 md:hidden'}>{'Claimable'}</label>
						{
							!claimableForCurrentGaugeMap || claimableForCurrentGaugeMap.length === 0 ? (
								<div className={'flex h-auto flex-col items-end pt-0 md:h-16 md:pt-6'}>
									<p className={'inline-flex items-baseline text-base tabular-nums text-neutral-900'}>
										{'$ 0.00000'}
									</p>
									<p className={'inline-flex items-baseline text-right text-xs tabular-nums text-neutral-400'}>
										{'-'}
									</p>
								</div>
							) : claimableForCurrentGaugeMap.map(([key, value]: [string, BigNumber]): ReactElement => (
								<>
									<GaugeRowItemWithExtraData
										key={`claimable-${currentGauge.gauge}-${key}`}
										address={toAddress(key)}
										value={value} />
									<div key={`claim-${key}`} className={'block h-auto pt-0 md:hidden md:h-16 md:pt-7'}>
										<Button
											className={'yearn--button-smaller w-full'}
											onClick={(): void => onClaimReward(key)}
											isBusy={txStatusClaim.pending}
											isDisabled={!isActive || !hasSomethingToClaim}>
											{'Claim'}
										</Button>
									</div>
								</>
							))
						}
					</div>
					<div />
				</div>

				<div className={'col-span-2'}>
					<div className={'col-span-2 hidden flex-col items-end md:flex'}>
						{
							!currentRewardsForCurrentGaugeMap || currentRewardsForCurrentGaugeMap.length === 0 ? (
								<div className={'h-16 pt-7'}>
									<Button
										className={'yearn--button-smaller w-full'}
										isBusy={txStatusClaim.pending}
										isDisabled>
										{'Claim'}
									</Button>
								</div>
							) : currentRewardsForCurrentGaugeMap.map(([key]: [string, BigNumber]): ReactElement => (
								<div key={`claim-${key}`} className={'h-16 pt-7'}>
									<Button
										className={'yearn--button-smaller w-full'}
										onClick={(): void => onClaimReward(key)}
										isBusy={txStatusClaim.pending}
										isDisabled={!isActive || !hasSomethingToClaim}>
										{'Claim'}
									</Button>
								</div>
							))
						}
					</div>
					<div />
				</div>
			</div>
		</div>
	);
}

export {GaugeTableRow};
