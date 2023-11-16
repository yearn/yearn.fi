import {cl} from '@yearn-finance/web-lib/utils/cl';

import type {ReactElement} from 'react';

type TProps = {
	text: string | number;
	size: 'sm' | 'md';
};

const getStyle = (
	size: TProps['size']
): {
	iStyle: string;
	tooltipStyle: string;
} => {
	if (size === 'sm') {
		return {
			iStyle: 'md:text-xs text-xxs pl-1',
			tooltipStyle: 'p-1 px-2 text-xs'
		};
	}

	return {
		iStyle: 'md:text-md text-sm pl-2',
		tooltipStyle: 'p-2 px-4 text-sm'
	};
};

export const InfoTooltip = ({text, size}: TProps): ReactElement => {
	const {iStyle, tooltipStyle} = getStyle(size);

	return (
		<sup
			className={cl(
				'tooltip underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600 font-light',
				iStyle
			)}>
			<span
				suppressHydrationWarning
				className={'tooltiptext bottom-full mb-1'}>
				<div
					className={cl(
						'w-fit border border-neutral-300 bg-neutral-100 text-center text-neutral-900',
						tooltipStyle
					)}>
					{text}
				</div>
			</span>
			{'(i)'}
		</sup>
	);
};
