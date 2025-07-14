import type {Hex, TransactionReceipt} from 'viem';
import type {TAddress} from './address';
import {TActionParams} from '@vaults-v2/contexts/useActionFlow';

export type TNotificationStatus = 'pending' | 'success' | 'error';

export type TNotificationType =
	| 'approve'
	| 'deposit'
	| 'withdraw'
	| 'zap'
	| 'deposit and stake'
	| 'stake'
	| 'unstake'
	| 'claim'
	| 'claim and exit'
	| 'migrate';

export type TNotification = {
	id?: number;
	type: TNotificationType;
	address: TAddress;
	chainId: number;
	spenderAddress?: TAddress;
	spenderName?: string;
	amount: string;
	fromAddress?: TAddress; // Token to deposit
	fromTokenName?: string;
	fromAmount?: string;
	toAddress?: TAddress; // Vault token to receive
	toTokenName?: string;
	txHash: Hex | undefined;
	timeFinished?: number;
	blockNumber?: bigint;
	status: TNotificationStatus;
};

export type TCurtainStatus = {isOpen: boolean};

export type TNotificationsContext = {
	shouldOpenCurtain: boolean;
	cachedEntries: TNotification[];
	notificationStatus: TNotificationStatus | null;
	isLoading: boolean;
	error: string | null;
	set_notificationStatus: (value: TNotificationStatus | null) => void;
	deleteByID: (id: number) => Promise<void>;
	updateEntry: (value: Partial<TNotification>, id: number) => Promise<void>;
	addNotification: (value: TNotification) => Promise<number>;
	set_shouldOpenCurtain: (value: boolean) => void;
};

export type TNotificationsActionsContext = {
	handleApproveNotification: ({
		actionParams,
		receipt,
		status,
		idToUpdate
	}: {
		actionParams: Partial<TActionParams>;
		receipt?: TransactionReceipt;
		status?: TNotificationStatus;
		idToUpdate?: number;
	}) => Promise<number>;
	handleDepositNotification: ({
		actionParams,
		type,
		receipt,
		status,
		idToUpdate
	}: {
		actionParams: Partial<TActionParams>;
		type?: TNotificationType;
		receipt?: TransactionReceipt;
		status?: TNotificationStatus;
		idToUpdate?: number;
	}) => Promise<number>;
	handleWithdrawNotification: ({
		actionParams,
		type,
		receipt,
		status,
		idToUpdate
	}: {
		actionParams: Partial<TActionParams>;
		type?: TNotificationType;
		receipt?: TransactionReceipt;
		status?: TNotificationStatus;
		idToUpdate?: number;
	}) => Promise<number>;
	handleStakeNotification: ({
		actionParams,
		type,
		receipt,
		status,
		idToUpdate
	}: {
		actionParams: Partial<TActionParams>;
		type?: TNotificationType;
		receipt?: TransactionReceipt;
		status?: TNotificationStatus;
		idToUpdate?: number;
	}) => Promise<number>;
	handleUnstakeNotification: ({
		actionParams,
		type,
		receipt,
		status,
		idToUpdate
	}: {
		actionParams: Partial<TActionParams>;
		type?: TNotificationType;
		receipt?: TransactionReceipt;
		status?: TNotificationStatus;
		idToUpdate?: number;
	}) => Promise<number>;
	handleClaimNotification: ({
		actionParams,
		type,
		receipt,
		status,
		idToUpdate
	}: {
		actionParams: Partial<TActionParams>;
		type?: TNotificationType;
		receipt?: TransactionReceipt;
		status?: TNotificationStatus;
		idToUpdate?: number;
	}) => Promise<number>;
};
