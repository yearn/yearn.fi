import type {ReactElement} from 'react';

function IconArrowRight(props: React.SVGProps<SVGSVGElement>): ReactElement {
	return (
		<svg
			{...props}
			width={'25'}
			height={'16'}
			viewBox={'0 0 25 16'}
			fill={'none'}
			xmlns={'http://www.w3.org/2000/svg'}>
			<path d={'M24.7071 8.70711C25.0976 8.31658 25.0976 7.68342 24.7071 7.29289L18.3431 0.928932C17.9526 0.538408 17.3195 0.538408 16.9289 0.928932C16.5384 1.31946 16.5384 1.95262 16.9289 2.34315L22.5858 8L16.9289 13.6569C16.5384 14.0474 16.5384 14.6805 16.9289 15.0711C17.3195 15.4616 17.9526 15.4616 18.3431 15.0711L24.7071 8.70711ZM0 9H24V7H0V9Z'} fill={'currentcolor'}/>
		</svg>
	);
}

export default IconArrowRight;
