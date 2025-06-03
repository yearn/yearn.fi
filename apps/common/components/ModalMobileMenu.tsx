'use client';
import React, {Fragment} from 'react';
import Link from 'next/link';
import {Dialog, Transition, TransitionChild} from '@headlessui/react';
import {IconClose} from '@common/icons/IconClose';
import {IconDiscord} from '@common/icons/IconDiscord';
import {IconParagraph} from '@common/icons/IconParagraph';
import {IconTwitter} from '@common/icons/IconTwitter';

import type {ReactElement, ReactNode} from 'react';
import type {Chain} from 'viem';
import type {TMenu} from '@yearn-finance/web-lib/components/Header';

const menu: TMenu[] = [
	{path: '/vaults', label: 'Vaults'},
	{
		path: 'https://gov.yearn.fi/',
		label: 'Governance',
		target: '_blank'
	},
	{path: 'https://blog.yearn.fi/', label: 'Blog', target: '_blank'},
	{path: 'https://docs.yearn.fi/', label: 'Docs', target: '_blank'},
	{path: 'https://discord.gg/yearn', label: 'Support', target: '_blank'}
];

export function FooterNav(): ReactElement {
	return (
		<div
			className={`flex w-full flex-col space-y-14 rounded-[24px] p-0 md:flex-row md:space-x-14 md:space-y-0 md:bg-[#222222]/50 md:p-[12px]`}>
			<div className={'flex w-full flex-col space-y-4 rounded-[12px] p-[24px] md:bg-neutral-50/30'}>
				{menu.map(link => (
					<Link
						className={'flex items-center gap-2 text-neutral-900 transition-colors hover:text-primary'}
						key={link.path}
						target={link.target}
						href={link.path}>
						<span className={'text-[20px]'}>{link.label}</span>
						<span className={'size-6'}>{'↗'}</span>
					</Link>
				))}
			</div>
			<div className={'flex w-full items-center justify-center gap-6'}>
				<Link
					href={'https://paragraph.xyz/@yearn'}
					target={'_blank'}
					className={
						'flex items-center justify-center rounded-full bg-white/10 p-3 transition-colors hover:bg-white/20'
					}>
					<IconParagraph className={'size-7 text-neutral-900'} />
				</Link>
				<Link
					href={'https://discord.com/invite/yearn'}
					target={'_blank'}
					className={
						'flex items-center justify-center rounded-full bg-white/10 p-3 transition-colors hover:bg-white/20'
					}>
					<IconDiscord className={'size-7 text-neutral-900'} />
				</Link>
				<Link
					href={'https://x.com/yearnfi'}
					target={'_blank'}
					className={
						'flex items-center justify-center rounded-full bg-white/10 p-3 transition-colors hover:bg-white/20'
					}>
					<IconTwitter className={'size-7 text-neutral-900'} />
				</Link>
			</div>
		</div>
	);
}

type TModalMobileMenu = {
	isOpen: boolean;
	shouldUseWallets: boolean;
	shouldUseNetworks: boolean;
	onClose: () => void;
	children: ReactNode;
	supportedNetworks: Chain[];
};

export type TModal = {
	isOpen: boolean;
	onClose: () => void;
	children: ReactNode;
} & React.ComponentPropsWithoutRef<'div'>;

export function ModalMobileMenu(props: TModalMobileMenu): ReactElement {
	const {isOpen, onClose} = props;

	return (
		<Transition
			show={isOpen}
			as={Fragment}>
			<Dialog
				as={'div'}
				className={'fixed inset-0 overflow-y-auto md:hidden'}
				style={{zIndex: 88}}
				onClose={onClose}>
				<div className={`relative flex min-h-screen items-end justify-end px-0 pb-0 pt-4 text-center`}>
					<TransitionChild
						as={Fragment}
						enter={'ease-out duration-300'}
						enterFrom={'opacity-0'}
						enterTo={'opacity-100'}
						leave={'ease-in duration-200'}
						leaveFrom={'opacity-100'}
						leaveTo={'opacity-0'}>
						<div className={`yearn--modal-overlay`} />
					</TransitionChild>

					<span
						className={'hidden'}
						aria-hidden={'true'}>
						&#8203;
					</span>
					<TransitionChild
						as={Fragment}
						enter={'ease-out duration-200'}
						enterFrom={'opacity-0 translate-y-full'}
						enterTo={'opacity-100 translate-y-0'}
						leave={'ease-in duration-200'}
						leaveFrom={'opacity-100 translate-y-0'}
						leaveTo={'opacity-0 translate-y-full'}>
						<div className={`yearn--modal fixed bottom-0 mb-0 h-full max-w-full`}>
							<div className={'flex items-center justify-between border-b border-[#292929] p-4'}>
								<button onClick={onClose}>
									<IconClose />
								</button>
							</div>
							<div
								style={{
									background:
										'linear-gradient(180deg, rgba(12, 12, 12, 0.8) 0%, rgba(26, 26, 26, 0.8) 100%)'
								}}
								className={'flex h-[calc(100vh-88px)] w-full flex-col justify-end px-8 pb-20'}>
								<FooterNav />
							</div>
						</div>
					</TransitionChild>
				</div>
			</Dialog>
		</Transition>
	);
}
