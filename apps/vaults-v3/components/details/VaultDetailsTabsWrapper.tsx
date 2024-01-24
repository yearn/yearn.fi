import {Fragment, useEffect, useMemo, useState} from 'react';
import {useRouter} from 'next/router';
import {Listbox, Transition} from '@headlessui/react';
import {VaultInfo} from '@vaults/components/details/tabs/VaultDetailsTabsWrapper';
import {VaultDetailsAbout} from '@vaults-v3/components/details/tabs/VaultDetailsAbout';
import {VaultDetailsStrategies} from '@vaults-v3/components/details/tabs/VaultDetailsStrategies';
import {Renderable} from '@yearn-finance/web-lib/components/Renderable';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {IconAddToMetamask} from '@yearn-finance/web-lib/icons/IconAddToMetamask';
import {IconLinkOut} from '@yearn-finance/web-lib/icons/IconLinkOut';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {getNetwork} from '@yearn-finance/web-lib/utils/wagmi/utils';
import {IconChevron} from '@common/icons/IconChevron';
import {assert} from '@common/utils/assert';

import type {ReactElement} from 'react';
import type {TYDaemonVault} from '@common/schemas/yDaemonVaultsSchemas';

type TTabsOptions = {
	value: number;
	label: string;
	slug?: string;
};
type TTabs = {
	hasStrategies: boolean;
	selectedAboutTabIndex: number;
	set_selectedAboutTabIndex: (arg0: number) => void;
};

type TExplorerLinkProps = {
	explorerBaseURI?: string;
	currentVaultAddress: string;
};

function Tabs({hasStrategies, selectedAboutTabIndex, set_selectedAboutTabIndex}: TTabs): ReactElement {
	const router = useRouter();

	const tabs: TTabsOptions[] = useMemo((): TTabsOptions[] => {
		if (hasStrategies) {
			return [
				{value: 0, label: 'About', slug: 'about'},
				{value: 1, label: 'Vaults', slug: 'vaults'},
				{value: 2, label: 'Info', slug: 'info'}
			];
		}
		return [{value: 0, label: 'About', slug: 'about'}];
	}, [hasStrategies]);

	useEffect((): void => {
		const tab = tabs.find((tab): boolean => tab.slug === router.query.tab);
		if (tab?.value) {
			set_selectedAboutTabIndex(tab?.value);
		}
	}, [router.query.tab, set_selectedAboutTabIndex, tabs]);

	return (
		<>
			<nav className={'hidden flex-row items-center space-x-10 md:flex'}>
				{tabs.map(
					(tab): ReactElement => (
						<button
							key={`desktop-${tab.value}`}
							onClick={(): void => {
								router.replace(
									{
										query: {
											...router.query,
											tab: tab.slug
										}
									},
									undefined,
									{
										shallow: true
									}
								);
								set_selectedAboutTabIndex(tab.value);
							}}>
							<p
								title={tab.label}
								aria-selected={selectedAboutTabIndex === tab.value}
								className={cl(
									'hover-fix tab',
									selectedAboutTabIndex === tab.value
										? '!text-neutral-900'
										: '!text-neutral-900/50 hover:!text-neutral-900'
								)}>
								{tab.label}
							</p>
						</button>
					)
				)}
			</nav>
			<div className={'relative z-50'}>
				<Listbox
					value={selectedAboutTabIndex}
					onChange={(value): void => set_selectedAboutTabIndex(value)}>
					{({open}): ReactElement => (
						<>
							<Listbox.Button
								className={
									'flex h-10 w-40 flex-row items-center border-0 border-b-2 border-neutral-900 bg-neutral-100 p-0 font-bold focus:border-neutral-900 md:hidden'
								}>
								<div className={'relative flex flex-row items-center'}>
									{tabs[selectedAboutTabIndex]?.label || 'Menu'}
								</div>
								<div className={'absolute right-0'}>
									<IconChevron
										className={`size-6 transition-transform${open ? '-rotate-180' : 'rotate-0'}`}
									/>
								</div>
							</Listbox.Button>
							<Transition
								as={Fragment}
								show={open}
								enter={'transition duration-100 ease-out'}
								enterFrom={'transform scale-95 opacity-0'}
								enterTo={'transform scale-100 opacity-100'}
								leave={'transition duration-75 ease-out'}
								leaveFrom={'transform scale-100 opacity-100'}
								leaveTo={'transform scale-95 opacity-0'}>
								<Listbox.Options className={'yearn--listbox-menu'}>
									{tabs.map(
										(tab): ReactElement => (
											<Listbox.Option
												className={'yearn--listbox-menu-item'}
												key={tab.value}
												value={tab.value}>
												{tab.label}
											</Listbox.Option>
										)
									)}
								</Listbox.Options>
							</Transition>
						</>
					)}
				</Listbox>
			</div>
		</>
	);
}

