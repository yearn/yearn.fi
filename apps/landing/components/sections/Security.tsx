import {FC} from 'react';
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
		href: '#',
		imageSrc: '/landing/yearn-apps-logo.png',
		gradientA: 'radial-gradient(circle_at_center,#5141CAaa_0%,transparent_100%)',
		gradientB: 'from-[#333761]/60 to-[#1A1C30]/60'
	},
	[SecurityCardType.BugBounties]: {
		title: 'Bug Bounties',
		description: 'Security is our top priority. Report vulnerabilities and get rewarded.',
		href: '#',
		imageSrc: '/landing/integrations.png',
		gradientA: 'radial-gradient(circle_at_center,#0066FFaa_0%,transparent_100%)',
		gradientB: 'from-[#1A3E68]/60 to-[#0A1E38]/60'
	}
};

const SecurityCard: FC<{
	type: SecurityCardType;
}> = ({type}) => {
	const {title, description, href, imageSrc, gradientA, gradientB} = Cards[type];
	return (
		<div className="rounded-2xl overflow-hidden border-[1px] border-[#ffffff]/5 ">
			<div className={`p-6 flex justify-center bg-[${gradientA}]`}>
				<Image
					src={imageSrc}
					width={180}
					height={180}
					alt={title}
					className="w-auto h-auto"
				/>
			</div>
			<div className={`bg-gradient-to-t ${gradientB} p-8`}>
				<h3 className="text-3xl mb-4 ">{title}</h3>
				<p className="text-gray-300 mb-4 text-white/80">{description}</p>
				<Link
					href={href}
					className="text-white flex items-center">
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
