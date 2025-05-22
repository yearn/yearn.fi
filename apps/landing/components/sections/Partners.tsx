import {FC} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {SectionHeader} from 'apps/landing/components/common/SectionHeader';
const PartnerLogo: FC<{image: string; alt: string}> = ({image, alt}) => {
	return (
		<div className="bg-gray-800 rounded-lg p-6 flex items-center justify-center w-full">
			<Image
				src={image}
				alt={alt}
				width={50}
				height={100}
			/>
		</div>
	);
};

export const Partners: FC = () => {
	return (
		<section className="flex justify-center w-full bg-gray-400">
			<div className="w-[1180px] bg-gray-500 flex flex-col md:flex-row items-center justify-between py-16">
				<div className="container px-4 mx-auto">
					<SectionHeader
						tagline="Partners"
						title="Yearn X"
						description={'Collaborations exploring yield opportunities with our partners'}
						cta={{
							label: 'Learn More',
							href: '#'
						}}
					/>

					<div className="flex flex-row gap-4 pt-8">
						<div className="flex flex-col w-1/2 gap-2">
							<div className="flex flex-row gap-2">
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
							<div className="flex flex-row gap-2">
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
								/>
							</div>
						</div>
						<div className="bg-gray-400 rounded-lg flex items-center justify-center aspect-auto relative w-1/2">
							<div className="absolute inset-0 overflow-hidden">
								<div className="absolute inset-0 opacity-20">
									<div className="grid grid-cols-12 h-full w-full">
										{Array(120)
											.fill(0)
											.map((_, i) => (
												<div
													key={i}
													className="w-1 h-1 bg-white rounded-full"
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
							/>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
};
