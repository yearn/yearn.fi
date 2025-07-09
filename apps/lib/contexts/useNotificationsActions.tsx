import React, {createContext, useCallback, useContext, useMemo} from 'react';
import {TActionParams} from '@vaults-v2/contexts/useActionFlow';
import {toAddress} from '@lib/utils';

import {useNotifications} from './useNotifications';
import {useWeb3} from './useWeb3';

import type {TransactionReceipt} from 'viem';
import type {TNotificationsActionsContext} from '@lib/types/notifications';

const defaultProps: TNotificationsActionsContext = {handleApproveNotification: async (): Promise<void> => undefined};

const NotificationsActionsContext = createContext<TNotificationsActionsContext>(defaultProps);
export const WithNotificationsActions = ({children}: {children: React.ReactElement}): React.ReactElement => {
	const {addNotification} = useNotifications();
	const {address} = useWeb3();

	const handleApproveNotification = useCallback(
		async (actionParams: TActionParams, receipt: TransactionReceipt): Promise<void> => {
			console.log('in handleApproveNotification', actionParams);
			await addNotification({
				fromAddress: toAddress(address),
				chainId: actionParams.selectedOptionFrom?.chainID || 1,
				txHash: receipt.transactionHash,
				timeFinished: Date.now() / 1000,
				blockNumber: receipt.blockNumber,
				status: 'success',
				type: 'approve',
				tokenAddress: toAddress(actionParams.selectedOptionFrom?.value),
				tokenName: actionParams.selectedOptionFrom?.label || '',
				spenderAddress: toAddress(actionParams.selectedOptionTo?.value),
				spenderName: actionParams.selectedOptionTo?.label || '',
				amount: actionParams.amount?.raw.toString() || '0'
			});
		},
		[addNotification, address]
	);

	/**************************************************************************
	 * Context value that is passed to all children of this component.
	 *************************************************************************/
	const contextValue = useMemo(
		(): TNotificationsActionsContext => ({
			handleApproveNotification
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
