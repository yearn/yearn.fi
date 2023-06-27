import Image from 'next/image';
import IconCross from '@yearn-finance/web-lib/icons/IconCross';

import type {ReactElement} from 'react';

type TImageWithOverlayProps = {
	imageSrc: string;
	imageAlt: string;
	imageWidth: number;
	imageHeight: number;
	overlayText: string;
	buttonText: string;
	href: string;
	onCloseClick: () => void;
}

const ImageWithOverlay: React.FC<TImageWithOverlayProps> = ({
	imageSrc,
	imageAlt,
	imageWidth,
	imageHeight,
	overlayText,
	buttonText,
	href,
	onCloseClick
}): ReactElement => {
	return (
		<div className={'relative h-full w-full'}>
			<Image
				src={imageSrc}
				alt={imageAlt}
				width={imageWidth}
				height={imageHeight}
				style={{objectFit: 'cover'}}
			/>
			<div className={'absolute inset-0 flex flex-col items-center justify-center'}>
				<IconCross
					className={'absolute right-1 top-1 cursor-pointer text-white md:right-3 md:top-4'}
					onClick={onCloseClick} />
				<h2 className={'text-xl font-bold text-white md:mb-5 md:text-6xl'}>{overlayText}</h2>
				<a href={href}>
					<button className={'w-auto bg-white p-1 text-sm font-bold text-[#0657F9] hover:bg-[#EBEBEB] md:w-[314px] md:p-2 md:text-intermediate'}>
						{buttonText}
					</button>
				</a>
			</div>
		</div>
	);
};

export default ImageWithOverlay;
