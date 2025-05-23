import {FC, useState, useEffect, useCallback} from 'react';
import Image from 'next/image';
import {SectionHeader} from 'apps/landing/components/common/SectionHeader';

interface VaultRow {
	bgClass: string;
	icon: string;
	text: string;
	description?: string;
	href: string;
}

interface Vault {
	background: string;
	image: string;
	size: number;
	tagline: string;
	title: string;
	description: string;
	cta?: {label: string; href: string};
	vaultRows: VaultRow[];
}

const slides: Vault[] = [
	{
		background: '/landing/vault-background-x.png',
		image: '/landing/safe.png',
		size: 250,
		tagline: 'Growing every day',
		title: 'Compounding Vaults',
		description:
			'Yearn Vaults take advantage of DeFi opportunities to give you the best risk-adjusted yields without you having to lift a finger',
		cta: {label: 'View All', href: 'https://yearn.fi/apps/vaults'},
		vaultRows: [
			{
				bgClass: 'bg-gradient-to-r from-gray-800 to-gray-700',
				icon: '/landing/vaults/eth.png',
				text: 'Earn 4.75% on ETH',
				href: '/v3/1/0xc56413869c6CDf96496f2b1eF801fEDBdFA7dDB0'
			},
			{
				bgClass: 'bg-gradient-to-r from-gray-900 to-gray-800',
				icon: '/landing/vaults/usds.png',
				text: 'Earn 5.25% on USDS',
				href: '/v3/1/0x182863131F9a4630fF9E27830d945B1413e347E8'
			},
			{
				bgClass: 'bg-gradient-to-r from-gray-900 to-gray-700',
				icon: '/landing/vaults/usdc.png',
				text: 'Earn 3.95% on USDC',
				href: '/v3/1/0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204'
			}
		]
	},
	{
		background: '/landing/vault-background-y.png',
		image: '/landing/apps.png',
		size: 300,
		tagline: 'Growing every day',
		title: 'App Ecosystem',
		description: 'Apps built on Yearn vaults by contributors and the wider community',
		vaultRows: [
			{
				bgClass: 'bg-gradient-to-r from-gray-800 to-blue-900',
				icon: '/landing/apps/veyfi.png',
				text: 'veYFI',
				description: 'Earn yield, boost gauges, and take part in governance',
				href: 'https://veyfi.yearn.fi/'
			},
			{
				bgClass: 'bg-gradient-to-r from-gray-800 to-blue-800',
				icon: '/landing/apps/ycrv.png',
				text: 'yCRV',
				description: 'Put your yCRV to work',
				href: 'https://ycrv.yearn.fi/'
			},
			{
				bgClass: 'bg-gradient-to-r from-gray-900 to-blue-700',
				icon: '/landing/apps/yprisma.png',
				text: 'yPRISMA',
				description: 'Put your yPRISMA to work',
				href: 'https://yprisma.yearn.fi/'
			},
			{
				bgClass: 'bg-gradient-to-r from-gray-900 to-blue-700',
				icon: '/landing/apps/yeth.png',
				text: 'yETH',
				description: 'A basket of LSTs in a single token',
				href: 'https://yeth.yearn.fi/'
			}
		]
	}
];

