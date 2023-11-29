import {cloneElement, Fragment, useMemo, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {AnimatePresence} from 'framer-motion';
import {Popover, Transition} from '@headlessui/react';
import {VaultsHeader} from '@vaults/components/header/VaultsHeader';
import {V3Mask} from '@vaults-v3/Mark';
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

	if (name === 'V3') {
		return <Fragment />;
	}

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
					className={'absolute left-1/2 z-10 mt-6 w-80 -translate-x-1/2 px-4 pt-4 sm:px-0 md:w-96'}>
					<div className={'overflow-hidden border border-neutral-200 shadow-lg'}>
						<div className={'relative grid grid-cols-2 bg-neutral-0 md:grid-cols-3'}>
							{[...Object.values(APPS)]
								.filter(({isDisabled}): boolean => !isDisabled)
								.map(({name, href, icon}): ReactElement => {
									if (name === 'V3') {
										return (
											<Link
												prefetch={false}
												key={name}
												href={href}
												className={'col-span-3'}
												onClick={(): void => set_isShowing(false)}>
												<div
													className={cl(
														'relative flex h-full w-full cursor-pointer flex-col items-center overflow-hidden transition-all',
														'bg-[#22206a]'
													)}>
													<div className={'z-10 flex w-full flex-col items-center p-6'}>
														<V3Mask className={'h-16'} />
														<div className={'pt-2 text-center'}>
															<p
																className={cl(
																	'font-black text-neutral-900 text-sm',
																	'whitespace-break-spaces uppercase'
																)}>
																{`Discover brand new vaults`}
															</p>
														</div>
													</div>
												</div>
											</Link>
										);
									}
									return (
										<Link
											prefetch={false}
											key={name}
											href={href}
											onClick={(): void => set_isShowing(false)}>
											<div
												onClick={(): void => set_isShowing(false)}
												className={
													'flex cursor-pointer flex-col items-center p-4 transition-colors hover:bg-neutral-200'
												}>
												<div>{cloneElement(icon)}</div>
												<div className={'pt-2 text-center'}>
													<b className={'text-base'}>{name}</b>
												</div>
											</div>
										</Link>
									);
								})}
						</div>
					</div>
				</Popover.Panel>
			</Transition>
		</Popover>
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

		if (pathname.startsWith('/vaults-v3')) {
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
