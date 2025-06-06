import React, {useEffect, useMemo, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {useAccountModal, useChainModal} from '@rainbow-me/rainbowkit';
import {useWeb3} from '@lib/contexts/useWeb3';
import {IconBurgerPlain} from '@lib/icons/IconBurgerPlain';
import {IconWallet} from '@lib/icons/IconWallet';
import {truncateHex} from '@lib/utils/tools.address';

import {AppName, APPS} from './Apps';
import {LogoPopover} from './LogoPopover';
import {ModalMobileMenu} from './ModalMobileMenu';

import type {ReactElement} from 'react';
import type {Chain} from 'viem';

export type TMenu = {path: string; label: string | ReactElement; target?: string};
type TNavbar = {nav: TMenu[]; currentPathName: string};

function Navbar({nav, currentPathName}: TNavbar): ReactElement {
	return (
		<nav className={'yearn--nav'}>
			{nav.map(
				(option): ReactElement => (
					<Link
						key={option.path}
						target={option.target}
						href={option.path}>
						<p
							className={`yearn--header-nav-item ${currentPathName.startsWith(option.path) ? 'active' : ''}`}>
							{option?.label || 'Unknown'}
						</p>
					</Link>
				)
			)}
		</nav>
	);
}

function WalletSelector(): ReactElement {
	const {openAccountModal} = useAccountModal();
	const {openChainModal} = useChainModal();
	const {isActive, address, ens, clusters, lensProtocolHandle, openLoginModal} = useWeb3();
	const [walletIdentity, set_walletIdentity] = useState<string | undefined>(undefined);

	useEffect((): void => {
		if (!isActive && address) {
			set_walletIdentity('Invalid Network');
		} else if (ens) {
			set_walletIdentity(ens);
		} else if (clusters) {
			set_walletIdentity(clusters.name);
		} else if (lensProtocolHandle) {
			set_walletIdentity(lensProtocolHandle);
		} else if (address) {
			set_walletIdentity(truncateHex(address, 4));
		} else {
			set_walletIdentity(undefined);
		}
	}, [ens, clusters, lensProtocolHandle, address, isActive]);

	return (
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
				className={'yearn--header-nav-item !text-xs md:!text-sm'}>
				{walletIdentity ? (
					walletIdentity
				) : (
					<span>
						<IconWallet className={'yearn--header-nav-item mt-0.5 block size-4 md:hidden'} />
						<span
							className={
								'relative hidden h-8 cursor-pointer items-center justify-center rounded border border-transparent bg-neutral-900 px-2 text-xs font-normal text-neutral-0 transition-all hover:bg-neutral-800 md:flex'
							}>
							{'Connect wallet'}
						</span>
					</span>
				)}
			</p>
		</div>
	);
}

function AppHeader(props: {supportedNetworks: Chain[]}): ReactElement {
	const {pathname} = useRouter();
	const [isMenuOpen, set_isMenuOpen] = useState<boolean>(false);

	const menu = useMemo((): TMenu[] => {
		const HOME_MENU = {path: '/apps', label: 'Apps'};

		if (pathname.startsWith('/ycrv')) {
			return [...APPS[AppName.YCRV].menu];
		}

		if (pathname.startsWith('/v3')) {
			return [...APPS[AppName.VAULTSV3].menu];
		}

		if (pathname.startsWith('/vaults')) {
			return [...APPS[AppName.VAULTS].menu];
		}

		if (pathname.startsWith('/veyfi')) {
			return [...APPS[AppName.VEYFI].menu];
		}

		return [
			HOME_MENU,
			{path: 'https://docs.yearn.fi/', label: 'Docs', target: '_blank'},
			{path: 'https://discord.gg/yearn', label: 'Support', target: '_blank'},
			{path: 'https://blog.yearn.fi/', label: 'Blog', target: '_blank'},
			{
				path: 'https://gov.yearn.fi/',
				label: 'Discourse',
				target: '_blank'
			}
		];
	}, [pathname]);

	return (
		<div
			id={'head'}
			className={'inset-x-0 top-0 z-50 w-full'}>
			<div className={'w-full'}>
				<header className={'yearn--header mx-auto max-w-6xl !px-0'}>
					<div className={'direction-row flex items-center justify-start gap-x-6 px-1 py-2 md:py-1'}>
						<div className={'flex justify-center'}>
							<LogoPopover />
						</div>
						<Navbar
							currentPathName={pathname || ''}
							nav={menu}
						/>
						<div className={'flex md:hidden'}>
							<button onClick={(): void => set_isMenuOpen(!isMenuOpen)}>
								<span className={'sr-only'}>{'Open menu'}</span>
								<IconBurgerPlain />
							</button>
						</div>
					</div>
					<div className={'flex w-1/3 items-center justify-end'}>
						<WalletSelector />
					</div>
				</header>
			</div>
			<ModalMobileMenu
				shouldUseWallets={true}
				shouldUseNetworks={true}
				isOpen={isMenuOpen}
				onClose={(): void => set_isMenuOpen(false)}
				supportedNetworks={props.supportedNetworks}>
				{menu?.map(
					(option): ReactElement => (
						<Link
							key={option.path}
							href={option.path}>
							<div
								className={'mobile-nav-item'}
								onClick={(): void => set_isMenuOpen(false)}>
								<p className={'font-bold'}>{option.label}</p>
							</div>
						</Link>
					)
				)}
			</ModalMobileMenu>
		</div>
	);
}

export default AppHeader;
