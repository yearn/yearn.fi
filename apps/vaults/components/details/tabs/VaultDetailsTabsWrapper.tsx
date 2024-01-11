import {Fragment, useEffect, useMemo, useState} from 'react';
import {useRouter} from 'next/router';
import {Listbox, Transition} from '@headlessui/react';
import * as Sentry from '@sentry/nextjs';
import {VaultDetailsAbout} from '@vaults/components/details/tabs/VaultDetailsAbout';
import {VaultDetailsHistorical} from '@vaults/components/details/tabs/VaultDetailsHistorical';
import {VaultDetailsStrategies} from '@vaults/components/details/tabs/VaultDetailsStrategies';
import {Renderable} from '@yearn-finance/web-lib/components/Renderable';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {IconAddToMetamask} from '@yearn-finance/web-lib/icons/IconAddToMetamask';
import {IconLinkOut} from '@yearn-finance/web-lib/icons/IconLinkOut';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatToNormalizedValue, toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatDate} from '@yearn-finance/web-lib/utils/format.time';
import {isZero} from '@yearn-finance/web-lib/utils/isZero';
import {getNetwork} from '@yearn-finance/web-lib/utils/wagmi/utils';
import {useFetch} from '@common/hooks/useFetch';
import {IconChevron} from '@common/icons/IconChevron';
import {yDaemonVaultHarvestsSchema} from '@common/schemas/yDaemonVaultsSchemas';
import {assert} from '@common/utils/assert';
import {useYDaemonBaseURI} from '@common/utils/getYDaemonBaseURI';

import type {ReactElement} from 'react';
import type {TYDaemonVault, TYDaemonVaultHarvests} from '@common/schemas/yDaemonVaultsSchemas';

type TTabsOptions = {
	value: number;
	label: string;
	slug?: string;
};
type TTabs = {
	selectedAboutTabIndex: number;
	set_selectedAboutTabIndex: (arg0: number) => void;
};

type TExplorerLinkProps = {
	explorerBaseURI?: string;
	currentVaultAddress: string;
};

