import React from 'react';
import Link from 'next/link';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {formatUSD} from '@common/utils';

import type {ReactElement} from 'react';
import type {TMigratableVault} from '@vaults/utils/types';

type TProps = {
	vault: TMigratableVault;
}

export function MigratableVaultListRow({vault}: TProps): ReactElement | null {
	const {safeChainID} = useChainID();

	if (!vault.address) {
		return null;
	}

	return (
		<Link key={`${vault.address}`} href={`/vaults/${safeChainID}/${toAddress(vault.address)}`}>
			<div className={'yearn--table-wrapper cursor-pointer transition-colors hover:bg-neutral-300'}>
				<div className={'yearn--table-token-section'}>
					<div className={'yearn--table-token-section-item'}>
						<div className={'yearn--table-token-section-item-image'}>
							<ImageWithFallback
								alt={vault.name}
								width={40}
								height={40}
								quality={90}
								src={`${process.env.BASE_YEARN_ASSETS_URI}/${safeChainID}/${toAddress(vault.address)}/logo-128.png`}
								loading={'eager'} />
						</div>
						<p>{vault.name}</p>
					</div>
				</div>

				<div className={'yearn--table-data-section'}>
					<div className={'yearn--table-data-section-item md:col-span-2'} datatype={'number'}>
						<label className={'yearn--table-data-section-item-label'}>{'Available'}</label>
						<p className={'yearn--table-data-section-item-value text-neutral-400'}>
							{formatAmount(0)}
						</p>
					</div>

					<div className={'yearn--table-data-section-item md:col-span-2'} datatype={'number'}>
						<label className={'yearn--table-data-section-item-label'}>{'Deposited'}</label>
						<p className={'yearn--table-data-section-item-value text-neutral-400'}>
							{formatAmount(0)}
						</p>
					</div>

					<div className={'col-span-1 hidden h-8 flex-col items-end px-0 pt-0 md:col-span-2 md:flex md:h-14 md:pt-4'}>
						<p className={'yearn--table-data-section-item-value font-number text-end'}>
							{formatUSD(0, 0, 0)}
						</p>
						<div className={'mt-1 w-2/3'}>
							<div className={'relative h-1 w-full bg-neutral-400'}>
								<div
									className={'absolute left-0 top-0 h-1 w-full bg-neutral-900'}
									style={{width: `${0}%`}} />
							</div>
						</div>
					</div>
				</div>
			</div>
		</Link>
	);
}
