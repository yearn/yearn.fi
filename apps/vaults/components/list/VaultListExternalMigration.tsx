import React, {Fragment, useCallback, useMemo, useState} from 'react';
import {ethers} from 'ethers';
import {useWalletForExternalMigrations} from '@vaults/contexts/useWalletForExternalMigrations';
import {migrationTable} from '@vaults/utils/migrationTable';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import {defaultTxStatus, Transaction} from '@yearn-finance/web-lib/utils/web3/transaction';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import ListHead from '@common/components/ListHead';
import {useWallet} from '@common/contexts/useWallet';
import {useBalance} from '@common/hooks/useBalance';
import {formatPercent} from '@common/utils';
import {approveERC20, isApprovedERC20} from '@common/utils/actions/approveToken';
import {depositVia} from '@common/utils/actions/depositVia';

import type {ReactElement} from 'react';
import type {TPossibleSortBy, TPossibleSortDirection} from '@vaults/hooks/useSortVaults';
import type {TMigrationTable} from '@vaults/utils/migrationTable';

function	VaultListExternalMigrationRow(
	{element}: {element: TMigrationTable}
): ReactElement {
	const {isActive, provider} = useWeb3();
	const {balances, refresh: refreshMigrableFromDefi} = useWalletForExternalMigrations();
	const {refresh} = useWallet();
	const {safeChainID} = useChainID();
	const [txStatus, set_txStatus] = useState(defaultTxStatus);

	const	balance = useBalance(element.migrableToken, balances);
	const	oldAPY = 0.004;
	const	newAPY = 0.04;

	async function onMigrateFlow(): Promise<void> {
		const	isApproved = await isApprovedERC20(
			provider as ethers.providers.Web3Provider, 
			toAddress(element.migrableToken), //from
			toAddress(element.zapVia), //migrator
			balance.raw
		);

		if (isApproved) {
			new Transaction(provider, depositVia, set_txStatus).populate(
				toAddress(element.zapVia),
				element.service,
				toAddress(element.migrableToken)
				// toAddress(selectedOptionTo?.value),
				// amount.raw
			).onSuccess(async (): Promise<void> => {
				await Promise.all([
					refresh(),
					refreshMigrableFromDefi()
				]);
			}).perform();
		} else {
			new Transaction(provider, approveERC20, set_txStatus).populate(
				toAddress(element.migrableToken), //from
				toAddress(element.zapVia), //migrator
				ethers.constants.MaxUint256 //amount
			).onSuccess(async (): Promise<void> => {
				await onMigrateFlow();
			}).perform();
		}
	}

	return (
		<button onClick={onMigrateFlow} className={'w-full'}>
			<div className={'yearn--table-wrapper'}>
				<div className={'yearn--table-token-section'}>
					<div className={'yearn--table-token-section-item'}>
						<div className={'yearn--table-token-section-item-image'}>
							<ImageWithFallback
								alt={''}
								width={40}
								height={40}
								quality={90}
								src={`${process.env.BASE_YEARN_ASSETS_URI}/${safeChainID}/${element.underlyingToken}/logo-128.png`}
								loading={'eager'} />
						</div>
						<p>{element.symbol}</p>
					</div>
				</div>


				<div className={'yearn--table-data-section'}>
					<div className={'yearn--table-data-section-item md:col-span-2'} datatype={'number'}>
						<label className={'yearn--table-data-section-item-label'}>{'APY'}</label>
						<p className={'yearn--table-data-section-item-value'}>
							{formatPercent((oldAPY || 0) * 100)}
						</p>
					</div>

					<div className={'yearn--table-data-section-item md:col-span-2'} datatype={'number'}>
						<label className={'yearn--table-data-section-item-label'}>{'APY'}</label>
						<b className={'yearn--table-data-section-item-value'}>
							{formatPercent((newAPY || 0) * 100)}
						</b>
					</div>

					<div className={'yearn--table-data-section-item md:col-span-2'} datatype={'number'}>
						<label className={'yearn--table-data-section-item-label'}>{'Deposited'}</label>
						<p className={`yearn--table-data-section-item-value ${balance.raw.isZero() ? 'text-neutral-400' : 'text-neutral-900'}`}>
							{formatAmount(balance.normalized)}
						</p>
					</div>

					<div className={'col-span-1 hidden h-8 flex-col items-end px-0 pt-0 md:col-span-2 md:flex md:h-14 md:pt-4'}>
						<Button
							className={'yearn--button-smaller !w-full'}
							isBusy={txStatus.pending}
							isDisabled={!isActive}>
							{'Migrate'}
						</Button>
					</div>
				</div>
			</div>
		</button>
	);
}


function	VaultListExternalMigration(): ReactElement {
	const	{balances} = useWalletForExternalMigrations();
	const	[sortBy, set_sortBy] = useState<TPossibleSortBy>('apy');
	const	[sortDirection, set_sortDirection] = useState<TPossibleSortDirection>('desc');
	
	/* 🔵 - Yearn Finance **************************************************************************
	**	Callback method used to sort the vaults list.
	**	The use of useCallback() is to prevent the method from being re-created on every render.
	**********************************************************************************************/
	const	onSort = useCallback((newSortBy: string, newSortDirection: string): void => {
		performBatchedUpdates((): void => {
			set_sortBy(newSortBy as TPossibleSortBy);
			set_sortDirection(newSortDirection as TPossibleSortDirection);
		});
	}, []);


	const	possibleMigrations = useMemo((): TMigrationTable[] => {
		const	migration: TMigrationTable[] = [];
		
		Object.values(migrationTable || {}).forEach((possibleMigrations: TMigrationTable[]): void => {
			for (const element of possibleMigrations) {
				console.log(element);
				if ((balances[toAddress(element.migrableToken)]?.raw || ethers.constants.Zero).gt(0)) {
					migration.push(element);
				}
			}
		});

		return migration;
	}, [balances]);


	if (possibleMigrations.length === 0) {
		return <Fragment />;
	}

	return (
		<div className={'col-span-12 flex w-full flex-col bg-neutral-100'}>
			<div className={'flex flex-col items-start justify-between space-x-0 px-4 pt-4 pb-2 md:px-10 md:pt-10 md:pb-8'}>
				<div className={'mb-6'}>
					<h2 className={'text-lg font-bold md:text-3xl'}>{'Migrations'}</h2>
				</div>

				<div className={'hidden w-full flex-row items-center justify-between space-x-4 md:flex'}>
					<p>{'You can move your assets from other DeFi platforms to Yearn in order to access higher yields and auto-compounding. When you migrate your assets to Yearn, you are supporting the DeFi ecosystem by helping to keep other platforms active. Overall, the migration feature is a convenient way for you to maximize your returns on your DeFi assets.'}</p>
				</div>
			</div>

			<ListHead
				sortBy={sortBy}
				sortDirection={sortDirection}
				onSort={onSort}
				items={[
					{label: 'Token', value: 'name', sortable: true},
					{label: 'Source APY', value: 'apy', sortable: true, className: 'col-span-2'},
					{label: 'Yean\'s APY', value: 'available', sortable: true, className: 'col-span-2'},
					{label: 'Available', value: 'deposited', sortable: true, className: 'col-span-2'},
					{label: '', value: '', sortable: false, className: 'col-span-2'}
				]} />

			<div className={'my-4'}>
				{
					possibleMigrations.map((element: TMigrationTable): ReactElement => (
						<VaultListExternalMigrationRow
							key={`${element.migrableToken}_${element.service}`}
							element={element} />
					))
				}
			</div>
		</div>
	);
}

export default VaultListExternalMigration;
