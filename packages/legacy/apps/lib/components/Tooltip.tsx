import {cl} from '@lib/utils';
import type {FC, ReactElement} from 'react';
import {useRef, useState} from 'react';
import {createPortal} from 'react-dom';

// Created as .tooltip & .tooltiptext can be lower in DOM and not render on top of other elements.
// Use this when tooltip is not in the same component as the trigger.

export const Tooltip: FC<{
	className?: string;
	children: ReactElement;
	tooltip: string | ReactElement;
}> = ({children, tooltip, className}) => {
	const [isHovered, set_isHovered] = useState(false);
	const [tooltipPosition, set_tooltipPosition] = useState({x: 0, y: 0});
	const triggerRef = useRef<HTMLDivElement>(null);

	const handleMouseEnter = (): void => {
		if (triggerRef.current) {
			const rect = triggerRef.current.getBoundingClientRect();
			set_tooltipPosition({
				x: rect.left + rect.width / 2,
				y: rect.bottom + 8
			});
			set_isHovered(true);
		}
	};

	const handleMouseLeave = (): void => set_isHovered(false);

	return (
		<div
			ref={triggerRef}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
			className={cl('flex w-fit items-center justify-end gap-4 md:justify-center relative h-6', className)}
		>
			{children}

			{isHovered &&
				typeof window !== 'undefined' &&
				createPortal(
					<div
						className={'pointer-events-none fixed z-[9999]'}
						style={{
							left: tooltipPosition.x,
							top: tooltipPosition.y,
							transform: 'translateX(-50%)',
							width: '15rem'
						}}
					>
						{tooltip}
					</div>,
					document.body
				)}
		</div>
	);
};
