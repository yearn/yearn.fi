import type {ReactElement} from 'react';

export function IconLock(props: React.SVGProps<SVGSVGElement>): ReactElement {
	return (
		<svg
			{...props}
			width={'16'}
			height={'18'}
			viewBox={'0 0 16 18'}
			fill={'none'}
			xmlns={'http://www.w3.org/2000/svg'}>
			<path
				d={
					'M13.5998 8.2002H2.3998C1.51615 8.2002 0.799805 8.91654 0.799805 9.8002V15.4002C0.799805 16.2839 1.51615 17.0002 2.3998 17.0002H13.5998C14.4835 17.0002 15.1998 16.2839 15.1998 15.4002V9.8002C15.1998 8.91654 14.4835 8.2002 13.5998 8.2002Z'
				}
				stroke={'currentcolor'}
				strokeWidth={'1.5'}
				strokeLinecap={'round'}
				strokeLinejoin={'round'}
			/>
			<path
				d={
					'M4 8.2V5C4 3.93913 4.42143 2.92172 5.17157 2.17157C5.92172 1.42143 6.93913 1 8 1C9.06087 1 10.0783 1.42143 10.8284 2.17157C11.5786 2.92172 12 3.93913 12 5V8.2'
				}
				stroke={'currentcolor'}
				strokeWidth={'1.5'}
				strokeLinecap={'round'}
				strokeLinejoin={'round'}
			/>
		</svg>
	);
}
