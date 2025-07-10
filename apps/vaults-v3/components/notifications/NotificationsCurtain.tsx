import {type ReactElement, useEffect, useMemo} from 'react';
import {Drawer} from 'vaul';
import {useNotifications} from '@lib/contexts/useNotifications';
import {IconCross} from '@lib/icons/IconCross';

import {Notification} from './Notification';

export function NotificationsCurtain(props: {
	set_shouldOpenCurtain: (value: boolean) => void;
	isOpen: boolean;
}): ReactElement {
	const {cachedEntries, set_notificationStatus} = useNotifications();
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
				<Drawer.Content className={'fixed inset-y-0 right-0 z-[999999] flex w-full outline-none md:w-[380px]'}>
					<div className={'flex w-full grow flex-col bg-neutral-100 p-5 md:my-2 md:mr-2 md:rounded-3xl'}>
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
							<div className={'h-[94.5%] overflow-y-auto overflow-x-hidden scrollbar-none'}>
								{isEmpty ? (
									<p className={'mx-auto mt-40 text-center text-neutral-800'}>
										{'Nothing here yet!'}
									</p>
								) : (
									<div className={'flex h-full flex-col gap-4'}>
										{cachedEntries.toReversed().map(entry => (
											<Notification
												key={entry.id}
												notification={entry}
												variant={'v3'}
											/>
										))}
									</div>
								)}
							</div>
						</div>
					</div>
				</Drawer.Content>
			</Drawer.Portal>
		</Drawer.Root>
	);
}
