import React, {useState} from 'react';
import Image from 'next/image';

import type {ImageProps} from 'next/image';
import type {ReactElement} from 'react';

export type TImageWithFallbackProps = ImageProps & {
	onCatchError?: () => void;
};
function	ImageWithFallback(props: TImageWithFallbackProps): ReactElement {
	const {alt, src, onCatchError, ...rest} = props;
	const [imageSrc, set_imageSrc] = useState(src);

	return (
		<Image
			alt={alt}
			src={imageSrc}
			loading={'eager'}
			onError={(): void => {
				set_imageSrc('/placeholder.png');
				onCatchError?.();
			}}
			{...rest}
		/>
	);
}

export {ImageWithFallback};
