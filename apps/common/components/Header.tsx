import React, {cloneElement, Fragment, useEffect, useMemo, useState} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {AnimatePresence, motion} from 'framer-motion';
import {Listbox, Popover, Transition} from '@headlessui/react';
import {LogoVaults, MenuVaults} from '@vaults/Header';
import {useWeb3} from '@yearn-finance/web-lib/contexts';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import IconWallet from '@yearn-finance/web-lib/icons/IconWallet';
import {truncateHex} from '@yearn-finance/web-lib/utils/address';
import {YCRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {useMenu} from '@common/contexts/useMenu';
import IconChevron from '@common/icons/IconChevron';
import LogoYearn from '@common/icons/LogoYearn';
import {variants} from '@common/utils/animations';
import {LogoYBribe, MenuYBribe} from '@yBribe/Header';
import {LogoYCRV, MenuYCRV} from '@yCRV/Header';

import LogoYearnBlue from '../icons/LogoYearnBlue';
import BalanceReminderPopover from './BalanceReminderPopover';

import type {ReactElement} from 'react';

function	Navbar(): ReactElement {
	const	router = useRouter();

	if (router.pathname.startsWith('/ycrv')) {
		return <MenuYCRV />;
	}
	if (router.pathname.startsWith('/vaults')) {
		return <MenuVaults />;
	}
	if (router.pathname.startsWith('/ybribe')) {
		return <MenuYBribe />;
	}
	return (
		<nav className={'yearn--nav'}>
			<Link href={'/'}>
				<p className={`yearn--header-nav-item ${router.pathname === '/' ? 'active' : '' }`}>
					{'Main'}
				</p>
			</Link>
		</nav>
	);
}

function	Logo(): ReactElement {
	const	router = useRouter();

	return (
		<>
			<LogoYCRV />
			<LogoVaults />
			<LogoYBribe />
			<motion.div
				key={'yearn'}
				initial={'initial'}
				animate={router.pathname === '/' ? 'enter' : 'exit'}
				variants={variants}
				className={'absolute cursor-pointer'}>
				<LogoYearn className={'h-8 w-8'} />
			</motion.div>
		</>
	);

}

function	LogoPopover(): ReactElement {
	const [isShowing, set_isShowing] = useState(false);

	return (
		<Popover
			onMouseEnter={(): void => set_isShowing(true)}
			onMouseLeave={(): void => set_isShowing(false)}
			className={'relative'}>
			<Popover.Button className={'flex items-center'}>
				<Link href={'/'}>
					<span className={'sr-only'}>{'Back to home'}</span>
					<Logo />
				</Link>
			</Popover.Button>
			<Transition
				as={Fragment}
				show={isShowing}
				enter={'transition ease-out duration-200'}
				enterFrom={'opacity-0 translate-y-1'}
				enterTo={'opacity-100 translate-y-0'}
				leave={'transition ease-in duration-150'}
				leaveFrom={'opacity-100 translate-y-0'}
				leaveTo={'opacity-0 translate-y-1'}>
				<Popover.Panel className={'absolute left-1/2 z-10 mt-6 w-80 -translate-x-1/2 px-4 pt-4 sm:px-0'}>
					<div className={'overflow-hidden border border-neutral-200 shadow-lg'}>
						<div className={'relative grid bg-neutral-0 md:grid-cols-3'}>
							{solutions.map((item): ReactElement => (
								<Link
									prefetch={false}
									key={item.name}
									href={item.href}
									onClick={(): void => set_isShowing(false)}>
									<div
										onClick={(): void => set_isShowing(false)}
										className={'flex cursor-pointer flex-col items-center p-4 transition-colors hover:bg-neutral-200'}>
										<div>
											{cloneElement(item.icon)}
										</div>
										<div className={'pt-2 text-center'}>
											<b className={'text-base'}>{item.name}</b>
										</div>
									</div>
								</Link>
							))}
						</div>
					</div>
				</Popover.Panel>
			</Transition>
		</Popover>
	);
}

const networks = [
	{value: 1, label: 'Ethereum'},
	{value: 10, label: 'Optimism'},
	{value: 250, label: 'Fantom'},
	{value: 42161, label: 'Arbitrum'}
];
function	NetworkSelector(): ReactElement {
	const {safeChainID} = useChainID();
	const {onSwitchChain} = useWeb3();

	const	currentNetwork = useMemo((): any => (
		networks.find((network): boolean => network.value === safeChainID)
	), [safeChainID]);

	return (
		<div className={'relative z-50 mr-4'}>
			<Listbox
				value={safeChainID}
				onChange={(value: any): void => onSwitchChain(value.value, true)}>
				{({open}): ReactElement => (
					<>
						<Listbox.Button
							className={'yearn--header-nav-item hidden flex-row items-center border-0 p-0 text-sm md:flex'}>
							<div suppressHydrationWarning className={'relative flex flex-row items-center'}>
								{currentNetwork?.label || 'Ethereum'}
							</div>
							<div className={'ml-2'}>
								<IconChevron
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
							<Listbox.Options className={'yearn--listbox-menu -ml-1 !bg-neutral-100'}>
								{networks.map((network): ReactElement => (
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

function	WalletSelector(): ReactElement {
	const	{isActive, address, ens, openLoginModal, onDesactivate, onSwitchChain} = useWeb3();
	const	[walletIdentity, set_walletIdentity] = useState<string | undefined>(undefined);

	useEffect((): void => {
		if (!isActive && address) {
			set_walletIdentity('Invalid Network');
		} else if (ens) {
			set_walletIdentity(ens);
		} else if (address) {
			set_walletIdentity(truncateHex(address, 4));
		} else {
			set_walletIdentity(undefined);
		}
	}, [ens, address, isActive]);

	return (
		<div
			onClick={(): void => {
				if (isActive) {
					onDesactivate();
				} else if (!isActive && address) {
					onSwitchChain(1, true);
				} else {
					openLoginModal();
				}
			}}>
			<p className={'yearn--header-nav-item text-sm'}>
				{walletIdentity ? walletIdentity : (
					<span>
						<IconWallet
							className={'yearn--header-nav-item mt-0.5 block h-4 w-4 md:hidden'} />
						<span className={'hidden md:block'}>
							{'Connect wallet'}
						</span>
					</span>
				)}
			</p>
		</div>
	);
}

const solutions = [
	{
		name: 'Vaults',
		description: 'deposit tokens and recieve yield.',
		href: '/vaults',
		icon: <LogoYearnBlue className={'h-8 w-8'} />
	},
	{
		name: 'yCRV',
		description: 'get the best CRV yields in DeFi.',
		href: '/ycrv',
		icon: (
			<Image
				alt={'yCRV'}
				width={32}
				height={32}
				src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${YCRV_TOKEN_ADDRESS}/logo-128.png`}
				loading={'eager'}
				priority />
		)
	},
	{
		name: 'veYFI',
		description: 'stake your YFI to recieve\nrewards and boost gauges.',
		href: '#',
		icon: <LogoYearn className={'h-8 w-8'} />
	}
];
function	Header(): ReactElement {
	const	{isActive} = useWeb3();
	const	{onOpenMenu} = useMenu();

	return (
		<header className={'yearn--header'}>
			<Navbar />
			<div className={'flex w-1/3 md:hidden'}>
				<button onClick={onOpenMenu}>
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
					<AnimatePresence mode={'wait'}>
						<LogoPopover />
					</AnimatePresence>
				</div>
			</div>
			<div className={'flex w-1/3 items-center justify-end'}>
				<NetworkSelector />
				<WalletSelector />
				{isActive ? (
					<div className={'ml-4'}>
						<BalanceReminderPopover />
					</div>
				) : <div />}
			</div>
		</header>
	);
}

export default Header;
