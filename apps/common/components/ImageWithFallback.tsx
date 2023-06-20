import {useState} from 'react';
import Image from 'next/image';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';

import type {ImageProps} from 'next/image';
import type {CSSProperties, ReactElement} from 'react';

function ImageWithFallback(props: ImageProps & {onCatchError?: VoidFunction}): ReactElement {
	const {alt, src, onCatchError, ...rest} = props;
	const [imageSrc, set_imageSrc] = useState(src);
	const [imageStyle, set_imageStyle] = useState<CSSProperties>({});

	return (
		<Image
			alt={alt}
			src={imageSrc}
			style={imageStyle}
			onError={(): void => {
				performBatchedUpdates((): void => {
					set_imageSrc('/placeholder.png');
					set_imageStyle({filter: 'opacity(0.2)'});
					onCatchError?.();
				});
			}}
			{...rest} />
	);
}

export {ImageWithFallback};
