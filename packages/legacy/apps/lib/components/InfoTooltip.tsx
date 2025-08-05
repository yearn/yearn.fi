import {IconQuestion} from '@lib/icons/IconQuestion'
import {cl} from '@lib/utils'

import type {ReactElement} from 'react'

type TProps = {
	text: string | number
	size: 'sm' | 'md'
	className?: string
	iconClassName?: string
}

const getStyle = (
	size: TProps['size']
): {
	iconStyle: string
	tooltipStyle: string
} => {
	if (size === 'sm') {
		return {
			iconStyle: 'md:h-3 md:w-3 md:top-0',
			tooltipStyle: 'p-1 px-2 text-xs'
		}
	}

	return {
		iconStyle: 'md:h-4 md:w-4 md:top-1',
		tooltipStyle: 'p-2 px-4 text-sm'
	}
}

export const InfoTooltip = ({text, size, iconClassName, className}: TProps): ReactElement => {
	const {iconStyle, tooltipStyle} = getStyle(size)

	return (
		<sup className={'tooltip font-light transition-opacity'}>
			<IconQuestion className={cl('absolute h-3 w-3 md:-right-4 -right-3 top-0', iconStyle, iconClassName)} />
			<span suppressHydrationWarning className={cl('tooltiptext bottom-full mb-1', className)}>
				<div
					className={cl(
						'w-fit border border-neutral-300 bg-neutral-100 text-center text-neutral-900',
						tooltipStyle
					)}>
					{text}
				</div>
			</span>
		</sup>
	)
}