function AddToWalletLink({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const {provider} = useWeb3();

	async function onAddTokenToMetamask(
		address: string,
		symbol: string,
		decimals: number,
		image: string
	): Promise<void> {
		try {
			assert(provider, 'Provider is not set');
			const walletClient = await provider.getWalletClient();
			await walletClient.watchAsset({
				type: 'ERC20',
				options: {
					address: toAddress(address),
					decimals: decimals,
					symbol: symbol,
					image: image
				}
			});
		} catch (error) {
			console.error(error);
			// Token has not been added to MetaMask.
		}
	}

	return (
		<button
			onClick={(): void => {
				onAddTokenToMetamask(
					currentVault.address,
					currentVault.symbol,
					currentVault.decimals,
					`https://assets.smold.app/api/token/${currentVault.chainID}/${currentVault.address}/logo-128.png`
				);
			}}>
			<span className={'sr-only'}>{'Add to wallet'}</span>
			<IconAddToMetamask
				className={'size-5 text-neutral-900/50 transition-colors hover:text-neutral-900 md:size-6'}
			/>
		</button>
	);
}

function ExplorerLink({explorerBaseURI, currentVaultAddress}: TExplorerLinkProps): ReactElement | null {
	return (
		<a
			href={`${explorerBaseURI}/address/${currentVaultAddress}`}
			target={'_blank'}
			rel={'noopener noreferrer'}>
			<span className={'sr-only'}>{'Open in explorer'}</span>
			<IconLinkOut
				className={
					'size-5 cursor-alias text-neutral-900/50 transition-colors hover:text-neutral-900 md:size-6'
				}
			/>
		</a>
	);
}

export function VaultDetailsTabsWrapper({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const [selectedAboutTabIndex, set_selectedAboutTabIndex] = useState(0);
	const hasStrategies = Number(currentVault.strategies?.length || 0) > 0;

	return (
		<div className={'col-span-12 mb-4 flex flex-col rounded-b-3xl bg-neutral-100'}>
			<div className={'relative flex w-full flex-row items-center justify-between px-4 pt-4 md:px-8'}>
				<Tabs
					hasStrategies={hasStrategies}
					selectedAboutTabIndex={selectedAboutTabIndex}
					set_selectedAboutTabIndex={set_selectedAboutTabIndex}
				/>

				<div className={'flex flex-row items-center justify-end space-x-2 pb-0 md:pb-4 md:last:space-x-4'}>
					<AddToWalletLink currentVault={currentVault} />
					<ExplorerLink
						explorerBaseURI={getNetwork(currentVault.chainID)?.defaultBlockExplorer}
						currentVaultAddress={currentVault.address}
					/>
				</div>
			</div>

			<div className={'-mt-0.5 h-0.5 w-full bg-neutral-300'} />

			<Renderable shouldRender={(currentVault && isZero(selectedAboutTabIndex)) || !hasStrategies}>
				<VaultDetailsAbout currentVault={currentVault} />
			</Renderable>

			<Renderable shouldRender={currentVault && selectedAboutTabIndex === 1 && hasStrategies}>
				<VaultDetailsStrategies currentVault={currentVault} />
			</Renderable>

			<Renderable shouldRender={currentVault && selectedAboutTabIndex === 2}>
				<VaultInfo currentVault={currentVault} />
			</Renderable>
		</div>
	);
}
