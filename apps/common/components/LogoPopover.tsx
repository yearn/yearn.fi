'use client';

import {cloneElement, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useRouter} from 'next/router';
import {motion} from 'framer-motion';
import {cl} from '@builtbymom/web3/utils';
import {Popover, Transition} from '@headlessui/react';

import {LogoYearn} from '../icons/LogoYearn';
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

function useIsMounted(): () => boolean {
	const isMounted = useRef(false);

	useEffect(() => {
		isMounted.current = true;

		return () => {
			isMounted.current = false;
		};
	}, []);

	return useCallback(() => isMounted.current, []);
}

function Logo({currentHost}: {currentHost: string; isVaultPage: boolean}): ReactElement {
	const router = useRouter();
	const {pathname} = router;
	const appsIcon = (
		<LogoYearn
			className={'!size-8 !max-h-8 !max-w-8'}
			back={'text-primary'}
			front={'text-white'}
		/>
	);
	return (
		<>
			{Object.values(APPS).map(({name, host, icon, pathname: appPathname}): ReactElement => {
				const shouldAnimate = host.some(h => currentHost.includes(h)) || pathname.includes(appPathname);
				return (
					<MotionDiv
						key={name}
						name={name}
						animate={shouldAnimate ? 'enter' : 'exit'}>
						{icon}
					</MotionDiv>
				);
			})}
			{(pathname === '/vaults' || pathname.startsWith('/v2') || pathname.startsWith('/v3')) && (
				<MotionDiv
					key={'Vaults'}
					name={'Vaults'}
					animate={'enter'}>
					{appsIcon}
				</MotionDiv>
			)}
		</>
	);
}

export function LogoPopover(): ReactElement {
	const [isShowing, set_isShowing] = useState(false);
	const isMounted = useIsMounted();
	const pathname = usePathname();

	const isV3 = isMounted() && pathname.includes('/v3');

	const [isShowingMore, set_isShowingMore] = useState(false);

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

	useEffect(() => {
		if (!isShowing) {
			setTimeout(() => {
				set_isShowingMore(false);
			}, 500);
		}
	}, [isShowing]);

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
						<span className={'sr-only'}>{'Back to Homepage'}</span>
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
							className={
								'absolute left-0 top-10 z-20 w-[345px] scale-[115%] bg-transparent px-4 sm:px-0'
							}>
							<div className={cl('overflow-hidden shadow-xl', isVaultPage ? 'pt-4' : 'pt-0')}>
								<div
									className={cl(
										'relative gap-2 border p-4 rounded-md',
										'border-transparent ',
										// 'bg-white',
										isV3
											? 'border-[#151C40] bg-[#000520]'
											: 'dark:border-[#010A3B] dark:bg-neutral-300 bg-white'
									)}>
									<div className={'grid grid-cols-2 gap-2'}>
										{[...Object.values(APPS)]
											.slice(0, 4)
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
																'flex cursor-pointer flex-col items-center justify-center transition-colors p-4 rounded-sm',
																isV3
																	? 'hover:bg-neutral-0 border-[#151C40] border bg-[#010A3B]'
																	: 'bg-[#EBEBEB] dark:border-[#151C40] dark:border hover:bg-[#c3c3c380] dark:bg-neutral-100 hover:dark:bg-neutral-0'
															)}>
															<div>
																{cloneElement(icon, {
																	className: 'w-8 h-8 min-w-8 max-w-8 min-h-8 max-h-8'
																})}
															</div>
															<div className={'pt-2 text-center'}>
																<b
																	className={cl(
																		'text-base',
																		isV3
																			? 'text-white'
																			: 'text-black dark:text-white'
																	)}>
																	{name}
																</b>
															</div>
														</div>
													</Link>
												);
											})}
									</div>
									<div className={'mt-2 grid grid-cols-3 gap-2'}>
										{[...Object.values(APPS)]
											.slice(4, isShowingMore ? 10 : 7)
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
																'flex w-full cursor-pointer flex-col items-center justify-start transition-colors p-4 rounded-sm',
																isV3
																	? 'hover:bg-neutral-0 border-[#151C40] border bg-[#010A3B]'
																	: 'bg-[#EBEBEB] dark:border-[#151C40] dark:border hover:bg-[#c3c3c380] dark:bg-neutral-100 hover:dark:bg-neutral-0'
															)}>
															<div>
																{cloneElement(icon, {
																	className:
																		'w-[22px] h-[22px] min-w-[22px] max-w-[22px] min-h-[22px] max-h-[22px]'
																})}
															</div>
															<div className={'text-center'}>
																<b
																	className={cl(
																		'text-xs',
																		isV3
																			? 'text-white'
																			: 'text-black dark:text-white'
																	)}>
																	{name}
																</b>
															</div>
														</div>
													</Link>
												);
											})}
										{!isShowingMore && [...Object.values(APPS)].length > 7 && (
											<button
												onClick={(): void => set_isShowingMore(true)}
												className={cl(
													'flex cursor-pointer text-xs flex-col items-center justify-center transition-colors p-4 rounded-sm',
													isV3
														? 'hover:bg-neutral-0 border-[#151C40] border bg-[#010A3B]'
														: 'bg-[#EBEBEB] dark:border-[#151C40] dark:border hover:bg-[#c3c3c380] dark:bg-neutral-100 hover:dark:bg-neutral-0'
												)}>
												<b>{'More...'}</b>
											</button>
										)}
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
