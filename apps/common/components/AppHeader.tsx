import {cloneElement, useMemo, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {AnimatePresence} from 'framer-motion';
import {Popover, Transition} from '@headlessui/react';
import {VaultsHeader} from '@vaults/components/header/VaultsHeader';
import {VaultsV3Header} from '@vaults-v3/components/header/VaultsHeader';
import {V3Logo} from '@vaults-v3/Mark';
import {VeYfiHeader} from '@veYFI/components/header/VeYfiHeader';
import {Header} from '@yearn-finance/web-lib/components/Header';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import {useMenu} from '@common/contexts/useMenu';
import {useCurrentApp} from '@common/hooks/useCurrentApp';
import {LogoYearn} from '@common/icons/LogoYearn';
import {YBalHeader} from '@yBal/components/header/YBalHeader';
import {YBribeHeader} from '@yBribe/components/header/YBribeHeader';
import {YCrvHeader} from '@yCRV/components/header/YCrvHeader';

import {AppName, APPS} from './Apps';
import {MotionDiv} from './MotionDiv';

import type {ReactElement} from 'react';
import type {TMenu} from '@yearn-finance/web-lib/components/Header';

function Logo(): ReactElement {
	const {pathname} = useRouter();

	return (
		<>
			<YCrvHeader pathname={pathname} />
			<YBalHeader pathname={pathname} />
			<VaultsHeader pathname={pathname} />
			<VeYfiHeader pathname={pathname} />
			<YBribeHeader pathname={pathname} />
			<VaultsV3Header pathname={pathname} />
			<MotionDiv
				name={'yearn'}
				animate={pathname === '/' ? 'enter' : 'exit'}>
				<LogoYearn
					className={'h-8 w-8'}
					back={'text-neutral-900'}
					front={'text-neutral-0'}
				/>
			</MotionDiv>
		</>
	);
}

function LogoPopover(): ReactElement {
	const [isShowing, set_isShowing] = useState(false);
	const router = useRouter();
	const {name} = useCurrentApp(router);

	return (
		<>
			<Popover
				onMouseEnter={(): void => set_isShowing(true)}
				onMouseLeave={(): void => set_isShowing(false)}
				className={'relative'}>
				<Popover.Button className={'z-20 flex items-center'}>
					<Link href={'/'}>
						<span className={'sr-only'}>{'Back to home'}</span>
						<Logo />
					</Link>
				</Popover.Button>
				<Transition
					as={'div'}
					show={isShowing}
					enter={'transition ease-out duration-200'}
					enterFrom={'opacity-0 translate-y-1'}
					enterTo={'opacity-100 translate-y-0'}
					leave={'transition ease-in duration-150'}
					leaveFrom={'opacity-100 translate-y-0'}
					leaveTo={'opacity-0 translate-y-1'}
					className={'relative z-[9999999]'}>
					<Popover.Panel
						className={'absolute left-1/2 z-20 mt-6 w-80 -translate-x-1/2 px-4 pt-4 sm:px-0 md:w-[560px]'}>
						<div className={'overflow-hidden rounded-sm shadow-xl'}>
							<div
								className={
									'relative grid grid-cols-2 gap-2 border border-neutral-200/60 bg-neutral-0 p-6 md:grid-cols-5'
								}>
								<div className={'col-span-3 grid grid-cols-2 gap-2 md:grid-cols-3'}>
									{[...Object.values(APPS)]
										.filter(({isDisabled}): boolean => !isDisabled)
										.filter(({name}): boolean => name !== 'V3')
										.map(({name, href, icon}): ReactElement => {
											return (
												<Link
													prefetch={false}
													key={name}
													href={href}
													onClick={(): void => set_isShowing(false)}>
													<div
														onClick={(): void => set_isShowing(false)}
														className={cl(
															'flex cursor-pointer flex-col items-center justify-center transition-colors hover:bg-neutral-200',
															'p-4 bg-neutral-100/40'
														)}>
														<div>{cloneElement(icon, {className: 'w-8 h-8'})}</div>
														<div className={'pt-2 text-center'}>
															<b className={'text-base'}>{name}</b>
														</div>
													</div>
												</Link>
											);
										})}
								</div>
								<div className={'col-span-2 grid grid-cols-2 gap-2 md:grid-cols-3'}>
									<Link
										prefetch={false}
										key={name}
										href={'/v3'}
										className={'col-span-3 row-span-2'}
										onClick={(): void => set_isShowing(false)}>
										<div
											className={cl(
												'relative flex h-full w-full cursor-pointer flex-col items-center justify-center transition-all',
												'bg-[#010A3B] hover:brightness-125 rounded-sm'
											)}>
											<div className={'z-10 flex w-full flex-col items-center'}>
												<V3Logo className={'h-20'} />
												<div className={'-mb-2 pt-4 text-center'}>
													<p
														className={cl(
															'font-bold text-white text-sm',
															'whitespace-break-spaces'
														)}>
														{`Discover\nBrand New Vaults`}
													</p>
												</div>
											</div>
										</div>
									</Link>
								</div>
							</div>
						</div>
					</Popover.Panel>
				</Transition>
			</Popover>
		</>
	);
}

export function AppHeader(): ReactElement {
	const {pathname} = useRouter();
	const {onOpenMenu} = useMenu();
	const menu = useMemo((): TMenu[] => {
		const HOME_MENU = {path: '/', label: 'Home'};

		if (pathname.startsWith('/ycrv')) {
			return [HOME_MENU, ...APPS[AppName.YCRV].menu];
		}

		if (pathname.startsWith('/ybal')) {
			return [HOME_MENU, ...APPS[AppName.YBAL].menu];
		}

		if (pathname.startsWith('/v3')) {
			return [HOME_MENU, ...APPS[AppName.VAULTSV3].menu];
		}

		if (pathname.startsWith('/vaults')) {
			return [HOME_MENU, ...APPS[AppName.VAULTS].menu];
		}

		if (pathname.startsWith('/veyfi')) {
			return [HOME_MENU, ...APPS[AppName.VEYFI].menu];
		}

		if (pathname.startsWith('/ybribe')) {
			return [HOME_MENU, ...APPS[AppName.YBRIBE].menu];
		}
		return [
			HOME_MENU,
			{
				path: 'https://gov.yearn.fi/',
				label: 'Governance',
				target: '_blank'
			},
			{path: 'https://blog.yearn.fi/', label: 'Blog', target: '_blank'},
			{path: 'https://docs.yearn.fi/', label: 'Docs', target: '_blank'}
		];
	}, [pathname]);

	return (
		<Header
			showNetworkSelector={false}
			linkComponent={<Link href={''} />}
			currentPathName={pathname}
			onOpenMenuMobile={onOpenMenu}
			nav={menu}
			logo={
				<AnimatePresence mode={'wait'}>
					<LogoPopover />
				</AnimatePresence>
			}
		/>
	);
}
