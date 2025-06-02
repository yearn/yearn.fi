import {cloneElement, Fragment, useEffect, useMemo, useState} from 'react';
import {useConnect, usePublicClient} from 'wagmi';
import {Listbox, Transition} from '@headlessui/react';
import {useAccountModal, useChainModal, useConnectModal} from '@rainbow-me/rainbowkit';
import {useIsMounted} from '@react-hookz/web';

import {useWeb3} from '../contexts/useWeb3';
import {toSafeChainID} from '../hooks/useChainID';
import {IconChevronBottom} from '../icons/IconChevronBottom';
import {IconWallet} from '../icons/IconWallet';
import {cl} from '../utils/cl';
import {truncateHex} from '../utils/tools.address';
import {retrieveConfig} from '../utils/wagmi';
import {Button} from './Button';

import type {AnchorHTMLAttributes, DetailedHTMLProps, ReactElement} from 'react';

const Link = (
	props: DetailedHTMLProps<AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement> & {tag: ReactElement}
): ReactElement => {
	const {tag, ...rest} = props;
	const Element = cloneElement(tag, rest);
	return Element;
};

export type TMenu = {path: string; label: string | ReactElement; target?: string};
export type TNavbar = {
	nav: TMenu[];
	linkComponent?: ReactElement;
	currentPathName: string;
};
function Navbar({nav, linkComponent = <a />, currentPathName}: TNavbar): ReactElement {
	return (
		<nav className={'yearn--nav'}>
			{nav.map(
				(option): ReactElement => (
					<Link
						tag={linkComponent}
						key={option.path}
						target={option.target}
						href={option.path}>
						<p className={`yearn--header-nav-item ${currentPathName === option.path ? 'active' : ''}`}>
							{option.label}
						</p>
					</Link>
				)
			)}
		</nav>
	);
}

function NetworkButton({
	label,
	isDisabled,
	onClick
}: {
	label: string;
	isDisabled?: boolean;
	onClick?: () => void;
}): ReactElement {
	return (
		<button
			disabled={isDisabled}
			onClick={onClick}
			suppressHydrationWarning
			className={
				'yearn--header-nav-item mr-4 hidden !cursor-default flex-row items-center border-0 p-0 text-sm hover:!text-neutral-500 md:flex'
			}>
			<div
				suppressHydrationWarning
				className={'relative flex flex-row items-center'}>
				{label}
			</div>
		</button>
	);
}

