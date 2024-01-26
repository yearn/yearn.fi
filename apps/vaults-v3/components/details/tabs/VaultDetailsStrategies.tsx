import {useMemo} from 'react';
import {useSortVaults} from '@vaults/hooks/useSortVaults';
import {useQueryArguments} from '@vaults/hooks/useVaultsQueryArgs';
import {VaultsV3ListHead} from '@vaults-v3/components/list/VaultsV3ListHead';
import {VaultsV3ListRow} from '@vaults-v3/components/list/VaultsV3ListRow';
import {ALL_VAULTSV3_CATEGORIES_KEYS} from '@vaults-v3/constants';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useYearn} from '@yearn-finance/web-lib/contexts/useYearn';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import {SearchBar} from '@common/components/SearchBar';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TSortDirection} from '@builtbymom/web3/types';
import type {TPossibleSortBy} from '@vaults/hooks/useSortVaults';

export function VaultDetailsStrategies({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const {vaults} = useYearn();
	const {sortDirection, sortBy, search, onSearch, onChangeSortDirection, onChangeSortBy} = useQueryArguments({
		defaultCategories: ALL_VAULTSV3_CATEGORIES_KEYS
	});

	const vaultList = useMemo((): TYDaemonVault[] => {
		const _vaultList = [];
		for (const strategy of currentVault?.strategies || []) {
			_vaultList.push(vaults[strategy.address]);
		}
		return _vaultList;
	}, [vaults, currentVault]);

	/* 🔵 - Yearn Finance **************************************************************************
	 **	Then, on the activeVaults list, we apply the search filter. The search filter is
	 **	implemented as a simple string.includes() on the vault name.
	 **********************************************************************************************/
	const searchedVaultsToDisplay = useMemo((): TYDaemonVault[] => {
		if (!search) {
			return vaultList;
		}
		return vaultList.filter((vault: TYDaemonVault): boolean => {
			const lowercaseSearch = search.toLowerCase();
			const splitted =
				`${vault.name} ${vault.symbol} ${vault.token.name} ${vault.token.symbol} ${vault.address} ${vault.token.address}`
					.toLowerCase()
					.split(' ');
			return splitted.some((word): boolean => word.startsWith(lowercaseSearch));
		});
	}, [vaultList, search]);

	/* 🔵 - Yearn Finance **************************************************************************
	 **	Then, once we have reduced the list of vaults to display, we can sort them. The sorting
	 **	is done via a custom method that will sort the vaults based on the sortBy and
	 **	sortDirection values.
	 **********************************************************************************************/
	const sortedVaultsToDisplay = useSortVaults([...searchedVaultsToDisplay], sortBy, sortDirection);

	return (
		<>
			<div className={'col-span-12 w-full p-4 md:px-8 md:pb-8'}>
				<div className={'w-1/2'}>
					<p className={'pb-2 text-[#757CA6]'}>{'Search'}</p>
					<SearchBar
						className={'max-w-none rounded-lg border-none bg-neutral-300 text-neutral-900 md:w-full'}
						iconClassName={'text-neutral-900'}
						searchPlaceholder={'YFI Vault'}
						searchValue={search as string}
						onSearch={onSearch}
					/>
				</div>
			</div>
			<div className={cl(sortedVaultsToDisplay.length === 0 ? 'hidden' : '')}>
				<div className={'grid grid-cols-12 px-8 pb-6 md:gap-6'}>
					<div className={'col-span-12 flex w-full flex-col'}>
						<VaultsV3ListHead
							sortBy={sortBy}
							sortDirection={sortDirection}
							onSort={(newSortBy: string, newSortDirection: string): void => {
								onChangeSortBy(newSortBy as TPossibleSortBy);
								onChangeSortDirection(newSortDirection as TSortDirection);
							}}
							items={[
								{label: 'Vault', value: 'name', sortable: true, className: 'col-span-2'},
								{label: 'Est. APR', value: 'estAPR', sortable: true, className: 'col-span-2'},
								{label: 'Hist. APR', value: 'apr', sortable: true, className: 'col-span-2'},
								{label: 'Available', value: 'available', sortable: true, className: 'col-span-2'},
								{label: 'Holdings', value: 'deposited', sortable: true, className: 'col-span-2'},
								{label: 'Deposits', value: 'tvl', sortable: true, className: 'col-span-2'}
							]}
						/>
						<div className={'grid gap-4'}>
							{sortedVaultsToDisplay
								.filter((v): boolean => Boolean(v?.chainID))
								.map(
									(vault): ReactElement => (
										<VaultsV3ListRow
											key={`${vault?.chainID}_${vault.address}`}
											currentVault={vault}
										/>
									)
								)}
						</div>
					</div>
				</div>
			</div>
			<div className={cl(sortedVaultsToDisplay.length === 0 && search === '' ? '' : 'hidden')}>
				<div className={'mx-auto flex h-96 w-full flex-col items-center justify-center px-10 py-2 md:w-3/4'}>
					<b className={'text-center text-lg'}>{'This vault IS the strategy'}</b>
					<p className={'text-center text-neutral-600'}>
						{"Surprise! This vault doesn't have any strategies. It is the strategy. #brainexplosion"}
					</p>
				</div>
			</div>
			<div className={cl(sortedVaultsToDisplay.length === 0 && search !== '' ? '' : 'hidden')}>
				<div className={'mx-auto flex h-96 w-full flex-col items-center justify-center px-10 py-2 md:w-3/4'}>
					<b className={'text-center text-lg'}>{'No vaults found'}</b>
					<p className={'text-center text-neutral-600'}>{'Try another search term'}</p>
					<Button
						className={'mt-4 w-full md:w-48'}
						onClick={(): void => onSearch('')}>
						{'Clear Search'}
					</Button>
				</div>
			</div>
		</>
	);
}
