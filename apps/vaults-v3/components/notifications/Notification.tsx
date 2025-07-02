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
	success: ['Success', 'text-green bg-[#C6F4D6]', <IconCheck className={'size-4'} />],
	pending: ['Pending', 'text-grey-800 bg-grey-100', <IconLoader className={'size-4 animate-spin'} />],
	error: ['Error', 'text-red bg-[#FBDADA]', <IconCross className={'size-4'} />]
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

export function Notification({
	fromAddress,
	toAddress,
	from,
	fromAmount,
	fromChainId,
	toChainId,
	fromTokenName,
	toTokenName,
	type,
	status,
	txHash,
	timeFinished
}: TNotification): ReactElement {
	const fromChainName = SUPPORTED_NETWORKS.find(network => network.id === fromChainId)?.name;
	const toChainName = SUPPORTED_NETWORKS.find(network => network.id === toChainId)?.name;

	const date = new Date((timeFinished || 0) * 1000);
	const formattedDate = date.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric'
	});

	const explorerLink = useMemo(() => {
		if (!txHash) {
			return null;
		}

		const chain = SUPPORTED_NETWORKS.find(network => network.id === fromChainId);
		const explorerBaseURI = chain?.blockExplorers?.default?.url || 'https://etherscan.io';
		return `${explorerBaseURI}/tx/${txHash}`;
	}, [fromChainId, txHash]);

	const notificationTitle = useMemo(() => {
		if (type === 'portals') {
			return 'Zap';
		}

		return 'Deposit';
	}, [type]);

	return (
		<div className={'border-grey-200 rounded-xl border p-4'}>
			<div className={'mb-4 flex items-center justify-between'}>
				<p className={'text-grey-900 font-medium'}>{notificationTitle}</p>
				<NotificationStatus status={status} />
			</div>

			<div className={'flex gap-8'}>
				<div className={'flex flex-col items-center gap-2'}>
					<div className={'relative'}>
						<ImageWithFallback
							alt={fromTokenName}
							unoptimized
							src={`${process.env.SMOL_ASSETS_URL}/token/${fromChainId}/${fromAddress}/logo-128.png`}
							altSrc={`${process.env.SMOL_ASSETS_URL}/token/${fromChainId}/${fromAddress}/logo-128.png`}
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
								src={`${process.env.SMOL_ASSETS_URL}/chain/${fromChainId}/logo.svg`}
							/>
						</div>
					</div>

					<IconArrow className={'rotate-90'} />

					<div className={'relative'}>
						<ImageWithFallback
							alt={toTokenName}
							unoptimized
							src={`${process.env.SMOL_ASSETS_URL}/token/${toChainId}/${toAddress}/logo-128.png`}
							altSrc={`${process.env.SMOL_ASSETS_URL}/token/${toChainId}/${toAddress}/logo-128.png`}
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
								src={`${process.env.SMOL_ASSETS_URL}/chain/${toChainId}/logo.svg`}
							/>
						</div>
					</div>
				</div>
				<div>
					<div className={'text-grey-800 grid grid-cols-2 grid-rows-7 gap-x-8 text-xs'}>
						<p>{'From:'}</p>
						<p className={'font-bold'}>{truncateHex(from, 5)}</p>
						<p>{'Amount:'}</p>
						<p className={'font-bold'}>{`${fromAmount} ${fromTokenName}`}</p>
						<p>{'To:'}</p>
						<p className={'font-bold'}>
							{toTokenName}
							{' Vault'}
						</p>
						<p>{'From chain:'}</p>
						<p className={'font-bold'}>{fromChainName}</p>
						<p>{'To Chain:'}</p>
						<p className={'font-bold'}>{toChainName}</p>
						<p>{status === 'success' ? 'Finalized:' : 'Finalizes:'}</p>
						<p className={'font-bold'}>{formattedDate}</p>
						{explorerLink ? (
							<>
								<p>{'Transaction:'}</p>
								<Link
									href={explorerLink}
									target={'_blank'}>
									<button className={'font-bold hover:underline'}>
										{txHash?.slice(0, 6)}
										{'...'}
										{txHash?.slice(-5)}
									</button>
								</Link>
							</>
						) : null}
					</div>
				</div>
			</div>
		</div>
	);
}
