import IconLinkOut from '@yearn-finance/web-lib/icons/IconLinkOut';
import {toAddress, truncateHex} from '@yearn-finance/web-lib/utils/address';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import {STYBAL_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatToNormalizedAmount, toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatUSD} from '@yearn-finance/web-lib/utils/format.number';
import {formatDate} from '@yearn-finance/web-lib/utils/format.time';
import {ImageWithFallback} from '@common/components/ImageWithFallback';

import type {ReactElement} from 'react';
import type {TYDaemonVaultHarvest} from '@common/schemas/yDaemonVaultsSchemas';

type TRowProps = {
	label: string;
	value: string;
	className?: string;
	valueClassName?: string;
}
function Row({label, value, className, valueClassName}: TRowProps): ReactElement {
	return (
		<div className={cl('yearn--table-data-section-item', className)} datatype={'number'}>
			<p className={'yearn--table-data-section-item-label'}>{label}</p>
			<p className={cl('yearn--table-data-section-item-value', valueClassName)}>
				{value}
			</p>
		</div>
	);
}

function HarvestListRow({harvest}: {harvest: TYDaemonVaultHarvest}): ReactElement {
	const vaultName = toAddress(harvest.vaultAddress) === STYBAL_TOKEN_ADDRESS ? 'st-yBal' : 'lp-yBal';
	const gain = formatToNormalizedAmount(toBigInt(harvest.profit) - toBigInt(harvest.loss));
	const value = formatUSD(Number(harvest.profitValue) - Number(harvest.lossValue));
	const date = formatDate(Number(harvest.timestamp) * 1000);

	return (
		<div className={'yearn--table-wrapper'}>
			<div className={'yearn--table-token-section'}>
				<div className={'yearn--table-token-section-item'}>
					<div className={'yearn--table-token-section-item-image'}>
						<ImageWithFallback
							alt={vaultName}
							width={40}
							height={40}
							quality={90}
							src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${toAddress(harvest.vaultAddress)}/logo-128.png`}
							loading={'eager'} />
					</div>
					<p>
						{vaultName}
					</p>
				</div>
			</div>

			<div className={'yearn--table-data-section md:grid-cols-9'}>
				<Row label={'Gain'} value={gain} className={'md:col-span-1'} valueClassName={'font-bold'} />
				<Row label={'Value'} value={value} className={'md:col-span-2'} />
				<Row label={'Date'} value={date} className={'md:col-span-3'} valueClassName={'leading-6'} />
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
