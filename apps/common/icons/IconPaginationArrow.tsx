import React from 'react';

import type {ReactElement} from 'react';

function	IconPaginationArrow(props: React.SVGProps<SVGSVGElement>): ReactElement {
	return (
		<svg
			{...props}
			width={'10'}
			height={'16'}
			viewBox={'0 0 10 16'}
			fill={'none'}
			xmlns={'http://www.w3.org/2000/svg'}>
			<svg
				width={'10'}
				height={'16'}
				viewBox={'0 0 10 16'}
				fill={'none'}
				xmlns={'http://www.w3.org/2000/svg'}>
				<path d={'M8.33716 15.7511L0.340576 8.75503C0.123779 8.5646 -0.000732784 8.29019 -0.000732772 8.0021C-0.000732766 7.86343 0.0270993 7.73062 0.0793454 7.60757C0.137451 7.47085 0.226318 7.34683 0.340576 7.24917L8.34058 0.249175C8.44897 0.154448 8.57202 0.0870652 8.70142 0.0470261C8.73218 0.0382371 8.76343 0.029448 8.79517 0.0226121C8.83647 0.0157997 8.87987 0.00210427 8.92163 0.00210427C8.96069 -0.000825414 9.00024 0.00112771 9.03979 0.00308084C9.17017 0.00796366 9.29419 0.0382371 9.40747 0.0890184C9.52808 0.142729 9.64038 0.221831 9.73511 0.325346C9.76831 0.360503 9.79858 0.398589 9.82593 0.439604C9.86694 0.499175 9.90015 0.562651 9.92651 0.627104C9.97339 0.743315 9.99927 0.869292 9.99927 1.0021L9.99927 14.9992C9.99927 15.132 9.97339 15.258 9.92651 15.3742C9.91382 15.4054 9.89966 15.4357 9.88354 15.466C9.86645 15.4982 9.84741 15.5304 9.82593 15.5617C9.79858 15.6027 9.76831 15.6408 9.73511 15.6759C9.64038 15.7794 9.52808 15.8586 9.40747 15.9123C9.29419 15.963 9.17017 15.9933 9.03979 15.9982C8.97354 16.0015 8.90792 15.9974 8.84253 15.9865C8.79419 15.9796 8.74731 15.9679 8.70142 15.9543C8.64233 15.9357 8.58423 15.9113 8.52856 15.882C8.46265 15.8468 8.39917 15.8039 8.33716 15.7511Z'} fill={'currentColor'}/>
			</svg>

		</svg>
	);
}

export {IconPaginationArrow};
