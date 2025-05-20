import {type ReactElement, useState} from 'react';
import Link from 'next/link';
import {IconArrow} from '@common/icons/IconArrow';

const CARDS = [
	{
		title: 'BUG BOUNTY.',
		description: 'Bugs?! Ew! Report a bug and you might earn $$.',
		href: 'https://immunefi.com/bug-bounty/yearnfinance/information/',
		target: '_blank'
	},
	{
		title: 'LEAVE FEEDBACK.',
		description: "Thoughts? Ideas? Improvements? Let's hear it!",
		href: 'https://gov.yearn.fi/c/general-chat/feedback/2',
		target: '_blank'
	},
	{
		title: 'WRITE DOCS.',
		description: 'Want to help write docs for Yearn, be our guest!',
		href: 'https://docs.yearn.fi/',
		target: '_blank'
	},
	{
		title: 'BUILD.',
		description: 'Yearn is open source, anyone can contribute to its future!',
		href: 'https://github.com/yearn',
		target: '_blank'
	}
];

function ContributeCard(props: {title: string; description: string; href: string; target: string}): ReactElement {
	const [isHovering, set_isHovering] = useState(false);
	return (
		<Link
			href={props.href}
			target={props.target}
			onMouseEnter={() => set_isHovering(true)}
			onMouseLeave={() => set_isHovering(false)}
			style={{
				background: isHovering
					? '#0657F9'
					: 'linear-gradient(180deg, rgba(12, 12, 12, 0.8) 0%, rgba(26, 26, 26, 0.8) 100%)'
			}}
			className={
				'flex  flex-col justify-between rounded-lg border border-[#292929] px-8 pb-8 pt-10 text-white transition-all hover:text-white md:h-[260px] md:hover:text-black'
			}>
			<div>
				<div className={'text-l mb-2'}>{props.title}</div>
				<div className={'opacity-60'}>{props.description}</div>
			</div>
			<div className={'flex justify-between gap-2'}>
				<p className={'leading-6 underline opacity-70 transition-opacity hover:opacity-100'}>{'Read more'}</p>
				{isHovering ? <IconArrow className={'text-black'} /> : null}
			</div>
		</Link>
	);
}

export function Contribute(): ReactElement {
	return (
		<div className={'max-w-6xl px-6'}>
			<p className={'text-left text-2xl font-medium text-white md:text-center md:text-4xl'}>
				{'Contribute and help build the Yearn DAO'}
			</p>
			<div
				className={
					'mt-10 grid grid-flow-col grid-cols-1 grid-rows-4 gap-6 sm:grid-cols-2 sm:grid-rows-2 md:grid-flow-row md:grid-cols-4 md:grid-rows-1'
				}>
				{CARDS.map(card => (
					<ContributeCard
						key={card.title}
						{...card}
					/>
				))}
			</div>
		</div>
	);
}
