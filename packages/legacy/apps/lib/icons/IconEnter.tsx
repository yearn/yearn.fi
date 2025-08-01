import type {ReactElement} from 'react';

export function IconEnter(props: React.SVGProps<SVGSVGElement>): ReactElement {
	return (
		<svg
			{...props}
			width={'12'}
			height={'12'}
			viewBox={'0 0 12 12'}
			fill={'none'}
			xmlns={'http://www.w3.org/2000/svg'}
		>
			<g clipPath={'url(#clip0_2013_717)'}>
				<path
					d={'M4 5L1 8L4 11'}
					stroke={'#9D9D9D'}
					strokeWidth={'1.5'}
					strokeLinecap={'round'}
					strokeLinejoin={'round'}
				/>
				<path
					d={'M6 1H9C10.1046 1 11 1.89543 11 3V6C11 7.10457 10.1046 8 9 8H2'}
					stroke={'#9D9D9D'}
					strokeWidth={'1.5'}
					strokeLinecap={'round'}
					strokeLinejoin={'round'}
				/>
			</g>
			<defs>
				<clipPath id={'clip0_2013_717'}>
					<rect width={'12'} height={'12'} fill={'white'} />
				</clipPath>
			</defs>
		</svg>
	);
}