export const Vaults: FC = () => {
	const [activeSlide, setActiveSlide] = useState(0);
	const [isAnimating, setIsAnimating] = useState(false);

	const totalSlides = slides.length;

	const nextSlide = useCallback(() => {
		if (!isAnimating) {
			setIsAnimating(true);
			setActiveSlide(prev => (prev + 1) % totalSlides);
			setTimeout(() => setIsAnimating(false), 500);
		}
	}, [activeSlide, isAnimating, totalSlides]);

	const goToSlide = useCallback(
		(index: number) => {
			if (!isAnimating && index !== activeSlide) {
				setIsAnimating(true);
				setActiveSlide(index);
				setTimeout(() => setIsAnimating(false), 500);
			}
		},
		[activeSlide, isAnimating]
	);

	useEffect(() => {
		const interval = setInterval(() => {
			nextSlide();
		}, 10_000);

		return () => clearInterval(interval);
	}, [nextSlide]);

	return (
		<section className="flex justify-center w-full px-4 md:px-8 ">
			<div className="w-full max-w-[1180px] py-12 md:py-36">
				{/* Slides */}
				<div className="relative mb-8 md:mb-12 overflow-hidden">
					<div
						className="flex transition-transform duration-500 ease-in-out"
						style={{transform: `translateX(-${activeSlide * 100}%)`}}>
						{slides.map((slide, index) => (
							<div
								key={index}
								className="w-full flex-shrink-0 flex flex-col md:flex-row items-stretch justify-between gap-6 md:gap-8">
								{/* Image Container */}
								<div className="flex w-full md:w-2/5 relative min-h-[200px] md:min-h-auto">
									<div
										className="flex h-full w-full border-[1px] border-[#ffffff]/10 rounded-[24px] items-center justify-center relative overflow-hidden"
										style={{
											backgroundImage: `url(${slide.background})`,
											backgroundRepeat: 'no-repeat',
											backgroundSize: 'cover',
											backgroundPosition: 'center'
										}}>
										<Image
											className={
												'z-10 md:opacity-100 transition-opacity group-hover:opacity-0 block'
											}
											src={slide.image}
											width={slide.size}
											height={slide.size}
											alt={'vault image'}
										/>
									</div>
								</div>

								<div className="flex flex-col w-full md:w-3/5 justify-between relative h-full gap-4 md:gap-4">
									<div className="relative">
										<SectionHeader
											tagline={slide.tagline}
											title={slide.title}
											description={slide.description}
											cta={slide.cta}
										/>
									</div>

									<div className="relative p-1 bg-white/5 rounded-[24px] overflow-hidden p-[8px] w-full">
										<div className="space-y-1">
											{slide.vaultRows.map((vault, vaultIndex) => (
												<a
													key={vaultIndex}
													href={vault.href}
													className={`${vault.bgClass} rounded-[16px] flex items-center justify-between p-2 md:p-[8px] cursor-pointer hover:opacity-90 transition-opacity duration-200`}>
													<div className="flex items-center">
														<div className=" rounded-2xl p-1 mr-2 md:mr-3">
															<div className="w-5 h-5 md:w-6 md:h-6 bg-gray-900 rounded-2xl flex items-center justify-center">
																<Image
																	src={vault.icon}
																	alt={vault.text}
																	width={24}
																	height={24}
																/>
															</div>
														</div>
														<div className="flex flex-col md:flex-row gap-1 md:gap-2">
															<span className=":text-base font-medium">{vault.text}</span>
															{vault.description && (
																<span className="md:text-base font-light text-gray-400">
																	{vault.description}
																</span>
															)}
														</div>
													</div>
													<div className="bg-transparent p-1 md:p-2 rounded-2xl">
														<svg
															xmlns="http://www.w3.org/2000/svg"
															className="h-5 w-5 md:h-6 md:w-6"
															fill="none"
															viewBox="0 0 24 24"
															stroke="currentColor">
															<path
																strokeLinecap="round"
																strokeLinejoin="round"
																strokeWidth={2}
																d="M14 5l7 7m0 0l-7 7m7-7H3"
															/>
														</svg>
													</div>
												</a>
											))}
										</div>
									</div>
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Pagination */}
				<div className="flex justify-center w-full">
					<div className="flex space-x-3 items-center">
						{Array.from({length: totalSlides}).map((_, index) => (
							<button
								key={index}
								onClick={() => goToSlide(index)}
								className={`w-2 h-2 rounded-full transition-all duration-300 ${
									index === activeSlide ? 'bg-white scale-125' : 'bg-gray-600'
								}`}
								aria-label={`Go to slide ${index + 1}`}
							/>
						))}
					</div>
				</div>
			</div>
		</section>
	);
};
