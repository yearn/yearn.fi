import React, {ReactElement, useState} from 'react';
import Image, {ImageProps} from 'next/image';

function	ImageWithFallback(props: ImageProps): ReactElement {
	const {alt, src, ...rest} = props;
	const [imageSrc, set_imageSrc] = useState(src);

	return (
		<Image
			alt={alt}
			src={imageSrc}
			loading={'eager'}
			onError={(): void => {
				set_imageSrc('/placeholder.png');
			}}
			{...rest}
		/>
	);
}

export {ImageWithFallback};