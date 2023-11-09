import React, {useState} from 'react';
import Image from 'next/image';
import {useUpdateEffect} from '@react-hookz/web';
import {cl} from '@yearn-finance/web-lib/utils/cl';

import type {ImageProps} from 'next/image';
import type {CSSProperties, ReactElement} from 'react';

type TImageWithFallback = ImageProps & {
	smWidth?: number;
	smHeight?: number;
};
export function ImageWithFallback(props: TImageWithFallback): ReactElement {
	const {alt, src, smWidth, smHeight, ...rest} = props;
	const [imageSrc, set_imageSrc] = useState(`${src}?fallback=true`);
	const [imageStyle, set_imageStyle] = useState<CSSProperties>({});

	useUpdateEffect((): void => {
		set_imageSrc(`${src}?fallback=true`);
		set_imageStyle({});
	}, [src]);

	return (
		<Image
			alt={alt}
			src={imageSrc}
			style={imageStyle}
			className={cl(
				`w-[${smWidth ?? rest.width}px] min-w-[${smWidth ?? rest.width}px]`,
				`h-[${smHeight ?? rest.height}px] min-h-[${smHeight ?? rest.height}px]`,
				`md:w-[${rest.width}px] md:h-[${rest.height}px]`,
				`md:min-w-[${rest.width}px] md:min-h-[${rest.height}px]`
			)}
			onError={(): void => {
				set_imageSrc('/placeholder.png');
				set_imageStyle({filter: 'opacity(0.2)'});
			}}
			{...rest}
		/>
	);
}
