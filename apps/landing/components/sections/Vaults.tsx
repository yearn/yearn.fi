import {FC, useState, useEffect, useCallback} from 'react';
import Image from 'next/image';

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
		<section className="flex justify-center w-full bg-gray-400">
			<div className="w-[1180px] bg-gray-500 flex flex-col md:flex-row items-center justify-between py-16">
				<div className="w-full md:w-1/2 mb-8 md:mb-0">
					<Image
						className={
							' z-10 hidden opacity-0 transition-opacity group-hover:opacity-0 md:block md:opacity-100'
						}
						src={'/landing/safe.png'}
						width={400}
						height={400}
						alt={'safe'}
					/>
				</div>

				<div className="w-full md:w-1/2 max-w-xl">
					<p className="text-lightBlue-500 mb-2">Growing every day</p>
					<h2 className="text-5xl font-medium mb-6">Compounding Vaults</h2>
					<p className="text-steelGray-500 mb-10 text-[18px]">
						Yearn Vaults take advantage of DeFi opportunities to give you the best risk-adjusted yields
						without you having to lift a finger.
					</p>

					<div className="relative bg-red-500 p-1 bg-gray-500 rounded-[24px] overflow-hidden p-[8px]">
						<div className="relative">
							{slides.map((row, rowIndex) => (
								<div
									key={rowIndex}
									className={`transition-all duration-500 ease-in-out space-y-1 ${getSlideClassName(rowIndex)}`}>
									{row.map((slide, index) => (
										<div
											key={index}
											className={`${slide.bgClass} h-[48px] rounded-[16px] flex items-center justify-between p-[8px]`}>
											<div className="flex items-center">
												<div className="bg-white rounded-2xl p-1 mr-3">
													<div className="w-6 h-6 bg-gray-900 rounded-2xl flex items-center justify-center">
														<span className="text-white">{slide.icon}</span>
													</div>
												</div>
												<span>{slide.text}</span>
											</div>
											<div className="bg-transparent p-2 rounded-2xl">
												<svg
													xmlns="http://www.w3.org/2000/svg"
													className="h-6 w-6"
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
							<div className="flex justify-center h-[24px] mt-[4px] items-center">
								<div className="flex space-x-3 ">
									{Array.from({length: totalSlides}).map((_, index) => (
										<button
											key={index}
											onClick={() => goToSlide(index)}
											className={`w-2 h-2 rounded-full transition-all duration-300 ${
												index === activeSlide ? 'bg-white w-3' : 'bg-gray-600'
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
		</section>
	);
};
