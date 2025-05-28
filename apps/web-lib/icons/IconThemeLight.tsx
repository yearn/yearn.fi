import React from 'react';

import type {ReactElement} from 'react';

export function IconThemeLight(props: React.SVGProps<SVGSVGElement>): ReactElement {
	return (
		<svg
			xmlns={'http://www.w3.org/2000/svg'}
			width={'24'}
			height={'24'}
			viewBox={'0 0 24 24'}
			{...props}>
			<path
				fillRule={'evenodd'}
				clipRule={'evenodd'}
				d={
					'M12 3C7.03028 3 3 7.03028 3 12C3 16.9697 7.03028 21 12 21C16.9697 21 21 16.9697 21 12C21 7.03028 16.9697 3 12 3ZM1 12C1 5.92572 5.92572 1 12 1C18.0743 1 23 5.92572 23 12C23 18.0743 18.0743 23 12 23C5.92572 23 1 18.0743 1 12Z'
				}
				fill={'currentcolor'}
			/>
		</svg>
	);
}
