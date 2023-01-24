import React, {useMemo, useState} from 'react';
import Link from 'next/link';
import {ethers} from 'ethers';
import {useWalletForInternalMigrations} from '@vaults/contexts/useWalletForInternalMigrations';
import {zap} from '@vaults/utils/actions/migrateVeCRV';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ZAP_YEARN_VE_CRV_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {defaultTxStatus, Transaction} from '@yearn-finance/web-lib/utils/web3/transaction';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {useWallet} from '@common/contexts/useWallet';
import {useBalance} from '@common/hooks/useBalance';
import {getVaultName} from '@common/utils';
import {approveERC20, isApprovedERC20} from '@common/utils/actions/approveToken';
import {migrateShares} from '@common/utils/actions/migrateShares';

import type {ReactElement} from 'react';
import type {TYearnVault} from '@common/types/yearn';

function	VaultsListInternalMigrationRow({currentVault}: {currentVault: TYearnVault}): ReactElement {
	const {isActive, provider} = useWeb3();
	const {balances, refresh: refreshInternalMigrations} = useWalletForInternalMigrations();
	const {refresh} = useWallet();
	const {safeChainID} = useChainID();
	const [txStatus, set_txStatus] = useState(defaultTxStatus);

	const vaultName = useMemo((): string => getVaultName(currentVault), [currentVault]);
	const balanceToMigrate = useBalance(currentVault.address, balances);

	async function onMigrateFlow(): Promise<void> {
		const	isApproved = await isApprovedERC20(
			provider as ethers.providers.Web3Provider,
			toAddress(currentVault.address), //from
			toAddress(currentVault.migration.contract), //migrator
			formatBN(balanceToMigrate.raw)
		);

		if (isApproved) {
			if (toAddress(currentVault.migration.contract) === ZAP_YEARN_VE_CRV_ADDRESS) {
				// yveCRV or yvBOOST migration
				await new Transaction(provider, zap, set_txStatus).populate(
					toAddress(currentVault.address), //_input_token
					toAddress(currentVault.migration.address), //_output_token
					balanceToMigrate.raw || ethers.constants.MaxUint256 //_amount
				).onSuccess(async (): Promise<void> => {
					await Promise.all([
						refresh([{token: toAddress(currentVault.migration.address)}]),
						refreshInternalMigrations([{token: toAddress(currentVault.address)}])
					]);
				}).perform();
			} else {
				// using provided migration contract
				await new Transaction(provider, migrateShares, set_txStatus).populate(
					toAddress(currentVault.migration.contract), //migrator
					toAddress(currentVault.address), //from
					toAddress(currentVault.migration.address) //to
				).onSuccess(async (): Promise<void> => {
					await Promise.all([
						refresh([{token: toAddress(currentVault.migration.address)}]),
						refreshInternalMigrations([{token: toAddress(currentVault.address)}])
					]);
				}).perform();
			}
		} else {
			const	isSuccess = await new Transaction(provider, approveERC20, set_txStatus, {shouldIgnoreSuccessTxStatusChange: true}).populate(
				toAddress(currentVault.address), //from
				toAddress(currentVault.migration.contract), //migrator
				ethers.constants.MaxUint256 //amount
			).perform();
			if (isSuccess) {
				onMigrateFlow();
			}
		}
	}

	return (
		<div className={'w-full'}>
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
						<div className={'text-left'}>
							<p>{vaultName}</p>
							<p className={'font-number text-xs'}>{`${formatAmount(balanceToMigrate.normalized)} ${currentVault.token.symbol}`}</p>
						</div>
					</div>
				</div>

				<div className={'yearn--table-data-section'}>
					<div className={'yearn--table-data-section-item h-auto text-left text-neutral-0 md:col-span-6 md:py-2'}>
						{'Looks like you\'re holding tokens for an old version of this Vault. To keep earning yield on your assets, migrate to the current Vault.'}
					</div>

					<div className={'col-span-2 flex h-auto flex-row items-center justify-between space-x-4 py-4 md:justify-end'}>
						<Button
							variant={'reverted'}
							className={'yearn--button-smaller !w-full'}
							onClick={onMigrateFlow}
							isBusy={txStatus.pending}
							isDisabled={!isActive}>
							{'Migrate'}
						</Button>

						<Link
							href={`/vaults/${currentVault.chainID}/${toAddress(currentVault.address)}`}
							data-variant={'reverted'}
							className={'yearn--button-smaller reverted !w-full text-center'}>
							{'Details'}
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}

export {VaultsListInternalMigrationRow};
