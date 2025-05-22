import {FC} from 'react';
import Link from 'next/link';
import Image from 'next/image';

import {SectionHeader} from 'apps/landing/components/common/SectionHeader';

const integrations = [
	{
		name: 'Cove',
		imageSrc: '/landing/integrations-cove.png',
		description: 'Earn the best yields on-chain without the hassle of managing a portfolio.'
	},
	{
		name: '1UP',
		imageSrc: '/landing/integrations-1up.png',
		description: '1UP is a public good liquid locker for YFI.'
	},
	{
		name: 'Stakedao',
		imageSrc: '/landing/integrations-stakedao.png',
		description: 'A non-custodial liquid staking platform focused on governance tokens.'
	},
	{
		name: 'Sturdy',
		imageSrc: '/landing/integrations-sturdy.png',
		description: 'Isolated lending with shared liquidity.'
	},
	{
		name: 'PWN',
		imageSrc: '/landing/integrations-pwn.png',
		description: 'PWN is a hub for peer-to-peer (P2P) loans backed by digital assets'
	},
	{
		name: 'Superform',
		imageSrc: '/landing/integrations-super.png',
		description: 'Superform grows your onchain wealth. Earn the best returns on your crypto.'
	}
];

const IntegrationItem: FC<{
	name: string;
	index: number;
	imageSrc: string;
	description: string;
}> = ({name, imageSrc, description, index}) => {
	return (
		<div
			className={`flex flex-col md:flex-row justify-between items-center p-[16px] ${index % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800'}`}>
			<div className="flex items-center">
				<div className="w-12 h-12 relative mr-4">
					<Image
						src={imageSrc}
						alt={name}
						width={48}
						height={48}
						className="rounded-full"
					/>
				</div>
				<Link
					href="#"
					className="text-[24px] text-white flex items-center">
					{name} <span className="ml-2 text-neutral-700">↗</span>
				</Link>
			</div>
			<div className="text-neutral-400 text-[18px]">{description}</div>
		</div>
	);
};

export const Integrations: FC = () => (
	<section className="flex justify-center w-full bg-gray-500">
		<div className="w-[1180px] bg-gray-600 flex flex-col md:flex-row items-center justify-between py-16">
			<div className="max-w-7xl w-full px-4">
				<SectionHeader
					tagline="Partners"
					title="Integrations"
					description={'External Yearn vaults available through our partners'}
					cta={{
						label: 'Learn More',
						href: '#'
					}}
				/>
				<div className="mt-8 grid gap-px bg-gray-800 rounded-lg overflow-hidden">
					{integrations.map((integration, index) => (
						<IntegrationItem
							index={index}
							key={index}
							name={integration.name}
							imageSrc={integration.imageSrc}
							description={integration.description}
						/>
					))}
				</div>
			</div>
		</div>
	</section>
);