export type TNetwork = {value: number; label: string};
function NetworkSelector({networks}: {networks: number[]}): ReactElement {
	const {onSwitchChain, isActive} = useWeb3();
	const publicClient = usePublicClient();
	const {connectors} = useConnect();
	const safeChainID = toSafeChainID(Number(publicClient?.chain.id), Number(process.env.BASE_CHAINID));
	const [selectedChainID, set_selectedChainID] = useState(1);

	const supportedNetworks = useMemo((): TNetwork[] => {
		connectors; //Hard trigger re-render when connectors change
		const config = retrieveConfig();
		const noFork = config.chains.filter(({id}): boolean => id !== 1337);
		return noFork
			.filter(({id}): boolean => id !== 1337 && ((networks.length > 0 && networks.includes(id)) || true))
			.map((network): TNetwork => ({value: network.id, label: network.name}));
	}, [connectors, networks]);

	const currentNetwork = useMemo((): TNetwork | undefined => {
		const currentChainID = isActive ? safeChainID : selectedChainID;
		return supportedNetworks.find((network): boolean => network.value === currentChainID);
	}, [isActive, safeChainID, selectedChainID, supportedNetworks]);

	if (supportedNetworks.length === 1) {
		if (publicClient?.chain.id === 1337) {
			return (
				<NetworkButton
					label={'Localhost'}
					isDisabled
				/>
			);
		}
		if (currentNetwork?.value === supportedNetworks[0]?.value) {
			return (
				<NetworkButton
					label={supportedNetworks[0]?.label || 'Ethereum'}
					isDisabled
				/>
			);
		}
		return (
			<NetworkButton
				label={'Invalid Network'}
				onClick={(): void => onSwitchChain(supportedNetworks[0].value)}
			/>
		);
	}

	return (
		<div className={'relative z-50 mr-4'}>
			<Listbox
				value={safeChainID}
				onChange={(value: unknown): void => {
					const chainID = (value as {value: number}).value;
					set_selectedChainID(chainID);
					onSwitchChain(chainID);
				}}>
				{({open}): ReactElement => (
					<>
						<Listbox.Button
							suppressHydrationWarning
							className={
								'yearn--header-nav-item flex flex-row items-center border-0 p-0 text-xs md:flex md:text-sm'
							}>
							<div
								suppressHydrationWarning
								className={
									'relative flex flex-row items-center truncate whitespace-nowrap text-xs md:text-sm'
								}>
								{currentNetwork?.label || 'Ethereum'}
							</div>
							<div className={'ml-1 md:ml-2'}>
								<IconChevronBottom
									className={`size-3 transition-transform md:h-5 md:w-4${
										open ? '-rotate-180' : 'rotate-0'
									}`}
								/>
							</div>
						</Listbox.Button>
						<Transition
							appear
							show={open}
							as={Fragment}>
							<div>
								<Transition.Child
									as={Fragment}
									enter={'ease-out duration-300'}
									enterFrom={'opacity-0'}
									enterTo={'opacity-100'}
									leave={'ease-in duration-200'}
									leaveFrom={'opacity-100'}
									leaveTo={'opacity-0'}>
									<div className={'fixed inset-0 bg-neutral-0/60'} />
								</Transition.Child>
								<Transition.Child
									as={Fragment}
									enter={'transition duration-100 ease-out'}
									enterFrom={'transform scale-95 opacity-0'}
									enterTo={'transform scale-100 opacity-100'}
									leave={'transition duration-75 ease-out'}
									leaveFrom={'transform scale-100 opacity-100'}
									leaveTo={'transform scale-95 opacity-0'}>
									<Listbox.Options
										className={
											'absolute -inset-x-24 z-50 flex items-center justify-center pt-2 opacity-0 transition-opacity'
										}>
										<div
											className={
												'w-fit border border-neutral-300 bg-neutral-100 p-1 px-2 text-center text-xxs text-neutral-900'
											}>
											{supportedNetworks.map(
												(network): ReactElement => (
													<Listbox.Option
														key={network.value}
														value={network}>
														{({active}): ReactElement => (
															<div
																data-active={active}
																className={'yearn--listbox-menu-item text-sm'}>
																{network?.label || 'Ethereum'}
															</div>
														)}
													</Listbox.Option>
												)
											)}
										</div>
									</Listbox.Options>
								</Transition.Child>
							</div>
						</Transition>
					</>
				)}
			</Listbox>
		</div>
	);
}

