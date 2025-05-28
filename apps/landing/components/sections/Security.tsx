import {type FC, useRef, useState} from 'react';
import Link from 'next/link';
import {SectionHeader} from 'apps/landing/components/common/SectionHeader';

enum SecurityCardType {
	Audits = 'audits',
	BugBounties = 'bug-bounties'
}

const Cards: {
	[key in SecurityCardType]: {
		title: string;
		description: string;
		href: string;
		imageSrc: string;
		bgColor: string;
	};
} = {
	[SecurityCardType.Audits]: {
		title: 'Audits',
		description: 'Yearn Contracts are audited thoroughly by a variety of auditors.',
		href: 'https://docs.yearn.fi/developers/security/',
		imageSrc: '/landing/yearn-apps-logo.png',
		bgColor: 'bg-[#6B2FEC]'
	},
	[SecurityCardType.BugBounties]: {
		title: 'Bug Bounties',
		description: 'Security is our top priority. Report vulnerabilities and get rewarded.',
		href: 'https://immunefi.com/bug-bounty/yearnfinance',
		imageSrc: '/landing/integrations.png',
		bgColor: 'bg-[#0B5DD0]'
	}
};

const SecurityCard: FC<{
	type: SecurityCardType;
}> = ({type}) => {
	const {title, description, href, bgColor} = Cards[type];
	const cardRef = useRef<HTMLDivElement>(null);
	const [mousePosition, set_mousePosition] = useState({x: 0, y: 0});
	const [isHovered, set_isHovered] = useState(false);

	const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>): void => {
		if (!cardRef.current) return;

		const rect = cardRef.current.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		set_mousePosition({x, y});
	};

	const handleMouseEnter = (): void => set_isHovered(true);

	const handleMouseLeave = (): void => {
		set_isHovered(false);
		set_mousePosition({x: 0, y: 0});
	};

	return (
		<Link
			href={href}
			className={'flex'}>
			<div
				ref={cardRef}
				className={`${bgColor} group relative cursor-pointer overflow-hidden rounded-2xl transition-all duration-300`}
				onMouseMove={handleMouseMove}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}>
				{isHovered && (
					<div
						className={'pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-300'}
						style={{
							background: `radial-gradient(200px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(255,255,255,0.25) 0%, transparent 100%)`
						}}
					/>
				)}
				<div className={`group-hover:bg/80 relative z-10  p-8 transition-all duration-300`}>
					<h3 className={'mb-4 text-3xl transition-colors duration-300 group-hover:text-white'}>{title}</h3>
					<p
						className={
							'mb-4 text-[18px] text-white/70 transition-colors duration-300 group-hover:text-white/90 '
						}>
						{description}
					</p>
					<div
						className={
							'group-hover:text-blue-200 flex items-center text-white transition-colors duration-300'
						}>
						{'Learn More →'}
					</div>
				</div>
			</div>
		</Link>
	);
};

export const Security: FC = () => (
	<section className={'flex w-full justify-center bg-white/5'}>
		<div className={'flex w-[1180px] flex-col items-center justify-between py-8 md:flex-row md:py-32'}>
			<div className={'w-full max-w-7xl px-4'}>
				<SectionHeader
					align={'center'}
					tagline={'Audited, secure'}
					title={'Security First'}
					description={'Yearn prioritizes security to protect your assets.'}
				/>
				<div className={'grid gap-6 pt-16 md:grid-cols-2'}>
					<SecurityCard type={SecurityCardType.Audits} />
					<SecurityCard type={SecurityCardType.BugBounties} />
				</div>
			</div>
		</div>
	</section>
);
