import React, {createContext, useCallback, useContext, useMemo, useState} from 'react';
import {useIndexedDBStore} from 'use-indexeddb';
import {NotificationsCurtain} from '@vaults-v3/components/notifications/NotificationsCurtain';
import {useAsyncTrigger} from '@lib/hooks/useAsyncTrigger';

import type {TNotification, TNotificationsContext, TNotificationStatus} from '@lib/types/notifications';

const defaultProps: TNotificationsContext = {
	shouldOpenCurtain: false,
	cachedEntries: [],
	notificationStatus: null,
	set_notificationStatus: (): void => undefined,
	deleteByID: async (): Promise<void> => undefined,
	updateEntry: async (): Promise<void> => undefined,
	addNotification: async (): Promise<number> => 0,
	set_shouldOpenCurtain: (): void => undefined
};

const NotificationsContext = createContext<TNotificationsContext>(defaultProps);
export const WithNotifications = ({children}: {children: React.ReactElement}): React.ReactElement => {
	const [cachedEntries, set_cachedEntries] = useState<TNotification[]>([]);
	const [entryNonce, set_entryNonce] = useState<number>(0);

	/**************************************************************************
	 * State that is used to store latest added/updated notification status
	 *************************************************************************/
	const [notificationStatus, set_notificationStatus] = useState<TNotificationStatus | null>(null);

	const [shouldOpenCurtain, set_shouldOpenCurtain] = useState(false);
	const {add, getAll, update, deleteByID, getByID} = useIndexedDBStore<TNotification>('notifications');

	/************************************************************************************************
	 * This useAsyncTrigger hook is responsible for fetching all notifications from the IndexedDB
	 * and updating the cached entries state whenever the entryNonce changes. This ensures that
	 * the component always displays the most up-to-date notifications.
	 *
	 * The entryNonce is used as a dependency to trigger the effect, allowing for manual refreshes
	 * of the notification list when needed (e.g., after adding or updating a notification).
	 ************************************************************************************************/
	useAsyncTrigger(async (): Promise<void> => {
		entryNonce;
		const entriesFromDB = await getAll();
		set_cachedEntries(entriesFromDB);
	}, [getAll, entryNonce]);

	/************************************************************************************************
	 * The updateEntry function is responsible for updating an existing notification in the IndexedDB.
	 * It takes a partial notification object and an ID as parameters.
	 *
	 * The function performs the following steps:
	 * 1. Retrieves the existing notification from the database using the provided ID.
	 * 2. If the notification exists, it merges the new data with the existing notification.
	 * 3. Updates the notification in the database.
	 * 4. Increments the entryNonce to trigger a refresh of the cached entries.
	 * 5. Updates the notificationStatus with the new status, if provided.
	 *
	 * This function is memoized using useCallback to optimize performance.
	 ************************************************************************************************/
	const updateEntry = useCallback(
		async (entry: Partial<TNotification>, id: number) => {
			const notification = await getByID(id);

			if (notification) {
				await update({...notification, ...entry});
				set_entryNonce(nonce => nonce + 1);
				set_notificationStatus(entry?.status || null);
			}
		},
		[getByID, update]
	);

	const addNotification = useCallback(
		async (notification: TNotification): Promise<number> => {
			const id = await add(notification);
			set_entryNonce(nonce => nonce + 1);
			set_notificationStatus(notification.status);
			return id;
		},
		[add]
	);

	/**************************************************************************
	 * Context value that is passed to all children of this component.
	 *************************************************************************/
	const contextValue = useMemo(
		(): TNotificationsContext => ({
			shouldOpenCurtain,
			cachedEntries,
			deleteByID,
			updateEntry,
			addNotification,
			notificationStatus,
			set_notificationStatus,
			set_shouldOpenCurtain
		}),
		[shouldOpenCurtain, cachedEntries, deleteByID, updateEntry, addNotification, notificationStatus]
	);

	return (
		<NotificationsContext.Provider value={contextValue}>
			{children}
			<NotificationsCurtain
				set_shouldOpenCurtain={set_shouldOpenCurtain}
				isOpen={shouldOpenCurtain}
			/>
		</NotificationsContext.Provider>
	);
};

export const useNotifications = (): TNotificationsContext => {
	const ctx = useContext(NotificationsContext);
	if (!ctx) {
		throw new Error('NotificationsContext not found');
	}
	return ctx;
};
