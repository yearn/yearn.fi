import React, {ReactElement, ReactNode, useMemo, useState} from 'react';
import {Button} from '@yearn-finance/web-lib/components';
import {format, performBatchedUpdates, toAddress} from '@yearn-finance/web-lib/utils';
import {VaultRow, VaultRowHead} from 'components/apps/vaults/VaultRow';
import Wrapper from 'components/apps/vaults/Wrapper';
import ValueAnimation from 'components/common/ValueAnimation';
import {useWallet} from 'contexts/useWallet';
import {useYearn} from 'contexts/useYearn';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS} from 'utils/constants';

import type {TYearnVault} from 'types/yearn';

function	Index(): ReactElement {
	const	{balances, cumulatedValueInVaults} = useWallet();
	const	{vaults} = useYearn();
	const	[category, set_category] = useState('all');
	const	[sortBy, set_sortBy] = useState('apy');
	const	[sortDirection, set_sortDirection] = useState('desc');

	const	formatedYouHave = useMemo((): string => {
		if (cumulatedValueInVaults) {
			return format.amount(cumulatedValueInVaults, 2, 2);
		}
		return '';
	}, [cumulatedValueInVaults]);

	const	formatedYouEarned = useMemo((): string => {
		if (cumulatedValueInVaults) {
			return format.amount(cumulatedValueInVaults / 97, 2, 2);
		}
		return '';
	}, [cumulatedValueInVaults]);

	const	curveVaults = useMemo((): TYearnVault[] => {
		return (Object.values(vaults || {}).filter((vault): boolean => (vault?.token?.display_name || '').includes('Curve')) as TYearnVault[]);
	}, [vaults]);

	const	notCurveVaults = useMemo((): TYearnVault[] => {
		return (Object.values(vaults || {}).filter((vault): boolean => !(vault?.token?.display_name || '').includes('Curve')) as TYearnVault[]);
	}, [vaults]);

	const	vaultsToDisplay = useMemo((): TYearnVault[] => {
		if (category === 'easy-curve') {
			return curveVaults;
		}
		if (category === 'all') {
			return Object.values(vaults || {}) as TYearnVault[];
		}
		if (category === 'simple-saver') {
			return notCurveVaults;
		}
		return [];
	}, [category, curveVaults, notCurveVaults, vaults]);

	const	sortedVaultsToDisplay = useMemo((): TYearnVault[] => {
		if (sortBy === 'apy') {
			return vaultsToDisplay.sort((a, b): number => {
				if (sortDirection === 'desc') {
					return (b.apy?.net_apy || 0) - (a.apy?.net_apy || 0);
				}
				return (a.apy?.net_apy || 0) - (b.apy?.net_apy || 0);
			});
		}
		if (sortBy === 'available') {
			return vaultsToDisplay.sort((a, b): number => {
				let	aBalance = (balances[toAddress(a.token.address)]?.normalized || 0);
				let	bBalance = (balances[toAddress(b.token.address)]?.normalized || 0);

				if (toAddress(a.token.address) === WETH_TOKEN_ADDRESS) {
					const	ethPlusWEth = (
						(balances[toAddress(WETH_TOKEN_ADDRESS)]?.normalized || 0)
						+
						(balances[toAddress(ETH_TOKEN_ADDRESS)]?.normalized || 0)
					);
					aBalance = ethPlusWEth;
				}
				if (toAddress(b.token.address) === WETH_TOKEN_ADDRESS) {
					const	ethPlusWEth = (
						(balances[toAddress(WETH_TOKEN_ADDRESS)]?.normalized || 0)
						+
						(balances[toAddress(ETH_TOKEN_ADDRESS)]?.normalized || 0)
					);
					bBalance = ethPlusWEth;
				}

				if (sortDirection === 'asc') {
					return (aBalance) - (bBalance);
				}
				return (bBalance) - (aBalance);
			});
		}
		if (sortBy === 'deposited') {
			return vaultsToDisplay.sort((a, b): number => {
				if (sortDirection === 'asc') {
					return (balances[toAddress(a.address)]?.normalized || 0) - (balances[toAddress(b.address)]?.normalized || 0);
				}
				return (balances[toAddress(b.address)]?.normalized || 0) - (balances[toAddress(a.address)]?.normalized || 0);
			});
		}
		if (sortBy === 'tvl') {
			return vaultsToDisplay.sort((a, b): number => {
				if (sortDirection === 'desc') {
					return (b.tvl.tvl || 0) - (a.tvl.tvl || 0);
				}
				return (a.tvl.tvl || 0) - (b.tvl.tvl || 0);
			});
		}

		return vaultsToDisplay;
	}, [sortBy, vaultsToDisplay, sortDirection, balances]);

	return (
		<section className={'mt-4 grid w-full grid-cols-12 gap-y-10 pb-10 md:mt-20 md:gap-x-10 md:gap-y-20'}>

			<div className={'col-span-12 w-full md:col-span-8'}>
				<p className={'pb-2 text-lg text-neutral-900 md:pb-6 md:text-3xl'}>{'You have'}</p>
				<b className={'text-4xl tabular-nums text-neutral-900 md:text-7xl'}>
					<ValueAnimation
						identifier={'youHave'}
						value={formatedYouHave}
						defaultValue={'0.00'}
						prefix={'$'} />
				</b>
			</div>
			<div className={'col-span-12 w-full md:col-span-4'}>
				<p className={'pb-2 text-lg text-neutral-900 md:pb-6 md:text-3xl'}>{'You earned'}</p>
				<b className={'text-3xl tabular-nums text-neutral-900 md:text-7xl'}>
					<ValueAnimation
						identifier={'youEarned'}
						value={formatedYouEarned ? formatedYouEarned : ''}
						defaultValue={'0.00'}
						prefix={'$'} />
				</b>
			</div>

			<div className={'col-span-12 flex w-full flex-col bg-neutral-100'}>
				<div className={'flex flex-row items-center justify-between px-10 pt-10 pb-8'}>
					<div>
						<h2 className={'text-3xl font-bold'}>{'Standard Vaults'}</h2>
					</div>
					<div className={'flex flex-row space-x-4'}>
						<Button
							onClick={(): void => set_category('all')}
							variant={category === 'all' ? 'filled' : 'outlined'}
							className={'yearn--button-smaller'}>
							{'All'}
						</Button>
						<Button
							onClick={(): void => set_category('simple-saver')}
							variant={category === 'simple-saver' ? 'filled' : 'outlined'}
							className={'yearn--button-smaller'}>
							{'Simple Saver'}
						</Button>
						<Button
							onClick={(): void => set_category('usd-stable')}
							variant={category === 'usd-stable' ? 'filled' : 'outlined'}
							className={'yearn--button-smaller'}>
							{'USD Stable'}
						</Button>
						<Button
							onClick={(): void => set_category('blue-chip')}
							variant={category === 'blue-chip' ? 'filled' : 'outlined'}
							className={'yearn--button-smaller'}>
							{'Blue Chip'}
						</Button>
						<Button
							onClick={(): void => set_category('easy-curve')}
							variant={category === 'easy-curve' ? 'filled' : 'outlined'}
							className={'yearn--button-smaller'}>
							{'Easy Curve'}
						</Button>
					</div>
				</div>
				<div className={'grid w-full grid-cols-1'}>
					<VaultRowHead
						sortBy={sortBy}
						sortDirection={sortDirection}
						onSort={(_sortBy: string, _sortDirection: string): void => {
							performBatchedUpdates((): void => {
								set_sortBy(_sortBy);
								set_sortDirection(_sortDirection);
							});
						}} />
					{sortedVaultsToDisplay.length === 0 ? (
						<div className={'flex h-96 w-full flex-col items-center justify-center py-2 px-10'}>
							<b className={'text-lg'}>{'Andre\'s Fault'}</b>
							<p className={'text-neutral-600'}>{'No vaults available. What a shame. What are the dev doing. Bouuuuuh.'}</p>

						</div>
					) : sortedVaultsToDisplay.map((vault): ReactNode => {
						if (!vault) {
							return (null);
						}
						return <VaultRow key={vault.address} currentVault={vault} />;
					})}

				</div>
			</div>

		</section>
	);
}

Index.getLayout = function getLayout(page: ReactElement): ReactElement {
	return <Wrapper>{page}</Wrapper>;
};

export default Index;
