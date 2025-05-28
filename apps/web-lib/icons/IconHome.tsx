import React from 'react';

import type {ReactElement} from 'react';

export function IconHome(props: React.SVGProps<SVGSVGElement>): ReactElement {
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
					'M12.58 1.207a.917.917 0 0 0-1.16 0L1.335 9.457a.917.917 0 0 0-.336.71V20.25A2.75 2.75 0 0 0 3.75 23h16.5A2.75 2.75 0 0 0 23 20.25V10.167a.917.917 0 0 0-.336-.71L12.58 1.207Zm4.003 19.96h3.667a.917.917 0 0 0 .917-.917v-9.649L12 3.101l-9.167 7.5v9.649c0 .506.411.917.917.917h3.667v-4.584a4.584 4.584 0 0 1 9.166 0v4.584Zm-7.333 0v-4.584a2.75 2.75 0 0 1 5.5 0v4.584h-5.5Z'
				}
				fill={'currentcolor'}
			/>
		</svg>
	);
}
