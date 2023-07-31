import {useMemo} from 'react';
import {truncateHex} from '@yearn-finance/web-lib/utils/address';
import {formatToNormalizedValue, toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount, formatUSD} from '@yearn-finance/web-lib/utils/format.number';
import {formatDate} from '@yearn-finance/web-lib/utils/format.time';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {useCurve} from '@common/contexts/useCurve';
import {useYearn} from '@common/contexts/useYearn';

import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TCurveGauge} from '@common/schemas/curveSchemas';
import type {TYDaemonGaugeRewardsFeed} from '@common/schemas/yDaemonGaugeRewardsFeedSchema';

function RewardFeedRowItemWithExtraData({
	address,
	value
}: {address: TAddress, value: bigint, minDecimals?: number}): ReactElement {
	const {tokens, prices} = useYearn();

	const tokenInfo = tokens?.[address];
	const tokenPrice = Number(prices?.[address]) / 1000000;
	const decimals = tokenInfo?.decimals || 18;
	const symbol = tokenInfo?.symbol || '???';
	const bribeAmount = formatToNormalizedValue(toBigInt(value), decimals);
	const bribeValue = bribeAmount * (Number(tokenPrice || 0));

	return (
		<div className={'flex h-auto flex-col items-end'}>
			<div className={'font-number inline-flex items-baseline text-base text-neutral-900'}>
				{formatUSD(bribeValue)}
			</div>
			<p className={'font-number inline-flex items-baseline text-right text-xs text-neutral-400'}>
				{formatAmount(bribeAmount)}
				&nbsp;
				<span>{`${symbol}`}</span>
			</p>
		</div>
	);
}

function RewardFeedTableRow({currentRewardAdded}: {currentRewardAdded: TYDaemonGaugeRewardsFeed[0]}): ReactElement | null {
	const {gauges} = useCurve();

	const gaugesObject = useMemo((): {[key: string]: TCurveGauge} => {
		const _gaugesObject: {[key: string]: TCurveGauge} = {};
		for (const gauge of gauges) {
			_gaugesObject[gauge.gauge] = gauge;
		}
		return _gaugesObject;
	}, [gauges]);

	const gaugeItem = gaugesObject[currentRewardAdded.gauge];

	if (!gaugeItem) {
		return null;
	}

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
							src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${gaugeItem?.swap_token}/logo-128.png`}
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
						className={'font-number inline-flex cursor-alias items-baseline text-right text-xs text-neutral-400 transition-colors hover:text-neutral-900'}>
						{truncateHex(gaugeItem.gauge, 6)}
					</a>
				</div>
			</div>

			<div className={'col-span-1 flex h-20 w-full justify-end'}>
				<div className={'flex flex-row pt-6'}>
					<p className={'font-number items-baseline text-end text-sm leading-6 text-neutral-400'}>
						{formatDate(Number(currentRewardAdded.timestamp) * 1000)}
					</p>
				</div>
			</div>

			<div className={'col-span-1 flex h-20 w-full justify-end'}>
				<div className={'flex flex-row pt-6'}>
					<label className={'block text-sm leading-6 text-neutral-400 md:hidden'}>{'Current Rewards per veCRV'}</label>
					<RewardFeedRowItemWithExtraData
						address={currentRewardAdded.rewardToken}
						value={toBigInt(currentRewardAdded.amount)} />
				</div>
			</div>

		</div>
	);
}

export {RewardFeedTableRow};
