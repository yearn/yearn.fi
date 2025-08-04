import {ImageWithFallback} from '@lib/components/ImageWithFallback';
import {useNotifications} from '@lib/contexts/useNotifications';
import {useTransactionStatusPoller} from '@lib/hooks/useTransactionStatusPoller';
import {IconArrow} from '@lib/icons/IconArrow';
import {IconCheck} from '@lib/icons/IconCheck';
import {IconClose} from '@lib/icons/IconClose';
import {IconCross} from '@lib/icons/IconCross';
import {IconLoader} from '@lib/icons/IconLoader';
import type {TNotification, TNotificationStatus} from '@lib/types/notifications';
import {cl, SUPPORTED_NETWORKS, toAddress, truncateHex} from '@lib/utils';
import type {TYDaemonVault} from '@lib/utils/schemas/yDaemonVaultsSchemas';
import {motion} from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import type {ReactElement} from 'react';
import {memo, useCallback, useMemo, useState} from 'react';

const STATUS: {[key: string]: [string, string, ReactElement]} = {
	success: ['Success', 'text-white bg-[#00796D]', <IconCheck className={'size-4'} key={'success'} />],
	pending: [
		'Pending',
		'text-neutral-800 bg-neutral-300',
		<IconLoader className={'size-4 animate-spin'} key={'pending'} />
	],
	error: ['Error', 'text-white bg-[#C73203] bg-opacity-90', <IconCross className={'size-3'} key={'error'} />]
};

function NotificationStatus(props: {status: TNotificationStatus}): ReactElement {
	return (
		<div
			className={cl(
				'flex gap-2 justify-center self-start py-2 px-4 items-center rounded-lg text-xs',
				STATUS[props.status][1]
			)}
			aria-label={`Status: ${STATUS[props.status][0]}`}>
			{STATUS[props.status][2]}
			{STATUS[props.status][0]}
		</div>
	);
}

