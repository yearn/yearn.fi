import React, {ReactElement} from 'react';

function	ArrowDown(props: React.SVGProps<SVGSVGElement>): ReactElement {
	return (
		<svg
			{...props}
			className={'text-neutral-900'}
			width={'16'}
			height={'49'}
			viewBox={'0 0 16 49'}
			fill={'none'}
			xmlns={'http://www.w3.org/2000/svg'}>
			<path d={'M7.29289 48.7071C7.68342 49.0976 8.31658 49.0976 8.7071 48.7071L15.0711 42.3431C15.4616 41.9526 15.4616 41.3195 15.0711 40.9289C14.6805 40.5384 14.0474 40.5384 13.6569 40.9289L8 46.5858L2.34314 40.9289C1.95262 40.5384 1.31945 40.5384 0.92893 40.9289C0.538406 41.3195 0.538406 41.9526 0.92893 42.3431L7.29289 48.7071ZM7 -4.37114e-08L7 48L9 48L9 4.37114e-08L7 -4.37114e-08Z'} fill={'currentcolor'}/>
		</svg>
	);
}

export default ArrowDown;
