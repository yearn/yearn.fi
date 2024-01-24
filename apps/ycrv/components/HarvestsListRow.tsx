import {formatAmount, formatUSD, toAddress, toBigInt, toNormalizedValue, truncateHex} from '@builtbymom/web3/utils';
import {IconLinkOut} from '@yearn-finance/web-lib/icons/IconLinkOut';
import {STYCRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatDate} from '@yearn-finance/web-lib/utils/format.time';
import {ImageWithFallback} from '@common/components/ImageWithFallback';

import type {ReactElement} from 'react';
import type {TYDaemonVaultHarvest} from '@common/schemas/yDaemonVaultsSchemas';

export function HarvestListRow({harvest}: {harvest: TYDaemonVaultHarvest}): ReactElement {
	return (
		<div className={'yearn--table-wrapper'}>
			<div className={'yearn--table-token-section'}>
				<div className={'yearn--table-token-section-item'}>
					<div className={'yearn--table-token-section-item-image'}>
						<ImageWithFallback
							alt={toAddress(harvest.vaultAddress) === STYCRV_TOKEN_ADDRESS ? 'st-yCRV' : 'lp-yCRV'}
							width={32}
							height={32}
							src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${toAddress(
								harvest.vaultAddress
							)}/logo-32.png`}
						/>
					</div>
					<p>{toAddress(harvest.vaultAddress) === STYCRV_TOKEN_ADDRESS ? 'st-yCRV' : 'lp-yCRV'}</p>
				</div>
			</div>

			<div className={'yearn--table-data-section md:grid-cols-9'}>
				<div
					className={'yearn--table-data-section-item md:col-span-1'}
					datatype={'number'}>
					<p className={'yearn--table-data-section-item-label'}>{'Gain'}</p>
					<b className={'yearn--table-data-section-item-value'}>
						{formatAmount(toNormalizedValue(toBigInt(harvest.profit) - toBigInt(harvest.loss), 18))}
					</b>
				</div>

				<div
					className={'yearn--table-data-section-item md:col-span-2'}
					datatype={'number'}>
					<p className={'yearn--table-data-section-item-label'}>{'Value'}</p>
					<p className={'yearn--table-data-section-item-value'}>
						{formatUSD(Number(harvest.profitValue) - Number(harvest.lossValue))}
					</p>
				</div>

				<div
					className={'yearn--table-data-section-item md:col-span-3'}
					datatype={'number'}>
					<p className={'yearn--table-data-section-item-label'}>{'Date'}</p>
					<p
						className={'yearn--table-data-section-item-value'}
						style={{lineHeight: '24px'}}>
						{formatDate(Number(harvest.timestamp) * 1000)}
					</p>
				</div>

				<div
					className={'yearn--table-data-section-item md:col-span-3'}
					datatype={'number'}>
					<p className={'yearn--table-data-section-item-label'}>{'Hash'}</p>
					<a
						href={`https://etherscan.io/tx/${harvest.txHash}`}
						target={'_blank'}
						rel={'noreferrer'}>
						<div
							className={'font-number flex flex-row items-center space-x-2 text-neutral-900'}
							style={{lineHeight: '24px'}}>
							{truncateHex(harvest.txHash, 6)}
							<IconLinkOut className={'ml-2 size-4 md:ml-4'} />
						</div>
					</a>
				</div>
			</div>
		</div>
	);
}
