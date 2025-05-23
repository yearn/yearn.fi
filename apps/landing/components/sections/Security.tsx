import {useRef, useState} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {SectionHeader} from 'apps/landing/components/common/SectionHeader';

import type {FC} from 'react';

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
		gradientA: string;
		gradientB: string;
	};
} = {
	[SecurityCardType.Audits]: {
		title: 'Audits',
		description: 'Yearn Contracts are audited thoroughly by a variety of auditors.',
		href: 'https://docs.yearn.fi/developers/security/',
		imageSrc: '/landing/yearn-apps-logo.png',
		gradientA: 'radial-gradient(circle_at_center,#5141CAaa_0%,transparent_100%)',
		gradientB: 'from-[#333761]/60 to-[#1A1C30]/60'
	},
	[SecurityCardType.BugBounties]: {
		title: 'Bug Bounties',
		description: 'Security is our top priority. Report vulnerabilities and get rewarded.',
		href: 'https://immunefi.com/bug-bounty/yearnfinance',
		imageSrc: '/landing/integrations.png',
		gradientA: 'radial-gradient(circle_at_center,#0066FFaa_0%,transparent_100%)',
		gradientB: 'from-[#1A3E68]/60 to-[#0A1E38]/60'
	}
};

const SecurityCard: FC<{
	type: SecurityCardType;
}> = ({type}) => {
	const {title, description, href, imageSrc, gradientA, gradientB} = Cards[type];
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
		<div
			ref={cardRef}
			className={
				'group relative overflow-hidden rounded-2xl border border-[#ffffff]/5  transition-all duration-300'
			}
			onMouseMove={handleMouseMove}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}>
			{isHovered && (
				<div
					className={'pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-300'}
					style={{
						background: `radial-gradient(300px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(255,255,255,0.1) 0%, transparent 50%)`
					}}
				/>
			)}

			<div
				className={`bg-[ justify-center p-6${gradientA}] group-hover:bg/80 relative z-10 hidden transition-all duration-300 md:flex`}>
				<Image
					src={imageSrc}
					width={180}
					height={180}
					alt={title}
					className={'size-auto transition-transform duration-300 group-hover:scale-105'}
				/>
			</div>
			<div
				className={`bg-gradient-to-t ${gradientB} group-hover:bg/80 relative z-10 p-8 transition-all duration-300`}>
				<h3 className={'mb-4 text-3xl transition-colors duration-300 group-hover:text-white'}>{title}</h3>
				<p className={'mb-4  text-white/80 transition-colors duration-300 group-hover:text-white/90'}>
					{description}
				</p>
				<Link
					href={href}
					className={'group-hover:text-blue-200 flex items-center text-white transition-colors duration-300'}>
					{'Learn More →'}
				</Link>
			</div>
		</div>
	);
};

export const Security: FC = () => (
	<section className={'flex w-full justify-center bg-white/5'}>
		<div className={'flex w-[1180px] flex-col items-center justify-between py-20 md:flex-row'}>
			<div className={'w-full max-w-7xl px-4'}>
				<SectionHeader
					align={'center'}
					tagline={'Audited, secure'}
					title={'Security First'}
				/>
				<div className={'grid gap-6 pt-16 md:grid-cols-2'}>
					<SecurityCard type={SecurityCardType.Audits} />
					<SecurityCard type={SecurityCardType.BugBounties} />
				</div>
			</div>
		</div>
	</section>
);