function WalletSelector(): ReactElement {
	const {openConnectModal} = useConnectModal();
	const {openAccountModal} = useAccountModal();
	const {openChainModal} = useChainModal();
	const {isActive, address, ens, lensProtocolHandle, openLoginModal} = useWeb3();
	const [walletIdentity, set_walletIdentity] = useState<string | undefined>(undefined);
	const isMounted = useIsMounted();

	useEffect((): void => {
		if (!isMounted()) {
			return;
		}
		if (!isActive && address) {
			set_walletIdentity('Invalid Network');
		} else if (ens) {
			set_walletIdentity(ens);
		} else if (lensProtocolHandle) {
			set_walletIdentity(lensProtocolHandle);
		} else if (address) {
			set_walletIdentity(truncateHex(address, 4));
		} else {
			set_walletIdentity(undefined);
		}
	}, [ens, lensProtocolHandle, address, isActive, isMounted]);

	return (
		<>
			<div
				onClick={(): void => {
					if (isActive) {
						openAccountModal?.();
					} else if (!isActive && address) {
						openChainModal?.();
					} else {
						openLoginModal();
					}
				}}>
				<p
					suppressHydrationWarning
					className={'yearn--header-nav-item text-sm'}>
					{walletIdentity ? (
						walletIdentity
					) : (
						<span>
							<IconWallet className={'yearn--header-nav-item mt-0.5 block size-4 md:hidden'} />
							<span
								className={
									'relative hidden h-8 cursor-pointer items-center justify-center border border-transparent bg-neutral-900 px-2 text-xs font-normal text-neutral-0 transition-all hover:bg-neutral-800 md:flex'
								}>
								{'Connect wallet'}
							</span>
						</span>
					)}
				</p>
			</div>
			<div
				onClick={(): void => {
					if (isActive) {
						openAccountModal?.();
					} else if (!isActive && address) {
						openChainModal?.();
					} else {
						openConnectModal?.();
					}
				}}
				className={cl(
					'fixed inset-x-0 bottom-0 z-[87] border-t border-neutral-900 bg-neutral-0 md:hidden',
					walletIdentity ? 'hidden pointer-events-none' : ''
				)}>
				<div className={'flex flex-col items-center justify-center pb-6 pt-4 text-center'}>
					{'You are not connected. Please connect to a wallet to continue.'}
					<Button className={'mt-3 space-x-2'}>
						<IconWallet className={'size-4'} />
						<p>{'Connect wallet'}</p>
					</Button>
				</div>
			</div>
		</>
	);
}

export type THeader = {
	logo: ReactElement;
	extra?: ReactElement;
	linkComponent?: ReactElement;
	nav: TMenu[];
	supportedNetworks?: number[];
	currentPathName: string;
	showNetworkSelector: boolean;
	onOpenMenuMobile: () => void;
};

export function Header({
	logo,
	extra,
	linkComponent,
	nav,
	currentPathName,
	supportedNetworks,
	showNetworkSelector = true,
	onOpenMenuMobile
}: THeader): ReactElement {
	return (
		<header className={'yearn--header'}>
			<Navbar
				linkComponent={linkComponent}
				currentPathName={currentPathName}
				nav={nav}
			/>
			<div className={'flex w-1/3 md:hidden'}>
				<button onClick={onOpenMenuMobile}>
					<span className={'sr-only'}>{'Open menu'}</span>
					<svg
						className={'text-neutral-500'}
						width={'20'}
						height={'20'}
						viewBox={'0 0 24 24'}
						fill={'none'}
						xmlns={'http://www.w3.org/2000/svg'}>
						<path
							d={
								'M2 2C1.44772 2 1 2.44772 1 3C1 3.55228 1.44772 4 2 4H22C22.5523 4 23 3.55228 23 3C23 2.44772 22.5523 2 22 2H2Z'
							}
							fill={'currentcolor'}
						/>
						<path
							d={
								'M2 8C1.44772 8 1 8.44772 1 9C1 9.55228 1.44772 10 2 10H14C14.5523 10 15 9.55228 15 9C15 8.44772 14.5523 8 14 8H2Z'
							}
							fill={'currentcolor'}
						/>
						<path
							d={
								'M1 15C1 14.4477 1.44772 14 2 14H22C22.5523 14 23 14.4477 23 15C23 15.5523 22.5523 16 22 16H2C1.44772 16 1 15.5523 1 15Z'
							}
							fill={'currentcolor'}
						/>
						<path
							d={
								'M2 20C1.44772 20 1 20.4477 1 21C1 21.5523 1.44772 22 2 22H14C14.5523 22 15 21.5523 15 21C15 20.4477 14.5523 20 14 20H2Z'
							}
							fill={'currentcolor'}
						/>
					</svg>
				</button>
			</div>
			<div className={'flex w-1/3 justify-center'}>
				<div className={'relative size-8'}>{logo}</div>
			</div>
			<div className={'flex w-1/3 items-center justify-end'}>
				{showNetworkSelector ? <NetworkSelector networks={supportedNetworks || []} /> : null}
				<WalletSelector />
				{extra}
			</div>
		</header>
	);
}
