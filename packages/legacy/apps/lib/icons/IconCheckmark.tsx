import React from 'react';

import type {ReactElement} from 'react';

export function IconCheckmark(props: React.SVGProps<SVGSVGElement>): ReactElement {
	return (
		<svg
			width={24}
			height={24}
			fill={'none'}
			xmlns={'http://www.w3.org/2000/svg'}
			viewBox={'0 0 24 24'}
			{...props}>
			<path
				d={'m4 14 6 4L20 6'}
				stroke={'currentcolor'}
				strokeWidth={2}
				strokeLinecap={'round'}
				strokeLinejoin={'round'}
			/>
		</svg>
	);
}
