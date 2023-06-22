import {useMemo} from 'react';
import Link from 'next/link';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import TokenIcon from '@common/components/TokenIcon';
import {useWallet} from '@common/contexts/useWallet';
import {useBalance} from '@common/hooks/useBalance';
import {getVaultName} from '@common/utils';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';

function VaultsListRetired({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const {balances} = useWallet();
	const vaultName = useMemo((): string => getVaultName(currentVault), [currentVault]);
	const balanceToMigrate = useBalance(currentVault.address, balances);

	return (
		<Link
			href={`/vaults/${currentVault.chainID}/${toAddress(currentVault.address)}?action=withdraw`}
			className={'w-full'}>
			<div className={'yearn--table-wrapper bg-neutral-900 text-neutral-0'}>
				<div className={'yearn--table-token-section'}>
					<div className={'yearn--table-token-section-item'}>
						<div className={'yearn--table-token-section-item-image'}>
							<TokenIcon
								chainID={currentVault.chainID}
								size={40}
								token={currentVault.token} />
						</div>
						<div className={'text-left'}>
							<p>{vaultName}</p>
							<p className={'font-number text-xs'}>{`${formatAmount(balanceToMigrate.normalized)} ${currentVault.token.symbol}`}</p>
						</div>
					</div>
				</div>

				<div className={'yearn--table-data-section'}>
					<div className={'yearn--table-data-section-item inline h-auto text-left text-neutral-0 md:col-span-6 md:py-2'}>
						<b>{'This Vault is no longer supported. '}</b>
						{'Sadly this vault is deprecated and will no longer earn yield. Please withdraw your funds (many other Vaults await you anon).'}
					</div>

					<div className={'col-span-2 flex h-auto flex-row items-center justify-between space-x-4 py-4 md:justify-end'}>
						<button
							data-variant={'reverted'}
							className={'yearn--button-smaller reverted !w-full text-center'}>
							{'Withdraw'}
						</button>
					</div>
				</div>
			</div>
		</Link>
	);
}

export {VaultsListRetired};
