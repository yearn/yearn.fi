import {type ReactElement, useState} from 'react';
import Image from 'next/image';

import {IconArrow} from '../icons/IconArrow';

export function EarnCard(props: {title: string; info: string; logoSrc: string; hoverLogoSrc: string}): ReactElement {
	const [isHovering, set_isHovering] = useState(false);

	return (
		<div
			onMouseEnter={() => set_isHovering(true)}
			onMouseLeave={() => set_isHovering(false)}
			style={{
				background: isHovering
					? '#0657F9'
					: 'linear-gradient(180deg, rgba(12, 12, 12, 0.8) 0%, rgba(26, 26, 26, 0.8) 100%)'
			}}
			className={'group relative flex h-full overflow-hidden p-6'}>
			<div className={'mt-auto flex items-end'}>
				<div>
					<p className={'text-[24px] group-hover:text-grey-900'}>{props.title}</p>
					<p className={'text-grey-400 group-hover:text-grey-900'}>{props.info}</p>
				</div>
				<div>
					<IconArrow className={'size-6 group-hover:text-grey-900'} />
				</div>
			</div>
			<Image
				className={'absolute -top-12 right-10'}
				src={props.hoverLogoSrc}
				width={200}
				height={200}
				alt={'app-logo'}
			/>
			<Image
				className={'absolute -top-12 right-10 group-hover:opacity-0'}
				src={props.logoSrc}
				width={200}
				height={200}
				alt={'app-logo'}
			/>
		</div>
	);
}