function NotificationContent({
	notification,
	fromVault,
	toVault
}: {
	notification: TNotification;
	fromVault?: TYDaemonVault;
	toVault?: TYDaemonVault;
}): ReactElement {
	const chainName = SUPPORTED_NETWORKS.find(network => network.id === notification.chainId)?.name || 'Unknown';
	const explorerBaseURI = useMemo(() => {
		const chain = SUPPORTED_NETWORKS.find(network => network.id === notification.chainId);
		return chain?.blockExplorers?.default?.url || 'https://etherscan.io';
	}, [notification.chainId]);

	const fromTokenLabel = useMemo(() => {
		switch (notification.type) {
			case 'approve':
				return 'Token:';
			case 'claim':
				return 'Token:';
			case 'withdraw':
				return 'From vault:';
			case 'unstake':
				return 'From vault:';
			default:
				return 'From token:';
		}
	}, [notification.type]);

	const fromTokenLink = useMemo(() => {
		if (!fromVault) {
			return `${explorerBaseURI}/address/${notification.fromAddress || '0x0'}`;
		}

		const isV3 = fromVault.version.startsWith('3') || fromVault.version.startsWith('~3');
		const href = isV3
			? `/v3/${fromVault.chainID}/${toAddress(fromVault.address)}`
			: `/vaults/${fromVault.chainID}/${toAddress(fromVault.address)}`;

		return href;
	}, [fromVault, explorerBaseURI, notification.fromAddress]);

	const toTokenLabel = useMemo(() => {
		switch (notification.type) {
			case 'withdraw':
				return 'To token:';
			default:
				return 'To vault:';
		}
	}, [notification.type]);

	const toTokenLink = useMemo(() => {
		if (!toVault) {
			return `${explorerBaseURI}/address/${notification.toAddress || '0x0'}`;
		}
		const isV3 = toVault.version.startsWith('3') || toVault.version.startsWith('~3');
		const href = isV3
			? `/v3/${toVault.chainID}/${toAddress(toVault.address)}`
			: `/vaults/${toVault.chainID}/${toAddress(toVault.address)}`;

		return href;
	}, [toVault, explorerBaseURI, notification.toAddress]);

	return (
		<div className={'flex gap-4'}>
			<div className={'flex flex-col items-center gap-3'}>
				<div className={'relative'}>
					<ImageWithFallback
						alt={notification.fromTokenName || 'Token'}
						unoptimized
						src={`${process.env.SMOL_ASSETS_URL}/token/${notification.chainId}/${notification.fromAddress || '0x0'}/logo-128.png`}
						altSrc={`${process.env.SMOL_ASSETS_URL}/token/${notification.chainId}/${notification.fromAddress || '0x0'}/logo-128.png`}
						quality={90}
						width={32}
						height={32}
					/>
					<div
						className={
							'absolute bottom-5 left-5 flex size-4 items-center justify-center rounded-full bg-white'
						}>
						<Image
							width={14}
							height={14}
							alt={'chain'}
							src={`${process.env.SMOL_ASSETS_URL}/chain/${notification.chainId}/logo.svg`}
						/>
					</div>
				</div>

				{notification.toTokenName && <IconArrow className={'size-4 rotate-[135deg]'} />}

				{notification.toTokenName && notification.toAddress && (
					<div className={'relative'}>
						<ImageWithFallback
							alt={notification.toTokenName || 'Token'}
							unoptimized
							src={`${process.env.SMOL_ASSETS_URL}/token/${notification.chainId}/${notification.toAddress}/logo-128.png`}
							altSrc={`${process.env.SMOL_ASSETS_URL}/token/${notification.chainId}/${notification.toAddress}/logo-128.png`}
							quality={90}
							width={32}
							height={32}
						/>
						<div
							className={
								'absolute bottom-5 left-5 flex size-4 items-center justify-center rounded-full bg-white'
							}>
							<Image
								width={14}
								height={14}
								alt={'chain'}
								src={`${process.env.SMOL_ASSETS_URL}/chain/${notification.chainId}/logo.svg`}
							/>
						</div>
					</div>
				)}
			</div>
			<div className={'flex-1'}>
				<div className={'grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-neutral-800'}>
					<p>{'Address:'}</p>
					<p className={'text-right font-bold'}>
						<Link
							href={`${explorerBaseURI}/address/${notification.address}`}
							target={'_blank'}
							rel={'noopener noreferrer'}
							aria-label={`View address ${notification.address} on explorer`}
							className={'text-neutral-900 hover:text-neutral-600'}>
							<button className={'text-xs font-medium underline'}>
								{truncateHex(notification.address, 5)}
							</button>
						</Link>
					</p>
					<p>{fromTokenLabel}</p>
					<p className={'text-right font-bold'}>
						<Link
							href={fromTokenLink}
							target={'_blank'}
							rel={'noopener noreferrer'}
							aria-label={`View token ${notification.fromTokenName || 'Unknown'} on explorer`}
							className={'text-neutral-900 hover:text-neutral-600'}>
							<button className={'text-xs font-medium underline'}>
								{notification.fromTokenName || 'Unknown'}
							</button>
						</Link>
					</p>
					<p>{'Amount:'}</p>
					<p className={'text-right font-bold'}>{notification.amount}</p>
					{notification.toTokenName && (
						<>
							<p>{toTokenLabel}</p>
							<p className={'text-right font-bold'}>
								<Link
									href={toTokenLink}
									target={'_blank'}
									rel={'noopener noreferrer'}
									aria-label={`View vault ${notification.toTokenName || 'Unknown'} on explorer`}
									className={'text-neutral-900 hover:text-neutral-600'}>
									<button className={'text-xs font-medium underline'}>
										{notification.toTokenName || 'Unknown'}
									</button>
								</Link>
							</p>
						</>
					)}
					{notification.spenderAddress && (
						<>
							<p>{'Spender:'}</p>
							<p className={'text-right font-bold'}>
								<Link
									href={`${explorerBaseURI}/address/${notification.spenderAddress}`}
									target={'_blank'}
									rel={'noopener noreferrer'}
									aria-label={`View spender ${notification.spenderAddress} on explorer`}
									className={'text-neutral-900 hover:text-neutral-600'}>
									<button className={'text-xs font-medium underline'}>
										{truncateHex(notification.spenderAddress || '0x0', 5)}
									</button>
								</Link>
							</p>
						</>
					)}
					<p>{'Chain:'}</p>
					<p className={'text-right font-bold'}>{chainName}</p>
				</div>
			</div>
		</div>
	);
}

