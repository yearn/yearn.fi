import {useMemo, useState} from 'react';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {Modal} from '@yearn-finance/web-lib/components/Modal';
import Renderable from '@yearn-finance/web-lib/components/Renderable';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatToNormalizedValue, toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount, formatPercent, formatUSD} from '@yearn-finance/web-lib/utils/format.number';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {useYearn} from '@common/contexts/useYearn';
import {GaugeBribeModal} from '@yBribe/components/bribe/GaugeBribeModal';
import {useBribes} from '@yBribe/contexts/useBribes';

import type {ReactElement} from 'react';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';
import type {TCurveGauge} from '@common/schemas/curveSchemas';

function GaugeRowItemWithExtraData({address, value}: {address: TAddress, value: bigint}): ReactElement {
	const {tokens, prices} = useYearn();

	const tokenInfo = tokens?.[address];
	const tokenPrice = prices?.[address];
	const decimals = tokenInfo?.decimals || 18;
	const symbol = tokenInfo?.symbol || '???';
	const bribeAmount = formatToNormalizedValue(toBigInt(value), decimals);
	const bribeValue = bribeAmount * (Number(tokenPrice || 0) / 100);

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

function GaugeListRow({currentGauge}: {currentGauge: TCurveGauge}): ReactElement {
	const {isActive} = useWeb3();
	const {currentRewards, nextRewards} = useBribes();
	const [hasModal, set_hasModal] = useState(false);

	const currentRewardsForCurrentGauge = useMemo((): TDict<bigint> => {
		return currentRewards?.[currentGauge.gauge] || {};
	}, [currentGauge.gauge, currentRewards]);

	const nextRewardsForCurrentGauge = useMemo((): TDict<bigint> => {
		return nextRewards?.[currentGauge.gauge] || {};
	}, [currentGauge.gauge, nextRewards]);

	const gaugeRelativeWeight = useMemo((): number => {
		return formatToNormalizedValue(toBigInt(currentGauge?.gauge_controller?.gauge_relative_weight), 18);
	}, [currentGauge]);

	const currentRewardsForCurrentGaugeMap = Object.entries(currentRewardsForCurrentGauge || {}) || [];
	const nextRewardsForCurrentGaugeMap = Object.entries(nextRewardsForCurrentGauge || {}) || [];

	function renderDefaultValueUSDFallback(): ReactElement {
		return (
			<div className={'flex h-auto flex-col items-end pt-0 md:h-14'}>
				<p className={'yearn--table-data-section-item-value'}>
					{formatUSD(0, 5, 5)}
				</p>
				<p className={'font-number inline-flex items-baseline text-right text-xs text-neutral-400'}>
					{'-'}
				</p>
			</div>
		);
	}

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
							src={`${process.env.BASE_YEARN_ASSETS_URI}1/${currentGauge.swap_token}/logo-128.png`} />
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
					<Renderable
						shouldRender={!!currentRewardsForCurrentGaugeMap && currentRewardsForCurrentGaugeMap.length > 0}
						fallback={renderDefaultValueUSDFallback()}>
						{currentRewardsForCurrentGaugeMap.map(([key, value]: [string, bigint]): ReactElement =>
							<GaugeRowItemWithExtraData
								key={`rewards-${currentGauge.gauge}-${key}`}
								address={toAddress(key)}
								value={value} />
						)}
					</Renderable>
				</div>

				<div className={'yearn--table-data-section-item md:col-span-3'} datatype={'number'}>
					<label className={'yearn--table-data-section-item-label'}>{'Current Bribes'}</label>
					<Renderable
						shouldRender={!!nextRewardsForCurrentGaugeMap && nextRewardsForCurrentGaugeMap.length > 0}
						fallback={renderDefaultValueUSDFallback()}>
						{nextRewardsForCurrentGaugeMap.map(([key, value]: [string, bigint]): ReactElement =>
							<GaugeRowItemWithExtraData
								key={`rewards-${currentGauge.gauge}-${key}`}
								address={toAddress(key)}
								value={value} />
						)}
					</Renderable>
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
