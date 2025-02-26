import {cl} from '@builtbymom/web3/utils';

import type {ReactElement, ReactNode} from 'react';

type TProps = {
	children: ReactNode;
	content: string;
	className?: string;
	tooltipClassName?: string;
};

export function LegendTooltip({children, content, className = '', tooltipClassName = ''}: TProps): ReactElement {
	return (
		<div className={cl('relative tooltip inline-block', className)}>
			{children}
			<span
				suppressHydrationWarning
				className={'tooltiptext pointer-events-none bottom-full mb-1 whitespace-normal text-center'}>
				<div
					className={cl(
						'w-fit max-w-xs border border-neutral-300 bg-neutral-100 p-2 px-4 text-sm text-neutral-900',
						tooltipClassName
					)}>
					{content}
				</div>
			</span>
		</div>
	);
}
