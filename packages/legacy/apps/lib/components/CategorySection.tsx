import { CarouselSlideArrows } from '@lib/components/CarouselSlideArrows'
import type { TApp } from '@lib/types/mixed'
import { useMountEffect } from '@react-hookz/web'
import { type ReactElement, useRef, useState } from 'react'
import { AppsCarousel } from './AppsCarousel'

type TAppSectionProps = {
	title: string
	apps: TApp[]
}

export const CategorySection = ({ title, apps }: TAppSectionProps): ReactElement => {
	const [shuffledApps, setShuffledApps] = useState<TApp[]>([])
	const [, setCurrentPage] = useState(1)
	const carouselRef = useRef<HTMLDivElement | null>(null)
	const [isProgrammaticScroll, setIsProgrammaticScroll] = useState(false)

	/**********************************************************************************************
	 ** Helper to get the width of a single carousel item.
	 *********************************************************************************************/
	const getItemWidth = (): number => {
		if (!carouselRef.current) {
			return 0
		}
		const firstChild = carouselRef.current.querySelector(':scope > *')
		return firstChild instanceof HTMLElement ? firstChild.offsetWidth : 0
	}

	/**********************************************************************************************
	 ** Handles scrolling back by one item in the carousel, wrapping to the end if at the start.
	 *********************************************************************************************/
	const onScrollBack = (): void => {
		if (!carouselRef.current) {
			return
		}
		const itemWidth = getItemWidth()
		if (itemWidth === 0) {
			return
		}

		setIsProgrammaticScroll(true)

		if (carouselRef.current.scrollLeft <= 0) {
			// Wrap to end
			carouselRef.current.scrollLeft = carouselRef.current.scrollWidth - carouselRef.current.clientWidth
		} else {
			carouselRef.current.scrollLeft -= itemWidth
		}

		setTimeout(() => {
			setIsProgrammaticScroll(false)
		}, 300)
	}

	/**********************************************************************************************
	 ** Handles scrolling forward by one item in the carousel, wrapping to the start if at the end.
	 *********************************************************************************************/
	const onScrollForward = (): void => {
		if (!carouselRef.current) {
			return
		}
		const itemWidth = getItemWidth()
		if (itemWidth === 0) {
			return
		}

		setIsProgrammaticScroll(true)

		const maxScrollLeft = carouselRef.current.scrollWidth - carouselRef.current.clientWidth
		if (carouselRef.current.scrollLeft >= maxScrollLeft) {
			// Wrap to start
			carouselRef.current.scrollLeft = 0
		} else {
			carouselRef.current.scrollLeft += itemWidth
		}

		setTimeout(() => {
			setIsProgrammaticScroll(false)
		}, 300)
	}

	/**********************************************************************************************
	 ** Handles the scroll event of the carousel.
	 ** It calculates the current page based on the scroll position and updates the state.
	 ** This function is not triggered during programmatic scrolling to avoid conflicts.
	 *********************************************************************************************/
	const onScroll = (): void => {
		if (!carouselRef.current || isProgrammaticScroll) {
			return
		}
		const itemWidth = getItemWidth()
		if (itemWidth === 0) {
			return
		}
		const { scrollLeft } = carouselRef.current
		const page = Math.ceil(scrollLeft / (itemWidth * 4)) + 1 // 4 items per page
		setCurrentPage(page)
	}

	/**********************************************************************************************
	 ** On component mount we shuffle the array of Partners to avoid any bias.
	 **********************************************************************************************/
	useMountEffect(() => {
		if (apps?.length < 1) {
			return
		}
		let orderedApps = apps
		if (title === 'Integrations') {
			orderedApps = apps.slice().sort(() => 0.5 - Math.random())
		}
		// Move 'Resupply' app to the front if it exists
		const resupplyIndex = orderedApps.findIndex(app => app.name === 'Resupply')
		if (resupplyIndex > 0) {
			const [resupplyApp] = orderedApps.splice(resupplyIndex, 1)
			orderedApps = [resupplyApp, ...orderedApps]
		}
		setShuffledApps(orderedApps)
	})

	return (
		<div className={'flex flex-col overflow-hidden'}>
			<div className={'mb-6 flex h-10 w-full items-center justify-between pr-1'}>
				<div className={'flex gap-x-4'}>
					<div className={'whitespace-nowrap text-lg font-bold text-neutral-800'}>{title}</div>
				</div>
				{apps?.length > 5 && (
					<CarouselSlideArrows onScrollBack={onScrollBack} onScrollForward={onScrollForward} />
				)}
			</div>
			<AppsCarousel apps={shuffledApps} ref={carouselRef} onScroll={onScroll} />
			{/* <CarouselControls
				carouselLength={apps.length}
				onDotsClick={onDotsClick}
				currentPage={currentPage}
			/> */}
		</div>
	)
}
