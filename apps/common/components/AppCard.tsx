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
				target={props.app.appURI.startsWith('/') ? '_self' : '_blank'}
				className={
					'group relative hidden min-w-[208px] max-w-[208px] overflow-hidden rounded-lg border border-neutral-200 bg-neutral-0 p-6 hover:bg-neutral-200 md:block'
				}>
				<div className={'mb-4'}>
					<div
						className={
							'absolute right-2 top-2 hidden size-10 items-center justify-center rounded-lg bg-neutral-0 group-hover:flex'
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
							className={'size-[80px] rounded-full border object-contain'}
						/>
					) : (
						<div className={'size-[80px] rounded-full bg-fallback'} />
					)}
				</div>
				<div className={'mb-1 text-lg font-bold text-neutral-700'}>{props.app.name}</div>

				<p className={'whitespace-normal text-sm text-neutral-600'}>{props.app.description}</p>
			</Link>
			<Link
				href={props.app.appURI}
				target={props.app.appURI.startsWith('/') ? '_self' : '_blank'}
				className={'flex items-center md:hidden rounded-lg border border-neutral-200 p-1'}>
				<div>
					{props.app.logoURI ? (
						<div className={'size-16 rounded-[32px]'}>
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
					<div className={'mb-1 text-base font-bold text-neutral-700'}>{props.app.name}</div>
					<p className={'line-clamp-2 h-12 text-xs text-neutral-600 md:text-base'}>{props.app.description}</p>
				</div>
			</Link>
		</>
	);
}
