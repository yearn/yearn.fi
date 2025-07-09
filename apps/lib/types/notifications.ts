import type {Hex, TransactionReceipt} from 'viem';
import type {TAddress} from './address';

export type TNotificationStatus = 'pending' | 'success' | 'error';

export type TNotificationType =
	| 'approve'
	| 'deposit'
	| 'zap'
	| 'deposit and stake'
	| 'stake'
	| 'claim'
	| 'claim and exit';

export type TNotification = {
	id?: number;
	type: TNotificationType;
	fromAddress: TAddress;
	chainId: number;
	tokenAddress: TAddress;
	tokenName: string;
	spenderAddress?: TAddress;
	spenderName?: string;
	amount: string;
	fromTokenName?: string;
	fromAmount?: string;
	toAddress?: TAddress;
	toTokenName?: string;
	txHash: Hex | undefined;
	timeFinished?: number;
	blockNumber: bigint;
	status: TNotificationStatus;
};

export type TCurtainStatus = {isOpen: boolean};

export type TNotificationsContext = {
	shouldOpenCurtain: boolean;
	cachedEntries: TNotification[];
	notificationStatus: TNotificationStatus | null;
	set_notificationStatus: (value: TNotificationStatus | null) => void;
	deleteByID: (id: number) => Promise<void>;
	updateEntry: (value: Partial<TNotification>, id: number) => Promise<void>;
	addNotification: (value: TNotification) => Promise<void>;
	set_shouldOpenCurtain: (value: boolean) => void;
};

export type TNotificationsActionsContext = {
	handleApproveNotification: (receipt: TransactionReceipt) => Promise<void>;
};
