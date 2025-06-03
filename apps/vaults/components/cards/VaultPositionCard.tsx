import Link from 'next/link';
import {formatAmount, formatPercent, toAddress} from '@builtbymom/web3/utils';
import {VAULT_NAME_REPLACEMENTS} from '@vaults/constants';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {replaceStrings} from '@common/utils/helpers';

import type {FC} from 'react';
import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TNormalizedBN} from '@builtbymom/web3/types';

export const VaultPositionCard: FC<{
	vault: TYDaemonVault & {totalBalance: TNormalizedBN; totalValue: number};
}> = ({vault}) => {
	if (!vault) return null;

	const title = replaceStrings(vault.name, VAULT_NAME_REPLACEMENTS, '');
	const apr = vault.apr?.forwardAPR?.netAPR || 0;
	const isV3 = vault.version.startsWith('3') || vault.version.startsWith('~3');
	const href = isV3
		? `/v3/${vault.chainID}/${toAddress(vault.address)}`
		: `/v2/${vault.chainID}/${toAddress(vault.address)}`;

	return (
		<Link href={href}>
			<div
				className={
					'group relative flex cursor-pointer items-center justify-between overflow-hidden rounded-lg border border-black/10 bg-black/20 transition-all hover:bg-black/5 '
				}>
				<div className={'flex size-full flex-row items-center '}>
					<div className={'flex w-full flex-col gap-3 p-4'}>
						<div className={'flex items-center gap-2'}>
							<div className={'rounded-full'}>
								<ImageWithFallback
									src={`${process.env.BASE_YEARN_ASSETS_URI}/${vault.chainID}/${vault.token.address}/logo-128.png`}
									alt={vault.symbol}
									width={28}
									height={28}
								/>
							</div>
							<p className={'text-[18px] font-medium text-neutral-900'}>{title}</p>
						</div>
						<div className={'h-px w-full bg-white/10'} />
						<div className={'flex w-full flex-row items-center justify-between gap-4'}>
							<p className={'text-[14px] font-medium text-neutral-900'}>
								<span className={'text-neutral-400 dark:text-neutral-900/50'}>{'$'}</span>
								{formatAmount(vault.totalValue)}
							</p>
							{apr > 0 && (
								<p
									className={
										'text-[14px] text-neutral-400 dark:text-neutral-900/50'
									}>{`${formatPercent(apr * 100, 2, 2)} APY`}</p>
							)}
						</div>
					</div>
					<div
						className={
							'bg-neutral-50/20 flex w-[40px] items-center justify-center self-stretch group-hover:bg-white/5'
						}>
						<svg
							className={'size-4 text-neutral-600'}
							fill={'none'}
							stroke={'currentColor'}
							viewBox={'0 0 24 24'}>
							<path
								strokeLinecap={'round'}
								strokeLinejoin={'round'}
								strokeWidth={2}
								d={'M7 17L17 7M17 7H7M17 7V17'}
							/>
						</svg>
					</div>
				</div>
			</div>
		</Link>
	);
};
