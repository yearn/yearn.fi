import {useState} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {SectionHeader} from 'apps/landing/components/common/SectionHeader';

import type {FC} from 'react';

type TPartner = {
	image: string;
	alt: string;
	href: string;
	size?: number;
};

const partners: TPartner[] = [
	{
		image: '/landing/x-curve.png',
		alt: 'Curve',
		href: 'https://curve.yearn.space/'
	},
	{
		image: '/landing/x-morpho.png',
		alt: 'Morpho',
		href: 'https://morpho.yearn.space/'
	},
	{
		image: '/landing/x-katana.png',
		alt: 'Katana',
		href: 'https://katana.yearn.space/'
	},
	{
		image: '/landing/x-aerodrome.png',
		alt: 'Aerodrome',
		href: 'https://aerodrome.yearn.space/'
	},
	{
		image: '/landing/x-velodrome.png',
		alt: 'Velodrome',
		href: 'https://velodrome.yearn.space/'
	},
	{
		image: '/landing/x-pooltogether.png',
		alt: 'PoolTogether',
		href: 'https://pooltogether.yearn.space/',
		size: 35
	}
];

const PartnerLogo: FC<TPartner> = ({image, alt, href, size = 50}) => {
	const [isHovered, set_isHovered] = useState(false);
	return (
		<Link
			href={href}
			className={'block flex-1'}>
			<div
				className={
					'relative flex h-20 cursor-pointer items-center justify-center rounded-lg bg-gray-800 p-4 transition-colors duration-200 hover:bg-blue-500 lg:h-full lg:p-6'
				}
				onMouseEnter={() => set_isHovered(true)}
				onMouseLeave={() => set_isHovered(false)}>
				{isHovered && (
					<div
						className={
							'absolute -top-12 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-full bg-gray-700 px-3 py-2 text-sm text-white lg:block'
						}>
						{alt}
						<div
							className={
								'absolute left-1/2 top-full size-0 -translate-x-1/2 border-x-4 border-t-4 border-transparent border-t-gray-700'
							}></div>
					</div>
				)}
				<Image
					src={image}
					alt={alt}
					width={size}
					height={size}
					className={'size-8 object-contain lg:size-auto'}
				/>
			</div>
		</Link>
	);
};

export const Partners: FC = () => (
	<section className={'flex w-full justify-center'}>
		<div className={'flex w-full max-w-[1180px] flex-col items-center justify-between py-8 lg:flex-row lg:py-16'}>
			<div className={'w-full px-4'}>
				<SectionHeader
					tagline={'Partners'}
					title={'Yearn X'}
					description={'Collaborations exploring yield opportunities with our partners'}
					cta={{
						label: 'Learn More',
						href: '#'
					}}
				/>

				{/* Mobile */}
				<div className={'flex flex-col gap-4 pt-8 lg:hidden'}>
					<div
						className={
							'group relative flex h-48 w-full cursor-pointer items-center justify-center rounded-lg bg-gray-800 transition-colors duration-200 hover:bg-blue-500'
						}>
						<div className={'absolute inset-0 z-0 overflow-hidden'}>
							<div className={'absolute inset-0 opacity-20'}>
								<div className={'grid size-full grid-cols-8 grid-rows-6 gap-2 p-4'}>
									{Array(48)
										.fill(0)
										.map((_, i) => (
											<div
												key={i}
												className={
													'size-1 self-center justify-self-center rounded-full bg-white'
												}
											/>
										))}
								</div>
							</div>
						</div>
						<div
							className={
								'z-10 flex size-[100px] items-center justify-center rounded-full bg-gray-800 p-4 transition-colors duration-200 group-hover:bg-blue-500'
							}>
							<Image
								src={'/landing/x-yearn.png'}
								alt={'Yearn'}
								width={75}
								height={75}
								className={'relative z-10'}
							/>
						</div>
					</div>
					<div className={'grid grid-cols-2 gap-2'}>
						{partners.map((partner, index) => (
							<PartnerLogo
								key={index}
								image={partner.image}
								alt={partner.alt}
								href={partner.href}
								size={partner.size}
							/>
						))}
					</div>
				</div>

				{/* Desktop */}
				<div className={'hidden h-80 gap-4 pt-8 lg:flex lg:flex-row'}>
					<div className={'flex h-full w-1/2 flex-col gap-2'}>
						<div className={'flex flex-1 flex-row gap-2'}>
							{partners.slice(0, 3).map((partner, index) => (
								<PartnerLogo
									key={index}
									image={partner.image}
									alt={partner.alt}
									href={partner.href}
								/>
							))}
						</div>
						<div className={'flex flex-1 flex-row gap-2'}>
							{partners.slice(3).map((partner, index) => (
								<PartnerLogo
									key={index}
									image={partner.image}
									alt={partner.alt}
									href={partner.href}
									size={partner.size}
								/>
							))}
						</div>
					</div>
					<div
						className={
							'group relative flex aspect-auto w-1/2 cursor-pointer items-center justify-center rounded-lg bg-gray-800 transition-colors duration-200 hover:bg-blue-500'
						}>
						<div className={'absolute inset-0 z-0 overflow-hidden'}>
							<div className={'absolute inset-0 opacity-20'}>
								<div className={'grid size-full grid-cols-12 grid-rows-10 gap-4 p-8'}>
									{Array(120)
										.fill(0)
										.map((_, i) => (
											<div
												key={i}
												className={
													'size-1 self-center justify-self-center rounded-full bg-white'
												}
											/>
										))}
								</div>
							</div>
						</div>
						<div
							className={
								'z-10 flex size-[150px] items-center justify-center rounded-full bg-gray-800 p-8 transition-colors duration-200 group-hover:bg-blue-500'
							}>
							<Image
								src={'/landing/x-yearn.png'}
								alt={'Yearn'}
								width={125}
								height={125}
								className={'relative z-10'}
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>
);
