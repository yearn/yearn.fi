import React, {useMemo, useState} from 'react';
import {ethers} from 'ethers';
import {useMigratableWallet} from '@vaults/contexts/useMigratableWallet';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {defaultTxStatus, Transaction} from '@yearn-finance/web-lib/utils/web3/transaction';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {useBalance} from '@common/hooks/useBalance';
import {getVaultName} from '@common/utils';
import {approveERC20, isApprovedERC20} from '@common/utils/actions/approveToken';
import {migrateShares} from '@common/utils/actions/migrateShares';

import type {ReactElement} from 'react';
import type {TYearnVault} from '@common/types/yearn';

function	VaultsListMigratableRow({currentVault}: {currentVault: TYearnVault}): ReactElement {
	const {isActive, provider} = useWeb3();
	const {balances, refresh} = useMigratableWallet();
	const {safeChainID} = useChainID();
	const [txStatus, set_txStatus] = useState(defaultTxStatus);

	const vaultName = useMemo((): string => getVaultName(currentVault), [currentVault]);
	const balanceToMigrate = useBalance(currentVault.address, balances);

	async function onMigrateFlow(): Promise<void> {
		const	isApproved = await isApprovedERC20(
			provider as ethers.providers.Web3Provider, 
			toAddress(currentVault.address), //from
			toAddress(currentVault.migration.contract), //migrator
			balanceToMigrate.raw || ethers.constants.Zero
		);

		if (isApproved) {
			new Transaction(provider, migrateShares, set_txStatus).populate(
				toAddress(currentVault.migration.contract), //migrator
				toAddress(currentVault.address), //from
				toAddress(currentVault.migration.address) //to
			).onSuccess(async (): Promise<void> => {
				await refresh();
			}).perform();
		} else {
			new Transaction(provider, approveERC20, set_txStatus).populate(
				toAddress(currentVault.address), //from
				toAddress(currentVault.migration.contract), //migrator
				ethers.constants.MaxUint256 //amount
			).onSuccess(async (): Promise<void> => {
				await onMigrateFlow();
			}).perform();
		}
	}

	return (
		<button onClick={onMigrateFlow} className={'w-full'}>
			<div className={'yearn--table-wrapper bg-neutral-900 text-neutral-0'}>
				<div className={'yearn--table-token-section'}>
					<div className={'yearn--table-token-section-item'}>
						<div className={'yearn--table-token-section-item-image'}>
							<ImageWithFallback
								alt={vaultName}
								width={40}
								height={40}
								quality={90}
								src={`${process.env.BASE_YEARN_ASSETS_URI}/${safeChainID}/${toAddress(currentVault.token.address)}/logo-128.png`}
								loading={'eager'} />
						</div>
						<p>{vaultName}</p>
					</div>
				</div>

				<div className={'yearn--table-data-section'}>
					<div className={'yearn--table-data-section-item h-auto text-left text-neutral-0 md:col-span-6 md:py-2'}>
						{'Looks like you\'re holding tokens for an old version of this Vault. To keep earning yield on your assets, migrate to the current Vault.'}
					</div>

					<div className={'col-span-2 flex h-8 flex-row items-center justify-between md:h-auto md:justify-end md:py-4'}>
						<Button
							variant={'reverted'}
							className={'yearn--button-smaller !w-full'}
							isBusy={txStatus.pending}
							isDisabled={!isActive}>
							{`Migrate ${formatAmount(balanceToMigrate.normalized)} ${currentVault.token.symbol}`}
						</Button>
					</div>
				</div>
			</div>
		</button>
	);
}

export {VaultsListMigratableRow};
