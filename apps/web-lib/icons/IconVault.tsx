import React from 'react';

import type {ReactElement} from 'react';

export function IconVault(props: React.SVGProps<SVGSVGElement>): ReactElement {
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
					'M11.083 9.25a2.75 2.75 0 1 0 .002 5.501 2.75 2.75 0 0 0-.002-5.501ZM10.167 12a.917.917 0 1 1 1.834.001.917.917 0 0 1-1.834-.001Z'
				}
				fill={'currentcolor'}
			/>
			<path
				fillRule={'evenodd'}
				clipRule={'evenodd'}
				d={
					'M4.667 12a6.417 6.417 0 0 1 9.723-5.5h4.027a.917.917 0 1 1 0 1.833h-2.068A6.386 6.386 0 0 1 17.5 12a6.386 6.386 0 0 1-1.15 3.667h2.067a.917.917 0 1 1 0 1.833H14.39A6.418 6.418 0 0 1 4.667 12Zm6.416-4.583a4.584 4.584 0 1 0 .002 9.168 4.584 4.584 0 0 0-.002-9.168Z'
				}
				fill={'currentcolor'}
			/>
			<path
				fillRule={'evenodd'}
				clipRule={'evenodd'}
				d={
					'M1 3.75A2.75 2.75 0 0 1 3.75 1h16.5A2.75 2.75 0 0 1 23 3.75v16.5A2.75 2.75 0 0 1 20.25 23H3.75A2.75 2.75 0 0 1 1 20.25V3.75Zm2.75-.917a.917.917 0 0 0-.917.917v16.5c0 .506.411.917.917.917h16.5a.917.917 0 0 0 .917-.917V3.75a.917.917 0 0 0-.917-.917H3.75Z'
				}
				fill={'currentcolor'}
			/>
		</svg>
	);
}
