import React, {cloneElement, Fragment, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {AnimatePresence, motion} from 'framer-motion';
import {Popover, Transition} from '@headlessui/react';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import Header from '@yearn-finance/web-lib/layouts/Header.next';
import BalanceReminderPopover from '@common/components/BalanceReminderPopover';
import {useMenu} from '@common/contexts/useMenu';
import {useAllApps} from '@common/hooks/useAllApps';
import LogoYearn from '@common/icons/LogoYearn';
import {variants} from '@common/utils/animations';

import {APPS} from './Apps';

import type {ReactElement} from 'react';
import type {AppName} from './Apps';

function	Logo(): ReactElement {
	const	{pathname} = useRouter();
	const	{headers} = useAllApps(pathname);

	return (
		<>
			{headers.yCrv}
			{headers.vaults}
			{headers.yBribe}
			<motion.div
				key={'yearn'}
				initial={'initial'}
				animate={pathname === '/' ? 'enter' : 'exit'}
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
				<Popover.Panel className={'absolute left-1/2 z-10 mt-6 w-80 -translate-x-1/2 px-4 pt-4 sm:px-0 md:w-96'}>
					<div className={'overflow-hidden border border-neutral-200 shadow-lg'}>
						<div className={'relative grid grid-cols-2 bg-neutral-0 md:grid-cols-4'}>
							{(Object.keys(APPS) as AppName[]).map((appName): ReactElement => (
								<Link
									prefetch={false}
									key={APPS[appName].name}
									href={APPS[appName].href}
									onClick={(): void => set_isShowing(false)}>
									<div
										onClick={(): void => set_isShowing(false)}
										className={'flex cursor-pointer flex-col items-center p-4 transition-colors hover:bg-neutral-200'}>
										<div>
											{cloneElement(APPS[appName].icon)}
										</div>
										<div className={'pt-2 text-center'}>
											<b className={'text-base'}>{APPS[appName].name}</b>
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
	const	{pathname} = useRouter();
	const	{isActive} = useWeb3();
	const	{onOpenMenu} = useMenu();
	const	{menu, supportedNetworks} = useAllApps(pathname);

	return (
		<Header
			linkComponent={<Link href={''} />}
			currentPathName={pathname}
			onOpenMenuMobile={onOpenMenu}
			nav={menu}
			supportedNetworks={supportedNetworks}
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
