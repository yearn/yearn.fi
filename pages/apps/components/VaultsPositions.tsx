import {useMemo, useState} from 'react';
import Link from 'next/link';
import {useWeb3} from '@builtbymom/web3/contexts/useWeb3';
import {cl, formatAmount, formatPercent, toAddress, toNormalizedBN} from '@builtbymom/web3/utils';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {useYearn} from '@common/contexts/useYearn';
import {IconExpand} from '@common/icons/IconExpand';
import {IconMinimize} from '@common/icons/IconMinimize';
import {replaceStrings} from '@common/utils/helpers';

import {VaultsListHead} from './VaultsListHead';
import {VaultsListRow} from './VaultsListRow';

import type {FC} from 'react';
import type {TYDaemonVault} from '@yearn-finance/web-lib/utils/schemas/yDaemonVaultsSchemas';
import type {TNormalizedBN, TSortDirection} from '@builtbymom/web3/types';

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

const BalanceCard: FC<{
	balance: number;
	view: TVaultsPositionsView;
	onExpansionClick?: () => void;
}> = ({balance, view, onExpansionClick}) => {
	return (
		<div className={'flex h-[120px] flex-col justify-center p-6'}>
			<div className={'flex items-center gap-2'}>
				<p className={'text-[12px] font-medium text-white/75'}>{'Your Deposits'}</p>
				{view !== TVaultsPositionsView.Empty && (
					<div
						className={
							'flex size-5 cursor-pointer items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20'
						}
						onClick={onExpansionClick}>
						{view === TVaultsPositionsView.Card ? <IconExpand /> : <IconMinimize />}
					</div>
				)}
			</div>
			<p className={'text-[28px] font-medium text-white'}>
				<span className={'font-medium text-white/50'}>{'$'}</span>
				{formatAmount(balance)}
			</p>
		</div>
	);
};

const VaultEmptyCard: FC = () => {
	return (
		<div className={'flex flex-1 flex-col justify-center rounded-lg bg-neutral-100 p-6'}>
			<p className={'text-[18px] font-medium text-white/75'}>{'No positions found'}</p>
			<p className={'text-[14px] font-medium text-white/50'}>{'Your vault positions will show here'}</p>
		</div>
	);
};

const VaultPositionCard: FC<{
	vault: TYDaemonVault & {totalBalance: TNormalizedBN; totalValue: number};
}> = ({vault}) => {
	if (!vault) return null;

	const title = replaceStrings(vault.name, ['Curve', 'Factory', 'yVault'], '');
	const apr = vault.apr?.forwardAPR?.netAPR || 0;
	const isV3 = vault.version.startsWith('3') || vault.version.startsWith('~3');
	const href = isV3
		? `/v3/${vault.chainID}/${toAddress(vault.address)}`
		: `/vaults/${vault.chainID}/${toAddress(vault.address)}`;

	return (
		<Link href={href}>
			<div
				className={
					'relative flex cursor-pointer items-center justify-between overflow-hidden rounded-lg bg-neutral-100 transition-all hover:bg-neutral-200'
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
								<span className={'text-white/50'}>{'$'}</span>
								{formatAmount(vault.totalValue)}
							</p>
							{apr > 0 && (
								<p className={'text-[14px] text-white/50'}>{`${formatPercent(apr * 100, 2, 2)} APY`}</p>
							)}
						</div>
					</div>
					<div className={'flex w-[40px] items-center justify-center self-stretch bg-white/5'}>
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
		<div className={`flex rounded-[16px] border border-dashed border-white/10 bg-white/5 ${styles.content}`}>
			<BalanceCard
				view={VaultView}
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
				<div className={'space-y-6'}>
					<div className={cl(styles.cards, 'block md:hidden')}>
						{userPositions.map((vault, index) => (
							<VaultPositionCard
								key={index}
								vault={vault}
							/>
						))}
					</div>
					<div className={'hidden md:block'}>
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
