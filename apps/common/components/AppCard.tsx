import Image from 'next/image';
import Link from 'next/link';
import {IconShare} from '@common/icons/IconShare';

import type {ReactElement} from 'react';
import type {TApp} from '@common/types/category';

type TAppCardProps = {
	app: TApp;
};

export function AppCard(props: TAppCardProps): ReactElement {
	return (
		<>
			<Link
				href={props.app.appURI ?? ''}
				target={(props.app.appURI || '').startsWith('/') ? '' : '_blank'}
				className={
					'bg-grey-900 group relative hidden rounded-lg border border-gray-700/50 p-6 hover:bg-gray-600/40 md:block'
				}>
				<div className={'mb-10'}>
					<div
						className={
							'absolute right-2 top-2 hidden size-10 items-center justify-center rounded-lg bg-gray-900 group-hover:flex'
						}>
						<IconShare className={'size-[10px]'} />
					</div>
					{props.app.logoURI ? (
						<Image
							src={props.app.logoURI}
							alt={props.app.name}
							unoptimized
							width={240}
							height={240}
							className={'size-[120px] rounded-[32px] object-contain'}
						/>
					) : (
						<div className={'size-[120px] rounded-[32px] bg-fallback'} />
					)}
				</div>
				<div className={'mb-2 text-2xl font-bold text-white'}>{props.app.name}</div>

				<p className={'text-base text-gray-400'}>{props.app.description}</p>
			</Link>
			<Link
				href={props.app.appURI}
				className={'flex items-center md:hidden'}>
				<div className={''}>
					{props.app.logoURI ? (
						<div className={'size-16 rounded-2xl md:rounded-[32px]'}>
							<Image
								src={props.app.logoURI}
								alt={props.app.name}
								width={300}
								height={300}
								unoptimized
								className={'size-full rounded-2xl bg-center object-cover md:rounded-[32px]'}
							/>
						</div>
					) : (
						<div className={'size-16 rounded-2xl bg-fallback md:rounded-[32px]'} />
					)}
				</div>

				<div className={'ml-4'}>
					<div className={'mb-1 text-base font-bold text-gray-300'}>{props.app.name}</div>
					<p className={'text-base text-gray-400'}>{props.app.description}</p>
				</div>
			</Link>
		</>
	);
}
