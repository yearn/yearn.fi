import {type ReactElement, useEffect} from 'react';
import {motion, AnimatePresence} from 'framer-motion';
import {Drawer} from 'vaul';
import {useNotifications} from '@lib/contexts/useNotifications';
import {IconCross} from '@lib/icons/IconCross';

import {Notification} from './Notification';
import {cl} from '@lib/utils';
import {useYearn} from '@lib/contexts/useYearn';

export function NotificationsCurtain(props: {
	set_shouldOpenCurtain: (value: boolean) => void;
	isOpen: boolean;
	variant: 'v2' | 'v3';
}): ReactElement {
	const {cachedEntries, set_notificationStatus, isLoading, error} = useNotifications();
	const {vaults, vaultsMigrations, vaultsRetired} = useYearn();
	const allVaults = {...vaults, ...vaultsMigrations, ...vaultsRetired};

	const isEmpty = cachedEntries.length === 0;

	/*************************************************************************************
	 * Clear top bar notification status when drawer is triggered
	 *******************************************************************/
	useEffect(() => {
		if (props.isOpen) {
			set_notificationStatus(null);
			// Block page scrolling when drawer is open
			document.body.style.overflow = 'hidden';
		} else {
			// Restore scrolling when drawer is closed
			document.body.style.overflow = '';
		}

		// Cleanup on unmount
		return () => {
			document.body.style.overflow = '';
		};
	}, [props.isOpen, set_notificationStatus]);

	return (
		<Drawer.Root
			direction={'right'}
			open={props.isOpen}
			onOpenChange={props.set_shouldOpenCurtain}>
			<Drawer.Portal>
				<Drawer.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[999998] transition-all duration-300" />
				<Drawer.Content className={'fixed inset-y-0 right-0 z-[999999] flex w-full outline-none md:w-[386px]'}>
					<div
						className={cl(
							'flex w-full grow flex-col py-5 pl-5 md:my-2 md:mr-2 shadow-2xl',
							props.variant === 'v3' ? 'bg-neutral-100 md:rounded-3xl' : 'bg-neutral-0'
						)}>
						<div className={'h-full'}>
							<div className={'mb-4 flex items-center justify-between pr-4'}>
								<Drawer.Title className={'font-bold text-neutral-900'}>{'Notifications'}</Drawer.Title>
								<Drawer.Close
									className={
										'rounded-full p-1 text-neutral-900 transition-colors hover:text-neutral-600'
									}>
									<IconCross className={'size-4'} />
								</Drawer.Close>
							</div>
							<div
								className={'h-[94.5%] overflow-y-auto overflow-x-hidden pt-2'}
								style={{
									scrollbarColor: '#9E9E9E transparent',
									scrollbarWidth: 'thin',
									scrollbarGutter: 'stable'
								}}>
								{isLoading ? (
									<div className={'flex h-full items-center justify-center'}>
										<div className={'flex flex-col items-center gap-2'}>
											<div
												className={
													'size-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900'
												}
											/>
											<p className={'text-sm text-neutral-600'}>{'Loading notifications...'}</p>
										</div>
									</div>
								) : error ? (
									<div className={'mx-auto mt-40 text-center'}>
										<p className={'text-red-600 font-medium'}>{'Error loading notifications'}</p>
										<p className={'text-sm text-neutral-600 mt-2'}>{error}</p>
									</div>
								) : isEmpty ? (
									<p className={'mx-auto mt-40 text-center text-neutral-800'}>
										{'Nothing here yet!'}
									</p>
								) : (
									<motion.div
										layout
										initial={{opacity: 0}}
										animate={{opacity: 1}}
										transition={{duration: 0.2, ease: [0.4, 0.0, 0.2, 1]}}
										className={'flex h-full flex-col pr-2'}>
										<AnimatePresence mode="popLayout">
											{cachedEntries.toReversed().map(entry => (
												<Notification
													key={`notification-${entry.id}`}
													fromVault={
														entry.fromAddress ? allVaults[entry.fromAddress] : undefined
													}
													toVault={entry.toAddress ? allVaults[entry.toAddress] : undefined}
													notification={entry}
													variant={props.variant}
												/>
											))}
										</AnimatePresence>
									</motion.div>
								)}
							</div>
						</div>
					</div>
				</Drawer.Content>
			</Drawer.Portal>
		</Drawer.Root>
	);
}
