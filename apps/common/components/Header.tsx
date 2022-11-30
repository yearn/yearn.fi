import React, {cloneElement, Fragment, useEffect, useState} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {AnimatePresence, motion} from 'framer-motion';
import {Popover, Transition} from '@headlessui/react';
import {ModalMobileMenu} from '@yearn-finance/web-lib/components';
import {useWeb3} from '@yearn-finance/web-lib/contexts';
import IconWallet from '@yearn-finance/web-lib/icons/IconWallet';
import {truncateHex} from '@yearn-finance/web-lib/utils';
import LogoYearn from '@common/icons/LogoYearn';
import {YCRV_TOKEN_ADDRESS} from '@common/utils/constants';

import LogoYearnBlue from '../icons/LogoYearnBlue';
import BalanceReminderPopover from './BalanceReminderPopover';

import type {ReactElement} from 'react';

const transition = {duration: 0.3, ease: 'easeInOut'};
const variants = {
	initial: {y: -80, opacity: 0, transition},
	enter: {y: 0, opacity: 1, transition},
	exit: {y: -80, opacity: 0, transition}
};

function	Navbar(): ReactElement {
	const	router = useRouter();

	if (router.pathname.startsWith('/ycrv')) {
		return (
			<nav className={'col-s hidden w-1/3 flex-row items-center space-x-3 md:flex md:space-x-6'}>
				<Link href={'/ycrv'}>
					<p className={`yveCRV--nav-link ${router.pathname === '/ycrv' ? 'active' : '' }`}>
						{'Main'}
					</p>
				</Link>
				<Link href={'/ycrv/holdings'}>
					<p className={`yveCRV--nav-link ${router.pathname === '/ycrv/holdings' ? 'active' : '' }`}>
						{'Holdings'}
					</p>
				</Link>
				<Link href={'/ycrv/about'}>
					<p className={`yveCRV--nav-link ${router.pathname === '/ycrv/about' ? 'active' : '' }`}>
						{'About'}
					</p>
				</Link>
			</nav>
		);
	}
	if (router.pathname.startsWith('/vaults')) {
		return (
			<nav className={'col-s hidden w-1/3 flex-row items-center space-x-3 md:flex md:space-x-6'}>
				<Link href={'/'}>
					<p className={`yveCRV--nav-link ${router.pathname === '/' ? 'active' : '' }`}>
						{'Main'}
					</p>
				</Link>
				<Link href={'/vaults'}>
					<p className={`yveCRV--nav-link ${router.pathname === '/vaults' ? 'active' : '' }`}>
						{'Vaults'}
					</p>
				</Link>
				<Link href={'/vaults/about'}>
					<p className={`yveCRV--nav-link ${router.pathname === '/vaults/about' ? 'active' : '' }`}>
						{'About'}
					</p>
				</Link>
			</nav>
		);
	}
	if (router.pathname.startsWith('/ybribe')) {
		return (
			<nav className={'col-s hidden w-1/3 flex-row items-center space-x-3 md:flex md:space-x-6'}>
				<Link href={'/'}>
					<p className={`yveCRV--nav-link ${router.pathname === '/' ? 'active' : '' }`}>
						{'Main'}
					</p>
				</Link>
				<Link href={'/ybribe'}>
					<p className={`yveCRV--nav-link ${router.pathname === '/ybribe' ? 'active' : '' }`}>
						{'Claim bribe'}
					</p>
				</Link>
				<Link href={'/ybribe/offer-bribe'}>
					<p className={`yveCRV--nav-link ${router.pathname === '/ybribe/offer-bribe' ? 'active' : '' }`}>
						{'Offer bribe'}
					</p>
				</Link>
				<Link href={'/ybribe/about'}>
					<p className={`yveCRV--nav-link ${router.pathname === '/ybribe/about' ? 'active' : '' }`}>
						{'About'}
					</p>
				</Link>
			</nav>
		);
	}
	return (
		<nav className={'col-s hidden w-1/3 flex-row items-center space-x-3 md:flex md:space-x-6'}>
			<Link href={'/'}>
				<p className={`yveCRV--nav-link ${router.pathname === '/' ? 'active' : '' }`}>
					{'Main'}
				</p>
			</Link>
		</nav>
	);
}

