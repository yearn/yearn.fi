import React from 'react';

import type {ReactElement} from 'react';

export function	IconEtherumChain(props: React.SVGProps<SVGSVGElement>): ReactElement {
	return (
		<svg
			width={32}
			height={32}
			fill={'none'}
			xmlns={'http://www.w3.org/2000/svg'}
			viewBox={'0 0 32 32'}
			{...props}>
			<g clipPath={'url(#clip0_621_285293)'}>
				<path
					fill={'#627EEA'}
					d={'M16 32c8.837 0 16-7.163 16-16S24.837 0 16 0 0 7.163 0 16s7.163 16 16 16z'}
				/>
				<path
					fill={'#fff'}
					fillRule={'evenodd'}
					d={'M9 16.223L16.5 4v8.872L9 16.222zm7.5 5.748V28L9 17.619l7.5 4.352z'}
					clipRule={'evenodd'}
				/>
				<path
					fill={'#fff'}
					fillOpacity={'0.2'}
					d={'M16.5 20.576l7.499-4.353-7.499-3.35v7.704z'}
				/>
				<path
					fill={'#fff'}
					fillOpacity={'0.602'}
					fillRule={'evenodd'}
					d={'M16.5 4v8.872l7.498 3.35L16.5 4zm0 17.972V28l7.503-10.381-7.503 4.353zm0-1.396L9 16.224l7.5-3.35v7.704z'}
					clipRule={'evenodd'}
				/>
			</g>
			<defs>
				<clipPath id={'clip0_621_285293'}>
					<path fill={'#fff'} d={'M0 0H32V32H0z'} />
				</clipPath>
			</defs>
		</svg>
	);
}
