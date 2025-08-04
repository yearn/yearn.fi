import Link from 'next/link';

import type {FC, ReactElement} from 'react';

export const SectionHeader: FC<{
	tagline?: string;
	title?: string;
	description?: ReactElement | string;
	cta?: {label: string; href: string};
	align?: 'left' | 'right' | 'center';
	isH1?: boolean;
}> = ({tagline, title, description, cta, align = 'left', isH1 = false}) => {
	return (
		<div
			className={`flex flex-col ${align === 'right' ? 'items-center md:items-end' : align === 'center' ? 'items-center' : 'items-center md:items-start'}  gap-y-4 px-2 md:px-0`}>
			<div
				className={`flex flex-col ${align === 'right' ? 'items-center md:items-end' : align === 'center' ? 'items-center' : 'items-center md:items-start'}`}>
				{!!tagline && <p className={'mb-2 hidden font-medium text-lightBlue-500 md:block'}>{tagline}</p>}
				{!!title &&
					(isH1 ? (
						<h1 className={'text-center text-4xl font-medium leading-tight md:text-left md:text-6xl'}>
							{title}
						</h1>
					) : (
						<h2 className={'text-center text-3xl font-medium md:text-left md:text-5xl'}>{title}</h2>
					))}
			</div>
			{!!description && (
				<p
					className={`text-steelGray-500 ${isH1 ? 'text-[18px] md:text-[24px]' : 'text-[18px]'} max-w-[55ch] ${align === 'center' ? 'text-center' : 'text-center md:text-left'} max-w-[28ch] md:max-w-full`}>
					{description}
					{!!cta && (
						<span className={'hidden md:inline'}>
							<Link href={cta.href} className={'ml-2 text-white'}>
								{cta.label} {'→'}
							</Link>
						</span>
					)}
				</p>
			)}
			{!!cta && (
				<span className={'block md:hidden'}>
					<Link href={cta.href} className={'ml-2 text-neutral-900'}>
						{cta.label} {'→'}
					</Link>
				</span>
			)}
		</div>
	);
};
