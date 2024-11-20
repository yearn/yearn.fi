import {type ReactElement, useState} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {IconArrow} from '@common/icons/IconArrow';

export function EarnCard(props: {
	title: string;
	info: string;
	logoSrc: string;
	hoverLogoSrc: string;
	href: string;
}): ReactElement {
	const [isHovering, set_isHovering] = useState(false);

	return (
		<Link
			href={props.href}
			onMouseEnter={() => set_isHovering(true)}
			onMouseLeave={() => set_isHovering(false)}
			style={{
				background: isHovering
					? '#0657F9'
					: 'linear-gradient(180deg, rgba(12, 12, 12, 0.8) 0%, rgba(26, 26, 26, 0.8) 100%)'
			}}
			className={'group relative z-30 flex h-full overflow-hidden rounded-lg border border-[#292929] p-6'}>
			<div className={'flex md:mt-auto md:items-end'}>
				<div>
					<p className={'text-[24px] text-white md:group-hover:text-gray-900'}>{props.title}</p>
					<p className={'text-gray-400 md:group-hover:text-gray-900'}>{props.info}</p>
				</div>
				<div>
					<IconArrow className={'size-6 group-hover:text-gray-900'} />
				</div>
			</div>
			<Image
				className={'absolute -bottom-20 left-0 -z-10 hidden md:-top-12 md:left-auto md:right-10 md:block'}
				src={props.hoverLogoSrc}
				width={200}
				height={200}
				alt={'app-logo'}
			/>
			<Image
				className={'absolute -bottom-20 left-0 -z-10 group-hover:opacity-0 md:-top-12 md:left-auto md:right-10'}
				src={props.logoSrc}
				width={200}
				height={200}
				alt={'app-logo'}
			/>
		</Link>
	);
}
