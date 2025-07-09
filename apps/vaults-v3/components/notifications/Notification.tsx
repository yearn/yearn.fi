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
	success: ['Success', 'text-green-600 bg-green-100', <IconCheck className={'size-4'} />],
	pending: ['Pending', 'text-neutral-800 bg-neutral-100', <IconLoader className={'size-4 animate-spin'} />],
	error: ['Error', 'text-red-600 bg-red-100', <IconCross className={'size-4'} />]
};

function NotificationStatus(props: {status: TNotificationStatus}): ReactElement {
	return (
		<div
			className={cl(
				'flex gap-1 justify-center self-start py-2 px-4 items-center rounded-lg text-xs',
				STATUS[props.status][1]
			)}>
			{STATUS[props.status][2]}
			{STATUS[props.status][0]}
		</div>
	);
}

function ApproveNotificationContent({notification}: {notification: TNotification}): ReactElement {
	const chainName = SUPPORTED_NETWORKS.find(network => network.id === notification.chainId)?.name;

	return (
		<div className={'flex gap-8'}>
			<div className={'flex flex-col items-center gap-2'}>
				<div className={'relative'}>
					<ImageWithFallback
						alt={notification.tokenName}
						unoptimized
						src={`${process.env.SMOL_ASSETS_URL}/token/${notification.chainId}/${notification.tokenAddress}/logo-128.png`}
						altSrc={`${process.env.SMOL_ASSETS_URL}/token/${notification.chainId}/${notification.tokenAddress}/logo-128.png`}
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
			</div>
			<div className={'flex-1'}>
				<div className={'grid grid-cols-2 gap-x-8 text-xs text-neutral-800'}>
					<p>{'From:'}</p>
					<p className={'font-bold'}>{truncateHex(notification.fromAddress, 5)}</p>
					<p>{'Token:'}</p>
					<p className={'font-bold'}>{notification.tokenName}</p>
					<p>{'Amount:'}</p>
					<p className={'font-bold'}>{notification.amount}</p>
					<p>{'Spender:'}</p>
					<p className={'font-bold'}>{notification.spenderName}</p>
					<p>{'Chain:'}</p>
					<p className={'font-bold'}>{chainName}</p>
				</div>
			</div>
		</div>
	);
}

function DepositNotificationContent({notification}: {notification: TNotification}): ReactElement {
	const fromChainName = SUPPORTED_NETWORKS.find(network => network.id === notification.chainId)?.name;
	const toChainName = SUPPORTED_NETWORKS.find(network => network.id === notification.chainId)?.name;

	return (
		<div className={'flex gap-8'}>
			<div className={'flex flex-col items-center gap-2'}>
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

				<IconArrow className={'rotate-90'} />

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
			</div>
			<div>
				<div className={'grid grid-cols-2 grid-rows-7 gap-x-8 text-xs text-neutral-800'}>
					<p>{'From:'}</p>
					<p className={'font-bold'}>{truncateHex(notification.fromAddress, 5)}</p>
					<p>{'Amount:'}</p>
					<p className={'font-bold'}>{`${notification.fromAmount} ${notification.fromTokenName}`}</p>
					<p>{'To:'}</p>
					<p className={'font-bold'}>
						{notification.toTokenName}
						{' Vault'}
					</p>
					<p>{'From chain:'}</p>
					<p className={'font-bold'}>{fromChainName}</p>
					<p>{'To Chain:'}</p>
					<p className={'font-bold'}>{toChainName}</p>
				</div>
			</div>
		</div>
	);
}

export function Notification(notification: TNotification): ReactElement {
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

			default:
				return 'Transaction';
		}
	}, [notification.type]);

	return (
		<div className={'rounded-xl border border-neutral-200 p-4'}>
			<div className={'mb-4 flex items-center justify-between'}>
				<p className={'font-medium text-neutral-900'}>{notificationTitle}</p>
				<NotificationStatus status={notification.status} />
			</div>

			{notification.type === 'approve' ? (
				<ApproveNotificationContent notification={notification} />
			) : (
				<DepositNotificationContent notification={notification} />
			)}

			<div className={'mt-4 flex justify-between text-xs text-neutral-800'}>
				<div>
					<p>{notification.status === 'success' ? 'Finalized:' : 'Finalizes:'}</p>
					<p className={'font-bold'}>{formattedDate}</p>
				</div>
				{explorerLink ? (
					<Link
						href={explorerLink}
						target={'_blank'}>
						<button className={'font-bold hover:underline'}>{'View transaction'}</button>
					</Link>
				) : null}
			</div>
		</div>
	);
}
