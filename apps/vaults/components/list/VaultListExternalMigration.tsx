import React, {Fragment, useCallback, useMemo, useState} from 'react';
import {ethers} from 'ethers';
import {VaultListEmptyExternalMigration} from '@vaults/components/list/VaultsListEmpty';
import {useWalletForExternalMigrations} from '@vaults/contexts/useWalletForExternalMigrations';
import {useBeefyVaults} from '@vaults/hooks/useBeefyVaults';
import {useFindVault} from '@vaults/hooks/useFindVault';
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
import {useYearn} from '@common/contexts/useYearn';
import {useBalance} from '@common/hooks/useBalance';
import {formatPercent} from '@common/utils';
import {approveERC20, isApprovedERC20} from '@common/utils/actions/approveToken';
import {depositVia} from '@common/utils/actions/depositVia';

import type {ReactElement} from 'react';
import type {TPossibleSortBy, TPossibleSortDirection} from '@vaults/hooks/useSortVaults';
import type {TMigrationTable} from '@vaults/utils/migrationTable';

function	VaultListExternalMigrationRow({element}: {element: TMigrationTable}): ReactElement {
	const {vaults} = useYearn();
	const {isActive, provider} = useWeb3();
	const {balances, refresh: refreshExternalMigrations} = useWalletForExternalMigrations();
	const {refresh} = useWallet();
	const {safeChainID} = useChainID();
	const [txStatus, set_txStatus] = useState(defaultTxStatus);

	const	yearnVault = useFindVault(vaults, ({token}): boolean => toAddress(token.address) === toAddress(element.underlyingToken));
	const	balance = useBalance(element.tokenToMigrate, balances);
	const	oldAPY = element?.sourceAPY || 0;
	const	newAPY = yearnVault?.apy?.net_apy || 0;

	//TODO: Move away from this component to be able to display empty state 
	if (!yearnVault) {
		return <Fragment />;
	}

	async function onMigrateFlow(): Promise<void> {
		const	isApproved = await isApprovedERC20(
			provider as ethers.providers.Web3Provider, 
			toAddress(element.tokenToMigrate), //from
			toAddress(element.zapVia), //migrator
			balance.raw
		);

		if (isApproved) {
			new Transaction(provider, depositVia, set_txStatus).populate(
				toAddress(element.zapVia),
				element.service,
				toAddress(element.tokenToMigrate)
				// toAddress(selectedOptionTo?.value),
				// amount.raw
			).onSuccess(async (): Promise<void> => {
				await Promise.all([
					refresh(),
					refreshExternalMigrations()
				]);
			}).perform();
		} else {
			new Transaction(provider, approveERC20, set_txStatus).populate(
				toAddress(element.tokenToMigrate), //from
				toAddress(element.zapVia), //migrator
				ethers.constants.MaxUint256 //amount
			).onSuccess(async (): Promise<void> => {
				await onMigrateFlow();
			}).perform();
		}
	}

	return (
		<div className={'yearn--table-wrapper group'}>
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
						isDisabled={!isActive}
						onClick={onMigrateFlow}>
						{'Migrate'}
					</Button>
				</div>
			</div>
		</div>
	);
}


function	VaultListExternalMigration(): ReactElement {
	const	{balances, balancesNonce} = useWalletForExternalMigrations();
	const	[sortBy, set_sortBy] = useState<TPossibleSortBy>('apy');
	const	[sortDirection, set_sortDirection] = useState<TPossibleSortDirection>('desc');
	
	const 	{vaults: beefyVaults} = useBeefyVaults();
	
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


	const	possibleBowswapMigrations = useMemo((): TMigrationTable[] => {
		balancesNonce; // remove warning, force deep refresh
		const	migration: TMigrationTable[] = [];
		
		Object.values(migrationTable || {}).forEach((possibleBowswapMigrations: TMigrationTable[]): void => {
			for (const element of possibleBowswapMigrations) {
				if ((balances[toAddress(element.tokenToMigrate)]?.raw || ethers.constants.Zero).gt(0)) {
					migration.push(element);
				}
			}
		});

		return migration;
	}, [balances, balancesNonce]);

	const	possibleBeefyMigrations = useMemo((): TMigrationTable[] => {
		return beefyVaults.reduce((migratableVaults, bVault): TMigrationTable[] => {
			if (!bVault.tokenAddress) {
				return migratableVaults; 
			}
			const	element: TMigrationTable = {
				service: 3,
				symbol: bVault.name,
				zapVia: toAddress(ethers.constants.AddressZero),
				tokenToMigrate: toAddress(bVault.tokenAddress),
				underlyingToken: toAddress(bVault.tokenAddress),
				sourceAPY: bVault.apy
			};
			return [...migratableVaults, element];
		}, [] as TMigrationTable[]);
	}, [beefyVaults]);

	return (
		<div className={'col-span-12 flex w-full flex-col bg-neutral-100'}>
			<div className={'flex flex-col items-start justify-between space-x-0 px-4 pt-4 pb-2 md:px-10 md:pt-10 md:pb-8'}>
				<div className={'mb-6'}>
					<h2 className={'text-lg font-bold md:text-3xl'}>{'Migrations'}</h2>
				</div>

				<div className={'hidden w-full flex-row items-center justify-between space-x-4 md:flex'}>
					<p>{'We looked in your wallet to see if you\'ve got tokens deposited somewhere in the DeFi ecosystem that could be earning more with Yearn. To enjoy the best risk adjusted yields in DeFi, benefit from auto-compounding, and live the good life. Click migrate.'}</p>
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

			<div>
				{
					possibleBowswapMigrations.length === 0 && possibleBeefyMigrations.length >= 0 ? (
						<VaultListEmptyExternalMigration />
					) : (
						<Fragment>
							{possibleBowswapMigrations.map((element: TMigrationTable): ReactElement => (
								<VaultListExternalMigrationRow
									key={`${element.tokenToMigrate}_${element.service}`}
									element={element} />
							))}
							{possibleBeefyMigrations.map((element: TMigrationTable): ReactElement => (
								<VaultListExternalMigrationRow
									key={`${element.tokenToMigrate}_${element.service}`}
									element={element} />
							))}
						</Fragment>
					)
				}

			</div>
		</div>
	);
}

export default VaultListExternalMigration;
