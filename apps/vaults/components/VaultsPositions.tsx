import {useMemo, useState} from 'react';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {cl, toNormalizedBN} from '@builtbymom/web3/utils';
import {useYearn} from '@common/contexts/useYearn';

import {VaultsListHead} from './VaultsListHead';
import {VaultsListRow} from './VaultsListRow';
import {VaultBalanceCard} from './cards/VaultBalanceCard';
import {VaultEmptyCard} from './cards/VaultEmptyCard';
import {VaultPositionCard} from './cards/VaultPositionCard';

import type {FC} from 'react';
import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TSortDirection} from '@builtbymom/web3/types';

enum TVaultsPositionsView {
	Empty = 'Empty',
	Card = 'Card',
	Table = 'Table'
}

const getVaultsPositionsView = (userPositions: TYDaemonVault[]): TVaultsPositionsView => {
	if (userPositions.length === 0) return TVaultsPositionsView.Empty;
	if (userPositions.length < 4) return TVaultsPositionsView.Card;
	return TVaultsPositionsView.Table;
};

export const VaultsPositions: FC = () => {
	const {address, isActive} = useWeb3();
	const {
		vaults,
		vaultsMigrations,
		vaultsRetired,
		getBalance,
		getPrice,
		cumulatedValueInV2Vaults,
		cumulatedValueInV3Vaults
	} = useYearn();

	const [sortBy, set_sortBy] = useState<string>('totalValue');
	const [sortDirection, set_sortDirection] = useState<TSortDirection>('desc');
	const [viewOverride, set_viewOverride] = useState<TVaultsPositionsView | null>(null);

	const userPositions = useMemo(() => {
		if (!isActive || !address) return [];

		const allVaults = [
			...Object.values(vaults),
			...Object.values(vaultsMigrations),
			...Object.values(vaultsRetired)
		];

		const positions = allVaults
			.map(vault => {
				const vaultBalance = getBalance({address: vault.address, chainID: vault.chainID});
				const stakingBalance =
					vault.staking.available && vault.staking.address
						? getBalance({address: vault.staking.address, chainID: vault.chainID})
						: toNormalizedBN(0n, vault.decimals);

				const totalBalance = toNormalizedBN(vaultBalance.raw + stakingBalance.raw, vault.decimals);
				const tokenPrice = getPrice({address: vault.address, chainID: vault.chainID});
				const totalValue = totalBalance.normalized * tokenPrice.normalized;

				return {
					...vault,
					totalBalance,
					totalValue
				};
			})
			.filter(vault => vault.totalBalance.raw > 0n && vault.totalValue >= 0.01);

		if (sortBy === 'totalValue') {
			return positions.sort((a, b) =>
				sortDirection === 'desc' ? b.totalValue - a.totalValue : a.totalValue - b.totalValue
			);
		}
		if (sortBy === 'name') {
			return positions.sort((a, b) =>
				sortDirection === 'desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)
			);
		}
		return positions.sort((a, b) => b.totalValue - a.totalValue);
	}, [address, isActive, vaults, vaultsMigrations, vaultsRetired, sortBy, sortDirection, getBalance, getPrice]);

	const totalDeposited = cumulatedValueInV2Vaults + cumulatedValueInV3Vaults;

	const handleSort = (newSortBy: string, newSortDirection: TSortDirection): void => {
		set_sortBy(newSortBy);
		set_sortDirection(newSortDirection);
	};

	const handleExpansionClick = (): void => {
		const currentView = viewOverride || getVaultsPositionsView(userPositions);
		if (currentView === TVaultsPositionsView.Card) {
			set_viewOverride(TVaultsPositionsView.Table);
		} else if (currentView === TVaultsPositionsView.Table) {
			set_viewOverride(TVaultsPositionsView.Card);
		}
	};

	const VaultView: TVaultsPositionsView = useMemo(() => {
		if (viewOverride) return viewOverride;
		return getVaultsPositionsView(userPositions);
	}, [userPositions, viewOverride]);

	// Adjust
	const styles = useMemo(() => {
		const cards = 'flex flex-col md:flex-row gap-2 md:p-0 p-2';
		if ([TVaultsPositionsView.Card, TVaultsPositionsView.Empty].includes(VaultView)) {
			return {
				divider: 'w-full h-px md:h-[100px] md:w-px',
				content: 'flex-col md:flex-row md:items-center md:gap-8',
				cards
			};
		}
		return {
			divider: 'h-px w-full',
			content: 'flex-col',
			cards
		};
	}, [VaultView]);

	return (
		<div
			className={`flex rounded-[16px] border border-dashed border-neutral-900/10 bg-neutral-900/10 ${styles.content}`}>
			<VaultBalanceCard
				showExpandButton={VaultView !== TVaultsPositionsView.Empty}
				isExpanded={VaultView === TVaultsPositionsView.Table}
				balance={totalDeposited}
				onExpansionClick={handleExpansionClick}
			/>
			<div className={`bg-white/10 ${styles.divider}`} />
			{VaultView === TVaultsPositionsView.Empty && (
				<div className={styles.cards}>
					<VaultEmptyCard />
				</div>
			)}
			{VaultView === TVaultsPositionsView.Card && (
				<div className={styles.cards}>
					{userPositions.map((vault, index) => (
						<VaultPositionCard
							key={index}
							vault={vault}
						/>
					))}
				</div>
			)}
			{VaultView === TVaultsPositionsView.Table && (
				<div className={''}>
					<div className={cl(styles.cards, 'block md:hidden')}>
						{userPositions.map((vault, index) => (
							<VaultPositionCard
								key={index}
								vault={vault}
							/>
						))}
					</div>
					<div className={'hidden p-4 md:block dark:bg-black/20'}>
						<div className={'col-span-12 flex w-full flex-col'}>
							<VaultsListHead
								sortBy={sortBy}
								sortDirection={sortDirection}
								onSort={handleSort}
								items={[
									{label: 'Vault', value: 'name', sortable: true, className: 'col-span-6'},
									{label: 'Est. APY', value: 'estAPY', sortable: false, className: 'col-span-3'},
									{
										label: 'Position Value',
										value: 'totalValue',
										sortable: true,
										className: 'col-span-3 justify-end'
									}
								]}
							/>
							<div className={'grid gap-1'}>
								{userPositions.map((vault, index) => {
									const isV3 = vault.version.startsWith('3') || vault.version.startsWith('~3');
									return (
										<VaultsListRow
											key={`${vault.chainID}_${vault.address}`}
											currentVault={vault}
											isV2={!isV3}
											index={index}
										/>
									);
								})}
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
