import Link from 'next/link';
import {LogoYearn} from '@common/icons/LogoYearn';

import {IconArrow} from '../icons/IconArrow';
import {IconDiscord} from '../icons/IconDiscord';
import {IconParagraph} from '../icons/IconParagraph';
import {IconTwitter} from '../icons/IconTwitter';

import type {ReactElement} from 'react';

const LINKS = [
	{
		label: 'GOVERNANCE',
		href: '/governance'
	},
	{
		label: 'BLOG',
		href: '/blog'
	},
	{
		label: 'DOCS',
		href: '/docs'
	},
	{
		label: 'SUPPORT',
		href: '/support'
	}
];

function FooterContent(): ReactElement {
	return (
		<>
			<div className={'flex flex-col-reverse justify-between gap-y-6 md:flex-row'}>
				<div>
					<p className={'font-aeonikFono text-5xl'}>{'TAKE THE BLUE PILL.'}</p>
				</div>
				<div>
					<LogoYearn
						className={'size-14'}
						front={'text-white'}
						back={'text-primary'}
					/>
				</div>
			</div>
			<div className={'flex flex-col justify-between gap-y-20 md:flex-row md:items-end'}>
				<div className={'flex flex-col gap-y-4'}>
					{LINKS.map(link => (
						<Link
							className={
								'flex items-center justify-between gap-x-4 text-3xl transition-colors hover:text-primary md:justify-start'
							}
							key={link.label}
							href={link.href}>
							<span>{link.label}</span>
							<IconArrow className={'size-4'} />
						</Link>
					))}
				</div>
				<div className={'items-cente flex gap-6'}>
					<Link
						href={'/'}
						target={'_blank'}
						className={'flex items-center gap-x-4'}>
						<IconParagraph className={'size-8 transition-colors hover:text-primary'} />
					</Link>
					<Link
						href={'/'}
						target={'_blank'}
						className={'flex items-center gap-x-4'}>
						<IconDiscord className={'size-8 transition-colors hover:text-primary'} />
					</Link>
					<Link
						href={'/'}
						target={'_blank'}
						className={'flex items-center gap-x-4'}>
						<IconTwitter className={'size-8 transition-colors hover:text-primary'} />
					</Link>
				</div>
			</div>
		</>
	);
}

export function Footer(): ReactElement {
	return (
		<div className={'flex w-full justify-center '}>
			<div
				style={{
					backgroundImage: "url('/landing/footer-background.png')",
					backgroundRepeat: 'no-repeat',
					backgroundSize: 'auto 100%',
					backgroundPosition: 'center'
				}}
				className={
					'items-between relative m-6 hidden h-[640px] w-full max-w-[2352px] flex-col justify-between self-center rounded-lg border border-[#292929] bg-[#0C0E14] px-14 py-12 md:flex'
				}>
				<FooterContent />
			</div>
			<div
				style={{
					backgroundImage: "url('/landing/footer-background-mobile.png')",
					backgroundRepeat: 'no-repeat',
					backgroundSize: '100% auto',
					backgroundPosition: 'center'
				}}
				className={
					'items-between relative flex h-[640px] w-full max-w-[2352px] flex-col justify-between self-center rounded-lg bg-[#0C0E14] px-8 pb-10 pt-12 md:hidden'
				}>
				<FooterContent />
			</div>
		</div>
	);
}
