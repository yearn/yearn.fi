import {type ReactElement, useEffect} from 'react';
import {motion, AnimatePresence} from 'framer-motion';
import {Drawer} from 'vaul';
import {useNotifications} from '@lib/contexts/useNotifications';
import {IconCross} from '@lib/icons/IconCross';

import {Notification} from './Notification';

export function NotificationsCurtain(props: {
	set_shouldOpenCurtain: (value: boolean) => void;
	isOpen: boolean;
}): ReactElement {
	const {cachedEntries, set_notificationStatus, isLoading, error} = useNotifications();
	const isEmpty = cachedEntries.length === 0;

	/*************************************************************************************
	 * Clear top bar notification status when drawer is triggered
	 *******************************************************************/
	useEffect(() => {
		if (props.isOpen) {
			set_notificationStatus(null);
		}
	}, [props.isOpen, set_notificationStatus]);

	return (
		<Drawer.Root
			direction={'right'}
			open={props.isOpen}
			onOpenChange={props.set_shouldOpenCurtain}>
			<Drawer.Portal>
				<Drawer.Content className={'fixed inset-y-0 right-0 z-[999999] flex w-full outline-none md:w-[386px]'}>
					<div
						className={'flex w-full grow flex-col bg-neutral-100 py-5 pl-5 md:my-2 md:mr-2 md:rounded-3xl'}>
						<div className={'h-full'}>
							<div className={'mb-4 flex items-center justify-between'}>
								<Drawer.Title className={'font-bold text-neutral-900'}>{'Notifications'}</Drawer.Title>
								<Drawer.Close
									className={
										'rounded-full p-1 text-neutral-900 transition-colors hover:text-neutral-600'
									}>
									<IconCross className={'size-4'} />
								</Drawer.Close>
							</div>
							<div className={'h-[94.5%] overflow-y-auto scrollbar-none'}>
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
										className={'flex h-full flex-col w-[95%] pt-2'}>
										<AnimatePresence mode="popLayout">
											{cachedEntries.toReversed().map(entry => (
												<Notification
													key={`notification-${entry.id}`}
													notification={entry}
													variant={'v3'}
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
