import React, {useMemo, useState} from 'react';
import {ethers} from 'ethers';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {Modal} from '@yearn-finance/web-lib/components/Modal';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {useYearn} from '@common/contexts/useYearn';
import {formatPercent, formatUSD} from '@common/utils';
import {GaugeBribeModal} from '@yBribe/components/bribe/GaugeBribeModal';
import {useBribes} from '@yBribe/contexts/useBribes';

import type {BigNumber} from 'ethers';
import type {ReactElement} from 'react';
import type {TDict} from '@yearn-finance/web-lib/utils/types';
import type {TCurveGauges} from '@common/types/curves';

function	GaugeRowItemWithExtraData({address, value}: {address: string, value: BigNumber}): ReactElement {
	const	{tokens, prices} = useYearn();

	const	tokenInfo = tokens?.[address];
	const	tokenPrice = prices?.[address];
	const	decimals = tokenInfo?.decimals || 18;
	const	symbol = tokenInfo?.symbol || '???';
	const	bribeAmount = formatToNormalizedValue(formatBN(value), decimals);
	const	bribeValue = bribeAmount * (Number(tokenPrice || 0) / 100);

	return (
		<div className={'flex h-auto flex-col items-end pt-0 md:h-14'}>
			<p className={'yearn--table-data-section-item-value'}>
				{formatUSD(bribeValue, 5, 5)}
			</p>
			<p className={'font-number inline-flex items-baseline text-right text-xs text-neutral-400'}>
				{formatAmount(bribeAmount, 5, 5)}
				&nbsp;
				<span>{`${symbol}`}</span>
			</p>
		</div>
	);
}

function	GaugeListRow({currentGauge}: {currentGauge: TCurveGauges}): ReactElement {
	const	{isActive} = useWeb3();
	const	{currentRewards, nextRewards} = useBribes();
	const	[hasModal, set_hasModal] = useState(false);

	const	currentRewardsForCurrentGauge = useMemo((): TDict<BigNumber> => {
		return currentRewards?.v3?.[toAddress(currentGauge.gauge)] || {};
	}, [currentGauge.gauge, currentRewards]);
	
	const	nextRewardsForCurrentGauge = useMemo((): TDict<BigNumber> => {
		return nextRewards?.v3?.[toAddress(currentGauge.gauge)] || {};
	}, [currentGauge.gauge, nextRewards]);

	const	gaugeRelativeWeight = useMemo((): number => {
		return formatToNormalizedValue(formatBN(String(currentGauge?.gauge_controller?.gauge_relative_weight) || ethers.constants.Zero), 18);
	}, [currentGauge]);

	const	currentRewardsForCurrentGaugeMap = Object.entries(currentRewardsForCurrentGauge || {}) || [];
	const	nextRewardsForCurrentGaugeMap = Object.entries(nextRewardsForCurrentGauge || {}) || [];

	return (
		<div className={'yearn--table-wrapper cursor-pointer transition-colors hover:bg-neutral-300'}>
			<div className={'yearn--table-token-section'}>
				<div className={'yearn--table-token-section-item'}>
					<div className={'yearn--table-token-section-item-image'}>
						<ImageWithFallback
							alt={''}
							width={40}
							height={40}
							quality={90}
							loading={'eager'}
							src={`${process.env.BASE_YEARN_ASSETS_URI}1/${toAddress(currentGauge.swap_token)}/logo-128.png`} />
					</div>
					<p>{currentGauge.name}</p>
				</div>
				<div className={'flex md:hidden'}>
					<div className={'h-16 pt-4 md:pt-7'}>
						<Button
							className={'yearn--button-smaller w-full'}
							isDisabled={!isActive}
							onClick={(): void => set_hasModal(true)}>
							{'Bribe'}
						</Button>
					</div>
				</div>
			</div>


			<div className={'yearn--table-data-section grid-cols-9'}>
				<div className={'yearn--table-data-section-item'} datatype={'number'}>
					<label className={'yearn--table-data-section-item-label'}>{'Weight'}</label>
					<p className={'yearn--table-data-section-item-value'}>
						{formatPercent(gaugeRelativeWeight * 100)}
					</p>
				</div>

				<div className={'yearn--table-data-section-item md:col-span-3'} datatype={'number'}>
					<label className={'yearn--table-data-section-item-label'}>{'Current Bribes'}</label>
					{
						!currentRewardsForCurrentGaugeMap || currentRewardsForCurrentGaugeMap.length === 0 ? (
							<div className={'flex h-auto flex-col items-end pt-0 md:h-14'}>
								<p className={'yearn--table-data-section-item-value'}>
									{formatUSD(0, 5, 5)}
								</p>
								<p className={'font-number inline-flex items-baseline text-right text-xs text-neutral-400'}>
									{'-'}
								</p>
							</div>
						) : currentRewardsForCurrentGaugeMap.map(([key, value]: [string, BigNumber]): ReactElement => (
							<GaugeRowItemWithExtraData
								key={`rewards-${currentGauge.gauge}-${key}`}
								address={toAddress(key)}
								value={value} />
						))
					}
				</div>

				<div className={'yearn--table-data-section-item md:col-span-3'} datatype={'number'}>
					<label className={'yearn--table-data-section-item-label'}>{'Current Bribes'}</label>
					{
						!nextRewardsForCurrentGaugeMap || nextRewardsForCurrentGaugeMap.length === 0 ? (
							<div className={'flex h-auto flex-col items-end pt-0 md:h-14'}>
								<p className={'yearn--table-data-section-item-value'}>
									{formatUSD(0, 5, 5)}
								</p>
								<p className={'font-number inline-flex items-baseline text-right text-xs text-neutral-400'}>
									{'-'}
								</p>
							</div>
						) : nextRewardsForCurrentGaugeMap.map(([key, value]: [string, BigNumber]): ReactElement => (
							<GaugeRowItemWithExtraData
								key={`rewards-${currentGauge.gauge}-${key}`}
								address={toAddress(key)}
								value={value} />
						))
					}
				</div>

				<div className={'yearn--table-data-section-item md:col-span-2'} datatype={'number'}>
					<div className={'h-14 pt-0'}>
						<Button
							className={'yearn--button-smaller w-full'}
							isDisabled={!isActive}
							onClick={(): void => set_hasModal(true)}>
							{'Bribe'}
						</Button>
					</div>
				</div>
			</div>

			<Modal
				className={'yearn--modal-bigger'}
				isOpen={hasModal}
				onClose={(): void => set_hasModal(false)}>
				<GaugeBribeModal
					currentGauge={currentGauge}
					onClose={(): void => set_hasModal(false)} />
			</Modal>
		</div>
	);
}

export {GaugeListRow};
