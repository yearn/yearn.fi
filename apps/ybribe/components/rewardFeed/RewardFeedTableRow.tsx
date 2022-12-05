import React, {useMemo} from 'react';
import {toAddress, truncateHex} from '@yearn-finance/web-lib/utils/address';
import {formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {formatDate} from '@yearn-finance/web-lib/utils/format.time';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {useCurve} from '@common/contexts/useCurve';
import {useYearn} from '@common/contexts/useYearn';

import type {BigNumber} from 'ethers';
import type {ReactElement} from 'react';
import type {TCurveGauges} from '@common/types/curves';
import type {TYDaemonGaugeRewardsFeed} from '@common/types/yearn';

function	RewardFeedRowItemWithExtraData({
	address,
	value
}: {address: string, value: BigNumber, minDecimals?: number, isV2?: boolean}): ReactElement {
	const	{tokens, prices} = useYearn();

	const	tokenInfo = tokens?.[address];
	const	tokenPrice = Number(prices?.[address]) / 1000000;
	const	decimals = tokenInfo?.decimals || 18;
	const	symbol = tokenInfo?.symbol || '???';
	const	bribeAmount = formatToNormalizedValue(formatBN(value), decimals);
	const	bribeValue = bribeAmount * (Number(tokenPrice || 0));

	return (
		<div className={'flex h-auto flex-col items-end'}>
			<div className={'inline-flex items-baseline text-base tabular-nums text-neutral-900'}>
				{`$ ${formatAmount(bribeValue, 2, 2)}`}
			</div>
			<p className={'inline-flex items-baseline text-right text-xs tabular-nums text-neutral-400'}>
				{formatAmount(bribeAmount, 2, 2)}
				&nbsp;
				<span>{`${symbol}`}</span>
			</p>
		</div>
	);
}

function	RewardFeedTableRow({currentRewardAdded}: {currentRewardAdded: TYDaemonGaugeRewardsFeed}): ReactElement {
	const	{gauges} = useCurve();

	const	gaugesObject = useMemo((): {[key: string]: TCurveGauges} => {
		const	_gaugesObject: {[key: string]: TCurveGauges} = {};
		for (const gauge of gauges) {
			_gaugesObject[toAddress(gauge.gauge)] = gauge;
		}
		return _gaugesObject;
	}, [gauges]);

	const	gaugeItem = gaugesObject[toAddress(currentRewardAdded.gauge)];

	return (
		<div className={'grid w-full grid-cols-2 border-t border-neutral-200 px-4 md:grid-cols-3 md:px-10'}>
			
			<div className={'col-span-1 flex h-20 w-full space-x-4'}>
				<div className={'flex flex-row items-start pt-6'}>
					<div className={'flex h-6 w-6 rounded-full md:flex md:h-10 md:w-10'}>
						<ImageWithFallback
							alt={''}
							width={40}
							height={40}
							quality={90}
							src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${toAddress(gaugeItem?.swap_token)}/logo-128.png`}
							loading={'eager'} />
					</div>
				</div>
				<div className={'flex h-auto flex-col items-start pt-6'}>
					<div className={'inline-flex items-baseline text-base tabular-nums text-neutral-900'}>
						{gaugeItem.name}
					</div>
					<a
						href={`https://etherscan.io/address/${gaugeItem.gauge}`}
						target={'_blank'}
						rel={'noreferrer'}
						className={'inline-flex cursor-alias items-baseline text-right text-xs tabular-nums text-neutral-400 transition-colors hover:text-neutral-900'}>
						{truncateHex(gaugeItem.gauge, 6)}
					</a>
				</div>
			</div>

			<div className={'col-span-1 flex h-20 w-full justify-end'}>
				<div className={'flex flex-row pt-6'}>
					<p className={'items-baseline text-end text-sm tabular-nums leading-6 text-neutral-400'}>
						{formatDate(Number(currentRewardAdded.timestamp) * 1000)}
					</p>
				</div>
			</div>

			<div className={'col-span-1 flex h-20 w-full justify-end'}>
				<div className={'flex flex-row pt-6'}>
					<label className={'block text-sm leading-6 text-neutral-400 md:hidden'}>{'Current Rewards per veCRV'}</label>
					<RewardFeedRowItemWithExtraData
						address={toAddress(currentRewardAdded.rewardToken)}
						value={formatBN(currentRewardAdded.amount)} />

				</div>
			</div>

		</div>
	);
}

export {RewardFeedTableRow};