function	Logo(): ReactElement {
	const	router = useRouter();
	const	isVaultPage = router.pathname === '/vaults/[address]';

	return (
		<>
			<motion.div
				key={'ycrv'}
				initial={'initial'}
				animate={router.pathname.startsWith('/ycrv') ? 'enter' : 'exit'}
				variants={variants}
				className={'absolute cursor-pointer'}>
				<Image
					alt={'yCRV'}
					width={34}
					height={34}
					src={`${process.env.BASE_YEARN_ASSETS_URI}/1/${YCRV_TOKEN_ADDRESS}/logo-128.png`}
					loading={'eager'}
					priority />
			</motion.div>

			<motion.div
				key={'vaults'}
				initial={'initial'}
				animate={!isVaultPage && router.pathname.startsWith('/vaults') ? 'enter' : 'exit'}
				variants={variants}
				className={'absolute cursor-pointer'}>
				<LogoYearnBlue className={'h-8 w-8'} />
			</motion.div>

			<motion.div
				key={'yBribe'}
				initial={'initial'}
				animate={!isVaultPage && router.pathname.startsWith('/ybribe') ? 'enter' : 'exit'}
				variants={variants}
				className={'absolute cursor-pointer'}>
				<LogoYearn className={'h-8 w-8'} />
			</motion.div>

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
	const	{isActive, address, ens, openLoginModal, onDesactivate, onSwitchChain} = useWeb3();
	const	[hasMobileMenu, set_hasMobileMenu] = useState(false);
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
		<>
			<header className={'gfixed inset-x-0 top-0 z-50 mb-5 flex h-20 w-full max-w-[1200px] flex-row items-center justify-between p-4 text-xs sm:text-sm md:inset-x-auto md:mb-0 md:px-0 md:text-base'}>
				<Navbar />
				<div className={'flex w-1/3 md:hidden'}>
					<button onClick={(): void => set_hasMobileMenu(true)}>
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
						<p className={'yveCRV--nav-link text-sm'}>
							{walletIdentity ? walletIdentity : (
								<span>
									<IconWallet className={'yveCRV--nav-link mt-0.5 block h-4 w-4 md:hidden'} />
									<span className={'hidden md:block'}>{'Connect wallet'}</span>
								</span>
							)
							}
						</p>
					</div>
					{isActive ? (
						<div className={'ml-4'}>
							<BalanceReminderPopover />
						</div>
					) : <div />}
				</div>
			</header>
			<ModalMobileMenu
				shouldUseWallets={true}
				shouldUseNetworks={false}
				isOpen={hasMobileMenu}
				onClose={(): void => set_hasMobileMenu(false)}>
				<Link href={'/'}>
					<div className={'mobile-nav-item'} onClick={(): void => set_hasMobileMenu(false)}>
						<p className={'font-bold'}>
							{'Home'}
						</p>
					</div>
				</Link>
				{/* <Link href={'/new-vaults'}>
					<div className={'mobile-nav-item'} onClick={(): void => set_hasMobileMenu(false)}>
						<p className={'font-bold'}>
							{'New Vaults'}
						</p>
					</div>
				</Link> */}
				{/* <Link href={'/vote'}>
					<div className={'mobile-nav-item'} onClick={(): void => set_hasMobileMenu(false)}>
						<p className={'font-bold'}>
							{'Vote'}
						</p>
					</div>
				</Link> */}
				<Link href={'/holdings'}>
					<div className={'mobile-nav-item'} onClick={(): void => set_hasMobileMenu(false)}>
						<p className={'font-bold'}>
							{'Holdings'}
						</p>
					</div>
				</Link>
				<Link href={'/about'}>
					<div className={'mobile-nav-item'} onClick={(): void => set_hasMobileMenu(false)}>
						<p className={'font-bold'}>
							{'About'}
						</p>
					</div>
				</Link>
			</ModalMobileMenu>
		</>
	);
}

export default Header;
