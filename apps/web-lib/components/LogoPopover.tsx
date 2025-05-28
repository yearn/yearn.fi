'use client';

import {cloneElement, useMemo, useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {motion} from 'framer-motion';
import {cl} from '@builtbymom/web3/utils';
import {Popover, Transition} from '@headlessui/react';

import {useIsMounted} from '../hooks/useIsMounted';
import {V3Logo} from '../icons/V3Logo';
import {APPS} from './YearnApps';

import type {AnimationProps} from 'framer-motion';
import type {ReactElement} from 'react';

type TMotionDiv = {
	animate: AnimationProps['animate'];
	name: string;
	children: ReactElement;
};

const transition = {duration: 0.4, ease: 'easeInOut'};
const variants = {
	initial: {y: -80, opacity: 0, transition},
	enter: {y: 0, opacity: 1, transition},
	exit: {y: -80, opacity: 0, transition}
};
function MotionDiv({animate, name, children}: TMotionDiv): ReactElement {
	return (
		<motion.div
			key={name}
			initial={'initial'}
			animate={animate}
			variants={variants}
			className={'absolute cursor-pointer'}>
			{children}
		</motion.div>
	);
}

function Logo({currentHost, isVaultPage}: {currentHost: string; isVaultPage: boolean}): ReactElement {
	return (
		<>
			{Object.values(APPS).map(({name, host, icon}): ReactElement => {
				const shouldAnimate = currentHost.includes(host);
				return (
					<MotionDiv
						key={name}
						name={name}
						animate={shouldAnimate && !isVaultPage ? 'enter' : 'exit'}>
						{icon}
					</MotionDiv>
				);
			})}
			<MotionDiv
				key={'Vaults'}
				name={'Vaults'}
				animate={isVaultPage ? 'enter' : 'exit'}>
				<div className={'size-16 opacity-0'} />
			</MotionDiv>
		</>
	);
}

export function LogoPopover(): ReactElement {
	const [isShowing, set_isShowing] = useState(false);
	const isMounted = useIsMounted();
	const pathname = usePathname();

	const currentHost = useMemo(() => {
		if (typeof window === 'undefined') {
			return '';
		}
		return window.location.host;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [typeof window, isMounted]);

	const isVaultPage = useMemo(() => {
		if (typeof window === 'undefined') {
			return false;
		}

		const isVaultPage =
			typeof window !== 'undefined' &&
			window.location.pathname.startsWith('/vaults/') &&
			window.location.pathname.split('/').length === 4;
		return isVaultPage;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [typeof window, pathname]);

	return (
		<>
			<Popover
				onMouseEnter={(): void => set_isShowing(true)}
				onMouseLeave={(): void => set_isShowing(false)}>
				<div
					onClick={(): void => set_isShowing(false)}
					onMouseEnter={(): void => set_isShowing(false)}
					className={cl(
						'fixed inset-0 bg-black backdrop-blur-sm transition-opacity',
						!isShowing ? 'opacity-0 pointer-events-none' : 'opacity-0 pointer-events-auto'
					)}
				/>
				<Popover.Button className={'z-20 flex size-8'}>
					<Link href={'/'}>
						<span className={'sr-only'}>{'Back to home'}</span>
						<Logo
							currentHost={currentHost}
							isVaultPage={isVaultPage}
						/>
					</Link>
				</Popover.Button>

				<Transition.Root show={isShowing}>
					<Transition.Child
						as={'div'}
						enter={'transition ease-out duration-200'}
						enterFrom={'opacity-0 translate-y-1'}
						enterTo={'opacity-100 translate-y-0'}
						leave={'transition ease-in duration-150'}
						leaveFrom={'opacity-100 translate-y-0'}
						leaveTo={'opacity-0 translate-y-1'}
						className={'relative z-[9999999]'}>
						<Popover.Panel
							className={'absolute left-1/2 z-20 w-80 -translate-x-1/2 px-4 pt-6 sm:px-0 md:w-[800px]'}>
							<div className={cl('overflow-hidden shadow-xl', isVaultPage ? 'pt-4' : 'pt-0')}>
								<div
									className={cl(
										'relative grid grid-cols-2 gap-2 border p-6 md:grid-cols-5 rounded',
										'bg-[#F4F4F4] dark:bg-neutral-100 border-transparent'
									)}>
									<div className={'col-span-3 grid grid-cols-2 gap-2 md:grid-cols-3'}>
										{[...Object.values(APPS)]
											.filter(({name}): boolean => name !== 'V3 Vaults')
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
																'flex cursor-pointer flex-col items-center justify-center transition-colors p-4 rounded',
																'bg-[#EBEBEB] border-transparent hover:bg-[#c3c3c380] dark:bg-[#010A3B] hover:dark:bg-neutral-0'
															)}>
															<div>
																{cloneElement(icon, {
																	className: 'w-8 h-8 min-w-8 max-w-8 min-h-8 max-h-8'
																})}
															</div>
															<div className={'pt-2 text-center'}>
																<b className={'text-base text-black dark:text-white'}>
																	{name}
																</b>
															</div>
														</div>
													</Link>
												);
											})}
									</div>
									<div className={'col-span-2 grid grid-cols-2 gap-2 md:grid-cols-3'}>
										<Link
											prefetch={false}
											key={APPS.V3.name}
											href={APPS.V3.href}
											className={'col-span-3 row-span-2'}
											onClick={(): void => set_isShowing(false)}>
											<div
												className={cl(
													'relative flex h-full w-full cursor-pointer flex-col items-center justify-center transition-all rounded p-4',
													'bg-[#EBEBEB] hover:bg-[#c3c3c380] dark:bg-[#010A3B] hover:dark:brightness-125'
												)}>
												<div className={'z-10 flex w-full flex-col items-center'}>
													<V3Logo className={'h-20'} />
													<div className={'-mb-2 pt-4 text-center'}>
														<p
															className={cl(
																'font-bold text-black dark:text-white text-sm',
																'whitespace-break-spaces'
															)}>
															{'Discover\nBrand New Vaults'}
														</p>
													</div>
												</div>
											</div>
										</Link>
									</div>
								</div>
							</div>
						</Popover.Panel>
					</Transition.Child>
				</Transition.Root>
			</Popover>
		</>
	);
}
