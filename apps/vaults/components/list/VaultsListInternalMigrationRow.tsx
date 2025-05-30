import {useMemo} from 'react';
import Link from 'next/link';
import {formatAmount, toAddress} from '@lib/utils';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {useYearnBalance} from '@common/hooks/useYearnBalance';
import {getVaultName} from '@common/utils';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@lib/utils/schemas/yDaemonVaultsSchemas';

export function VaultsListInternalMigrationRow({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const vaultName = useMemo((): string => getVaultName(currentVault), [currentVault]);
	const balanceToMigrate = useYearnBalance({address: currentVault.address, chainID: currentVault.chainID});

	return (
		<Link
			prefetch={false}
			href={`/vaults/${currentVault.chainID}/${toAddress(currentVault.address)}`}
			className={'w-full'}>
			<div className={'yearn--table-wrapper bg-neutral-900 text-neutral-0'}>
				<div className={'yearn--table-token-section'}>
					<div className={'yearn--table-token-section-item'}>
						<div className={'yearn--table-token-section-item-image'}>
							<ImageWithFallback
								src={`${process.env.BASE_YEARN_ASSETS_URI}/${currentVault.chainID}/${toAddress(
									currentVault.token.address
								)}/logo-32.png`}
								alt={''}
								width={32}
								height={32}
							/>
						</div>
						<div className={'text-left'}>
							<p>{vaultName}</p>
							<p className={'font-number text-xs'}>{`${formatAmount(balanceToMigrate.normalized)} ${
								currentVault.token.symbol
							}`}</p>
						</div>
					</div>
				</div>

				<div className={'yearn--table-data-section'}>
					<div
						className={
							'yearn--table-data-section-item h-auto text-left text-neutral-0 md:col-span-6 md:py-2'
						}>
						{
							"Looks like you're holding tokens from a previous version of this vault. To keep earning yield on your assets, migrate to the current vault."
						}
					</div>

					<div
						className={
							'col-span-2 flex h-auto flex-row items-center justify-between space-x-4 py-4 md:justify-end'
						}>
						<button
							data-variant={'reverted'}
							className={'yearn--button-smaller reverted !w-full text-center'}>
							{'Migrate'}
						</button>
					</div>
				</div>
			</div>
		</Link>
	);
}
