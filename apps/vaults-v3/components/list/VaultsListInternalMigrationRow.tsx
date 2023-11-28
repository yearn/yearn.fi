import Link from 'next/link';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {useBalance} from '@common/hooks/useBalance';

import {VaultChainTag} from '../VaultChainTag';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';

export function VaultsListInternalMigrationRow({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const balanceToMigrate = useBalance({address: currentVault.address, chainID: currentVault.chainID});

	return (
		<div className={cl('grid w-full grid-cols-1 md:grid-cols-12 rounded-3xl', 'p-6 pt-2 md:pr-10', 'relative')}>
			<div
				className={cl(
					'absolute inset-0 rounded-3xl',
					'opacity-20 pointer-events-none',
					'bg-[linear-gradient(80deg,_#2C3DA6,_#D21162)]'
				)}
			/>
			<div className={cl('col-span-3 z-10', 'flex flex-row items-center justify-between')}>
				<div className={'flex flex-row space-x-6'}>
					<div className={'mt-2.5 h-8 w-8 rounded-full md:flex'}>
						<ImageWithFallback
							src={`${process.env.BASE_YEARN_ASSETS_URI}/${currentVault.chainID}/${currentVault.token.address}/logo-32.png`}
							alt={''}
							width={32}
							height={32}
						/>
					</div>
					<div>
						<strong className={'mb-1 block text-xl font-black text-neutral-800'}>
							{currentVault.name}
						</strong>
						<p className={'mb-2 block text-neutral-800'}>{currentVault.token.name}</p>
						<VaultChainTag chainID={currentVault.chainID} />
					</div>
				</div>
			</div>

			<div className={cl('col-span-9 z-10', 'flex flex-col md:flex-row items-center', 'gap-x-7', 'mt-8 md:mt-0')}>
				<div className={cl('flex justify-between', 'text-left text-neutral-800/80 whitespace-break-spaces')}>
					{"Looks like you're holding tokens from a previous version of this vault.\n"}
					{'To keep earning yield on your assets, migrate to the current vault.'}
				</div>

				<div className={'mt-6 flex w-full items-center md:ml-auto md:mt-0 md:justify-end'}>
					<Link
						className={'w-full'}
						href={`/vaults/${currentVault.chainID}/${toAddress(currentVault.address)}`}>
						<button
							className={cl(
								'rounded-lg overflow-hidden flex',
								'px-4 py-2 w-full',
								'relative group',
								'border-none'
							)}>
							<div
								className={cl(
									'absolute inset-0',
									'opacity-80 transition-opacity group-hover:opacity-100 pointer-events-none',
									'bg-[linear-gradient(80deg,_#D21162,_#2C3DA6)]'
								)}
							/>
							<p className={'z-10 mx-auto whitespace-nowrap text-neutral-900'}>
								{'Migrate '}
								{`${formatAmount(balanceToMigrate.normalized)} ${currentVault.token.symbol}`}
							</p>
						</button>
					</Link>
				</div>
			</div>
		</div>
	);
}
