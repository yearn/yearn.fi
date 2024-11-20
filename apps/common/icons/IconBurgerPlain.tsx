import type {ReactElement} from 'react';

export function IconBurgerPlain(props: React.SVGProps<SVGSVGElement>): ReactElement {
	return (
		<svg
			{...props}
			width={'24'}
			height={'24'}
			viewBox={'0 0 24 24'}
			fill={'none'}
			xmlns={'http://www.w3.org/2000/svg'}>
			<rect
				x={'2'}
				y={'18'}
				width={'20'}
				height={'2'}
				fill={'white'}
			/>
			<rect
				x={'2'}
				y={'11'}
				width={'20'}
				height={'2'}
				fill={'white'}
			/>
			<rect
				x={'2'}
				y={'4'}
				width={'20'}
				height={'2'}
				fill={'white'}
			/>
		</svg>
	);
}
