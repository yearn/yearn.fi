import {FC, useState} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {SectionHeader} from 'apps/landing/components/common/SectionHeader';

const PartnerLogo: FC<{image: string; alt: string; href: string; size?: number}> = ({image, alt, href, size = 50}) => {
	const [isHovered, setIsHovered] = useState(false);

	return (
		<Link
			href={href}
			className="flex-1 block">
			<div
				className="bg-gray-800 hover:bg-blue-500 rounded-lg p-6 flex items-center justify-center h-full transition-colors duration-200 cursor-pointer relative"
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}>
				{isHovered && (
					<div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-gray-700 text-white px-3 py-2 rounded-full text-sm whitespace-nowrap z-10">
						{alt}
						<div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
					</div>
				)}
				<Image
					src={image}
					alt={alt}
					width={size}
					height={size}
				/>
			</div>
		</Link>
	);
};

export const Partners: FC = () => {
	return (
		<section className="flex justify-center w-full">
			<div className="w-[1180px] flex flex-row items-center justify-between py-16">
				<div className="max-w-7xl w-full px-4">
					<SectionHeader
						tagline="Partners"
						title="Yearn X"
						description={'Collaborations exploring yield opportunities with our partners'}
						cta={{
							label: 'Learn More',
							href: '#'
						}}
					/>

					<div className="flex flex-row gap-4 pt-8 h-80">
						<div className="flex flex-col w-1/2 gap-2 h-full">
							<div className="flex-1 flex flex-row gap-2">
								<PartnerLogo
									image="/landing/x-curve.png"
									alt="Curve"
									href="#"
								/>
								<PartnerLogo
									image="/landing/x-morpho.png"
									alt="Morpho"
									href="#"
								/>
								<PartnerLogo
									image="/landing/x-katana.png"
									alt="Katana"
									href="#"
								/>
							</div>
							<div className="flex-1 flex flex-row gap-2">
								<PartnerLogo
									image="/landing/x-aerodrome.png"
									alt="Aerodrome"
									href="#"
								/>
								<PartnerLogo
									image="/landing/x-velodrome.png"
									alt="Velodrome"
									href="#"
								/>
								<PartnerLogo
									image="/landing/x-pooltogether.png"
									alt="PoolTogether"
									size={35}
									href="#"
								/>
							</div>
						</div>
						<div className="bg-gray-800 hover:bg-blue-500 rounded-lg flex items-center justify-center aspect-auto relative w-1/2 transition-colors duration-200 cursor-pointer group">
							<div className="absolute inset-0 overflow-hidden z-0">
								<div className="absolute inset-0 opacity-20">
									<div className="grid grid-cols-12 grid-rows-10 h-full w-full gap-4 p-8">
										{Array(120)
											.fill(0)
											.map((_, i) => (
												<div
													key={i}
													className="w-1 h-1 bg-white rounded-full justify-self-center self-center"
												/>
											))}
									</div>
								</div>
							</div>
							<div className="bg-gray-800 group-hover:bg-blue-500 rounded-full p-8 h-[150px] w-[150px] z-10 flex items-center justify-center transition-colors duration-200">
								<Image
									src="/landing/x-yearn.png"
									alt="Yearn"
									width={125}
									height={125}
									className="relative z-10"
								/>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
};
