import {cloneElement, Fragment, useEffect, useMemo, useState} from 'react';
import {Listbox, Transition} from '@headlessui/react';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChain} from '@yearn-finance/web-lib/hooks/useChain';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import IconChevronBottom from '@yearn-finance/web-lib/icons/IconChevronBottom';
import IconWallet from '@yearn-finance/web-lib/icons/IconWallet';
import {truncateHex} from '@yearn-finance/web-lib/utils/address';

import type {AnchorHTMLAttributes, DetailedHTMLProps, ReactElement} from 'react';

const Link = (props: (DetailedHTMLProps<AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>) & {tag: ReactElement}): ReactElement => {
	const {tag, ...rest} = props;
	const Element = cloneElement(tag, rest);
	return Element;
};

export type TMenu = {path: string, label: string | ReactElement, target?: string};
export type TNavbar = {
	nav: TMenu[],
	linkComponent?: ReactElement,
	currentPathName: string
};
function Navbar({nav, linkComponent = <a />, currentPathName}: TNavbar): ReactElement {
	return (
		<nav className={'yearn--nav'}>
			{nav.map((option): ReactElement => (
				<Link
					tag={linkComponent}
					key={option.path}
					target={option.target}
					href={option.path}>
					<p className={`yearn--header-nav-item ${currentPathName === option.path ? 'active' : '' }`}>
						{option.label}
					</p>
				</Link>
			))}
		</nav>
	);
}

export type TNetwork = {value: number, label: string};
function NetworkSelector({supportedChainID}: {supportedChainID: number[]}): ReactElement {
	const chains = useChain();
	const {chainID} = useChainID();
	const {onSwitchChain} = useWeb3();
	const supportedNetworks = useMemo((): TNetwork[] => {
		const noTestnet = supportedChainID.filter((chainID: number): boolean => chainID !== 1337);
		return noTestnet.map((chainID: number): TNetwork => (
			{value: chainID, label: chains.get(chainID)?.displayName || `Chain ${chainID}`}
		));
	}, [chains, supportedChainID]);

	const	currentNetwork = useMemo((): TNetwork | undefined => (
		supportedNetworks.find((network): boolean => network.value === chainID)
	), [chainID, supportedNetworks]);

	if (supportedNetworks.length === 1) {
		if (currentNetwork?.value === supportedNetworks[0]?.value) {
			return (
				<button
					disabled
					suppressHydrationWarning
					className={'yearn--header-nav-item mr-4 hidden !cursor-default flex-row items-center border-0 p-0 text-sm hover:!text-neutral-500 md:flex'}>
					<div suppressHydrationWarning className={'relative flex flex-row items-center'}>
						{supportedNetworks[0]?.label || 'Ethereum'}
					</div>
				</button>
			);
		}
		return (
			<button
				suppressHydrationWarning
				onClick={(): void => {
					onSwitchChain(supportedNetworks[0].value);
				}}
				className={'yearn--header-nav-item mr-4 hidden cursor-pointer flex-row items-center border-0 p-0 text-sm hover:!text-neutral-500 md:flex'}>
				<div suppressHydrationWarning className={'relative flex flex-row items-center'}>
					{'Invalid Network'}
				</div>
			</button>
		);
	}

	return (
		<div key={chainID} className={'relative z-50 mr-4'}>
			<Listbox
				value={chainID}
				onChange={async (value: any): Promise<void> => onSwitchChain(value.value)}>
				{({open}): ReactElement => (
					<>
						<Listbox.Button
							suppressHydrationWarning
							className={'yearn--header-nav-item hidden flex-row items-center border-0 p-0 text-sm md:flex'}>
							<div suppressHydrationWarning className={'relative flex flex-row items-center'}>
								{currentNetwork?.label || 'Ethereum'}
							</div>
							<div className={'ml-2'}>
								<IconChevronBottom
									className={`h-5 w-4 transition-transform ${open ? '-rotate-180' : 'rotate-0'}`} />
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
							<Listbox.Options className={'yearn--listbox-menu yearn--shadow -ml-1 bg-neutral-0'}>
								{supportedNetworks.map((network): ReactElement => (
									<Listbox.Option key={network.value} value={network}>
										{({active}): ReactElement => (
											<div
												data-active={active}
												className={'yearn--listbox-menu-item text-sm'}>
												{network?.label || 'Ethereum'}
											</div>
										)}
									</Listbox.Option>
								))}
							</Listbox.Options>
						</Transition>
					</>
				)}
			</Listbox>
		</div>
	);
}

