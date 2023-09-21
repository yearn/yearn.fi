import React from 'react';

import type {ReactElement} from 'react';

export function	IconBaseChain(props: React.SVGProps<SVGSVGElement>): ReactElement {
	return (
		<svg
			width={32}
			height={32}
			fill={'none'}
			xmlns={'http://www.w3.org/2000/svg'}
			viewBox={'0 0 32 32'}
			{...props}>
			<g clipPath={'url(#clip0_621_285370)'}>
				<path
					fill={'#1C55F5'}
					d={'M32 16c0 8.837-7.163 16-16 16S0 24.837 0 16 7.163 0 16 0s16 7.163 16 16z'}
				/>
				<path
					fill={'#fff'}
					d={'M15.977 29C23.17 29 29 23.18 29 16S23.17 3 15.977 3C9.154 3 3.557 8.24 3 14.907h17.213v2.186H3C3.556 23.761 9.154 29 15.977 29z'}
				/>
			</g>
			<defs>
				<clipPath id={'clip0_621_285370'}>
					<path fill={'#fff'} d={'M0 0H32V32H0z'} />
				</clipPath>
			</defs>
		</svg>
	);
}
