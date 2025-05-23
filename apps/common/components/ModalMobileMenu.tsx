'use client';
import React, {Fragment} from 'react';
import Link from 'next/link';
import {Dialog, Transition, TransitionChild} from '@headlessui/react';
import {IconArrow} from '@common/icons/IconArrow';
import {IconClose} from '@common/icons/IconClose';
import {IconDiscord} from '@common/icons/IconDiscord';
import {IconParagraph} from '@common/icons/IconParagraph';
import {IconTwitter} from '@common/icons/IconTwitter';
import {LogoYearn} from '@common/icons/LogoYearn';

import type {ReactElement, ReactNode} from 'react';
import type {Chain} from 'viem';
import type {TMenu} from '@yearn-finance/web-lib/components/Header';

const menu: TMenu[] = [
	{path: '/apps', label: 'Apps'},
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
			className={`flex flex-col md:flex-row space-y-14 md:space-y-0 md:space-x-14 w-full md:bg-[#222222]/50 p-0 md:p-[12px] rounded-[24px]`}>
			<div className={'flex flex-col space-y-8 w-full md:bg-black/30 p-[24px] rounded-[12px]'}>
				{menu.map(link => (
					<Link
						className={
							'flex items-center justify-between text-2xl text-white transition-colors hover:text-primary'
						}
						key={link.path}
						target={link.target}
						href={link.path}>
						<span>{link.label}</span>
						<IconArrow className={'size-6'} />
					</Link>
				))}
			</div>
			<div className={'flex justify-center items-center gap-6 w-full'}>
				<Link
					href={'https://paragraph.xyz/@yearn'}
					target={'_blank'}
					className={
						'rounded-full bg-white/10 p-3 flex items-center justify-center hover:bg-white/20 transition-colors'
					}>
					<IconParagraph className={'size-7 text-white'} />
				</Link>
				<Link
					href={'https://discord.com/invite/yearn'}
					target={'_blank'}
					className={
						'rounded-full bg-white/10 p-3 flex items-center justify-center hover:bg-white/20 transition-colors'
					}>
					<IconDiscord className={'size-7 text-white'} />
				</Link>
				<Link
					href={'https://x.com/yearnfi'}
					target={'_blank'}
					className={
						'rounded-full bg-white/10 p-3 flex items-center justify-center hover:bg-white/20 transition-colors'
					}>
					<IconTwitter className={'size-7 text-white'} />
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
								<Link href={'/'}>
									<LogoYearn
										className={'size-6'}
										front={'text-black'}
										back={'text-white'}
									/>
								</Link>
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