function WalletSelector(): ReactElement {
	const	{options, isActive, address, ens, lensProtocolHandle, openLoginModal, onDesactivate, onSwitchChain} = useWeb3();
	const	[walletIdentity, set_walletIdentity] = useState<string | undefined>(undefined);

	useEffect((): void => {
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
	}, [ens, lensProtocolHandle, address, isActive]);

	return (
		<div
			onClick={(): void => {
				if (isActive) {
					onDesactivate();
				} else if (!isActive && address) {
					onSwitchChain(options?.defaultChainID || 1);
				} else {
					openLoginModal();
				}
			}}>
			<p suppressHydrationWarning className={'yearn--header-nav-item text-sm'}>
				{walletIdentity ? walletIdentity : (
					<span>
						<IconWallet
							className={'yearn--header-nav-item mt-0.5 block h-4 w-4 md:hidden'} />
						<span className={'relative hidden h-8 cursor-pointer items-center justify-center border border-transparent bg-neutral-900 px-2 text-xs font-normal text-neutral-0 transition-all hover:bg-neutral-800 md:flex'}>
							{'Connect wallet'}
						</span>
					</span>
				)}
			</p>
		</div>
	);
}

export type THeader = {
	logo: ReactElement,
	extra?: ReactElement,
	linkComponent?: ReactElement,
	nav: TMenu[],
	supportedNetworks?: number[],
	currentPathName: string,
	onOpenMenuMobile: () => void
}
function Header({
	logo,
	extra,
	linkComponent,
	nav,
	currentPathName,
	supportedNetworks,
	onOpenMenuMobile
}: THeader): ReactElement {
	const {options} = useWeb3();

	const supportedChainID = useMemo((): number[] => (
		supportedNetworks || options?.supportedChainID || [1, 10, 250, 42161]
	), [supportedNetworks, options?.supportedChainID]);

	return (
		<header className={'yearn--header'}>
			<Navbar
				linkComponent={linkComponent}
				currentPathName={currentPathName}
				nav={nav} />
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
						<path d={'M2 2C1.44772 2 1 2.44772 1 3C1 3.55228 1.44772 4 2 4H22C22.5523 4 23 3.55228 23 3C23 2.44772 22.5523 2 22 2H2Z'} fill={'currentcolor'}/>
						<path d={'M2 8C1.44772 8 1 8.44772 1 9C1 9.55228 1.44772 10 2 10H14C14.5523 10 15 9.55228 15 9C15 8.44772 14.5523 8 14 8H2Z'} fill={'currentcolor'}/>
						<path d={'M1 15C1 14.4477 1.44772 14 2 14H22C22.5523 14 23 14.4477 23 15C23 15.5523 22.5523 16 22 16H2C1.44772 16 1 15.5523 1 15Z'} fill={'currentcolor'}/>
						<path d={'M2 20C1.44772 20 1 20.4477 1 21C1 21.5523 1.44772 22 2 22H14C14.5523 22 15 21.5523 15 21C15 20.4477 14.5523 20 14 20H2Z'} fill={'currentcolor'}/>
					</svg>
				</button>
			</div>
			<div className={'flex w-1/3 justify-center'}>
				<div className={'relative h-8 w-8'}>
					{logo}
				</div>
			</div>
			<div className={'flex w-1/3 items-center justify-end'}>
				<NetworkSelector supportedChainID={supportedChainID} />
				<WalletSelector />
				{extra}
			</div>
		</header>
	);
}

export default Header;
