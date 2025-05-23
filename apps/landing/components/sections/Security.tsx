import {FC, useRef, useState} from 'react';
import Image from 'next/image';
import Link from 'next/link';

import {SectionHeader} from 'apps/landing/components/common/SectionHeader';

enum SecurityCardType {
	Audits = 'audits',
	BugBounties = 'bug-bounties'
}

const Cards: Record<
	SecurityCardType,
	{
		title: string;
		description: string;
		href: string;
		imageSrc: string;
		gradientA: string;
		gradientB: string;
	}
> = {
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
	const [mousePosition, setMousePosition] = useState({x: 0, y: 0});
	const [isHovered, setIsHovered] = useState(false);

	const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
		if (!cardRef.current) return;

		const rect = cardRef.current.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		setMousePosition({x, y});
	};

	const handleMouseEnter = () => setIsHovered(true);

	const handleMouseLeave = () => {
		setIsHovered(false);
		setMousePosition({x: 0, y: 0});
	};

	return (
		<div
			ref={cardRef}
			className="rounded-2xl overflow-hidden border-[1px] border-[#ffffff]/5 transition-all duration-300  group relative"
			onMouseMove={handleMouseMove}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}>
			{isHovered && (
				<div
					className="absolute inset-0 pointer-events-none opacity-60 transition-opacity duration-300"
					style={{
						background: `radial-gradient(300px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(255,255,255,0.1) 0%, transparent 50%)`
					}}
				/>
			)}

			<div
				className={`p-6 justify-center bg-[${gradientA}] hidden md:flex transition-all duration-300 group-hover:bg-opacity-80 relative z-10`}>
				<Image
					src={imageSrc}
					width={180}
					height={180}
					alt={title}
					className="w-auto h-auto transition-transform duration-300 group-hover:scale-105"
				/>
			</div>
			<div
				className={`bg-gradient-to-t ${gradientB} p-8 transition-all duration-300 group-hover:bg-opacity-80 relative z-10`}>
				<h3 className="text-3xl mb-4 transition-colors duration-300 group-hover:text-white">{title}</h3>
				<p className="text-gray-300 mb-4 text-white/80 transition-colors duration-300 group-hover:text-white/90">
					{description}
				</p>
				<Link
					href={href}
					className="text-white flex items-center transition-colors duration-300 group-hover:text-blue-200">
					Learn More →
				</Link>
			</div>
		</div>
	);
};

export const Security: FC = () => (
	<section className="flex justify-center w-full bg-white/5">
		<div className="w-[1180px] flex flex-col md:flex-row items-center justify-between py-20">
			<div className="max-w-7xl w-full px-4">
				<SectionHeader
					align="center"
					tagline="Audited, secure"
					title="Security First"
				/>
				<div className="grid md:grid-cols-2 gap-6 pt-16">
					<SecurityCard type={SecurityCardType.Audits} />
					<SecurityCard type={SecurityCardType.BugBounties} />
				</div>
			</div>
		</div>
	</section>
);
