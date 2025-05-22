import {FC} from 'react';
import Image from 'next/image';
import {SectionHeader} from 'apps/landing/components/common/SectionHeader';

const PartnerLogo: FC<{image: string; alt: string; size?: number}> = ({image, alt, size = 50}) => {
	return (
		<div className="bg-gray-800 rounded-lg p-6 flex items-center justify-center flex-1">
			<Image
				src={image}
				alt={alt}
				width={size}
				height={size}
			/>
		</div>
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
								/>
								<PartnerLogo
									image="/landing/x-morpho.png"
									alt="Morpho"
								/>
								<PartnerLogo
									image="/landing/x-katana.png"
									alt="Katana"
								/>
							</div>
							<div className="flex-1 flex flex-row gap-2">
								<PartnerLogo
									image="/landing/x-aerodrome.png"
									alt="Aerodrome"
								/>
								<PartnerLogo
									image="/landing/x-velodrome.png"
									alt="Velodrome"
								/>
								<PartnerLogo
									image="/landing/x-pooltogether.png"
									alt="PoolTogether"
									size={35}
								/>
							</div>
						</div>
						<div className="bg-[#37393A] rounded-lg flex items-center justify-center aspect-auto relative w-1/2">
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
							<Image
								src="/landing/x-yearn.png"
								alt="Yearn"
								width={150}
								height={150}
								className="relative z-10"
							/>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
};
