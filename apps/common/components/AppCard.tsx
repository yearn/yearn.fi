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
					'group relative hidden min-w-[208px] max-w-[208px] overflow-hidden rounded-lg border border-gray-700/50 bg-gray-900 p-6 hover:bg-gray-600/40 md:block'
				}>
				<div className={'mb-4'}>
					<div
						className={
							'absolute right-2 top-2 hidden size-10 items-center justify-center rounded-lg bg-gray-900 group-hover:flex'
						}>
						<IconShare className={'size-[10px]'} />
					</div>
					<div className={'flex items-center gap-x-2'}>
						{props.app.logoURI ? (
							<Image
								src={props.app.logoURI}
								alt={props.app.name}
								unoptimized
								width={32}
								height={32}
								className={'size-[32px] rounded-full border border-[#292929]/80 object-contain'}
							/>
						) : (
							<div className={'size-[32px] rounded-full bg-fallback'} />
						)}
						<div className={'text-lg font-bold text-neutral-900'}>{props.app.name}</div>
					</div>
				</div>

				<p className={'whitespace-normal text-sm text-gray-400'}>{props.app.description}</p>
			</Link>
			<Link
				href={props.app.appURI}
				target={props.app.appURI.startsWith('/') ? '_self' : '_blank'}
				className={'flex items-center md:hidden'}>
				<div>
					{props.app.logoURI ? (
						<div className={'size-16 rounded-[32px]'}>
							<Image
								src={props.app.logoURI}
								alt={props.app.name}
								width={64}
								height={64}
								unoptimized
								className={'size-[48px] rounded-2xl bg-center object-cover md:rounded-[24px]'}
							/>
						</div>
					) : (
						<div className={'size-16 rounded-2xl bg-fallback md:rounded-[32px]'} />
					)}
				</div>

				<div className={'ml-4'}>
					<div className={'mb-1 text-base font-bold text-gray-300'}>{props.app.name}</div>
					<p className={'line-clamp-2 h-12 text-xs text-gray-400 md:text-base'}>{props.app.description}</p>
				</div>
			</Link>
		</>
	);
}
