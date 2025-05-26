import type {ReactElement} from 'react';

export function IconTwitter(props: React.SVGProps<SVGSVGElement>): ReactElement {
	return (
		<svg
			{...props}
			width={'32'}
			height={'32'}
			viewBox={'0 0 32 32'}
			fill={'currentColor'}
			xmlns={'http://www.w3.org/2000/svg'}>
			<g clipPath={'url(#clip0_2811_22170)'}>
				<path
					fillRule={'evenodd'}
					clipRule={'evenodd'}
					d={
						'M15.9995 32C24.8361 32 31.9995 24.8366 31.9995 16C31.9995 7.16344 24.8361 0 15.9995 0C7.16296 0 -0.000488281 7.16344 -0.000488281 16C-0.000488281 24.8366 7.16296 32 15.9995 32ZM24.2296 8H21.3673L16.6506 13.1126L12.5726 8H6.66618L13.7234 16.7508L7.03479 24H9.89886L15.0611 18.4066L19.5727 24H25.3328L17.9762 14.7774L24.2296 8ZM21.9487 22.3754H20.3627L10.0088 9.53928H11.7108L21.9487 22.3754Z'
					}
					fill={'currentColor'}
				/>
			</g>
			<defs>
				<clipPath id={'clip0_2811_22170'}>
					<rect
						width={'32'}
						height={'32'}
						fill={'currentColor'}
					/>
				</clipPath>
			</defs>
		</svg>
	);
}
