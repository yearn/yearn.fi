import {type ReactElement, useRef, useState} from 'react';
import {useMountEffect} from '@react-hookz/web';
// import {CarouselControls} from '@common/CarouselControls';
import {CarouselSlideArrows} from '@common/CarouselSlideArrows';
import {IconShare} from '@common/icons/IconShare';

import {AppsCarousel} from './AppsCarousel';

import type {TApp} from '@common/types/category';

type TAppSectionProps = {
	title: string;
	onExpandClick: () => void;
	apps: TApp[];
};

export const CategorySection = ({title, onExpandClick, apps}: TAppSectionProps): ReactElement => {
	const [shuffledApps, set_shuffledApps] = useState<TApp[]>([]);
	const [, set_currentPage] = useState(1);
	const carouselRef = useRef<HTMLDivElement | null>(null);
	const [isProgrammaticScroll, set_isProgrammaticScroll] = useState(false);

	/**********************************************************************************************
	 ** Helper to get the width of a single carousel item.
	 *********************************************************************************************/
	const getItemWidth = (): number => {
		if (!carouselRef.current) return 0;
		const firstChild = carouselRef.current.querySelector(':scope > *');
		return firstChild instanceof HTMLElement ? firstChild.offsetWidth : 0;
	};

	/**********************************************************************************************
	 ** Handles scrolling back by one item in the carousel, wrapping to the end if at the start.
	 *********************************************************************************************/
	const onScrollBack = (): void => {
		if (!carouselRef.current) return;
		const itemWidth = getItemWidth();
		if (itemWidth === 0) return;

		set_isProgrammaticScroll(true);

		if (carouselRef.current.scrollLeft <= 0) {
			// Wrap to end
			carouselRef.current.scrollLeft = carouselRef.current.scrollWidth - carouselRef.current.clientWidth;
		} else {
			carouselRef.current.scrollLeft -= itemWidth;
		}

		setTimeout(() => {
			set_isProgrammaticScroll(false);
		}, 300);
	};

	/**********************************************************************************************
	 ** Handles scrolling forward by one item in the carousel, wrapping to the start if at the end.
	 *********************************************************************************************/
	const onScrollForward = (): void => {
		if (!carouselRef.current) return;
		const itemWidth = getItemWidth();
		if (itemWidth === 0) return;

		set_isProgrammaticScroll(true);

		const maxScrollLeft = carouselRef.current.scrollWidth - carouselRef.current.clientWidth;
		if (carouselRef.current.scrollLeft >= maxScrollLeft) {
			// Wrap to start
			carouselRef.current.scrollLeft = 0;
		} else {
			carouselRef.current.scrollLeft += itemWidth;
		}

		setTimeout(() => {
			set_isProgrammaticScroll(false);
		}, 300);
	};

	/**********************************************************************************************
	 ** Handles clicking on the carousel dots to navigate to a specific page.
	 ** It updates the scroll position, current page, and sets a flag to indicate programmatic
	 ** scrolling. The flag is reset after a delay to allow for smooth scrolling.
	 *********************************************************************************************/
	// const onDotsClick = (destination: number): void => {
	// 	if (!carouselRef.current) return;
	// 	const itemWidth = getItemWidth();
	// 	if (itemWidth === 0) return;

	// 	set_isProgrammaticScroll(true);

	// 	carouselRef.current.scrollLeft = itemWidth * (destination - 1) * 4; // 4 items per page
	// 	set_currentPage(destination);

	// 	setTimeout(() => {
	// 		set_isProgrammaticScroll(false);
	// 	}, 300);
	// };

	/**********************************************************************************************
	 ** Handles the scroll event of the carousel.
	 ** It calculates the current page based on the scroll position and updates the state.
	 ** This function is not triggered during programmatic scrolling to avoid conflicts.
	 *********************************************************************************************/
	const onScroll = (): void => {
		if (!carouselRef.current || isProgrammaticScroll) return;
		const itemWidth = getItemWidth();
		if (itemWidth === 0) return;
		const {scrollLeft} = carouselRef.current;
		const page = Math.ceil(scrollLeft / (itemWidth * 4)) + 1; // 4 items per page
		set_currentPage(page);
	};

	/**********************************************************************************************
	 ** On component mount we shuffle the array of Partners to avoid any bias.
	 **********************************************************************************************/
	useMountEffect(() => {
		if (apps?.length < 1) {
			return;
		}
		if (title === 'Integrations') {
			set_shuffledApps(apps?.toSorted(() => 0.5 - Math.random()));
		}
		set_shuffledApps(apps);
	});

	return (
		<div className={'flex flex-col overflow-hidden'}>
			<div className={'mb-6 flex h-10 w-full items-center justify-between pr-1'}>
				<div className={'flex gap-x-4'}>
					<div className={'whitespace-nowrap text-lg font-bold text-neutral-800'}>{title}</div>
					<button
						onClick={onExpandClick}
						className={
							'flex items-center rounded-[4px] px-4 py-2 outline !outline-1 outline-neutral-600/50 hover:bg-neutral-600/40'
						}>
						<span className={'mr-2 whitespace-nowrap text-xs text-neutral-800'}>{'View all'}</span>
						<IconShare className={'size-3'} />
					</button>
				</div>
				{apps?.length > 5 && (
					<CarouselSlideArrows
						onScrollBack={onScrollBack}
						onScrollForward={onScrollForward}
					/>
				)}
			</div>
			<AppsCarousel
				apps={shuffledApps}
				ref={carouselRef}
				onScroll={onScroll}
			/>
			{/* <CarouselControls
				carouselLength={apps.length}
				onDotsClick={onDotsClick}
				currentPage={currentPage}
			/> */}
		</div>
	);
};
