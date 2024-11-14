import {type ReactElement, useState} from 'react';
import Link from 'next/link';

const CARDS = [
	{title: 'BUG BOUNTY.', description: 'Bugs?! Ew! Report a bug and you might earn $$.'},
	{title: 'LEAVE FEEDBACK.', description: "Thoughts? Ideas? Improvements? Let's hear it!"},
	{title: 'WRITE DOCS.', description: 'Want to help write docs for Yearn, be our guest!'},
	{title: 'BUILD.', description: 'Yearn is open source, anyone can contribute to its future!'}
];

function ContributeCard(props: {title: string; description: string}): ReactElement {
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
			className={
				'flex h-[360px] flex-col justify-between rounded-lg border border-[#292929] px-8 pb-8 pt-10 text-white transition-all hover:text-black'
			}>
			<div>
				<div className={'mb-2 text-xl'}>{props.title}</div>
				<div className={'opacity-60'}>{props.description}</div>
			</div>
			<Link
				className={'leading-6 underline opacity-70 transition-opacity hover:opacity-100'}
				href={'/'}>
				{'Read more'}
			</Link>
		</div>
	);
}

export function Contribute(): ReactElement {
	return (
		<div className={'max-w-6xl pt-[160px]'}>
			<p className={'text-center text-5xl font-light text-white'}>{'CONTRIBUTE AND HELP BUILD THE YEARN DAO'}</p>
			<div className={'mt-10 grid grid-cols-4 gap-6'}>
				{CARDS.map(card => (
					<ContributeCard {...card} />
				))}
			</div>
		</div>
	);
}
