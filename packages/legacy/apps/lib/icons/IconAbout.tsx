import type {ReactElement} from 'react';

export function IconAbout(props: React.SVGProps<SVGSVGElement>): ReactElement {
	return (
		<svg
			{...props}
			width={'18'}
			height={'16'}
			viewBox={'0 0 18 16'}
			fill={'none'}
			xmlns={'http://www.w3.org/2000/svg'}
		>
			<path
				d={
					'M17 8C12.8416 8 9 5.08957 9 1C9 5.08957 5.15831 8 1 8C5.15831 8 9 10.9104 9 15C9 10.9104 12.8416 8 17 8Z'
				}
				stroke={'currentcolor'}
				strokeWidth={'1.5'}
				strokeLinecap={'round'}
				strokeLinejoin={'round'}
			/>
		</svg>
	);
}
