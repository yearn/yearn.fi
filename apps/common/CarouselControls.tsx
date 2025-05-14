import {type ReactElement} from 'react';
import {cl} from 'builtbymom-web3-fork/utils';

type TCarouselControlsProps = {
	carouselLength?: number;
	onDotsClick: (destination: number) => void;
	currentPage: number;
};

export function CarouselControls({
	carouselLength = 0,
	onDotsClick,
	currentPage
}: TCarouselControlsProps): ReactElement | null {
	const numberOfControls = Math.ceil(carouselLength / 4);

	if (carouselLength && carouselLength < 5) {
		return null;
	}

	return (
		<div className={'mt-4 hidden w-full justify-center md:flex'}>
			<div className={'flex gap-x-3'}>
				{Array(numberOfControls)
					.fill('')
					.map((_, index) => (
						<button
							key={index}
							className={'p-[2px]'}
							onClick={() => {
								onDotsClick(index + 1);
							}}>
							<div
								className={cl(
									'size-2 rounded-full',
									currentPage === index + 1 ? 'bg-white' : 'bg-gray-500'
								)}
							/>
						</button>
					))}
			</div>
		</div>
	);
}
