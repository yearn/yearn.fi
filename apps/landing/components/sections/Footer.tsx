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

//todo: update img
export function Footer(): ReactElement {
	return (
		<div className={'flex w-full justify-center '}>
			<div
				style={{
					backgroundImage: "url('/landing/footer.png')",
					backgroundRepeat: 'no-repeat',
					backgroundSize: 'auto 100%',
					backgroundPosition: 'center'
				}}
				className={
					'items-between relative m-6 flex h-[640px] w-full max-w-[2352px] flex-col justify-between self-center rounded-lg border border-[#292929] bg-[#0C0E14] px-14 py-12'
				}>
				<div className={'flex justify-between'}>
					<div>
						<p className={'font-aeonikFono text-4xl'}>{'TAKE THE BLUE PILL.'}</p>
					</div>
					<div>
						<LogoYearn
							className={'size-14'}
							front={'text-white'}
							back={'text-primary'}
						/>
					</div>
				</div>
				<div className={'flex items-end justify-between'}>
					<div className={'flex flex-col gap-y-4'}>
						{LINKS.map(link => (
							<Link
								className={'flex items-center gap-x-4 text-3xl transition-colors hover:text-primary'}
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
			</div>
		</div>
	);
}
