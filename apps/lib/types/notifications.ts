import type {Hash, TransactionReceipt} from 'viem';
import type {TActionParams} from '@vaults-v2/contexts/useActionFlow';
import type {TAddress} from './address';

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
	txHash?: Hash;
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

// Base interface for notification handler parameters
export type TNotificationHandlerParams = {
	actionParams: Partial<TActionParams>;
	txHash?: Hash;
	type?: TNotificationType;
	receipt?: TransactionReceipt;
	status?: TNotificationStatus;
	idToUpdate?: number;
};

// Specific parameters for approve notification (no type field)
export type TApproveNotificationParams = Omit<TNotificationHandlerParams, 'type'>;

// Generic notification handler type
export type TNotificationHandler<T = TNotificationHandlerParams> = (params: T) => Promise<number>;

export type TNotificationsActionsContext = {
	handleApproveNotification: TNotificationHandler<TApproveNotificationParams>;
	handleDepositNotification: TNotificationHandler;
	handleWithdrawNotification: TNotificationHandler;
	handleStakeNotification: TNotificationHandler;
	handleUnstakeNotification: TNotificationHandler;
	handleClaimNotification: TNotificationHandler;
};