export const Notification = memo(function Notification({
	notification,
	variant = 'v3',
	fromVault,
	toVault
}: {
	notification: TNotification;
	variant: 'v2' | 'v3';
	fromVault?: TYDaemonVault;
	toVault?: TYDaemonVault;
}): ReactElement {
	const {deleteByID} = useNotifications();
	const [isDeleting, setIsDeleting] = useState(false);

	/************************************************************************************************
	 * Use the transaction status poller to automatically check and update pending transactions
	 * every minute. This will update the notification status when transactions are completed.
	 ************************************************************************************************/
	useTransactionStatusPoller(notification);

	const formattedDate = useMemo(() => {
		if (!notification.timeFinished || notification.status === 'pending') {
			return null;
		}
		const date = new Date(notification.timeFinished * 1000);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: 'numeric'
		});
	}, [notification.timeFinished, notification.status]);

	const explorerLink = useMemo(() => {
		if (!notification.txHash) {
			return null;
		}

		const chain = SUPPORTED_NETWORKS.find(network => network.id === notification.chainId);
		const explorerBaseURI = chain?.blockExplorers?.default?.url || 'https://etherscan.io';
		return `${explorerBaseURI}/tx/${notification.txHash}`;
	}, [notification.chainId, notification.txHash]);

	const notificationTitle = useMemo(() => {
		switch (notification.type) {
			case 'approve':
				return 'Approve';
			case 'deposit':
				return 'Deposit';
			case 'withdraw':
				return 'Withdraw';
			case 'zap':
				return 'Zap';
			case 'deposit and stake':
				return 'Deposit & Stake';
			case 'stake':
				return 'Stake';
			case 'unstake':
				return 'Unstake';
			case 'claim':
				return 'Claim';
			case 'claim and exit':
				return 'Claim & Exit';
			case 'migrate':
				return 'Migrate';
			default:
				return 'Transaction';
		}
	}, [notification.type]);

	const handleDelete = useCallback(async () => {
		if (!notification.id || isDeleting) {
			return;
		}

		setIsDeleting(true);

		try {
			await deleteByID(notification.id!);
		} catch (error) {
			console.error('Failed to delete notification:', error);
			setIsDeleting(false);
		}
	}, [deleteByID, notification.id, isDeleting]);

	return (
		<motion.div
			layout
			layoutId={`notification-${notification.id}`}
			initial={{opacity: 0, y: 20, scaleY: 0.8}}
			animate={{opacity: 1, y: 0, scaleY: 1}}
			exit={{
				opacity: 0,
				y: -10,
				scaleY: 0.3,
				transition: {
					duration: 0.2,
					ease: [0.4, 0.0, 0.2, 1] // easeOut
				}
			}}
			transition={{
				duration: 0.25,
				ease: [0.4, 0.0, 0.2, 1], // easeOut
				layout: {
					duration: 0.2,
					ease: [0.4, 0.0, 0.2, 1] // easeOut
				}
			}}
			className={cl(
				'border border-neutral-200 p-4 h-fit relative mb-4 origin-top group',
				variant === 'v3'
					? 'bg-neutral-200 rounded-xl'
					: 'bg-neutral-0 hover:bg-neutral-100/30 transition-colors'
			)}
			style={{transformOrigin: 'top center'}}
			aria-label={`${notificationTitle} notification`}>
			{variant === 'v3' && (
				<div
					className={cl(
						'absolute inset-0 rounded-xl',
						'opacity-20 transition-opacity  pointer-events-none',
						'bg-[linear-gradient(80deg,_#2C3DA6,_#D21162)] group-hover:opacity-100'
					)}
				/>
			)}

			{/* Close button */}
			<button
				onClick={handleDelete}
				disabled={isDeleting}
				className={cl(
					'absolute z-[999999] flex items-center justify-center',
					'right-2 top-2 w-5 h-5 rounded-full hover:opacity-100 hover:bg-neutral-200',
					'transition-all duration-200',
					'opacity-0 group-hover:opacity-60 group-hover:bg-neutral-200/60 hover:!opacity-100',
					isDeleting ? '!opacity-30' : ''
				)}
				title={'Remove'}>
				<IconClose className={cl('w-3 h-3', variant === 'v3' ? 'text-neutral-700' : 'text-neutral-600')} />
			</button>

			<div className={'relative z-20'}>
				<div className={'mb-4 flex items-center justify-between'}>
					<p className={'font-medium text-neutral-900'}>{notificationTitle}</p>
					<NotificationStatus status={notification.status} />
				</div>

				<NotificationContent notification={notification} fromVault={fromVault} toVault={toVault} />

				{notification.status === 'success' || notification.txHash ? (
					<div
						className={
							'mt-4 flex items-center justify-between border-t border-neutral-100 pt-3 text-xs text-neutral-800'
						}>
						<div className={'flex gap-4'}>
							<span className={'font-bold'}>{formattedDate}</span>
						</div>
						{explorerLink ? (
							<Link
								href={explorerLink}
								target={'_blank'}
								rel={'noopener noreferrer'}
								aria-label={`View transaction ${notification.txHash} on explorer`}
								className={'text-neutral-900 hover:text-neutral-600'}>
								<button className={'text-xs font-medium underline'}>{'View tx'}</button>
							</Link>
						) : null}
					</div>
				) : null}
			</div>
		</motion.div>
	);
});
