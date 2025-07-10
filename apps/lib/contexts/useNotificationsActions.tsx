import React, {createContext, useCallback, useContext, useMemo} from 'react';
import {TActionParams} from '@vaults-v2/contexts/useActionFlow';
import {toAddress} from '@lib/utils';

import {useNotifications} from './useNotifications';
import {useWeb3} from './useWeb3';

import type {TransactionReceipt} from 'viem';
import type {TNotificationsActionsContext, TNotificationStatus} from '@lib/types/notifications';

const defaultProps: TNotificationsActionsContext = {
	handleApproveNotification: async (): Promise<number> => 0,
	handleDepositNotification: async (): Promise<number> => 0
};

const NotificationsActionsContext = createContext<TNotificationsActionsContext>(defaultProps);
export const WithNotificationsActions = ({children}: {children: React.ReactElement}): React.ReactElement => {
	const {addNotification, updateEntry} = useNotifications();
	const {address} = useWeb3();

	const handleApproveNotification = useCallback(
		async (
			actionParams: Partial<TActionParams>,
			receipt?: TransactionReceipt,
			status?: TNotificationStatus,
			idToUpdate?: number
		): Promise<number> => {
			if (idToUpdate && receipt) {
				await updateEntry(
					{
						txHash: receipt.transactionHash,
						timeFinished: Date.now() / 1000,
						blockNumber: receipt.blockNumber,
						status
					},
					idToUpdate
				);
				return idToUpdate;
			}
			const createdId = await addNotification({
				address: toAddress(address),
				chainId: actionParams.selectedOptionFrom?.chainID || 1,
				txHash: undefined,
				timeFinished: undefined,
				blockNumber: undefined,
				status: 'pending',
				type: 'approve',
				fromAddress: toAddress(actionParams.selectedOptionFrom?.value),
				fromTokenName: actionParams.selectedOptionFrom?.label || '',
				spenderAddress: toAddress(actionParams.selectedOptionTo?.value),
				spenderName: actionParams.selectedOptionTo?.label || '',
				amount: actionParams.amount?.display || '0'
			});
			return createdId;
		},
		[addNotification, address]
	);

	const handleDepositNotification = useCallback(
		async (
			actionParams: Partial<TActionParams>,
			receipt?: TransactionReceipt,
			status?: TNotificationStatus,
			idToUpdate?: number
		): Promise<number> => {
			if (idToUpdate && receipt) {
				await updateEntry(
					{
						txHash: receipt.transactionHash,
						timeFinished: Date.now() / 1000,
						blockNumber: receipt.blockNumber,
						status
					},
					idToUpdate
				);
				return idToUpdate;
			}

			const createdId = await addNotification({
				address: toAddress(address),
				fromAddress: toAddress(actionParams.selectedOptionFrom?.value),
				fromTokenName: actionParams.selectedOptionFrom?.label || '',
				toAddress: toAddress(actionParams.selectedOptionTo?.value),
				toTokenName: actionParams.selectedOptionTo?.label || '',
				chainId: actionParams.selectedOptionFrom?.chainID || 1,
				txHash: undefined,
				timeFinished: undefined,
				blockNumber: undefined,
				status: 'pending',
				type: 'deposit',
				amount: actionParams.amount?.display || '0'
			});
			return createdId;
		},
		[addNotification, updateEntry, address]
	);

	/**************************************************************************
	 * Context value that is passed to all children of this component.
	 *************************************************************************/
	const contextValue = useMemo(
		(): TNotificationsActionsContext => ({
			handleApproveNotification,
			handleDepositNotification
		}),
		[handleApproveNotification]
	);

	return <NotificationsActionsContext.Provider value={contextValue}>{children}</NotificationsActionsContext.Provider>;
};

export const useNotificationsActions = (): TNotificationsActionsContext => {
	const ctx = useContext(NotificationsActionsContext);
	if (!ctx) {
		throw new Error('NotificationsActionsContext not found');
	}
	return ctx;
};
