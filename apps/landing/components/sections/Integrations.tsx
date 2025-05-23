import {FC} from 'react';
import Link from 'next/link';
import Image from 'next/image';

import {SectionHeader} from 'apps/landing/components/common/SectionHeader';

interface Integration {
	name: string;
	imageSrc: string;
	description: string;
	href: string;
}

const integrations: Integration[] = [
	{
		name: 'Cove',
		imageSrc: '/landing/integrations-cove.png',
		description: 'Earn the best yields on-chain without the hassle of managing a portfolio.',
		href: 'https://cove.finance'
	},
	{
		name: '1UP',
		imageSrc: '/landing/integrations-1up.png',
		description: '1UP is a public good liquid locker for YFI.',
		href: 'https://1up.tokyo/'
	},
	{
		name: 'Stakedao',
		imageSrc: '/landing/integrations-stakedao.png',
		description: 'A non-custodial liquid staking platform focused on governance tokens.',
		href: 'https://stakedao.org'
	},
	{
		name: 'Sturdy',
		imageSrc: '/landing/integrations-sturdy.png',
		description: 'Isolated lending with shared liquidity.',
		href: 'https://sturdy.finance'
	},
	{
		name: 'PWN',
		imageSrc: '/landing/integrations-pwn.png',
		description: 'PWN is a hub for peer-to-peer (P2P) loans backed by digital assets',
		href: 'https://pwn.finance'
	},
	{
		name: 'Superform',
		imageSrc: '/landing/integrations-super.png',
		description: 'Superform grows your onchain wealth. Earn the best returns on your crypto.',
		href: 'https://superform.xyz'
	}
];

const IntegrationItem: FC<Integration & {index: number}> = ({name, imageSrc, description, href, index}) => {
	return (
		<Link
			href={href}
			className="block cursor-pointer">
			<div
				className={`flex flex-col md:flex-row justify-between items-center p-[16px] transition-all duration-300 ease-in-out hover:bg-[#2a2b2c] hover:scale-[1.01] hover:shadow-lg ${index % 2 === 0 ? 'bg-[#212223]' : 'bg-[#212223]/50'}`}>
				<div className="flex items-center">
					<div className="w-12 h-12 relative mr-4">
						<Image
							src={imageSrc}
							alt={name}
							width={48}
							height={48}
							className="rounded-full transition-transform duration-300 ease-in-out group-hover:scale-110"
						/>
					</div>
					<div className="text-[24px] text-white flex items-center">
						{name}{' '}
						<span className="ml-2 text-neutral-700 transition-all duration-300 ease-in-out hover:text-neutral-500">
							↗
						</span>
					</div>
				</div>
				<div className="text-neutral-400 text-[18px] transition-colors duration-300 ease-in-out hover:text-neutral-300">
					{description}
				</div>
			</div>
		</Link>
	);
};

export const Integrations: FC = () => (
	<section className="flex justify-center w-full bg-white/5">
		<div className="w-[1180px] flex flex-col md:flex-row items-center justify-between py-16">
			<div className="w-full px-4">
				<SectionHeader
					tagline="Partners"
					title="Integrations"
					description={'External Yearn vaults available through our partners'}
					cta={{
						label: 'Learn More',
						href: '#'
					}}
				/>
				<div className="mt-8 grid rounded-lg overflow-hidden">
					{integrations.map((integration, index) => (
						<IntegrationItem
							index={index}
							key={index}
							name={integration.name}
							imageSrc={integration.imageSrc}
							description={integration.description}
							href={integration.href}
						/>
					))}
				</div>
			</div>
		</div>
	</section>
);
