import {FC, useState, useEffect, useCallback} from 'react';
import Image from 'next/image';
import {SectionHeader} from 'apps/landing/components/common/SectionHeader';

const slides = [
	[
		{
			bgClass: 'bg-gradient-to-r from-gray-800 to-gray-700',
			icon: 'Ξ',
			text: 'Earn 4.75% on ETH'
		},
		{
			bgClass: 'bg-gradient-to-r from-gray-900 to-gray-800',
			icon: 'Ξ',
			text: 'Earn 5.25% on wstETH'
		},
		{
			bgClass: 'bg-gradient-to-r from-gray-900 to-gray-700',
			icon: 'Ξ',
			text: 'Earn 3.95% on rETH'
		}
	],
	[
		{
			bgClass: 'bg-gradient-to-r from-gray-800 to-blue-900',
			icon: '$',
			text: 'Earn 3.75% on USDC'
		},
		{
			bgClass: 'bg-gradient-to-r from-gray-800 to-blue-800',
			icon: '$',
			text: 'Earn 4.25% on DAI'
		},
		{
			bgClass: 'bg-gradient-to-r from-gray-900 to-blue-700',
			icon: '$',
			text: 'Earn 3.50% on USDT'
		}
	],
	[
		{
			bgClass: 'bg-gradient-to-r from-gray-800 to-purple-900',
			icon: '$',
			text: 'Earn 8.75% on USDT'
		},
		{
			bgClass: 'bg-gradient-to-r from-gray-800 to-purple-800',
			icon: 'Y',
			text: 'Earn 10.5% on YFI'
		},
		{
			bgClass: 'bg-gradient-to-r from-gray-800 to-purple-700',
			icon: 'C',
			text: 'Earn 7.80% on CRV'
		}
	]
];

export const Vaults: FC = () => {
	const [activeSlide, setActiveSlide] = useState(0);
	const [prevSlide, setPrevSlide] = useState(0);
	const [isAnimating, setIsAnimating] = useState(false);

	const totalSlides = slides.length;

	const nextSlide = useCallback(() => {
		if (!isAnimating) {
			setIsAnimating(true);
			setPrevSlide(activeSlide);
			setActiveSlide(prev => (prev + 1) % totalSlides);
			setTimeout(() => setIsAnimating(false), 500);
		}
	}, [activeSlide, isAnimating, totalSlides]);

	const goToSlide = useCallback(
		(index: number) => {
			if (!isAnimating && index !== activeSlide) {
				setIsAnimating(true);
				setPrevSlide(activeSlide);
				setActiveSlide(index);
				setTimeout(() => setIsAnimating(false), 500);
			}
		},
		[activeSlide, isAnimating]
	);

	useEffect(() => {
		const interval = setInterval(() => {
			nextSlide();
		}, 5000);

		return () => clearInterval(interval);
	}, [nextSlide]);

	const getSlideClassName = (index: number) => {
		if (index === activeSlide) {
			return 'opacity-100 translate-x-0 z-10 relative';
		} else if (index === prevSlide) {
			return 'opacity-0 -translate-x-24 absolute top-0 left-0 w-full';
		} else {
			return 'opacity-0 translate-x-24 absolute top-0 left-0 w-full';
		}
	};

	return (
		<section className="flex justify-center w-full px-4 md:px-8">
			<div className="w-full max-w-[1180px] flex flex-col md:flex-row items-center justify-between py-12 md:py-24 gap-6 md:gap-[48px]">
				<div className="flex w-full md:w-2/5 h-[250px] md:h-full items-center justify-center">
					<div
						className="flex h-full w-full mb-4 md:mb-0 border-[1px] border-[#ffffff]/10 rounded-[24px] items-center justify-center"
						style={{
							backgroundImage: "url('/landing/vault-background.png')",
							backgroundRepeat: 'no-repeat',
							backgroundSize: 'cover',
							backgroundPosition: 'center'
						}}>
						<Image
							className={'z-10 md:opacity-100 transition-opacity group-hover:opacity-0 block'}
							src={'/landing/safe.png'}
							width={250}
							height={250}
							alt={'safe'}
						/>
					</div>
				</div>

				<div className="w-full md:w-3/5 items-center justify-center">
					<div>
						<SectionHeader
							tagline="Growing every day"
							title="Compounding Vaults"
							description="Yearn Vaults take advantage of DeFi opportunities to give you the best risk-adjusted yields without you having to lift a finger"
							cta={{label: 'View All', href: '#'}}
						/>

						<div className="relative p-1 bg-white/5 rounded-[24px] overflow-hidden p-[8px] mt-6 md:mt-8">
							<div className="relative">
								{slides.map((row, rowIndex) => (
									<div
										key={rowIndex}
										className={`transition-all duration-500 ease-in-out space-y-1 ${getSlideClassName(rowIndex)}`}>
										{row.map((slide, index) => (
											<div
												key={index}
												className={`${slide.bgClass} h-[48px] md:h-[48px] rounded-[16px] flex items-center justify-between p-2 md:p-[8px]`}>
												<div className="flex items-center">
													<div className="bg-white rounded-2xl p-1 mr-2 md:mr-3">
														<div className="w-5 h-5 md:w-6 md:h-6 bg-gray-900 rounded-2xl flex items-center justify-center">
															<span className="text-white text-sm md:text-base">
																{slide.icon}
															</span>
														</div>
													</div>
													<span className="text-sm md:text-base">{slide.text}</span>
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
											</div>
										))}
									</div>
								))}
								<div className="flex justify-center h-[20px] md:h-[24px] mt-[4px] items-center">
									<div className="flex space-x-2 md:space-x-3">
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
						</div>
					</div>
				</div>
			</div>
		</section>
	);
};
