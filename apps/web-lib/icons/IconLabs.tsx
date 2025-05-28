import React from 'react';

import type {ReactElement} from 'react';

export function IconLabs(props: React.SVGProps<SVGSVGElement>): ReactElement {
	return (
		<svg
			width={24}
			height={24}
			fill={'none'}
			xmlns={'http://www.w3.org/2000/svg'}
			viewBox={'0 0 24 24'}
			{...props}>
			<path
				fillRule={'evenodd'}
				clipRule={'evenodd'}
				d={
					'M13.185 1.268a.917.917 0 0 1 1.296 0l4.584 4.584a.917.917 0 0 1 0 1.296l-2.7 2.7a9.539 9.539 0 0 1 .677 3.527 9.612 9.612 0 0 1-3.973 7.792h9.014a.917.917 0 1 1 0 1.833H1.917a.917.917 0 0 1 0-1.833h5.5a7.791 7.791 0 0 0 7.791-7.792c0-.722-.1-1.42-.287-2.082l-5.94 5.939a.917.917 0 0 1-1.296 0l-4.583-4.584a.917.917 0 0 1 0-1.296L13.185 1.268ZM5.046 12l8.787-8.787L17.12 6.5l-2.478 2.478-.03.03-6.279 6.279L5.046 12Z'
				}
				fill={'currentcolor'}
			/>
			<path
				d={'M2.565 14.102a.917.917 0 1 0-1.297 1.296l3.667 3.667a.917.917 0 1 0 1.297-1.297l-3.667-3.666Z'}
				fill={'currentcolor'}
			/>
		</svg>
	);
}
