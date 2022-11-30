import React from 'react';

import type {ReactElement} from 'react';

function	IconChevron(props: React.SVGProps<SVGSVGElement>): ReactElement {
	return (
		<svg
			{...props}
			width={'24'}
			height={'24'}
			viewBox={'0 0 24 24'}
			fill={'none'}
			xmlns={'http://www.w3.org/2000/svg'}>
			<path
				fillRule={'evenodd'}
				clipRule={'evenodd'}
				d={'M19.6585 7.24744C20.0742 7.61112 20.1163 8.24288 19.7526 8.65852L12.7526 16.6585C12.5627 16.8755 12.2884 17 12 17C11.7117 17 11.4373 16.8755 11.2474 16.6585L4.24744 8.65852C3.88376 8.24288 3.92588 7.61112 4.34151 7.24744C4.75715 6.88375 5.38891 6.92587 5.75259 7.34151L12 14.4814L18.2474 7.34151C18.6111 6.92587 19.2429 6.88375 19.6585 7.24744Z'}
				fill={'currentColor'} />
		</svg>
	);
}

export default IconChevron;
