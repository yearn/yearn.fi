import React from 'react';
import IconLinkOut from '@yearn-finance/web-lib/icons/IconLinkOut';
import {toAddress, truncateHex} from '@yearn-finance/web-lib/utils/address';
import {STYCRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatBN, formatToNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {formatDate} from '@yearn-finance/web-lib/utils/format.time';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {formatUSD} from '@common/utils';

import type {ReactElement} from 'react';
import type {TYDaemonHarvests} from '@common/types/yearn';

function	HarvestListRow({harvest}: {harvest: TYDaemonHarvests}): ReactElement {
	return (
		<div className={'yearn--table-wrapper'}>
			<div className={'yearn--table-token-section'}>
				<div className={'yearn--table-token-section-item'}>
					<div className={'yearn--table-token-section-item-image'}>
						<ImageWithFallback
							alt={toAddress(harvest.vaultAddress) === STYCRV_TOKEN_ADDRESS ? 'st-yCRV' : 'lp-yCRV'}
							width={40}
							height={40}
							quality={90}
							src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${toAddress(harvest.vaultAddress)}/logo-128.png`}
							loading={'eager'} />
					</div>
					<p>
						{toAddress(harvest.vaultAddress) === STYCRV_TOKEN_ADDRESS ? 'st-yCRV' : 'lp-yCRV'}
					</p>
				</div>
			</div>

			<div className={'yearn--table-data-section md:grid-cols-9'}>
				<div className={'yearn--table-data-section-item md:col-span-1'} datatype={'number'}>
					<p className={'yearn--table-data-section-item-label'}>{'Gain'}</p>
					<b className={'yearn--table-data-section-item-value'}>
						{formatAmount(formatToNormalizedValue(formatBN(harvest.profit).sub(formatBN(harvest.loss)), 18))}
					</b>
				</div>

				<div className={'yearn--table-data-section-item md:col-span-2'} datatype={'number'}>
					<p className={'yearn--table-data-section-item-label'}>{'Value'}</p>
					<p className={'yearn--table-data-section-item-value'}>
						{formatUSD(Number(harvest.profitValue) - Number(harvest.lossValue))}
					</p>
				</div>

				<div className={'yearn--table-data-section-item md:col-span-3'} datatype={'number'}>
					<p className={'yearn--table-data-section-item-label'}>{'Date'}</p>
					<p className={'yearn--table-data-section-item-value'} style={{lineHeight: '24px'}}>
						{formatDate(Number(harvest.timestamp) * 1000)}
					</p>
				</div>

				<div className={'yearn--table-data-section-item md:col-span-3'} datatype={'number'}>
					<p className={'yearn--table-data-section-item-label'}>{'Hash'}</p>
					<a
						href={`https://etherscan.io/tx/${harvest.txHash}`}
						target={'_blank'}
						rel={'noreferrer'}>
						<div
							className={'font-number flex flex-row items-center space-x-2 text-neutral-900'}
							style={{lineHeight: '24px'}}>
							{truncateHex(harvest.txHash, 6)}
							<IconLinkOut className={'ml-2 h-4 w-4 md:ml-4'} />
						</div>
					</a>
				</div>

			</div>
		</div>
	);
}

export {HarvestListRow};
