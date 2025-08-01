import type {ReactElement} from 'react';

export function IconChevron(props: React.SVGProps<SVGSVGElement>): ReactElement {
	return (
		<svg
			{...props}
			width={'12'}
			height={'8'}
			viewBox={'0 0 12 8'}
			fill={'none'}
			xmlns={'http://www.w3.org/2000/svg'}
		>
			<path
				fillRule={'evenodd'}
				clipRule={'evenodd'}
				d={
					'M11.7439 0.435577C12.0556 0.708339 12.0872 1.18216 11.8144 1.49389L6.56443 7.49388C6.42202 7.65664 6.21627 7.75 6 7.75C5.78373 7.75 5.57798 7.65664 5.43557 7.49388L0.185577 1.49389C-0.087184 1.18216 -0.0555964 0.708338 0.256131 0.435577C0.567858 0.162816 1.04168 0.194404 1.31444 0.506131L6 5.86106L10.6856 0.506131C10.9583 0.194404 11.4321 0.162816 11.7439 0.435577Z'
				}
				fill={'currentcolor'}
			/>
		</svg>
	);
}
