import React, {cloneElement, Fragment, useMemo, useState} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {AnimatePresence, motion} from 'framer-motion';
import {Popover, Transition} from '@headlessui/react';
import {LogoVaults, MenuVaultsOptions} from '@vaults/Header';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import Header from '@yearn-finance/web-lib/layouts/Header.next';
import {YCRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import BalanceReminderPopover from '@common/components/BalanceReminderPopover';
import {useMenu} from '@common/contexts/useMenu';
import LogoYearn from '@common/icons/LogoYearn';
import {variants} from '@common/utils/animations';
import {LogoYBribe, MenuYBribeOptions} from '@yBribe/Header';
import {LogoYCRV, MenuYCRVOptions} from '@yCRV/Header';

import type {ReactElement} from 'react';
import type {TMenu} from '@yearn-finance/web-lib/layouts/Header.next';

const Apps = [
	{
		name: 'Vaults',
		href: '/vaults',
		icon: <LogoYearn
			className={'h-8 w-8'}
			back={'text-pink-400'}
			front={'text-white'} />
	},
	{
		name: 'yCRV',
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
		href: 'https://vote.yearn.finance',
		icon: <LogoYearn
			className={'h-8 w-8'}
			back={'text-primary'}
			front={'text-white'} />
	},
	{
		name: 'yBribe',
		href: '/ybribe',
		icon: <LogoYearn
			className={'h-8 w-8'}
			back={'text-neutral-900'}
			front={'text-neutral-0'} />
	}
];

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
				<LogoYearn
					className={'h-8 w-8'}
					back={'text-neutral-900'}
					front={'text-neutral-0'} />
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
							{Apps.map((item): ReactElement => (
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

export function	AppHeader(): ReactElement {
	const	router = useRouter();
	const	{isActive} = useWeb3();
	const	{onOpenMenu} = useMenu();
	const	navMenu = useMemo((): TMenu[] => {
		let	menu = [
			{path: '/', label: 'Home'},
			{path: 'https://gov.yearn.finance/', label: 'Governance'},
			{path: 'https://blog.yearn.finance/', label: 'Blog'},
			{path: 'https://docs.yearn.finance/', label: 'Docs'}
		];

		if (router.pathname.startsWith('/ycrv')) {
			menu = [{path: '/', label: 'Home'}, ...MenuYCRVOptions];
		} else if (router.pathname.startsWith('/vaults')) {
			menu = [{path: '/', label: 'Home'}, ...MenuVaultsOptions];
		} else if (router.pathname.startsWith('/ybribe')) {
			menu = [{path: '/', label: 'Home'}, ...MenuYBribeOptions];
		}
		return menu as TMenu[];
	}, [router]);

	return (
		<Header
			linkComponent={<Link href={''} />}
			currentPathName={router.pathname}
			onOpenMenuMobile={onOpenMenu}
			nav={navMenu}
			logo={(
				<AnimatePresence mode={'wait'}>
					<LogoPopover />
				</AnimatePresence>	
			)}
			extra={isActive ? (
				<div className={'ml-4'}>
					<BalanceReminderPopover />
				</div>
			) : <div />}
		/>
	);
}
