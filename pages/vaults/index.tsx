import React, {useMemo, useState} from 'react';
import {VaultsListHead} from '@vaults/components/list/VaultsListHead';
import {VaultsListRow} from '@vaults/components/list/VaultsListRow';
import Wrapper from '@vaults/Wrapper';
import {Button} from '@yearn-finance/web-lib/components';
import {format, performBatchedUpdates, toAddress} from '@yearn-finance/web-lib/utils';
import ValueAnimation from '@common/components/ValueAnimation';
import {useWallet} from '@common/contexts/useWallet';
import {useYearn} from '@common/contexts/useYearn';
import {getVaultName} from '@common/utils';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS} from '@common/utils/constants';

import type {ChangeEvent, ReactElement, ReactNode} from 'react';
import type {TYearnVault} from '@common/types/yearn';

function	Index(): ReactElement {
	const	{balances, cumulatedValueInVaults} = useWallet();
	const	{vaults, earned} = useYearn();
	const	[category, set_category] = useState('Crypto Vaults');
	const	[searchValue, set_searchValue] = useState('');
	const	[sortBy, set_sortBy] = useState('apy');
	const	[sortDirection, set_sortDirection] = useState('desc');

	const	formatedYouHave = useMemo((): string => {
		if (cumulatedValueInVaults) {
			return format.amount(cumulatedValueInVaults, 2, 2);
		}
		return '';
	}, [cumulatedValueInVaults]);

	const	formatedYouEarned = useMemo((): string => {
		if (earned?.totalUnrealizedGainsUSD) {
			return format.amount(earned?.totalUnrealizedGainsUSD, 2, 2);
		}
		return '';
	}, [earned]);

	const	curveVaults = useMemo((): TYearnVault[] => {
		return (Object.values(vaults || {}).filter((vault): boolean => (vault?.category === 'Curve')) as TYearnVault[]);
	}, [vaults]);
	const	stablesVaults = useMemo((): TYearnVault[] => {
		return (Object.values(vaults || {}).filter((vault): boolean => (vault?.category === 'Stablecoin')) as TYearnVault[]);
	}, [vaults]);
	const	balancerVaults = useMemo((): TYearnVault[] => {
		return (Object.values(vaults || {}).filter((vault): boolean => (vault?.category === 'Balancer')) as TYearnVault[]);
	}, [vaults]);
	const	cryptoVaults = useMemo((): TYearnVault[] => {
		return (Object.values(vaults || {}).filter((vault): boolean => (vault?.category === 'Volatile')) as TYearnVault[]);
	}, [vaults]);
	const	holdingsVaults = useMemo((): TYearnVault[] => {
		return (Object.values(vaults || {}).filter((vault): boolean => (
			balances?.[toAddress(vault?.address)]?.raw.gt(0)
		)) as TYearnVault[]);
	}, [vaults, balances]);

	const	vaultsToDisplay = useMemo((): TYearnVault[] => {
		if (category === 'Curve Vaults') {
			return curveVaults;
		} else if (category === 'Balancer Vaults') {
			return balancerVaults;
		} else if (category === 'Stables Vaults') {
			return stablesVaults;
		} else if (category === 'Crypto Vaults') {
			return cryptoVaults;
		} else if (category === 'Holdings') {
			return holdingsVaults;
		}
		return Object.values(vaults || {}) as TYearnVault[];
	}, [category, curveVaults, stablesVaults, balancerVaults, cryptoVaults, vaults, holdingsVaults]);

	const	searchedVaultsToDisplay = useMemo((): TYearnVault[] => {
		const	vaultsToUse = [...vaultsToDisplay];
	
		if (searchValue === '') {
			return vaultsToUse;
		}
		return vaultsToUse.filter((vault): boolean => {
			const	searchString = getVaultName(vault);
			return searchString.toLowerCase().includes(searchValue.toLowerCase());
		});
	}, [vaultsToDisplay, searchValue]);

	const	sortedVaultsToDisplay = useMemo((): TYearnVault[] => {
		if (sortBy === 'token') {
			return searchedVaultsToDisplay.sort((a, b): number => {
				const	aName = getVaultName(a);
				const	bName = getVaultName(b);
				if (sortDirection === 'desc') {
					return aName.localeCompare(bName);
				}
				return bName.localeCompare(aName);
			});
		}
		if (sortBy === 'apy') {
			return searchedVaultsToDisplay.sort((a, b): number => {
				if (sortDirection === 'desc') {
					return (b.apy?.net_apy || 0) - (a.apy?.net_apy || 0);
				}
				return (a.apy?.net_apy || 0) - (b.apy?.net_apy || 0);
			});
		}
		if (sortBy === 'available') {
			return searchedVaultsToDisplay.sort((a, b): number => {
				let	aBalance = (balances[toAddress(a.token.address)]?.normalized || 0);
				let	bBalance = (balances[toAddress(b.token.address)]?.normalized || 0);

				if (toAddress(a.token.address) === WETH_TOKEN_ADDRESS) {
					const	ethPlusWEth = (
						(balances[WETH_TOKEN_ADDRESS]?.normalized || 0)
						+
						(balances[ETH_TOKEN_ADDRESS]?.normalized || 0)
					);
					aBalance = ethPlusWEth;
				}
				if (toAddress(b.token.address) === WETH_TOKEN_ADDRESS) {
					const	ethPlusWEth = (
						(balances[WETH_TOKEN_ADDRESS]?.normalized || 0)
						+
						(balances[ETH_TOKEN_ADDRESS]?.normalized || 0)
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
			return searchedVaultsToDisplay.sort((a, b): number => {
				if (sortDirection === 'asc') {
					return (balances[toAddress(a.address)]?.normalized || 0) - (balances[toAddress(b.address)]?.normalized || 0);
				}
				return (balances[toAddress(b.address)]?.normalized || 0) - (balances[toAddress(a.address)]?.normalized || 0);
			});
		}
		if (sortBy === 'tvl') {
			return searchedVaultsToDisplay.sort((a, b): number => {
				if (sortDirection === 'desc') {
					return (b.tvl.tvl || 0) - (a.tvl.tvl || 0);
				}
				return (a.tvl.tvl || 0) - (b.tvl.tvl || 0);
			});
		}
		if (sortBy === 'risk') {
			return searchedVaultsToDisplay.sort((a, b): number => {
				if (sortDirection === 'desc') {
					return (b.safetyScore || 0) - (a.safetyScore || 0);
				}
				return (a.safetyScore || 0) - (b.safetyScore || 0);
			});
		}

		return searchedVaultsToDisplay;
	}, [sortBy, searchedVaultsToDisplay, sortDirection, balances]);

	return (
		<section className={'mt-4 grid w-full grid-cols-12 gap-y-10 pb-10 md:mt-20 md:gap-x-10 md:gap-y-20'}>

			<div className={'col-span-12 w-full md:col-span-8'}>
				<p className={'pb-2 text-lg text-neutral-900 md:pb-6 md:text-3xl'}>{'Deposited'}</p>
				<b className={'text-4xl tabular-nums text-neutral-900 md:text-7xl'}>
					<ValueAnimation
						identifier={'youHave'}
						value={formatedYouHave}
						defaultValue={'0.00'}
						prefix={'$'} />
				</b>
			</div>
			<div className={'col-span-12 w-full md:col-span-4'}>
				<p className={'pb-2 text-lg text-neutral-900 md:pb-6 md:text-3xl'}>{'Earnings'}</p>
				<b className={'text-3xl tabular-nums text-neutral-900 md:text-7xl'}>
					<ValueAnimation
						identifier={'youEarned'}
						value={formatedYouEarned ? formatedYouEarned : ''}
						defaultValue={'0.00'}
						prefix={'$'} />
				</b>
			</div>

			<div className={'col-span-12 flex w-full flex-col bg-neutral-100'}>
				<div className={'flex flex-col items-start justify-between space-x-0 px-4 pt-4 pb-2 md:px-10 md:pt-10 md:pb-8'}>
					<div className={'mb-6'}>
						<h2 className={'text-lg font-bold md:text-3xl'}>{category}</h2>
					</div>

					<div className={'hidden w-full flex-row items-center justify-between space-x-4 md:flex'}>
						<div className={'w-full'}>
							<label className={'text-neutral-600'}>{'Search'}</label>
							<div className={'mt-1 flex h-10 w-full items-center border border-neutral-0 bg-neutral-0 p-2 md:w-2/3'}>
								<div className={'relative flex h-10 w-full flex-row items-center justify-between'}>
									<input
										className={'h-10 w-full overflow-x-scroll border-none bg-transparent py-2 px-0 text-base outline-none scrollbar-none placeholder:text-neutral-400'}
										type={'text'}
										placeholder={'YFI Vault'}
										value={searchValue}
										onChange={(e: ChangeEvent<HTMLInputElement>): void => {
											set_searchValue(e.target.value);
										}} />
									<div className={'absolute right-0 text-neutral-400'}>
										<svg
											width={'20'}
											height={'20'}
											viewBox={'0 0 24 24'}
											fill={'none'}
											xmlns={'http://www.w3.org/2000/svg'}>
											<path
												fillRule={'evenodd'}
												clipRule={'evenodd'}
												d={'M10 1C5.02972 1 1 5.02972 1 10C1 14.9703 5.02972 19 10 19C12.1249 19 14.0779 18.2635 15.6176 17.0318L21.2929 22.7071C21.6834 23.0976 22.3166 23.0976 22.7071 22.7071C23.0976 22.3166 23.0976 21.6834 22.7071 21.2929L17.0318 15.6176C18.2635 14.0779 19 12.1249 19 10C19 5.02972 14.9703 1 10 1ZM3 10C3 6.13428 6.13428 3 10 3C13.8657 3 17 6.13428 17 10C17 13.8657 13.8657 17 10 17C6.13428 17 3 13.8657 3 10Z'}
												fill={'currentcolor'}/>
										</svg>
									</div>

								</div>
							</div>
						</div>
						<div>
							<label className={'text-neutral-600'}>&nbsp;</label>
							<div className={'mt-1 flex flex-row space-x-4'}>
								<div className={'flex flex-row space-x-0 divide-x border-x border-neutral-900'}>
									<Button
										onClick={(): void => set_category('Crypto Vaults')}
										variant={category === 'Crypto Vaults' ? 'filled' : 'outlined'}
										className={'yearn--button-smaller !border-l-0'}>
										{'Crypto'}
									</Button>
									<Button
										onClick={(): void => set_category('Stables Vaults')}
										variant={category === 'Stables Vaults' ? 'filled' : 'outlined'}
										className={'yearn--button-smaller !border-x-0'}>
										{'Stables'}
									</Button>
									<Button
										onClick={(): void => set_category('Curve Vaults')}
										variant={category === 'Curve Vaults' ? 'filled' : 'outlined'}
										className={'yearn--button-smaller !border-x-0'}>
										{'Curve'}
									</Button>
									<Button
										onClick={(): void => set_category('Balancer Vaults')}
										variant={category === 'Balancer Vaults' ? 'filled' : 'outlined'}
										className={'yearn--button-smaller !border-x-0'}>
										{'Balancer'}
									</Button>
									<Button
										onClick={(): void => set_category('All Vaults')}
										variant={category === 'All Vaults' ? 'filled' : 'outlined'}
										className={'yearn--button-smaller !border-r-0'}>
										{'All'}
									</Button>
								</div>

								<Button
									onClick={(): void => set_category('Holdings')}
									variant={category === 'Holdings' ? 'filled' : 'outlined'}
									className={'yearn--button-smaller'}>
									{'Holdings'}
								</Button>
							</div>
						</div>
					</div>
					<div className={'flex w-full flex-row space-x-2 md:hidden md:w-2/3'}>
						<select
							className={'yearn--button-smaller !w-[120%] border-none bg-neutral-900 text-neutral-0'}
							onChange={(e): void => set_category(e.target.value)}>
							<option value={'Stables Vaults'}>{'Stables'}</option>
							<option value={'Crypto Vaults'}>{'Crypto'}</option>
							<option value={'Curve Vaults'}>{'Curve'}</option>
							<option value={'Balancer Vaults'}>{'Balancer'}</option>
							<option value={'All Vaults'}>{'All'}</option>
							<option value={'Holdings'}>{'Holdings'}</option>
						</select>
						<div className={'flex h-8 w-full items-center border border-neutral-0 bg-neutral-0 p-2 md:w-auto'}>
							<div className={'flex h-8 w-full flex-row items-center justify-between py-2 px-0'}>
								<input
									className={'w-full overflow-x-scroll border-none bg-transparent py-2 px-0 text-xs outline-none scrollbar-none'}
									type={'text'}
									placeholder={'Search'}
									value={searchValue}
									onChange={(e: ChangeEvent<HTMLInputElement>): void => {
										set_searchValue(e.target.value);
									}} />
							</div>
						</div>
					</div>
				</div>
				<div className={'mt-4 grid w-full grid-cols-1 md:mt-0'}>
					<VaultsListHead
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
						return <VaultsListRow key={vault.address} currentVault={vault} />;
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