function Tabs({selectedAboutTabIndex, set_selectedAboutTabIndex}: TTabs): ReactElement {
	const router = useRouter();

	const tabs: TTabsOptions[] = useMemo(
		(): TTabsOptions[] => [
			{value: 0, label: 'About', slug: 'about'},
			{value: 1, label: 'Strategies', slug: 'strategies'},
			{value: 2, label: 'Historical rates', slug: 'historical-rates'},
			{value: 3, label: 'Info', slug: 'info'}
		],
		[]
	);

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
								className={'hover-fix tab'}>
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
										className={`h-6 w-6 transition-transform ${open ? '-rotate-180' : 'rotate-0'}`}
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

function ExplorerLink({explorerBaseURI, currentVaultAddress}: TExplorerLinkProps): ReactElement | null {
	return (
		<a
			href={`${explorerBaseURI}/address/${currentVaultAddress}`}
			target={'_blank'}
			rel={'noopener noreferrer'}>
			<span className={'sr-only'}>{'Open in explorer'}</span>
			<IconLinkOut
				className={
					'h-5 w-5 cursor-alias text-neutral-600 transition-colors hover:text-neutral-900 md:h-6 md:w-6'
				}
			/>
		</a>
	);
}

export function VaultInfo({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const blockExplorer = getNetwork(currentVault.chainID).blockExplorers?.etherscan?.url;

	return (
		<div className={'grid w-2/3 grid-cols-1 gap-10 bg-neutral-100 p-4 md:p-8'}>
			<div className={'col-span-1 grid w-full gap-1'}>
				<div className={'flex flex-col items-center md:flex-row'}>
					<p className={'w-full text-sm text-neutral-500 md:w-44'}>{'Vault Contract Address'}</p>
					<a
						className={'font-number text-sm text-neutral-900 hover:underline'}
						href={`${blockExplorer}/address/${currentVault.address}`}
						target={'_blank'}
						rel={'noopener noreferrer'}
						suppressHydrationWarning>
						{currentVault.address}
					</a>
				</div>

				<div className={'flex flex-col items-center md:flex-row'}>
					<p className={'w-full text-sm text-neutral-500 md:w-44'}>{'Token Contract Address'}</p>
					<a
						href={`${blockExplorer}/address/${currentVault.token.address}`}
						target={'_blank'}
						rel={'noopener noreferrer'}
						className={'font-number text-sm text-neutral-900 hover:underline'}
						suppressHydrationWarning>
						{currentVault.token.address}
					</a>
				</div>

				{currentVault.staking.available ? (
					<div className={'flex flex-col items-center md:flex-row'}>
						<p className={'w-full text-sm text-neutral-500 md:w-44'}>{'Staking Contract Address'}</p>
						<a
							href={`${blockExplorer}/address/${currentVault.staking.address}`}
							target={'_blank'}
							rel={'noopener noreferrer'}
							className={'font-number text-sm text-neutral-900 hover:underline'}
							suppressHydrationWarning>
							{currentVault.staking.address}
						</a>
					</div>
				) : null}

				{currentVault.info.sourceURL.includes('curve.fi') ? (
					<div className={'flex flex-col items-center md:flex-row'}>
						<p className={'w-full text-sm text-neutral-500 md:w-44'}>{'Curve deposit URI'}</p>
						<a
							href={currentVault.info.sourceURL}
							target={'_blank'}
							rel={'noopener noreferrer'}
							className={'font-number text-sm text-neutral-900 hover:underline'}
							suppressHydrationWarning>
							{currentVault.info.sourceURL}
						</a>
					</div>
				) : null}
			</div>
		</div>
	);
}

export function VaultDetailsTabsWrapper({currentVault}: {currentVault: TYDaemonVault}): ReactElement {
	const {provider} = useWeb3();
	const {yDaemonBaseUri} = useYDaemonBaseURI({chainID: currentVault.chainID});
	const [selectedAboutTabIndex, set_selectedAboutTabIndex] = useState(0);

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
			Sentry.captureException(error);
			// Token has not been added to MetaMask.
		}
	}

	const {data: yDaemonHarvestsData} = useFetch<TYDaemonVaultHarvests>({
		endpoint: `${yDaemonBaseUri}/vaults/harvests/${currentVault.address}`,
		schema: yDaemonVaultHarvestsSchema
	});

	const harvestData = useMemo((): {name: string; value: number}[] => {
		const _yDaemonHarvestsData = [...(yDaemonHarvestsData || [])].reverse();
		return _yDaemonHarvestsData.map((harvest): {name: string; value: number} => ({
			name: formatDate(Number(harvest.timestamp) * 1000),
			value: formatToNormalizedValue(toBigInt(harvest.profit) - toBigInt(harvest.loss), currentVault.decimals)
		}));
	}, [currentVault.decimals, yDaemonHarvestsData]);

	return (
		<div
			aria-label={'Vault Details'}
			className={'col-span-12 mb-4 flex flex-col bg-neutral-100'}>
			<div className={'relative flex w-full flex-row items-center justify-between px-4 pt-4 md:px-8'}>
				<Tabs
					selectedAboutTabIndex={selectedAboutTabIndex}
					set_selectedAboutTabIndex={set_selectedAboutTabIndex}
				/>

				<div
					className={
						'flex flex-col items-center justify-end space-x-2 pb-0 md:flex-row md:pb-4 md:last:space-x-4'
					}>
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
							className={
								'h-5 w-5 text-neutral-600 transition-colors hover:text-neutral-900 md:h-6 md:w-6'
							}
						/>
					</button>
					<ExplorerLink
						explorerBaseURI={getNetwork(currentVault.chainID)?.defaultBlockExplorer}
						currentVaultAddress={currentVault.address}
					/>
				</div>
			</div>

			<div className={'-mt-0.5 h-0.5 w-full bg-neutral-300'} />

			<Renderable shouldRender={currentVault && isZero(selectedAboutTabIndex)}>
				<VaultDetailsAbout
					currentVault={currentVault}
					harvestData={harvestData}
				/>
			</Renderable>

			<Renderable shouldRender={currentVault && selectedAboutTabIndex === 1}>
				<VaultDetailsStrategies currentVault={currentVault} />
			</Renderable>

			<Renderable shouldRender={currentVault && selectedAboutTabIndex === 2}>
				<VaultDetailsHistorical
					currentVault={currentVault}
					harvestData={harvestData}
				/>
			</Renderable>

			<Renderable shouldRender={currentVault && selectedAboutTabIndex === 3}>
				<VaultInfo currentVault={currentVault} />
			</Renderable>
		</div>
	);
}
