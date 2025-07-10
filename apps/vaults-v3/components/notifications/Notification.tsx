import React, {useMemo} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {ImageWithFallback} from '@lib/components/ImageWithFallback';
import {IconArrow} from '@lib/icons/IconArrow';
import {IconCheck} from '@lib/icons/IconCheck';
import {IconCross} from '@lib/icons/IconCross';
import {IconLoader} from '@lib/icons/IconLoader';
import {cl, SUPPORTED_NETWORKS, truncateHex} from '@lib/utils';

import type {ReactElement} from 'react';
import type {TNotification, TNotificationStatus} from '@lib/types/notifications';

const STATUS: {[key: string]: [string, string, ReactElement]} = {
	success: ['Success', 'text-green-800 bg-green-100', <IconCheck className={'size-4'} />],
	pending: ['Pending', 'text-neutral-800 bg-neutral-300', <IconLoader className={'size-4 animate-spin'} />],
	error: ['Error', 'text-white  bg-[#ef4444] bg-opacity-90', <IconCross className={'size-3'} />]
};

function NotificationStatus(props: {status: TNotificationStatus}): ReactElement {
	return (
		<div
			className={cl(
				'flex gap-2 justify-center self-start py-2 px-4 items-center rounded-lg text-xs',
				STATUS[props.status][1]
			)}>
			{STATUS[props.status][2]}
			{STATUS[props.status][0]}
		</div>
	);
}

function NotificationContent({notification}: {notification: TNotification}): ReactElement {
	const chainName = SUPPORTED_NETWORKS.find(network => network.id === notification.chainId)?.name;
	const explorerBaseURI = useMemo(() => {
		const chain = SUPPORTED_NETWORKS.find(network => network.id === notification.chainId);
		return chain?.blockExplorers?.default?.url || 'https://etherscan.io';
	}, [notification.chainId, notification.spenderAddress]);

	return (
		<div className={'flex gap-4'}>
			<div className={'flex flex-col items-center gap-3'}>
				<div className={'relative'}>
					<ImageWithFallback
						alt={notification.fromTokenName || ''}
						unoptimized
						src={`${process.env.SMOL_ASSETS_URL}/token/${notification.chainId}/${notification.fromAddress}/logo-128.png`}
						altSrc={`${process.env.SMOL_ASSETS_URL}/token/${notification.chainId}/${notification.fromAddress}/logo-128.png`}
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

				{notification.toTokenName && <IconArrow className={'rotate-[135deg] size-4'} />}

				{notification.toTokenName && (
					<div className={'relative'}>
						<ImageWithFallback
							alt={notification.toTokenName || ''}
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
					<p className={'font-bold text-right'}>
						<Link
							href={`${explorerBaseURI}/address/${notification.address}`}
							target={'_blank'}
							className={'text-neutral-900 hover:text-neutral-600'}>
							<button className={'text-xs font-medium underline'}>
								{truncateHex(notification.address, 5)}
							</button>
						</Link>
					</p>
					<p>{notification.type === 'approve' ? 'Token: ' : 'From token: '}</p>
					<p className={'font-bold text-right'}>
						<Link
							href={`${explorerBaseURI}/address/${notification.fromAddress}`}
							target={'_blank'}
							className={'text-neutral-900 hover:text-neutral-600'}>
							<button className={'text-xs font-medium underline'}>{notification.fromTokenName}</button>
						</Link>
					</p>
					<p>{'Amount:'}</p>
					<p className={'font-bold text-right'}>{notification.amount}</p>
					{notification.toTokenName && (
						<>
							<p>{'To vault:'}</p>
							<p className={'font-bold text-right'}>
								<Link
									href={`${explorerBaseURI}/address/${notification.toAddress}`}
									target={'_blank'}
									className={'text-neutral-900 hover:text-neutral-600'}>
									<button className={'text-xs font-medium underline'}>
										{notification.toTokenName}
									</button>
								</Link>
							</p>
						</>
					)}
					{notification.spenderAddress && (
						<>
							<p>{'Spender:'}</p>
							<p className={'font-bold text-right'}>
								<Link
									href={`${explorerBaseURI}/address/${notification.spenderAddress}`}
									target={'_blank'}
									className={'text-neutral-900 hover:text-neutral-600'}>
									<button className={'text-xs font-medium underline'}>
										{truncateHex(notification.spenderAddress, 5)}
									</button>
								</Link>
							</p>
						</>
					)}
					<p>{'Chain:'}</p>
					<p className={'font-bold text-right'}>{chainName}</p>
				</div>
			</div>
		</div>
	);
}

export function Notification({
	notification,
	variant = 'v3'
}: {
	notification: TNotification;
	variant: 'v2' | 'v3';
}): ReactElement {
	const date = new Date((notification.timeFinished || 0) * 1000);
	const formattedDate = date.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric'
	});

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
			case 'zap':
				return 'Zap';
			case 'deposit and stake':
				return 'Deposit & Stake';
			case 'stake':
				return 'Stake';
			case 'claim':
				return 'Claim';
			case 'claim and exit':
				return 'Claim & Exit';
			default:
				return 'Transaction';
		}
	}, [notification.type]);

	return (
		<div className={'rounded-xl border border-neutral-200 p-4 bg-neutral-200 relative'}>
			{variant === 'v3' && (
				<div
					className={cl(
						'absolute inset-0 rounded-xl',
						'opacity-20 transition-opacity  pointer-events-none',
						'bg-[linear-gradient(80deg,_#2C3DA6,_#D21162)] group-hover:opacity-100'
					)}
				/>
			)}
			<div className={'relative z-20'}>
				<div className={'mb-4 flex items-center justify-between'}>
					<p className={'font-medium text-neutral-900'}>{notificationTitle}</p>
					<NotificationStatus status={notification.status} />
				</div>

				<NotificationContent notification={notification} />

				{notification.status === 'success' ? (
					<div
						className={
							'mt-4 flex items-center justify-between border-t border-neutral-100 pt-3 text-xs text-neutral-800'
						}>
						<div className={'flex gap-4'}>
							<span className={'text-neutral-600'}>{'Arrived at'}</span>
							<span className={'font-bold'}>{formattedDate}</span>
						</div>
						{explorerLink ? (
							<Link
								href={explorerLink}
								target={'_blank'}
								className={'text-neutral-900 hover:text-neutral-600'}>
								<button className={'text-xs font-medium underline'}>{'View tx'}</button>
							</Link>
						) : null}
					</div>
				) : null}
			</div>
		</div>
	);
}
